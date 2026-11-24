import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const cachePath = path.join(here, '..', 'data', 'precomputed-benchmarks.json');
const dailyCachePath = path.join(here, '..', 'data', 'precomputed-daily-summaries.json');
const DAILY_CACHE_VERSION = 4;
const CACHE_VERSION = 2;
const ANALYTIC_SETTING_KEYS = [
  'poorDeviationPct', 'reviewDeviationPct', 'goodDeviationPct', 'outstandingDeviationPct',
  'minSameVehicleDestinationSamples', 'minPeerDestinationSamples', 'outlierMadThreshold',
  'weightNormalizationEnabled', 'weightSensitivity', 'defaultReferenceGrossKg', 'recentBenchmarkLimit'
];

function pickSettings(settings = {}) {
  const out = {};
  for (const key of ANALYTIC_SETTING_KEYS) out[key] = settings[key] ?? null;
  return out;
}

function compactContext(c = {}) {
  return {
    consumptionId: c.consumptionId ?? null,
    trailerRegistration: c.trailerRegistration ?? null,
    productName: c.productName ?? null,
    truckTareKg: c.truckTareKg ?? null,
    trailerTareKg: c.trailerTareKg ?? null,
    outboundProductKg: c.outboundProductKg ?? null,
    returnProductKg: c.returnProductKg ?? null,
    loadedDistancePct: c.loadedDistancePct ?? null,
    referenceGrossKg: c.referenceGrossKg ?? null,
    confirmed: c.confirmed === true,
    evidenceSource: c.evidenceSource ?? null
  };
}

function datasetSignature(snapshot, contexts = [], settings = {}) {
  const hash = crypto.createHash('sha256');
  hash.update(`stellar-precomputed-v${CACHE_VERSION}|`);
  hash.update(JSON.stringify({
    mongoMetadataId: snapshot?.meta?.mongoMetadataId ?? null,
    datasetDate: snapshot?.meta?.datasetDate ?? null,
    assetCount: snapshot?.assets?.length ?? 0,
    permitCount: snapshot?.permits?.length ?? 0,
    tripCount: snapshot?.trips?.length ?? 0
  }));

  // Vehicle identity is enough to make adding/removing/replacing a truck invalidate the cache.
  const vehicleIds = (snapshot?.assets || [])
    .filter(a => a?.isTrailer !== true)
    .map(a => String(a?._id || a?.registration || ''))
    .filter(Boolean)
    .sort();
  hash.update(JSON.stringify(vehicleIds));

  // A changed trip count/latest operating date also invalidates the prototype cache so new
  // imported fuel data cannot silently use old averages.
  const tripDates = (snapshot?.trips || []).map(t => String(t?.date || t?.consumptionDate || '').slice(0, 10)).filter(Boolean).sort();
  hash.update(JSON.stringify({ firstTripDate: tripDates[0] || null, lastTripDate: tripDates.at(-1) || null }));

  const ctx = [...(contexts || [])].map(compactContext).sort((a, b) => String(a.consumptionId).localeCompare(String(b.consumptionId)));
  hash.update(JSON.stringify(ctx));
  hash.update(JSON.stringify(pickSettings(settings)));
  return hash.digest('hex');
}

function readCache() {
  try { return JSON.parse(fs.readFileSync(cachePath, 'utf8')); }
  catch { return null; }
}

function writeCache(doc) {
  const tmp = `${cachePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(doc));
  fs.renameSync(tmp, cachePath);
}

export async function loadOrBuildPrecomputed(engine, snapshot, contexts = [], settings = {}, { force = false } = {}) {
  const signature = datasetSignature(snapshot, contexts, settings);
  const existing = force ? null : readCache();
  if (existing?.version === CACHE_VERSION && existing.signature === signature && existing.benchmarks) {
    engine.loadPrecomputedBenchmarks(existing.benchmarks, {
      source: 'disk',
      signature,
      createdAt: existing.createdAt,
      benchmarkCount: existing.benchmarkCount ?? Object.keys(existing.benchmarks).length
    });
    return { source: 'disk', rebuilt: false, signature, createdAt: existing.createdAt, benchmarkCount: existing.benchmarkCount ?? Object.keys(existing.benchmarks).length };
  }

  const started = Date.now();
  const benchmarks = engine.buildPrecomputedBenchmarks();
  const createdAt = new Date().toISOString();
  const doc = {
    version: CACHE_VERSION,
    signature,
    createdAt,
    dataset: snapshot?.meta || null,
    benchmarkCount: Object.keys(benchmarks).length,
    settings: pickSettings(settings),
    benchmarks
  };
  writeCache(doc);
  const elapsedMs = Date.now() - started;
  engine.loadPrecomputedBenchmarks(benchmarks, { source: 'rebuilt', signature, createdAt, benchmarkCount: doc.benchmarkCount, elapsedMs });
  return { source: 'rebuilt', rebuilt: true, signature, createdAt, benchmarkCount: doc.benchmarkCount, elapsedMs };
}


function readDailyCache() {
  try { return JSON.parse(fs.readFileSync(dailyCachePath, 'utf8')); }
  catch { return null; }
}

function writeDailyCache(doc) {
  const tmp = `${dailyCachePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(doc));
  fs.renameSync(tmp, dailyCachePath);
}

function compactHomeTrip(x) {
  return {
    id: x.id,
    registration: x.registration,
    date: x.date,
    destination: x.destination,
    litres: x.litres,
    analysedKmL: x.analysedKmL,
    deviationPct: x.deviationPct,
    expectedLitres: x.expectedLitres,
    excessLitres: x.excessLitres,
    fuelVariancePct: x.fuelVariancePct,
    expectedDistanceKm: x.expectedDistanceKm,
    extraKm: x.extraKm,
    distanceVariancePct: x.distanceVariancePct,
    distanceStatus: x.distanceStatus,
    distanceBenchmark: x.distanceBenchmark ? {
      expectedDistanceKm: x.distanceBenchmark.expectedDistanceKm,
      actualDistanceKm: x.distanceBenchmark.actualDistanceKm,
      extraKm: x.distanceBenchmark.extraKm,
      distanceVariancePct: x.distanceBenchmark.distanceVariancePct,
      sampleSize: x.distanceBenchmark.sampleSize,
      excludedOutliers: x.distanceBenchmark.excludedOutliers,
      scope: x.distanceBenchmark.scope,
      confidence: x.distanceBenchmark.confidence,
      status: x.distanceBenchmark.status,
      routeLabel: x.distanceBenchmark.routeLabel
    } : null,
    fuelAttributionConfidence: x.fuelAttributionConfidence,
    sourceKind: x.sourceKind,
    hasFuelEvidence: Boolean(x.fuelInterval),
    rating: x.rating,
    confidenceScore: x.confidenceScore,
    benchmark: x.benchmark ? {
      averageKmL: x.benchmark.averageKmL,
      sampleSize: x.benchmark.sampleSize,
      scope: x.benchmark.scope,
      confidence: x.benchmark.confidence
    } : null
  };
}

function buildDailyCache(engine, signature) {
  const latestCompleteDate = engine.latestCompleteDate();
  const dates = engine.availableDates().filter(d => !latestCompleteDate || d <= latestCompleteDate);
  const summaries = {};
  for (const date of dates) {
    const daily = engine.daily(date);
    const distanceComparable = daily.trips.filter(x => x.extraKm != null);
    const flaggedDistance = daily.needsReview.filter(x => x.extraKm != null);
    summaries[date] = {
      date: daily.date,
      totalTrips: daily.totalTrips,
      averageKmL: daily.averageKmL,
      distanceSummary: {
        tripsWithBenchmark: distanceComparable.length,
        positiveExtraKm: Number(distanceComparable.reduce((s, x) => s + Math.max(0, x.extraKm || 0), 0).toFixed(1)),
        flaggedPositiveExtraKm: Number(flaggedDistance.reduce((s, x) => s + Math.max(0, x.extraKm || 0), 0).toFixed(1))
      },
      counts: daily.counts,
      needsReview: daily.needsReview.slice(0, 6).map(compactHomeTrip),
      outstanding: daily.outstanding.slice(0, 6).map(compactHomeTrip),
      dataWarnings: [],
      trips: []
    };
  }
  return {
    version: DAILY_CACHE_VERSION,
    signature,
    createdAt: new Date().toISOString(),
    latestCompleteDate,
    minDate: dates[0] || null,
    maxDate: dates.at(-1) || null,
    dateCount: dates.length,
    dates,
    summaries
  };
}

export async function loadOrBuildDailySummaries(engine, snapshot, contexts = [], settings = {}, { force = false } = {}) {
  const signature = datasetSignature(snapshot, contexts, settings);
  const existing = force ? null : readDailyCache();
  if (existing?.version === DAILY_CACHE_VERSION && existing.signature === signature && existing.summaries) {
    return { ...existing, source: 'disk', rebuilt: false };
  }
  const started = Date.now();
  const doc = buildDailyCache(engine, signature);
  writeDailyCache(doc);
  return { ...doc, source: 'rebuilt', rebuilt: true, elapsedMs: Date.now() - started };
}

export function dailySummaryCachePath() { return dailyCachePath; }

export function precomputedCachePath() { return cachePath; }
export function calculatePrecomputedSignature(snapshot, contexts = [], settings = {}) { return datasetSignature(snapshot, contexts, settings); }
