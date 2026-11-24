import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import registrationRouter from './routes/registration.js';
import loginRouter from './routes/login.js';
import {
  initialiseRepository, refreshRepository, getSnapshot, repositoryStatus,
  listTripContexts, getTripContext, saveTripContext,
  listAlertReviews, getAlertReview, saveAlertReview,
  getSettings, saveSettings, getAudit
} from './repository.js';
import { AnalyticsEngine } from './analytics.js';
import { loadOrBuildPrecomputed, loadOrBuildDailySummaries } from './precomputed-cache.js';

const app = express();
app.use(cors({ origin: true, credentials: false }));
app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use('/api', registrationRouter);
app.use('/api', loginRouter);

let engine = null;
let dailySummaryCache = null;
async function rebuildEngine({ forcePrecompute = false } = {}) {
  const contexts = await listTripContexts();
  const settings = await getSettings();
  const snapshot = getSnapshot();
  engine = new AnalyticsEngine(snapshot, contexts, settings);

  const precomputed = await loadOrBuildPrecomputed(engine, snapshot, contexts, settings, { force: forcePrecompute });
  console.log(`Analytics averages: ${precomputed.rebuilt ? 'rebuilt once and saved' : 'loaded from saved precomputed cache'} (${precomputed.benchmarkCount} trip benchmarks${precomputed.elapsedMs ? ` in ${precomputed.elapsedMs} ms` : ''})`);

  // Precompute every completed operating day's Home dashboard once.
  // Date navigation then becomes an in-memory lookup and does not recalculate trips.
  dailySummaryCache = await loadOrBuildDailySummaries(engine, snapshot, contexts, settings, { force: forcePrecompute });
  console.log(`Daily dashboards: ${dailySummaryCache.rebuilt ? 'rebuilt once and saved' : 'loaded from saved cache'} (${dailySummaryCache.dateCount} operating dates${dailySummaryCache.elapsedMs ? ` in ${dailySummaryCache.elapsedMs} ms` : ''})`);

  engine.fleetSummary();
  return engine;
}
await initialiseRepository();
await rebuildEngine();

function e() { if (!engine) throw new Error('Analytics engine unavailable'); return engine; }
function asyncRoute(fn) { return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next); }

app.get('/api/health', (_req, res) => {
  const status = repositoryStatus();
  res.json({
    ok: true,
    service: 'Stellar Fuel Analytics API',
    featureVersion: 'distance-history-v4',
    ...status,
    fleet: e().fleetSummary(),
    analyticsCache: {
      ...e().precomputedStatus(),
      dailyPrecomputed: true,
      dailyDateCount: dailySummaryCache?.dateCount || 0,
      dailyCacheSource: dailySummaryCache?.source || null
    },
    time: new Date().toISOString()
  });
});

app.post('/api/admin/refresh-data', asyncRoute(async (_req, res) => {
  await refreshRepository();
  await rebuildEngine();
  res.json({ ok: true, ...repositoryStatus(), fleet: e().fleetSummary() });
}));

// Compatibility endpoints used by both the existing web/mobile prototype and the new analytics screens.
app.get('/api/vehicles', (req, res) => {
  const items = e().listVehicles({ search: String(req.query.search || ''), status: String(req.query.status || ''), limit: req.query.limit || 500 });
  const latestDaily = e().daily();
  const alertCounts = new Map();
  const latestByReg = new Map(latestDaily.trips.map(t => [t.registration, t]));
  for (const a of latestDaily.needsReview) alertCounts.set(a.registration, (alertCounts.get(a.registration) || 0) + 1);
  res.json(items.map(v => {
    const latest = latestByReg.get(v.registration);
    return {
      ...v,
      currentKmL: latest?.analysedKmL ?? v.currentKmL,
      currentRating: latest?.rating ?? v.currentRating,
      openAlerts: alertCounts.get(v.registration) || 0,
      benchmarkLow: null,
      benchmarkHigh: null
    };
  }));
});
app.get('/api/vehicles/:reg', (req, res) => {
  const v = e().vehicleSummary(req.params.reg.toUpperCase());
  if (!v) return res.status(404).json({ message: 'Vehicle not found' });
  res.json({ ...v, benchmarkLow: null, benchmarkHigh: null });
});
app.get('/api/vehicles/:reg/transactions', (req, res) => {
  const rows = e().tripsForVehicle(req.params.reg.toUpperCase(), { limit: req.query.limit || 100 });
  res.json(rows.map(x => ({ id: x.id, registration: x.registration, date: x.date, litres: x.litres || 0, distanceKm: x.kilometers, kmL: x.analysedKmL, location: x.destination || x.fillUpLocation || 'Unknown', cost: 0, source: 'Historical' })));
});
app.get('/api/transactions', (_req, res) => {
  const daily = e().daily();
  res.json(daily.trips.map(x => ({ id: x.id, registration: x.registration, date: x.date, litres: x.litres || 0, distanceKm: x.kilometers, kmL: x.analysedKmL, location: x.destination || x.fillUpLocation || 'Unknown', cost: 0, source: 'Historical' })));
});

function alertFromTrip(x) {
  const severity = x.rating === 'Poor' ? 'High' : x.rating === 'Data Warning' ? 'Data Warning' : 'Review';
  const reason = x.rating === 'Data Warning'
    ? (x.correction || 'Fuel record failed data-quality validation and is excluded from benchmarks')
    : `${x.rating} fuel performance: ${Math.abs(x.deviationPct || 0).toFixed(1)}% ${x.deviationPct < 0 ? 'below' : 'above'} ${x.benchmark?.scope || 'historical'} average`;
  return {
    id: `ALERT-${x.id}`,
    tripId: x.id,
    registration: x.registration,
    date: x.date,
    reason,
    severity,
    status: 'Open',
    kmL: x.analysedKmL,
    benchmark: x.benchmark ? `${x.benchmark.averageKmL.toFixed(2)} km/L · ${x.benchmark.scope}` : 'Insufficient clean history',
    driver: x.driverContext || 'Not confirmed',
    trailer: x.weight?.trailerRegistration || 'Trip trailer not confirmed',
    loadContext: x.weight?.applied ? `${Math.round((x.weight.averageGrossKg || 0) / 1000)} t average gross` : 'Exact trailer/payload not confirmed',
    rating: x.rating,
    deviationPct: x.deviationPct,
    confidenceScore: x.confidenceScore,
    destination: x.destination,
    explanations: x.explanations
  };
}
async function currentAlerts() {
  const daily = e().daily();
  const base = [...daily.needsReview, ...daily.dataWarnings].map(alertFromTrip);
  const reviews = await listAlertReviews();
  const map = new Map(reviews.map(r => [r.alertId, r]));
  return base.map(a => ({ ...a, ...(map.get(a.id) || {}) }));
}
app.get('/api/alerts', asyncRoute(async (_req, res) => res.json(await currentAlerts())));
app.get('/api/alerts/:id', asyncRoute(async (req, res) => {
  const alerts = await currentAlerts();
  const a = alerts.find(x => x.id === req.params.id);
  if (!a) return res.status(404).json({ message: 'Alert not found' });
  res.json(a);
}));
app.patch('/api/alerts/:id', asyncRoute(async (req, res) => {
  const allowed = ['Open', 'Investigating', 'Resolved'];
  const status = allowed.includes(req.body.status) ? req.body.status : 'Open';
  const comment = typeof req.body.comment === 'string' ? req.body.comment.trim() : '';
  await saveAlertReview(req.params.id, { status, comment });
  const alerts = await currentAlerts();
  res.json(alerts.find(x => x.id === req.params.id) || { id: req.params.id, status, comment });
}));

function emptyCounts() {
  return { poor: 0, review: 0, average: 0, good: 0, outstanding: 0, dataWarnings: 0 };
}

function cachedDateNavigation(selectedDate) {
  const dates = dailySummaryCache?.dates || [];
  const latestCompleteDate = dailySummaryCache?.latestCompleteDate || e().latestCompleteDate();
  if (!dates.length) return {
    selectedDate,
    previousDate: null,
    nextDate: null,
    minDate: null,
    maxDate: null,
    latestCompleteDate,
    hasData: false
  };

  const exact = dates.indexOf(selectedDate);
  if (exact >= 0) return {
    selectedDate,
    previousDate: exact > 0 ? dates[exact - 1] : null,
    nextDate: exact < dates.length - 1 ? dates[exact + 1] : null,
    minDate: dates[0],
    maxDate: dates.at(-1),
    latestCompleteDate,
    hasData: true
  };

  let previousDate = null;
  let nextDate = null;
  for (const d of dates) {
    if (d < selectedDate) previousDate = d;
    else if (d > selectedDate) { nextDate = d; break; }
  }
  return {
    selectedDate,
    previousDate,
    nextDate,
    minDate: dates[0],
    maxDate: dates.at(-1),
    latestCompleteDate,
    hasData: false
  };
}

app.get('/api/dashboard/summary', (req, res) => {
  const latest = dailySummaryCache?.latestCompleteDate || e().latestCompleteDate();
  const requestedDate = req.query.date ? String(req.query.date).slice(0, 10) : latest;
  const cached = dailySummaryCache?.summaries?.[requestedDate] || {
    date: requestedDate,
    totalTrips: 0,
    averageKmL: null,
    counts: emptyCounts(),
    needsReview: [],
    outstanding: [],
    dataWarnings: [],
    trips: []
  };

  res.json({
    ...cached,
    navigation: cachedDateNavigation(requestedDate),
    fleet: e().fleetSummary(),
    source: repositoryStatus(),
    analyticsCache: {
      ...e().precomputedStatus(),
      dailyPrecomputed: true,
      dailyDateCount: dailySummaryCache?.dateCount || 0,
      dailyCacheSource: dailySummaryCache?.source || null
    }
  });
});

app.get('/api/analytics/dates', (_req, res) => {
  res.json({
    dates: dailySummaryCache?.dates || [],
    latestCompleteDate: dailySummaryCache?.latestCompleteDate || e().latestCompleteDate()
  });
});

app.get('/api/dashboard', (req, res) => {
  const daily = e().daily(req.query.date ? String(req.query.date) : null);
  res.json({ ...daily, fleet: e().fleetSummary(), source: repositoryStatus() });
});
app.get('/api/analytics/daily', (req, res) => res.json(e().daily(req.query.date ? String(req.query.date) : null)));
app.get('/api/analytics/trips', (req, res) => {
  const registration = String(req.query.registration || '').toUpperCase();
  if (!registration) return res.status(400).json({ message: 'registration is required' });
  res.json(e().tripsForVehicle(registration, { destination: String(req.query.destination || ''), from: String(req.query.from || ''), to: String(req.query.to || ''), limit: req.query.limit || 200 }));
});
app.get('/api/analytics/trips/:id', asyncRoute(async (req, res) => {
  const trip = e().tripById(req.params.id);
  if (!trip) return res.status(404).json({ message: 'Trip not found' });
  const analysis = e().analyseTrip(trip);
  const recentFuelHistory = e().recentFuelHistory(trip.assetId, { upToDate: trip.date, currentTripId: trip.consumptionId, limit: 15 });
  res.json({ ...analysis, recentFuelHistory });
}));
app.get('/api/analytics/vehicles/:reg', (req, res) => {
  const reg = req.params.reg.toUpperCase();
  const vehicle = e().vehicleSummary(reg);
  if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });
  const trips = e().tripsForVehicle(reg, { limit: Number(req.query.limit || 60) });
  res.json({ vehicle, destinations: e().destinationsForVehicle(reg), trips });
});
app.get('/api/analytics/vehicles/:reg/destinations', (req, res) => res.json(e().destinationsForVehicle(req.params.reg.toUpperCase())));
app.get('/api/analytics/vehicles/:reg/fuel-history', (req, res) => {
  const reg = req.params.reg.toUpperCase();
  const vehicle = e().vehicleSummary(reg, false);
  if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });
  res.json(e().recentFuelHistory(reg, { upToDate: String(req.query.to || ''), limit: req.query.limit || 15 }));
});
app.get('/api/trailers', (req, res) => res.json(e().listTrailers({ search: String(req.query.search || ''), limit: req.query.limit || 500 })));

app.get('/api/trips/:id/context', asyncRoute(async (req, res) => res.json(await getTripContext(req.params.id) || {})));
app.put('/api/trips/:id/context', asyncRoute(async (req, res) => {
  const allowed = ['trailerRegistration','productName','truckTareKg','trailerTareKg','outboundProductKg','returnProductKg','loadedDistancePct','referenceGrossKg','notes','confirmed','evidenceSource','sourceReference'];
  const context = {};
  for (const k of allowed) if (req.body[k] !== undefined) context[k] = req.body[k];
  for (const k of ['truckTareKg','trailerTareKg','outboundProductKg','returnProductKg','loadedDistancePct','referenceGrossKg']) {
    if (context[k] !== undefined && (!Number.isFinite(Number(context[k])) || Number(context[k]) < 0)) return res.status(400).json({ message: `${k} must be a non-negative number` });
    if (context[k] !== undefined) context[k] = Number(context[k]);
  }
  if (context.loadedDistancePct != null && context.loadedDistancePct > 100) return res.status(400).json({ message: 'loadedDistancePct must be between 0 and 100' });
  const sourceTrip = e().tripById(req.params.id);
  const enrichedContext = {
    ...context,
    registration: sourceTrip?.assetId || null,
    tripDate: sourceTrip?.date || null,
    loadingInstructionNo: sourceTrip?.loadingInstructionNo || null,
    destination: sourceTrip?.destination || null,
    routeMatchConfidence: sourceTrip?.matchConfidence || 'none',
    linkMethod: context.confirmed === true ? 'verified_trip_context' : 'manual_or_estimated_trip_context'
  };
  await saveTripContext(req.params.id, enrichedContext);
  await rebuildEngine({ forcePrecompute: true });
  const trip = e().tripById(req.params.id);
  res.json(trip ? e().analyseTrip(trip) : enrichedContext);
}));

app.get('/api/settings/analytics', asyncRoute(async (_req, res) => res.json(await getSettings())));
app.patch('/api/settings/analytics', asyncRoute(async (req, res) => {
  const updated = await saveSettings(req.body || {});
  await rebuildEngine({ forcePrecompute: true });
  res.json(updated);
}));
app.get('/api/audit', asyncRoute(async (_req, res) => res.json(await getAudit())));
app.get('/api/reports/summary', (req, res) => {
  const daily = e().daily(req.query.date ? String(req.query.date) : null);
  res.json({ vehicles: e().fleetSummary().activeTrucks, transactions: daily.totalTrips, activeAlerts: daily.needsReview.length + daily.dataWarnings.length, highAlerts: daily.counts.poor, outstanding: daily.counts.outstanding, date: daily.date });
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

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: 'The API could not complete this request.', detail: process.env.NODE_ENV === 'development' ? err.message : undefined });
});
app.use((_req, res) => res.status(404).json({ message: 'Endpoint not found' }));

const port = Number(process.env.PORT || 3000);
app.listen(port, '0.0.0.0', () => {
  console.log(`Stellar Fuel Analytics API running on http://localhost:${port}/api`);
  console.log(`Data source: ${repositoryStatus().source}`);
});
