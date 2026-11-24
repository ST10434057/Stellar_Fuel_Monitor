/**
 * Offline acceptance-verification harness for the Stellar full-cycle analytics.
 *
 * PURPOSE
 * -------
 * Everything in here is a DELIBERATELY INDEPENDENT re-derivation of the rules the
 * production engine implements. It re-reads the raw cycle inputs and recomputes
 * km/L, benchmarks, deviation, rating and alert severity from the written Stellar
 * specification, so the results can be diffed against what
 * `server/src/cycle-analytics.js` actually produced.
 *
 * It therefore must NOT call the engine's own maths helpers (summariseBenchmark,
 * benchmarkFor, weightedFuelEfficiency, analyseCycle, ...). Importing them would
 * make the comparison circular and prove nothing.
 *
 * READ-ONLY GUARANTEE
 * -------------------
 * `precomputed-cache.js` and the repository write paths (saveTripContext,
 * saveAlertReview, saveSettings) are never imported. CycleAnalyticsEngine reads
 * only rawEngine.prepared / rawEngine.assets, so the precomputed benchmark and
 * daily-summary caches are not needed and are never rebuilt. dataFileFingerprints()
 * lets the CLI prove nothing under server/data/ changed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AnalyticsEngine } from '../../src/analytics.js';
import { CycleAnalyticsEngine } from '../../src/cycle-analytics.js';

const here = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.join(here, '..', '..', 'data');

/* ------------------------------------------------------------------ boot --- */

/**
 * Boots the same engine pair index.js builds, minus Express and minus the two
 * precomputed-cache loaders (which serve the legacy engine only and write to disk).
 * MongoDB is attempted first exactly as in production; it fails in ~2.5s and
 * initialiseRepository falls back to the packaged Stellar dataset cache.
 */
export async function bootOffline() {
  const repo = await import('../../src/repository.js');
  await repo.initialiseRepository();
  const snapshot = repo.getSnapshot();
  const [contexts, settings] = await Promise.all([repo.listTripContexts(), repo.getSettings()]);
  const rawEngine = new AnalyticsEngine(snapshot, contexts, settings);
  const cycleEngine = new CycleAnalyticsEngine(rawEngine, contexts, settings);
  return { snapshot, contexts, settings, rawEngine, cycleEngine, source: repo.repositoryStatus() };
}

export function dataFileFingerprints() {
  const out = {};
  for (const name of fs.readdirSync(DATA_DIR).sort()) {
    const full = path.join(DATA_DIR, name);
    const stat = fs.statSync(full);
    if (stat.isFile()) out[name] = stat.size + ':' + stat.mtimeMs;
  }
  return out;
}

/* ----------------------------------------------------- independent maths --- */

const num = v => { const x = Number(v); return Number.isFinite(x) ? x : null; };

export function medianOf(values) {
  const a = values.filter(Number.isFinite).slice().sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

/** UTC month arithmetic, matching the benchmark window cutoff. */
export function monthsBefore(dateString, months) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateString || ''));
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  d.setUTCMonth(d.getUTCMonth() - Math.max(0, Number(months) || 0));
  return d.toISOString().slice(0, 10);
}

/**
 * The full-to-full rule, re-derived from the cycle's own raw rows.
 *
 * includedRows is the slice AFTER the opening Stellar full-up through and
 * including the closing one, so the opening fill litres are excluded by
 * construction and every intermediate top-up is counted. Distance prefers the
 * opening-to-closing odometer span whenever that is positive.
 */
export function recomputeCycleFuel(cycle) {
  const rows = cycle.includedRows || [];
  const openOdo = num(cycle.openingRow?.endKm ?? cycle.openingRow?.fuelInterval?.nextOdometer);
  const closeOdo = num(cycle.closingRow?.endKm ?? cycle.closingRow?.fuelInterval?.nextOdometer);
  const odometerKm = openOdo != null && closeOdo != null ? closeOdo - openOdo : null;
  const segmentKm = rows.reduce((s, r) => s + Math.max(0, num(r.kilometers ?? r.fuelInterval?.distanceKm) ?? 0), 0);
  const km = odometerKm != null && odometerKm > 0 ? odometerKm : segmentKm;
  const litres = rows.reduce((s, r) => s + Math.max(0, num(r.litres ?? r.fuelInterval?.fuelLoadedLitres) ?? 0), 0);
  const openingLitres = Math.max(0, num(cycle.openingRow?.litres ?? cycle.openingRow?.fuelInterval?.fuelLoadedLitres) ?? 0);
  return {
    km, litres, odometerKm, segmentKm, openingLitres,
    countedRows: rows.length,
    kmL: km > 0 && litres > 0 ? km / litres : null
  };
}

/** Strictly-prior ordering: earlier date, or same date with a lower closing odometer. */
export function isStrictlyPrior(candidate, target) {
  if (!candidate || !target || candidate.id === target.id) return false;
  if (String(candidate.date) < String(target.date)) return true;
  if (String(candidate.date) > String(target.date)) return false;
  return (candidate.closingOdometer || 0) < (target.closingOdometer || 0);
}

/**
 * Distance/fuel-weighted historical benchmark: total km across the pool divided by
 * total litres across the pool - NOT the mean of the per-cycle km/L values.
 */
export function recomputeBenchmark(pool, { minSamples, minTrucks }) {
  const rows = (pool || []).filter(c =>
    c.validForBenchmark && Number.isFinite(c.analysedKmL) && c.kilometers > 0 && c.litres > 0);
  const trucks = new Set(rows.map(c => c.assetId).filter(Boolean));
  if (rows.length < minSamples || trucks.size < minTrucks) return null;
  const totalKm = rows.reduce((s, c) => s + Number(c.kilometers), 0);
  const totalLitres = rows.reduce((s, c) => s + Number(c.litres), 0);
  const averageKmL = totalKm > 0 && totalLitres > 0 ? totalKm / totalLitres : null;
  if (!(averageKmL > 0)) return null;
  const values = rows.map(c => c.analysedKmL);
  const dates = rows.map(c => String(c.date || '')).filter(Boolean).sort();
  return {
    averageKmL,
    medianKmL: medianOf(values),
    sampleSize: rows.length,
    distinctTruckCount: trucks.size,
    totalKm, totalLitres,
    historyStartDate: dates[0] || null,
    historyEndDate: dates.at(-1) || null,
    confidence: rows.length >= 20 && trucks.size >= 4 ? 'high' : rows.length >= 8 ? 'medium' : 'low',
    poolIds: rows.map(c => c.id)
  };
}

/** Group cycles ourselves rather than reusing the engine byModel/byAsset maps. */
export function buildIndex(cycles) {
  const byModel = new Map(), byAsset = new Map();
  for (const c of cycles) {
    if (c.modelKey) { if (!byModel.has(c.modelKey)) byModel.set(c.modelKey, []); byModel.get(c.modelKey).push(c); }
    if (c.assetId) { if (!byAsset.has(c.assetId)) byAsset.set(c.assetId, []); byAsset.get(c.assetId).push(c); }
  }
  return { byModel, byAsset };
}

/** Selection order: pooled same-model/same-route first, exact-truck/same-route as fallback. */
export function recomputeSelectedBenchmark(cycle, index, settings) {
  if (!cycle.validForBenchmark || !cycle.routeKey) {
    return { benchmark: null, selection: 'baseline', modelBenchmark: null, truckBenchmark: null };
  }
  const cutoff = monthsBefore(cycle.date, settings.modelBenchmarkMonths);
  const inWindow = arr => (arr || []).filter(c =>
    c.validForBenchmark && c.routeKey === cycle.routeKey && isStrictlyPrior(c, cycle) &&
    (!cutoff || String(c.date || '') >= cutoff));

  const model = cycle.modelKey
    ? recomputeBenchmark(inWindow(index.byModel.get(cycle.modelKey)), {
        minSamples: settings.minFullCycleBenchmarkSamples,
        minTrucks: settings.minModelBenchmarkTrucks
      })
    : null;
  const truck = recomputeBenchmark(inWindow(index.byAsset.get(cycle.assetId)), {
    minSamples: settings.minFullCycleBenchmarkSamples,
    minTrucks: 1
  });

  if (model) return { benchmark: model, selection: 'model-route', modelBenchmark: model, truckBenchmark: truck };
  if (truck) return { benchmark: truck, selection: 'truck-route-fallback', modelBenchmark: null, truckBenchmark: truck };
  return { benchmark: null, selection: 'baseline', modelBenchmark: null, truckBenchmark: null };
}

export function classifyRating(deviationPct, settings) {
  if (deviationPct == null || !Number.isFinite(deviationPct)) return null;
  if (deviationPct <= Number(settings.poorDeviationPct)) return 'Poor';
  if (deviationPct <= Number(settings.reviewDeviationPct)) return 'Review';
  if (deviationPct >= Number(settings.outstandingDeviationPct)) return 'Outstanding';
  if (deviationPct >= Number(settings.goodDeviationPct)) return 'Good';
  return 'Average';
}

/** Mirrors alertFromTrip: three levels, no CRITICAL tier. */
export function severityForRating(rating) {
  return rating === 'Poor' ? 'High' : rating === 'Data Warning' ? 'Data Warning' : 'Review';
}

/** The whole chain for one cycle, independent end to end. */
export function recomputeAll(cycle, index, settings) {
  const fuel = recomputeCycleFuel(cycle);
  const picked = recomputeSelectedBenchmark(cycle, index, settings);
  const base = { ...fuel, ...picked };
  if (!cycle.validFuelCycle) {
    return { ...base, deviationPct: null, rating: 'Data Warning', severity: 'Data Warning' };
  }
  if (!picked.benchmark) {
    return { ...base, deviationPct: null, rating: 'Baseline', severity: severityForRating('Baseline') };
  }
  const expected = picked.benchmark.averageKmL;
  const deviationPct = ((fuel.kmL - expected) / expected) * 100;
  const rating = classifyRating(deviationPct, settings);
  return {
    ...base, deviationPct, rating, severity: severityForRating(rating),
    expectedLitres: fuel.km > 0 ? fuel.km / expected : null
  };
}

/* ---------------------------------------------------------- selection ----- */

/**
 * Deterministic representative sample. cycle.id is a sha1 of
 * registration|openingConsumptionId|closingConsumptionId, so it is a pure function
 * of the dataset and the same rows come back on every machine and every run.
 */
export function selectRepresentative(analyses, { perStratum = 3 } = {}) {
  const strata = new Map();
  for (const a of analyses) {
    const key = a.rating + ' / ' + a.benchmarkSelection;
    if (!strata.has(key)) strata.set(key, []);
    strata.get(key).push(a);
  }
  return [...strata.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, rows]) => [key, rows.slice().sort((x, y) => x.id.localeCompare(y.id)).slice(0, perStratum)]);
}

/* ------------------------------------------------------ test fixtures ----- */

/** Minimal stand-in for AnalyticsEngine: CycleAnalyticsEngine reads only these. */
export function fixtureRawEngine({ rows, assets = [] }) {
  return {
    prepared: rows,
    assets: new Map(assets.map(a => [a._id, a])),
    permitsByAsset: new Map(),
    vehicleSummary: reg => ({ registration: reg }),
    listVehicles: () => [],
    recentFuelHistory: () => ({ rows: [], summary: {} })
  };
}

export function fixtureRow({ reg, id, date, startKm, endKm, litres, home = false, dest = null }) {
  const km = endKm - startKm;
  return {
    assetId: reg, consumptionId: id, date,
    startKm, endKm, kilometers: km, litres,
    fillUpLocation: home ? 'STELLAR DEPOT' : 'Route fuel stop',
    destination: dest, inferredDestination: null,
    matchStatus: null, matchConfidence: null,
    candidateRoutes: [], linkedLoadingInstructions: [],
    driverAtReport: null, sourceKind: 'fixture',
    efficiency: { value: km > 0 && litres > 0 ? km / litres : null }
  };
}

export function fixtureTruck(reg, { assetType = 'TEST TRUCK TRACTOR', axle = '6 X 4' } = {}) {
  return {
    _id: reg, registration: reg, assetType, axleConfiguration: axle,
    description: assetType, isTrailer: false, vehicleStatus: 'Active'
  };
}

/** Builds a cycle engine over synthetic rows using the real production classes. */
export function fixtureEngine({ rows, assets, settings = {} }) {
  const merged = {
    poorDeviationPct: -15, reviewDeviationPct: -7.5, goodDeviationPct: 4, outstandingDeviationPct: 10,
    minFullCycleBenchmarkSamples: 3, modelBenchmarkMonths: 36, minModelBenchmarkTrucks: 2,
    homeFillLocationPatterns: ['STELLAR'], weightSensitivity: 0.35,
    ...settings
  };
  return new CycleAnalyticsEngine(fixtureRawEngine({ rows, assets }), [], merged);
}
