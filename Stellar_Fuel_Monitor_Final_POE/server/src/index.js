import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import fs from 'fs';
import path from 'path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'url';
import registrationRouter from './routes/registration.js';
import loginRouter from './routes/login.js';
import {
  initialiseRepository, refreshRepository, getSnapshot, repositoryStatus,
  listTripContexts, getTripContext, saveTripContext,
  listAlertReviews, getAlertReview, saveAlertReview,
  getSettings, saveSettings, getAudit,
  registerDeviceToken, removeDeviceToken, listDeviceTokens,
  saveEvidenceRecord, listEvidenceRecords, getEvidenceRecord, deleteEvidenceRecord,
  listWatchlistItems, saveWatchlistItem, deleteWatchlistItem
} from './repository.js';
import { AnalyticsEngine } from './analytics.js';
import { CycleAnalyticsEngine } from './cycle-analytics.js';
import { loadOrBuildPrecomputed, loadOrBuildDailySummaries } from './precomputed-cache.js';
import { getGoogleRoadBenchmark, googleRoutesConfigured } from './google-routes.js';
import { alertFromTrip } from './alerts.js';
import { apiLimiter, authLimiter, uploadLimiter, pushTriggerLimiter, protectedWhenEnabled, securityAudit } from './security/middleware.js';
import { uploadEvidenceBlob, downloadEvidenceBlob, deleteEvidenceBlob, blobStorageStatus } from './blob-storage.js';
import { decodeEvidence } from './evidence-validation.js';
import { pushStatus, sendPushToTokens } from './notifications.js';

const app = express();
const allowedOrigins = String(process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:4200,http://127.0.0.1:4200').split(',').map(x => x.trim()).filter(Boolean);
app.disable('x-powered-by');
app.set('trust proxy', Number(process.env.TRUST_PROXY || 0));
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin(origin, cb) { if (!origin || allowedOrigins.includes(origin)) return cb(null, true); return cb(new Error('Origin not allowed by CORS')); }, credentials: false, methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] }));
app.use(express.json({ limit: '8mb' }));
app.use((req, _res, next) => { const clean = value => typeof value === 'string' ? value.replace(/[\u0000-\u001F\u007F]/g, '').trim() : value; if (req.body && typeof req.body === 'object') for (const k of Object.keys(req.body)) { if (['__proto__','prototype','constructor'].includes(k)) delete req.body[k]; else req.body[k] = clean(req.body[k]); } next(); });
app.use('/api', apiLimiter);
app.use('/api', securityAudit);
app.use('/api/login', authLimiter);
app.use('/api/register', authLimiter);
app.use('/api', registrationRouter);
app.use('/api', loginRouter);

let engine = null;
let cycleEngine = null;
let dailySummaryCache = null;
let alertReviewCache = new Map();
let tripCoreCache = new Map();
let tripDetailCache = new Map();
let tripWarmupStatus = { ready: false, warmedTrips: 0, warmedDates: 0, elapsedMs: 0 };

function buildTripCore(id) {
  if (!id) return null;
  if (tripCoreCache.has(id)) return tripCoreCache.get(id);
  let result = null;
  if (String(id).startsWith('cycle_')) result = cycleEngine?.analyseById(id) || null;
  else {
    const trip = engine?.tripById(id);
    if (!trip) return null;
    result = engine.analyseTrip(trip);
  }
  if (!result) return null;
  if (tripCoreCache.size > 10000) tripCoreCache.clear();
  tripCoreCache.set(id, result);
  return result;
}

function buildTripHistory(id) {
  if (String(id || '').startsWith('cycle_')) {
    const cycle = cycleEngine?.cycleById(id);
    return cycle ? cycleEngine.cycleHistory(cycle, 50) : null;
  }
  const trip = engine?.tripById(id);
  if (!trip) return null;
  return engine.recentFuelHistory(trip.assetId, {
    upToDate: trip.date,
    currentTripId: trip.consumptionId,
    limit: 15
  });
}

function buildTripDetail(id) {
  if (!id) return null;
  if (tripDetailCache.has(id)) return tripDetailCache.get(id);
  const result = String(id).startsWith('cycle_')
    ? cycleEngine?.detail(id)
    : (() => {
        const core = buildTripCore(id);
        if (!core) return null;
        return { ...core, recentFuelHistory: buildTripHistory(id) };
      })();
  if (!result) return null;
  if (tripDetailCache.size > 10000) tripDetailCache.clear();
  tripDetailCache.set(id, result);
  return result;
}

function warmRecentTripDetails() {
  const started = Date.now();
  const warmDate = cycleEngine?.latestCompleteDate?.() || dailySummaryCache?.latestCompleteDate || engine?.latestCompleteDate?.();
  let warmedTrips = 0;
  let sampleTripId = null;
  tripWarmupStatus = { ready: false, warmedTrips: 0, warmedDates: warmDate ? 1 : 0, elapsedMs: 0, sampleTripId: null };

  // Only warm the latest complete operating day. The benchmark and route profiles are
  // already precomputed, so a core analysis is cheap; full-year warmups just waste time.
  if (warmDate) {
    const rows = cycleEngine?.dayCycleList(warmDate) || engine.dayTripList(warmDate) || [];
    for (const row of rows) {
      if (!row?.id) continue;
      sampleTripId ||= row.id;
      if (buildTripCore(row.id)) warmedTrips++;
    }
  }

  tripWarmupStatus = { ready: true, warmedTrips, warmedDates: warmDate ? 1 : 0, elapsedMs: Date.now()-started, sampleTripId };
  console.log(`Presentation warmup: ${warmedTrips} latest-day trip cores in ${tripWarmupStatus.elapsedMs} ms`);
}


async function rebuildEngine({ forcePrecompute = false } = {}) {
  const [contexts, settings, alertReviews] = await Promise.all([listTripContexts(), getSettings(), listAlertReviews()]);
  alertReviewCache = new Map((alertReviews || []).map(r => [r.alertId, r]));
  const snapshot = getSnapshot();
  engine = new AnalyticsEngine(snapshot, contexts, settings);

  const precomputed = await loadOrBuildPrecomputed(engine, snapshot, contexts, settings, { force: forcePrecompute });
  console.log(`Analytics averages: ${precomputed.rebuilt ? 'rebuilt once and saved' : 'loaded from saved precomputed cache'} (${precomputed.benchmarkCount} trip benchmarks${precomputed.elapsedMs ? ` in ${precomputed.elapsedMs} ms` : ''})`);

  // Precompute every completed operating day's Home dashboard once.
  // Date navigation then becomes an in-memory lookup and does not recalculate trips.
  dailySummaryCache = await loadOrBuildDailySummaries(engine, snapshot, contexts, settings, { force: forcePrecompute });
  console.log(`Legacy interval dashboards: ${dailySummaryCache.rebuilt ? 'rebuilt once and saved' : 'loaded from saved cache'} (${dailySummaryCache.dateCount} operating dates${dailySummaryCache.elapsedMs ? ` in ${dailySummaryCache.elapsedMs} ms` : ''})`);

  // V17: all Good/Poor performance screens use complete Stellar full-up -> route -> Stellar full-up cycles.
  // The old interval engine remains available only as source evidence and for raw fuel-history pages.
  cycleEngine = new CycleAnalyticsEngine(engine, contexts, settings);
  console.log(`Full-cycle analytics V20: ${cycleEngine.status().completedCycles} completed cycles; ${cycleEngine.status().benchmarkableCycles} benchmarkable; latest close ${cycleEngine.status().latestCycleDate || 'none'}`);

  engine.fleetSummary();

  tripCoreCache = new Map();
  tripDetailCache = new Map();

  // Warm lightweight core investigation results only.
  const warmDate = cycleEngine?.latestCompleteDate() || dailySummaryCache?.latestCompleteDate || engine.latestCompleteDate();
  if (warmDate) cycleEngine?.daily(warmDate);
  warmRecentTripDetails();

  return engine;
}
await initialiseRepository();
await rebuildEngine();

function e() { if (!engine) throw new Error('Analytics engine unavailable'); return engine; }
function c() { if (!cycleEngine) throw new Error('Full-cycle analytics unavailable'); return cycleEngine; }
function asyncRoute(fn) { return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next); }

app.get('/api/health', (_req, res) => {
  const status = repositoryStatus();
  res.json({
    ok: true,
    service: 'Stellar Fuel Analytics API',
    featureVersion: 'final-poe-v3',
    googleRoutes: { configured: googleRoutesConfigured(), mode: 'DRIVE road-route benchmark only' },
    loadCalculatorVersion: 'v20-model-route-weighted-cycle-engine',
    finalPoe: { blobStorage: blobStorageStatus(), pushNotifications: pushStatus(), offlineSync: 'android-sqlite-workmanager', languages: ['English','Afrikaans','isiZulu'] },
    ...status,
    fleet: e().fleetSummary(),
    fullCycleAnalytics: c().status(),
    analyticsCache: {
      ...e().precomputedStatus(),
      dailyPrecomputed: true,
      dailyDateCount: dailySummaryCache?.dateCount || 0,
      dailyCacheSource: dailySummaryCache?.source || null,
      tripDetailWarmup: tripWarmupStatus
    },
    time: new Date().toISOString()
  });
});

app.post('/api/admin/refresh-data', protectedWhenEnabled('Administrator'), asyncRoute(async (_req, res) => {
  await refreshRepository();
  await rebuildEngine();
  res.json({ ok: true, ...repositoryStatus(), fleet: e().fleetSummary() });
}));

// Compatibility endpoints used by both the existing web/mobile prototype and the new analytics screens.
app.get('/api/vehicles', (req, res) => {
  const items = c().listVehicles({ search: String(req.query.search || ''), status: String(req.query.status || ''), limit: req.query.limit || 500 });
  res.set('Cache-Control', 'private, max-age=60');
  res.json(items);
});

app.get('/api/vehicles/:reg', (req, res) => {
  const v = c().vehicleSummary(req.params.reg.toUpperCase());
  if (!v) return res.status(404).json({ message: 'Vehicle not found' });
  res.json({ ...v, benchmarkLow: null, benchmarkHigh: null });
});
app.get('/api/vehicles/:reg/transactions', (req, res) => {
  const rows = c().tripsForVehicle(req.params.reg.toUpperCase(), { limit: req.query.limit || 100 });
  res.json(rows.map(x => ({ id: x.id, registration: x.registration, date: x.date, litres: x.litres || 0, distanceKm: x.kilometers, kmL: x.analysedKmL, location: x.destination || x.fillUpLocation || 'Unknown', cost: 0, source: 'Historical' })));
});
function transactionFromTrip(x) {
  return {
    id: x.id,
    registration: x.registration,
    date: x.date,
    litres: x.litres || 0,
    distanceKm: x.kilometers,
    kmL: x.analysedKmL,
    location: x.fillUpLocation || x.destination || 'Unknown',
    fillUpLocation: x.fillUpLocation || null,
    destination: x.destination || null,
    startKm: x.startKm ?? null,
    endKm: x.endKm ?? null,
    // V17: raw fuel rows are source evidence only. Never expose an interval-level Good/Poor result.
    rating: null,
    expectedLitres: null,
    excessLitres: null,
    expectedDistanceKm: null,
    extraKm: null,
    cost: 0,
    source: 'Historical'
  };
}

app.get('/api/transactions', (req, res) => {
  const registration = String(req.query.registration || '').trim().toUpperCase();
  const date = String(req.query.date || '').slice(0, 10);
  const from = String(req.query.from || '').slice(0, 10);
  const to = String(req.query.to || '').slice(0, 10);
  const limit = Math.max(1, Math.min(1000, Number(req.query.limit || 500)));
  let rows;
  if (registration) {
    rows = e().tripsForVehicle(registration, { from, to, limit });
    if (date) rows = rows.filter(x => x.date === date);
  } else {
    rows = e().dayTripList(date || null).slice(0, limit);
  }
  res.set('Cache-Control', 'private, max-age=60');
  res.json(rows.map(transactionFromTrip));
});

async function currentAlerts(date = null) {
  const selectedDate = date || c().latestCompleteDate();
  const daily = c().daily(selectedDate);
  const sourceTrips = [...(daily.needsReview || []), ...(daily.dataWarnings || [])];
  const base = sourceTrips.map(alertFromTrip);
  return base.map(a => ({ ...a, ...(alertReviewCache.get(a.id) || {}) }));
}

app.get('/api/alerts', asyncRoute(async (req, res) => {
  const date = req.query.date ? String(req.query.date).slice(0, 10) : null;
  res.json(await currentAlerts(date));
}));
app.get('/api/alerts/:id', asyncRoute(async (req, res) => {
  const alertId = String(req.params.id || '');
  const tripId = alertId.startsWith('ALERT-') ? alertId.slice(6) : '';
  let a = null;
  if (tripId) {
    const sourceTrip = c().cycleById(tripId);
    if (sourceTrip) a = alertFromTrip(c().analyseCycle(sourceTrip));
  }
  if (!a) {
    const alerts = await currentAlerts();
    a = alerts.find(x => x.id === alertId) || null;
  }
  if (!a) return res.status(404).json({ message: 'Alert not found' });
  const review = alertReviewCache.get(alertId) || await getAlertReview(alertId);
  res.json({ ...a, ...(review || {}) });
}));
app.patch('/api/alerts/:id', asyncRoute(async (req, res) => {
  const allowed = ['Open', 'Investigating', 'Resolved'];
  const status = allowed.includes(req.body.status) ? req.body.status : 'Open';
  const comment = typeof req.body.comment === 'string' ? req.body.comment.trim() : '';
  await saveAlertReview(req.params.id, { status, comment });
  alertReviewCache.set(String(req.params.id), { alertId: String(req.params.id), status, comment });
  const alertId = String(req.params.id || '');
  const tripId = alertId.startsWith('ALERT-') ? alertId.slice(6) : '';
  const sourceTrip = tripId ? c().cycleById(tripId) : null;
  const base = sourceTrip ? alertFromTrip(c().analyseCycle(sourceTrip)) : { id: alertId };
  res.json({ ...base, id: alertId, status, comment });

  // Real-time Final POE notification. Notification failure must never roll back the saved review.
  if (pushStatus().configured) {
    listDeviceTokens().then(rows => pushToDevices(rows, {
      title: `Alert ${status}: ${base.registration || 'fleet record'}`,
      body: comment || base.reason || `A Stellar fuel alert was updated to ${status}.`,
      data: { alertId, tripId: base.tripId || '', registration: base.registration || '', status }
    })).catch(error => console.warn(`Push notification failed after alert update: ${error.message}`));
  }
}));

function emptyCounts() {
  return { poor: 0, review: 0, average: 0, good: 0, outstanding: 0, baseline: 0, dataWarnings: 0 };
}

function cachedDateNavigation(selectedDate) {
  return c().navigation(selectedDate);
}

app.get('/api/dashboard/summary', (req, res) => {
  const latest = c().latestCompleteDate();
  const requestedDate = req.query.date ? String(req.query.date).slice(0, 10) : latest;
  const daily = c().daily(requestedDate);
  res.json({
    ...daily,
    navigation: c().navigation(requestedDate),
    fleet: e().fleetSummary(),
    source: repositoryStatus(),
    fullCycleAnalytics: c().status(),
    analyticsCache: { enabled: true, source: 'memory-full-cycle-v20-model-route', benchmarkCount: c().status().benchmarkableCycles }
  });
});

app.get('/api/analytics/dates', (_req, res) => {
  res.json({ dates: c().availableDates(), latestCompleteDate: c().latestCompleteDate() });
});

app.get('/api/dashboard', (req, res) => {
  const daily = c().daily(req.query.date ? String(req.query.date) : null);
  res.json({ ...daily, fleet: e().fleetSummary(), source: repositoryStatus(), fullCycleAnalytics: c().status() });
});
app.get('/api/analytics/daily', (req, res) => res.json(c().daily(req.query.date ? String(req.query.date) : null)));
app.get('/api/analytics/trips', (req, res) => {
  const registration = String(req.query.registration || '').toUpperCase();
  if (!registration) return res.status(400).json({ message: 'registration is required' });
  res.json(c().tripsForVehicle(registration, { destination: String(req.query.destination || ''), from: String(req.query.from || ''), to: String(req.query.to || ''), limit: req.query.limit || 200 }));
});
app.get('/api/analytics/trips-list', (req, res) => {
  const registration = String(req.query.registration || '').trim().toUpperCase();
  if (!registration) return res.status(400).json({ message: 'registration is required' });
  res.json(c().cycleListPage(registration, {
    destination: String(req.query.destination || ''),
    from: String(req.query.from || ''),
    to: String(req.query.to || ''),
    limit: req.query.limit || 100,
    offset: req.query.offset || 0
  }));
});
app.get('/api/analytics/day-trips', (req, res) => {
  const date = req.query.date ? String(req.query.date).slice(0, 10) : null;
  res.json({ date: date || c().latestCompleteDate(), items: c().dayCycleList(date) });
});
app.get('/api/analytics/trips/:id/core', (req, res) => {
  const started = Date.now();
  const detail = buildTripCore(req.params.id);
  if (!detail) return res.status(404).json({ message: 'Trip not found' });
  res.set('Cache-Control', 'private, max-age=120');
  res.set('X-Stellar-Render-Ms', String(Date.now() - started));
  res.json(detail);
});

app.get('/api/analytics/trips/:id/recent-history', (req, res) => {
  const started = Date.now();
  const history = buildTripHistory(req.params.id);
  if (!history) return res.status(404).json({ message: 'Trip not found' });
  res.set('Cache-Control', 'private, max-age=120');
  res.set('X-Stellar-History-Ms', String(Date.now() - started));
  res.json(history);
});

// V16 restores the original working Trip Investigation contract: one request returns
// the complete investigation. The response is cached in memory after the first request,
// so repeated opens/back-navigation are effectively instant.
app.get('/api/analytics/trips/:id', asyncRoute(async (req, res) => {
  const started = Date.now();
  const detail = buildTripDetail(req.params.id);
  if (!detail) return res.status(404).json({ message: 'Trip not found' });
  let googleRoadBenchmark = { available: false, status: 'not-applicable', disclaimer: 'Google DRIVE is used only as a general road-route distance benchmark. It is not a guaranteed legal, permitted, safe or suitable heavy-truck route.' };
  const stops = Array.isArray(detail.destinationStops) ? detail.destinationStops.filter(Boolean) : [];
  const mixed = detail.mixedDestinations || stops.length > 1;
  if (!mixed && detail.destination) {
    const origin = process.env.GOOGLE_ROUTES_ORIGIN || detail.openingFillLocation || detail.startFullUpLocation || 'Stellar Transport, Johannesburg, South Africa';
    googleRoadBenchmark = await getGoogleRoadBenchmark({ origin, destination: detail.destination, actualDistanceKm: detail.kilometers, roundTrip: true });
  } else if (mixed) googleRoadBenchmark = { ...googleRoadBenchmark, status: 'multi-stop-cycle', disclaimer: googleRoadBenchmark.disclaimer + ' Multi-stop cycles are not reduced to a misleading single Google route.' };
  res.set('Cache-Control', 'private, max-age=120');
  res.set('X-Stellar-Trip-Mode', String(req.params.id).startsWith('cycle_') ? 'full-cycle-combined-v17' : 'legacy-interval-fallback');
  res.set('X-Stellar-Render-Ms', String(Date.now() - started));
  res.json({ ...detail, googleRoadBenchmark });
}));

app.get('/api/admin/warmup/status', protectedWhenEnabled('Administrator','Analyst'), (_req, res) => res.json({
  ok: true,
  ...tripWarmupStatus,
  cachedTripCores: tripCoreCache.size,
  cachedFullTrips: tripDetailCache.size
}));
app.get('/api/analytics/vehicles/:reg', (req, res) => {
  const reg = req.params.reg.toUpperCase();
  const vehicle = c().vehicleSummary(reg);
  if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });
  const limit = Math.max(20, Math.min(200, Number(req.query.limit || 60)));
  const trips = c().cycleListPage(reg, { limit, offset: 0 }).items;
  res.set('Cache-Control', 'private, max-age=60');
  res.json({ vehicle, destinations: c().destinationsForVehicle(reg), trips });
});
app.get('/api/analytics/vehicles/:reg/destinations', (req, res) => res.json(c().destinationsForVehicle(req.params.reg.toUpperCase())));
app.get('/api/analytics/vehicles/:reg/fuel-history', (req, res) => {
  const reg = req.params.reg.toUpperCase();
  const vehicle = e().vehicleSummary(reg, false);
  if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });

  const month = String(req.query.month || '').slice(0, 7);
  let fromDate = String(req.query.from || '').slice(0, 10);
  let toDate = String(req.query.to || '').slice(0, 10);
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [year, mon] = month.split('-').map(Number);
    const lastDay = new Date(Date.UTC(year, mon, 0)).getUTCDate();
    fromDate = `${month}-01`;
    toDate = `${month}-${String(lastDay).padStart(2, '0')}`;
  }
  const limit = Math.max(10, Math.min(500, Number(req.query.limit || (month ? 500 : 30))));
  const history = e().recentFuelHistory(reg, { fromDate, upToDate: toDate, limit });
  res.set('Cache-Control', 'private, max-age=60');
  res.json({
    ...history,
    registration: reg,
    month: month || (fromDate ? fromDate.slice(0, 7) : ''),
    fromDate: fromDate || null,
    toDate: toDate || null,
    vehicle
  });
});
app.get('/api/trailers', (req, res) => res.json(e().listTrailers({ search: String(req.query.search || ''), limit: req.query.limit || 500 })));

app.get('/api/trips/:id/context', asyncRoute(async (req, res) => res.json(await getTripContext(req.params.id) || {})));
app.put('/api/trips/:id/context', protectedWhenEnabled('Administrator','Analyst','Management'), asyncRoute(async (req, res) => {
  const allowed = ['trailerRegistration','productName','truckTareKg','trailerTareKg','outboundProductKg','returnProductKg','loadedDistancePct','referenceGrossKg','referencePayloadKg','massInputUnit','notes','confirmed','evidenceSource','sourceReference'];
  const context = {};
  for (const k of allowed) if (req.body[k] !== undefined) context[k] = req.body[k];
  for (const k of ['truckTareKg','trailerTareKg','outboundProductKg','returnProductKg','loadedDistancePct','referenceGrossKg','referencePayloadKg']) {
    if (context[k] !== undefined && (!Number.isFinite(Number(context[k])) || Number(context[k]) < 0)) return res.status(400).json({ message: `${k} must be a non-negative number` });
    if (context[k] !== undefined) context[k] = Number(context[k]);
  }
  if (context.loadedDistancePct != null && context.loadedDistancePct > 100) return res.status(400).json({ message: 'loadedDistancePct must be between 0 and 100' });
  if (context.massInputUnit !== undefined && !['kg','t'].includes(String(context.massInputUnit))) return res.status(400).json({ message: 'massInputUnit must be kg or t' });
  const sourceTrip = c().cycleById(req.params.id) || e().tripById(req.params.id);
  const enrichedContext = {
    ...context,
    registration: sourceTrip?.assetId || sourceTrip?.registration || null,
    tripDate: sourceTrip?.date || null,
    loadingInstructionNo: sourceTrip?.loadingInstructionNo || sourceTrip?.loadingInstructions?.[0]?.loadingInstructionNo || null,
    destination: sourceTrip?.destination || null,
    routeMatchConfidence: sourceTrip?.matchConfidence || sourceTrip?.destinationConfidence || 'none',
    linkMethod: context.confirmed === true ? 'verified_trip_context' : 'manual_or_estimated_trip_context'
  };
  await saveTripContext(req.params.id, enrichedContext);

  // V18.1: changing trailer/product context does not require rebuilding 12k+ fuel cycles.
  // Update only this cycle's context and invalidate the small dependent caches.
  cycleEngine?.updateContext(req.params.id, enrichedContext);
  if (engine?.contexts) engine.contexts.set(req.params.id, enrichedContext);
  if (engine?.analysisCache) engine.analysisCache.delete(req.params.id);
  tripCoreCache.delete(req.params.id);
  tripDetailCache.delete(req.params.id);

  const detail = buildTripDetail(req.params.id);
  if (!detail) return res.json(enrichedContext);
  res.set('X-Stellar-Recalculation', 'fast-context-only-v20');
  res.json(detail);
}));

app.get('/api/settings/analytics', asyncRoute(async (_req, res) => res.json(await getSettings())));
app.patch('/api/settings/analytics', protectedWhenEnabled('Administrator','Management'), asyncRoute(async (req, res) => {
  const updated = await saveSettings(req.body || {});
  await rebuildEngine({ forcePrecompute: true });
  res.json(updated);
}));
app.get('/api/audit', protectedWhenEnabled('Administrator','Management'), asyncRoute(async (_req, res) => res.json(await getAudit())));
app.get('/api/reports/summary', (req, res) => {
  const date = req.query.date ? String(req.query.date).slice(0,10) : c().latestCompleteDate();
  const daily = c().daily(date);
  res.json({ vehicles: e().fleetSummary().activeTrucks, transactions: daily.totalTrips, activeAlerts: (daily.needsReview?.length || 0) + (daily.dataWarnings?.length || 0), highAlerts: daily.counts?.poor || 0, outstanding: daily.counts?.outstanding || 0, date: daily.date });
});

app.post('/api/fuel-estimate', (req, res) => {
  const { truckWeight, trailerWeight, cargoWeight, returnCargoWeight = 0, loadedDistancePct = 50, distanceKm, baselineRate, weightPenalty } = req.body;
  const penalty = weightPenalty === undefined ? 0.6 : weightPenalty;
  const fields = { truckWeight, trailerWeight, cargoWeight, returnCargoWeight, loadedDistancePct, distanceKm, baselineRate, weightPenalty: penalty };
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value !== 'number' || Number.isNaN(value) || value < 0) return res.status(400).json({ message: `${key} must be a non-negative number` });
  }
  if (distanceKm === 0) return res.status(400).json({ message: 'distanceKm must be greater than 0' });
  if (loadedDistancePct > 100) return res.status(400).json({ message: 'loadedDistancePct must be 0–100' });
  const loadedFraction = loadedDistancePct / 100;
  const averageCargoWeight = cargoWeight * loadedFraction + returnCargoWeight * (1 - loadedFraction);
  const averageGrossTonnes = truckWeight + trailerWeight + averageCargoWeight;
  const adjustedRateLper100km = baselineRate + (averageGrossTonnes * penalty);
  const fuelLitres = (adjustedRateLper100km * distanceKm) / 100;
  res.json({ averageGrossTonnes, averageCargoWeight, adjustedRateLper100km, fuelLitres, inputs: fields, note: 'Prototype estimate. Calibrate weight penalty against telematics and actual load records before production.' });
});


// ---- Final POE: Firebase Cloud Messaging ----
const FCM_TOKEN_PATTERN = /^[\w:.-]{20,4096}$/;
const DEVICE_ID_PATTERN = /^[\w:.-]{1,200}$/;

// Sends to registered devices and deletes the registrations FCM reports as permanently dead.
async function pushToDevices(rows, message) {
  const result = await sendPushToTokens(rows.map(x => x.token), message);
  for (const token of result.invalidTokens) await removeDeviceToken({ token }).catch(() => {});
  if (result.invalidTokens.length) console.log(`FCM: removed ${result.invalidTokens.length} unregistered device token(s)`);
  return result;
}

app.post('/api/notifications/register', asyncRoute(async (req, res) => {
  const token = String(req.body?.token || '').trim();
  const deviceId = String(req.body?.deviceId || '').trim();
  const platform = String(req.body?.platform || 'android').trim().toLowerCase();
  if (!FCM_TOKEN_PATTERN.test(token)) return res.status(400).json({ message: 'A valid FCM token is required' });
  if (!DEVICE_ID_PATTERN.test(deviceId)) return res.status(400).json({ message: 'deviceId is required' });
  if (platform !== 'android') return res.status(400).json({ message: 'platform must be android' });
  await registerDeviceToken({
    token,
    deviceId,
    platform,
    userId: typeof req.body?.userId === 'string' ? req.body.userId.slice(0, 128) : null,
    email: typeof req.body?.email === 'string' ? req.body.email.slice(0, 320) : null
  });
  res.json({ ok: true, message: 'Push token registered' });
}));

app.post('/api/notifications/unregister', asyncRoute(async (req, res) => {
  const token = String(req.body?.token || '').trim();
  const deviceId = String(req.body?.deviceId || '').trim();
  // Without this guard an empty body would match (and delete) registrations with a blank deviceId.
  if (!token && !deviceId) return res.status(400).json({ message: 'token or deviceId is required' });
  const removed = await removeDeviceToken({ token, deviceId });
  res.json({ ok: true, message: `Removed ${removed} push registration(s)` });
}));

app.post('/api/notifications/test', pushTriggerLimiter, asyncRoute(async (req, res) => {
  if (!pushStatus().configured) return res.status(503).json({ message: 'Firebase server credentials are not configured' });
  const deviceId = String(req.body?.deviceId || '').trim();
  if (deviceId && !DEVICE_ID_PATTERN.test(deviceId)) return res.status(400).json({ message: 'deviceId is not valid' });
  const rows = await listDeviceTokens({ deviceId });
  if (!rows.length) return res.status(404).json({ message: 'No registered device token was found for this phone' });
  const result = await pushToDevices(rows, {
    title: 'Stellar real-time notification test',
    body: 'Firebase Cloud Messaging is connected to the Final POE app.',
    data: { type: 'test', createdAt: new Date().toISOString() }
  });
  if (result.failed) console.warn(`FCM test push: ${result.failed} failed - ${result.errors.join(' | ')}`);
  res.json({ ok: result.sent > 0, message: `Sent ${result.sent} test notification(s)`, sent: result.sent, failed: result.failed });
}));

// ---- Final POE: Azure Blob evidence vault + MongoDB metadata ----
app.get('/api/evidence', asyncRoute(async (req, res) => {
  res.json(await listEvidenceRecords({
    registration: String(req.query.registration || ''),
    tripId: String(req.query.tripId || '')
  }));
}));

app.post('/api/evidence', uploadLimiter, protectedWhenEnabled('Administrator','Analyst','Management'), asyncRoute(async (req, res) => {
  const registration = String(req.body?.registration || '').trim().toUpperCase();
  const tripId = String(req.body?.tripId || '').trim().slice(0, 200);
  const note = String(req.body?.note || '').trim().slice(0, 1000);
  if (!registration) return res.status(400).json({ message: 'registration is required' });
  if (!c().vehicleSummary(registration)) return res.status(404).json({ message: 'Vehicle registration was not found' });
  // Strict Base64, 5 MB limit and magic-byte check: the declared contentType must match the bytes.
  let evidence;
  try {
    evidence = decodeEvidence({ base64Data: req.body?.base64Data, contentType: req.body?.contentType || 'image/jpeg', fileName: req.body?.fileName });
  } catch (error) {
    return res.status(error.statusCode || 400).json({ message: error.message });
  }

  const storage = await uploadEvidenceBlob({ buffer: evidence.buffer, contentType: evidence.contentType, registration });
  let record;
  try {
    record = await saveEvidenceRecord({
      id: `EVD-${crypto.randomUUID()}`,
      registration,
      tripId: tripId || null,
      note: note || null,
      fileName: evidence.fileName,
      contentType: evidence.contentType,
      sizeBytes: evidence.buffer.length,
      sha256: evidence.sha256,
      blobName: storage.blobName,
      blobUrl: storage.blobUrl,
      storageProvider: storage.provider,
      uploadedAt: new Date()
    });
  } catch (error) {
    // Never leave an orphaned blob behind when the metadata write fails.
    await deleteEvidenceBlob({ blobName: storage.blobName, provider: storage.provider }).catch(() => {});
    throw error;
  }
  console.log(`Evidence ${record.id} stored for ${registration} (${record.contentType}, ${record.sizeBytes} bytes, ${record.storageProvider})`);
  res.status(201).json(record);
}));

// Streams the stored file through the API (the container stays private and the SAS never
// reaches the phone), e.g. for opening evidence during the demonstration.
app.get('/api/evidence/:id/file', asyncRoute(async (req, res) => {
  const record = await getEvidenceRecord(req.params.id);
  if (!record) return res.status(404).json({ message: 'Evidence record was not found' });
  const buffer = await downloadEvidenceBlob({ blobName: record.blobName, provider: record.storageProvider });
  res.set('Content-Type', record.contentType || 'application/octet-stream');
  res.set('Content-Disposition', `inline; filename="${String(record.fileName || 'evidence').replace(/"/g, '')}"`);
  res.set('Cache-Control', 'private, no-store');
  res.send(buffer);
}));

app.delete('/api/evidence/:id', protectedWhenEnabled('Administrator','Analyst','Management'), asyncRoute(async (req, res) => {
  const record = await getEvidenceRecord(req.params.id);
  if (!record) return res.status(404).json({ message: 'Evidence record was not found' });
  await deleteEvidenceBlob({ blobName: record.blobName, provider: record.storageProvider });
  await deleteEvidenceRecord(record.id);
  res.json({ ok: true, message: 'Evidence removed' });
}));

// ---- Final POE user-defined feature: fleet watchlist and investigation priorities ----
app.get('/api/watchlist', asyncRoute(async (_req, res) => {
  const rows = await listWatchlistItems();
  res.json(rows.map(row => {
    const vehicle = c().vehicleSummary(row.registration);
    return {
      ...row,
      currentKmL: vehicle?.currentKmL ?? null,
      currentRating: vehicle?.currentRating ?? null,
      openAlerts: vehicle?.openAlerts ?? 0,
      description: vehicle?.description || [vehicle?.manufacturer, vehicle?.model].filter(Boolean).join(' ') || null
    };
  }));
}));

app.post('/api/watchlist', protectedWhenEnabled('Administrator','Analyst','Management'), asyncRoute(async (req, res) => {
  const registration = String(req.body?.registration || '').trim().toUpperCase();
  if (!registration) return res.status(400).json({ message: 'registration is required' });
  if (!/^[A-Z0-9][A-Z0-9 _()-]{1,39}$/.test(registration)) return res.status(400).json({ message: 'registration is not valid' });
  if (req.body?.note != null && typeof req.body.note !== 'string') return res.status(400).json({ message: 'note must be text' });
  const vehicle = c().vehicleSummary(registration);
  if (!vehicle) return res.status(404).json({ message: 'Vehicle registration was not found' });
  const saved = await saveWatchlistItem(registration, {
    note: req.body?.note || '',
    priority: req.body?.priority || 'Monitor'
  });
  res.status(201).json({
    ...saved,
    currentKmL: vehicle.currentKmL ?? null,
    currentRating: vehicle.currentRating ?? null,
    openAlerts: vehicle.openAlerts ?? 0,
    description: vehicle.description || [vehicle.manufacturer, vehicle.model].filter(Boolean).join(' ') || null
  });
}));

app.delete('/api/watchlist/:registration', protectedWhenEnabled('Administrator','Analyst','Management'), asyncRoute(async (req, res) => {
  const registration = String(req.params.registration || '').trim().toUpperCase();
  const removed = await deleteWatchlistItem(registration);
  res.json({ ok: true, message: removed ? 'Watchlist item removed' : 'Watchlist item was already absent' });
}));


// PRESENTATION MODE: serve the pre-built Angular app from this same Express process.
// This removes ng serve, proxying and a second Node process from the live demo path.
if (String(process.env.SERVE_WEB || '') === '1') {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(here, '../../web/dist/stellar-fuel-monitor/browser'),
    path.resolve(here, '../../web/dist/stellar-fuel-monitor')
  ];
  const webRoot = candidates.find(p => fs.existsSync(path.join(p, 'index.html')));
  if (webRoot) {
    // Prototype/live-demo mode must never serve a stale Angular bundle after a hotfix.
    // The previous 1-hour cache could leave the browser running an older Trip Investigation
    // component even after the source had been fixed and rebuilt.
    app.use(express.static(webRoot, {
      maxAge: 0,
      etag: false,
      lastModified: false,
      index: false,
      setHeaders(res) {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
      }
    }));
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      res.sendFile(path.join(webRoot, 'index.html'));
    });
    console.log(`Presentation web build: ${webRoot}`);
  } else {
    console.warn('SERVE_WEB=1 but Angular dist/index.html was not found. Run the presentation installer build first.');
  }
}

app.use((err, _req, res, _next) => {
  console.error(err);
  const rawStatus = Number(err?.statusCode || 500);
  const status = rawStatus >= 400 && rawStatus <= 599 ? rawStatus : 500;
  const isDevelopment = process.env.NODE_ENV === 'development';
  // expose: set on deliberate, secret-free 5xx messages (e.g. "Azure Blob Storage is not configured").
  const message = status < 500 || isDevelopment || err?.expose === true
    ? (err?.message || 'The API could not complete this request.')
    : 'The API could not complete this request.';
  res.status(status).json({
    message,
    detail: isDevelopment ? err?.stack : undefined
  });
});
app.use((_req, res) => res.status(404).json({ message: 'Endpoint not found' }));

const port = Number(process.env.PORT || 3000);
app.listen(port, '0.0.0.0', () => {
  console.log(`Stellar Fuel Analytics API running on http://localhost:${port}/api`);
  console.log(`Data source: ${repositoryStatus().source}`);
});
