import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectToDatabase, getDatabase, databaseStatus } from './db.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const cachePath = path.join(here, '..', 'data', 'latest-dataset-cache.json');
const localStatePath = path.join(here, '..', 'data', 'app-state.json');
const CACHE_FROM = process.env.ANALYTICS_FROM_DATE || '2024-01-01';

let snapshot = null;
let source = 'initialising';
let lastLoadedAt = null;
let mongoDb = null;

function dateString(value) {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function compactAsset(a) {
  return {
    _id: a._id,
    registration: a.registration,
    description: a.description ?? null,
    assetType: a.assetType ?? null,
    axleConfiguration: a.axleConfiguration ?? null,
    vehicleStatus: a.vehicleStatus ?? null,
    vehicleGroup: a.vehicleGroup ?? null,
    vin: a.vin ?? null,
    odometer: a.odometer ?? null,
    licenceExpiry: dateString(a.licenceExpiry),
    isTrailer: a.isTrailer ?? null,
    dataQuality: a.dataQuality ?? null
  };
}

function compactPermit(p) {
  return {
    _id: p._id,
    assetId: p.assetId ?? null,
    registrationNormalized: p.registrationNormalized ?? null,
    category: p.category ?? null,
    permissibleWeightKgParsed: p.permissibleWeightKgParsed ?? null,
    permissibleWeightRaw: p.permissibleWeightRaw ?? null,
    make: p.make ?? null
  };
}

function compactTrip(r, c = null, fuelEntryMap = null, loadingRouteMap = null) {
  const tripDate = dateString(r.consumptionDate ?? r.date);
  const matchedFuelEntryIds = c?.matchedFuelEntryIds ?? r.matchedFuelEntryIds ?? [];
  const fuelEntries = (matchedFuelEntryIds || [])
    .map(id => fuelEntryMap?.get(id))
    .filter(Boolean);
  const fuelEntry = fuelEntries[0] || null;
  const route = r.loadingInstructionNo ? loadingRouteMap?.get(Number(r.loadingInstructionNo)) : null;

  const is2026Historical = Boolean(
    tripDate?.startsWith('2026-') &&
    !r.fuelInterval &&
    String(r.consumptionId || '').startsWith('cons_')
  );

  let historicalFuelInterval = null;
  if (is2026Historical) {
    const exactFuelMatch = fuelEntries.length === 1 && ['exact_csv_key_match', 'exact_current_export_match'].includes(c?.locationMatchStatus);
    const attributionConfidence = fuelEntries.length > 1
      ? 'ambiguous'
      : exactFuelMatch
        ? 'high'
        : fuelEntries.length === 1
          ? 'medium'
          : 'low';

    historicalFuelInterval = {
      intervalMode: 'historical_consumption',
      startDate: dateString(r.previousConsumptionDate) || tripDate,
      nextFuelDate: tripDate,
      startOdometer: r.startKm ?? null,
      nextOdometer: r.endKm ?? fuelEntry?.odometer ?? null,
      distanceKm: r.kilometers ?? null,
      odometerDeltaRaw: r.kilometers ?? null,
      fuelLoadedLitres: r.litres ?? fuelEntry?.litres ?? null,
      startFillLocation: null,
      nextFillLocation: c?.fillUpLocation ?? fuelEntry?.fillUpLocation ?? null,
      sourceConfirmation: fuelEntry
        ? (exactFuelMatch ? 'historical_fuel_entry_exact_match' : 'historical_fuel_entry_match')
        : 'historical_consumption_report_only',
      attributionConfidence,
      linkedLoadingInstructionCount: r.loadingInstructionNo ? 1 : 0,
      method: 'Stellar historical vehicle-consumption evidence: the litres recorded for this consumption row are compared with the odometer movement from the prior recorded consumption point to this fuel event. It is not direct tank-sensor burn.',
      fuelEventId: fuelEntry?._id ?? null,
      fuelEventDate: dateString(fuelEntry?.date) || tripDate,
      capturedBy: fuelEntry?.capturedBy ?? null,
      matchedFuelEntryCount: fuelEntries.length
    };
  }

  const routeTimingUsable = !(route?.dataQuality?.futureTimestampAfterExport === true);
  const routeLoadStanding = routeTimingUsable ? (route?.loadStandingHoursReported ?? null) : null;
  const routeOffloadStanding = routeTimingUsable ? (route?.offloadStandingHoursReported ?? null) : null;
  const routeTotalStanding = routeLoadStanding != null || routeOffloadStanding != null
    ? Number((Number(routeLoadStanding || 0) + Number(routeOffloadStanding || 0)).toFixed(2))
    : null;

  const linkedLoadingInstructions = (r.linkedLoadingInstructions?.length
    ? r.linkedLoadingInstructions
    : r.loadingInstructionNo
      ? [{
          loadingInstructionNo: Number(r.loadingInstructionNo),
          transactionDate: dateString(route?.transactionDate ?? r.loadingInstructionDate),
          customerCode: route?.customerCode ?? r.customerCode ?? null,
          customerName: route?.customerName ?? r.customerName ?? null,
          loadLocation: route?.loadLocation ?? r.loadLocation ?? null,
          offloadLocation: route?.offloadLocation ?? r.inferredDestination ?? null,
          loadArriveAtLocal: route?.loadArriveAtLocal ?? null,
          loadDepartAtLocal: route?.loadDepartAtLocal ?? null,
          offloadArriveAtLocal: route?.offloadArriveAtLocal ?? null,
          offloadDepartAtLocal: route?.offloadDepartAtLocal ?? null,
          loadStandingHours: routeLoadStanding,
          offloadStandingHours: routeOffloadStanding,
          totalStandingHours: routeTotalStanding
        }]
      : []);

  return {
    consumptionId: r.consumptionId,
    assetId: r.assetId ?? r.registrationNormalized ?? null,
    registrationNormalized: r.registrationNormalized ?? r.assetId ?? null,
    date: tripDate,
    previousConsumptionDate: dateString(r.previousConsumptionDate),
    startKm: r.startKm ?? null,
    endKm: r.endKm ?? null,
    kilometers: r.kilometers ?? null,
    litres: r.litres ?? null,
    reportedKmL: r.consumptionKmPerLitre ?? r.reportedKmL ?? null,
    matchStatus: r.matchStatus ?? 'no_match',
    matchConfidence: r.matchConfidence ?? 'none',
    matchMethod: r.matchMethod ?? null,
    loadingInstructionNo: r.loadingInstructionNo ?? null,
    customerCode: route?.customerCode ?? r.customerCode ?? null,
    customerName: route?.customerName ?? r.customerName ?? null,
    loadLocation: route?.loadLocation ?? r.loadLocation ?? null,
    inferredDestination: route?.offloadLocation ?? r.inferredDestination ?? null,
    loadArriveDate: dateString(route?.loadArriveDate ?? r.loadArriveDate),
    loadDepartDate: dateString(route?.loadDepartDate ?? r.loadDepartDate),
    offloadArriveDate: dateString(route?.offloadArriveDate ?? r.offloadArriveDate),
    offloadDepartDate: dateString(route?.offloadDepartDate ?? r.offloadDepartDate),
    routeDataQuality: route?.dataQuality ?? r.routeDataQuality ?? null,
    candidateRoutes: (r.candidateRoutes || []).slice(0, 4),
    driverAtReport: c?.driverAtReport ?? r.driverAtReport ?? null,
    fillUpLocation: c?.fillUpLocation ?? r.fillUpLocation ?? fuelEntry?.fillUpLocation ?? null,
    destinationSource: c?.destination ?? r.destinationSource ?? fuelEntry?.destination ?? null,
    locationMatchStatus: c?.locationMatchStatus ?? r.locationMatchStatus ?? null,
    matchedFuelEntryIds,
    consumptionRaw: c?.consumptionRaw ?? r.consumptionRaw ?? null,
    fuelInterval: r.fuelInterval ?? historicalFuelInterval,
    fuelAttributionConfidence: r.fuelAttributionConfidence ?? r.fuelInterval?.attributionConfidence ?? historicalFuelInterval?.attributionConfidence ?? null,
    fuelSourceConfirmation: r.fuelSourceConfirmation ?? r.fuelInterval?.sourceConfirmation ?? historicalFuelInterval?.sourceConfirmation ?? null,
    linkedLoadingInstructions,
    candidateLoadingInstructionNos: r.candidateLoadingInstructionNos ?? [],
    loadStandingHours: r.loadStandingHours ?? routeLoadStanding,
    offloadStandingHours: r.offloadStandingHours ?? routeOffloadStanding,
    totalStandingHours: r.totalStandingHours ?? routeTotalStanding,
    sourceKind: r.sourceKind ?? (String(r.consumptionId || '').startsWith('fuelint_') ? 'fuel_loading_interval' : 'historical_consumption_report'),
    sourceQualityFlags: r.qualityFlags ?? [],
    fuelEvidence: is2026Historical ? {
      year: 2026,
      matchedFuelEntryCount: fuelEntries.length,
      fuelEntryId: fuelEntry?._id ?? null,
      capturedBy: fuelEntry?.capturedBy ?? null,
      rawFuelEntryConfirmed: fuelEntries.length > 0,
      exactFuelEntryMatch: fuelEntries.length === 1 && ['exact_csv_key_match', 'exact_current_export_match'].includes(c?.locationMatchStatus)
    } : null
  };
}

function readLocalState() {
  try { return JSON.parse(fs.readFileSync(localStatePath, 'utf8')); }
  catch { return { alertReviews: {}, tripContext: {}, settings: {}, deviceTokens: {}, evidenceRecords: [], watchlist: {} }; }
}
function writeLocalState(state) {
  fs.writeFileSync(localStatePath, JSON.stringify(state, null, 2));
}

async function loadFromMongo() {
  const db = await connectToDatabase();
  const meta = await db.collection('database_metadata').find({}).sort({ importedAt: -1, updateDate: -1 }).limit(1).next();
  const assets = await db.collection('assets').find({}).toArray();
  const permits = await db.collection('permits').find({}).toArray();
  const fromDate = new Date(`${CACHE_FROM}T00:00:00.000Z`);

  // 07-Sep current-data update: preserve all older history, but replace the analytical
  // window from 13-Aug onward with the newest Vehicle Consumption export. This avoids
  // double counting the older 20-Aug interval patch and keeps recent odometers exact.
  const currentWindowStart = dateString(meta?.currentWindowStart) || null;
  const currentStartDate = currentWindowStart ? new Date(`${currentWindowStart}T00:00:00.000Z`) : null;
  const currentCollectionExists = await db.collection('consumption_route_matches_current').estimatedDocumentCount().catch(() => 0);
  const useCurrentWindow = Boolean(currentStartDate && currentCollectionExists > 0);

  const legacyRouteQuery = useCurrentWindow
    ? { consumptionDate: { $gte: fromDate, $lt: currentStartDate } }
    : { consumptionDate: { $gte: fromDate } };
  const legacyRouteRows = await db.collection('consumption_route_matches').find(legacyRouteQuery).toArray();
  const currentRouteRows = useCurrentWindow
    ? await db.collection('consumption_route_matches_current').find({ consumptionDate: { $gte: currentStartDate } }).toArray()
    : [];
  const routeRows = [...legacyRouteRows, ...currentRouteRows];

  // Old additive fuel intervals are retained in MongoDB for provenance, but once the
  // current report is imported they are intentionally not added again inside the
  // superseded window.
  const fuelIntervalQuery = useCurrentWindow
    ? { consumptionDate: { $gte: fromDate, $lt: currentStartDate } }
    : { consumptionDate: { $gte: fromDate } };
  const fuelIntervalRows = await db.collection('fuel_trip_intervals').find(fuelIntervalQuery).toArray();

  const legacyConsumptionQuery = useCurrentWindow
    ? { date: { $gte: fromDate, $lt: currentStartDate } }
    : { date: { $gte: fromDate } };
  const legacyConsumptionRows = await db.collection('vehicle_consumption').find(
    legacyConsumptionQuery,
    { projection: { _id: 1, date: 1, driverAtReport: 1, fillUpLocation: 1, destination: 1, locationMatchStatus: 1, matchedFuelEntryIds: 1, consumptionRaw: 1 } }
  ).toArray();
  const currentConsumptionRows = useCurrentWindow
    ? await db.collection('vehicle_consumption_current').find(
        { date: { $gte: currentStartDate } },
        { projection: { _id: 1, date: 1, driverAtReport: 1, fillUpLocation: 1, destination: 1, locationMatchStatus: 1, matchedFuelEntryIds: 1, consumptionRaw: 1 } }
      ).toArray()
    : [];
  const consumptionRows = [...legacyConsumptionRows, ...currentConsumptionRows];
  const consumptionMap = new Map(consumptionRows.map(r => [r._id, r]));

  const matchedFuelIds = [...new Set(consumptionRows
    .filter(r => dateString(r.date)?.startsWith('2026-'))
    .flatMap(r => r.matchedFuelEntryIds || [])
    .filter(Boolean))];
  const legacyFuelIds = matchedFuelIds.filter(id => !String(id).startsWith('fuelcur_'));
  const currentFuelIds = matchedFuelIds.filter(id => String(id).startsWith('fuelcur_'));
  const legacyFuelRows = legacyFuelIds.length
    ? await db.collection('fuel_entries').find(
        { _id: { $in: legacyFuelIds } },
        { projection: { _id: 1, date: 1, odometer: 1, litres: 1, fillUpLocation: 1, destination: 1, capturedBy: 1 } }
      ).toArray()
    : [];
  const currentFuelRows = currentFuelIds.length
    ? await db.collection('fuel_loading_events_current').find(
        { _id: { $in: currentFuelIds } },
        { projection: { _id: 1, date: 1, odometer: 1, litres: 1, fillUpLocation: 1, destination: 1, sourceConfirmation: 1, corroboration: 1 } }
      ).toArray()
    : [];
  const fuelEntryMap = new Map([...legacyFuelRows, ...currentFuelRows].map(r => [r._id, r]));

  const loadingRoutes2026 = await db.collection('loading_instruction_routes').find(
    { transactionDate: { $gte: new Date('2026-01-01T00:00:00.000Z') } }
  ).toArray();
  const routeUpdates = await db.collection('loading_instruction_route_updates').find({}).toArray().catch(() => []);
  const loadingRouteMap = new Map(loadingRoutes2026.map(r => [Number(r.loadingInstructionNo), r]));
  // Current route/standing export wins when the same Loading Instruction exists twice.
  for (const r of routeUpdates) loadingRouteMap.set(Number(r.loadingInstructionNo), r);

  const historical2026 = consumptionRows.filter(r => dateString(r.date)?.startsWith('2026-'));
  const fuelLinked2026 = historical2026.filter(r => (r.matchedFuelEntryIds || []).length > 0);

  await Promise.all([
    db.collection('trip_context').createIndex({ consumptionId: 1 }, { unique: true }),
    db.collection('alert_reviews').createIndex({ alertId: 1 }, { unique: true }),
    db.collection('analytics_settings').createIndex({ _id: 1 }, { unique: true }),
    db.collection('device_tokens').createIndex({ token: 1 }, { unique: true }),
    db.collection('evidence_records').createIndex({ id: 1 }, { unique: true }),
    db.collection('evidence_records').createIndex({ registration: 1, uploadedAt: -1 }),
    db.collection('watchlist').createIndex({ registration: 1 }, { unique: true })
  ]).catch(() => {});

  mongoDb = db;
  return {
    meta: {
      datasetName: meta?.sourcePackage || 'stellar_fuel_monitoring',
      datasetDate: dateString(meta?.updateDate) || '2026-09-07',
      cacheFromDate: CACHE_FROM,
      currentWindowStart,
      latestFuelTransactionDate: dateString(meta?.latestFuelTransactionDate),
      latestVehicleConsumptionDate: dateString(meta?.latestVehicleConsumptionDate),
      latestCompletedRouteContextDate: dateString(meta?.latestCompletedRouteContextDate),
      latestLoadingInstructionDate: dateString(meta?.latestLoadingInstructionDate),
      latestCompleteFuelConsumptionDate: dateString(meta?.latestCompleteFuelConsumptionDate),
      assets: assets.length,
      permits: permits.length,
      trips: routeRows.length + fuelIntervalRows.length,
      legacyTrips: legacyRouteRows.length,
      currentWindowTrips: currentRouteRows.length,
      fuelLinkedIntervals: fuelIntervalRows.length,
      historicalTrips2026: historical2026.length,
      fuelLinkedHistoricalTrips2026: fuelLinked2026.length,
      fuelCoveragePct2026: historical2026.length ? Number(((fuelLinked2026.length / historical2026.length) * 100).toFixed(1)) : 0,
      currentWindowFuelCoveragePct: meta?.quality?.vehicleConsumptionFuelCoveragePct ?? null,
      fuelFeatureYear: 2026,
      mongoMetadataId: meta?._id || null
    },
    assets: assets.map(compactAsset),
    permits: permits.map(compactPermit),
    trips: [
      ...routeRows.map(r => compactTrip(r, consumptionMap.get(r.consumptionId), fuelEntryMap, loadingRouteMap)),
      ...fuelIntervalRows.map(r => compactTrip(r, null, fuelEntryMap, loadingRouteMap))
    ]
  };
}

function loadFromFile() {
  return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
}

export async function initialiseRepository() {
  try {
    snapshot = await loadFromMongo();
    source = 'mongodb';
  } catch (error) {
    console.warn(`MongoDB unavailable or not imported; using latest packaged cache: ${error.message}`);
    snapshot = loadFromFile();
    source = 'latest-database-cache';
    mongoDb = null;
  }
  lastLoadedAt = new Date();
  return snapshot;
}

export async function refreshRepository() {
  return initialiseRepository();
}

export function getSnapshot() {
  if (!snapshot) throw new Error('Repository has not been initialised');
  return snapshot;
}

export function repositoryStatus() {
  const dbs = databaseStatus();
  return {
    source,
    mongoConnected: source === 'mongodb' && dbs.connected,
    databaseName: dbs.databaseName,
    mongoError: source === 'mongodb' ? null : dbs.error,
    lastLoadedAt: lastLoadedAt?.toISOString() || null,
    dataset: snapshot?.meta || null
  };
}

export async function getTripContext(consumptionId) {
  if (mongoDb) return await mongoDb.collection('trip_context').findOne({ consumptionId });
  return readLocalState().tripContext?.[consumptionId] || null;
}

export async function listTripContexts() {
  if (mongoDb) return await mongoDb.collection('trip_context').find({}).toArray();
  return Object.values(readLocalState().tripContext || {});
}

export async function saveTripContext(consumptionId, context) {
  const doc = { ...context, consumptionId, updatedAt: new Date(), source: context.source || 'manual' };
  if (mongoDb) {
    await mongoDb.collection('trip_context').replaceOne({ consumptionId }, doc, { upsert: true });
    return doc;
  }
  const state = readLocalState();
  state.tripContext ||= {};
  state.tripContext[consumptionId] = { ...doc, updatedAt: doc.updatedAt.toISOString() };
  writeLocalState(state);
  return state.tripContext[consumptionId];
}

export async function getAlertReview(alertId) {
  if (mongoDb) return await mongoDb.collection('alert_reviews').findOne({ alertId });
  return readLocalState().alertReviews?.[alertId] || null;
}

export async function listAlertReviews() {
  if (mongoDb) return await mongoDb.collection('alert_reviews').find({}).toArray();
  return Object.values(readLocalState().alertReviews || {});
}

export async function saveAlertReview(alertId, review) {
  const doc = { ...review, alertId, updatedAt: new Date() };
  if (mongoDb) {
    await mongoDb.collection('alert_reviews').replaceOne({ alertId }, doc, { upsert: true });
    await mongoDb.collection('audit_log').insertOne({ at: new Date(), action: 'ALERT_UPDATED', alertId, status: review.status, comment: review.comment || '' });
    return doc;
  }
  const state = readLocalState();
  state.alertReviews ||= {};
  state.alertReviews[alertId] = { ...doc, updatedAt: doc.updatedAt.toISOString() };
  state.audit ||= [];
  state.audit.push({ id: `AUD-${Date.now()}`, at: new Date().toISOString(), action: 'ALERT_UPDATED', alertId, status: review.status, comment: review.comment || '' });
  writeLocalState(state);
  return state.alertReviews[alertId];
}

export async function getSettings() {
  const defaults = {
    _id: 'fuel_analytics',
    poorDeviationPct: -15,
    reviewDeviationPct: -7.5,
    goodDeviationPct: 4,
    outstandingDeviationPct: 10,
    minSameVehicleDestinationSamples: 5,
    minFullCycleBenchmarkSamples: 3,
    modelBenchmarkMonths: 36,
    minModelBenchmarkTrucks: 2,
    homeFillLocationPatterns: ['STELLAR'],
    minPeerDestinationSamples: 8,
    outlierMadThreshold: 3.5,
    weightNormalizationEnabled: true,
    weightSensitivity: 0.35,
    defaultReferenceGrossKg: 42000,
    recentBenchmarkLimit: 180,
    note: 'V20 performance uses completed Stellar full-up to Stellar full-up cycles. Primary fuel benchmarking pools prior cycles from the same fleet-master model/type + axle configuration on the same route within the selected history window. The exact truck benchmark remains visible separately. Historical averages are distance/fuel weighted; medians are calculated from completed trip km/L values. Trailer/product mass adjusts only the expected target.'
  };
  if (mongoDb) {
    const row = await mongoDb.collection('analytics_settings').findOne({ _id: 'fuel_analytics' });
    return { ...defaults, ...(row || {}) };
  }
  const state = readLocalState();
  return { ...defaults, ...(state.settings?.fuel_analytics || {}) };
}

export async function saveSettings(update) {
  const current = await getSettings();
  const doc = { ...current, ...update, _id: 'fuel_analytics', updatedAt: new Date() };
  if (mongoDb) {
    await mongoDb.collection('analytics_settings').replaceOne({ _id: 'fuel_analytics' }, doc, { upsert: true });
    return doc;
  }
  const state = readLocalState();
  state.settings ||= {};
  state.settings.fuel_analytics = { ...doc, updatedAt: doc.updatedAt.toISOString() };
  writeLocalState(state);
  return state.settings.fuel_analytics;
}

export async function getAudit() {
  if (mongoDb) return await mongoDb.collection('audit_log').find({}).sort({ at: -1 }).limit(200).toArray();
  return (readLocalState().audit || []).slice().reverse().slice(0, 200);
}


// ---- Final POE NoSQL collections: FCM devices, Azure Blob metadata and fleet watchlist ----
export async function registerDeviceToken(record) {
  const doc = {
    token: String(record.token || '').trim(),
    deviceId: String(record.deviceId || '').trim(),
    platform: String(record.platform || 'android'),
    userId: record.userId || null,
    email: record.email || null,
    updatedAt: new Date()
  };
  if (!doc.token) throw new Error('token is required');
  if (mongoDb) {
    await mongoDb.collection('device_tokens').replaceOne({ token: doc.token }, doc, { upsert: true });
    return doc;
  }
  const state = readLocalState();
  state.deviceTokens ||= {};
  state.deviceTokens[doc.token] = { ...doc, updatedAt: doc.updatedAt.toISOString() };
  writeLocalState(state);
  return state.deviceTokens[doc.token];
}

export async function removeDeviceToken({ token, deviceId }) {
  if (mongoDb) {
    const query = token ? { token } : { deviceId };
    const result = await mongoDb.collection('device_tokens').deleteMany(query);
    return result.deletedCount || 0;
  }
  const state = readLocalState();
  state.deviceTokens ||= {};
  let removed = 0;
  for (const [key, row] of Object.entries(state.deviceTokens)) {
    if ((token && key === token) || (!token && deviceId && row.deviceId === deviceId)) {
      delete state.deviceTokens[key];
      removed++;
    }
  }
  writeLocalState(state);
  return removed;
}

export async function listDeviceTokens({ deviceId = '' } = {}) {
  if (mongoDb) return await mongoDb.collection('device_tokens').find(deviceId ? { deviceId } : {}).toArray();
  return Object.values(readLocalState().deviceTokens || {}).filter(x => !deviceId || x.deviceId === deviceId);
}

export async function saveEvidenceRecord(record) {
  const doc = { ...record, uploadedAt: record.uploadedAt || new Date() };
  if (!doc.id) throw new Error('evidence id is required');
  if (mongoDb) {
    await mongoDb.collection('evidence_records').replaceOne({ id: doc.id }, doc, { upsert: true });
    await mongoDb.collection('audit_log').insertOne({ at: new Date(), action: 'EVIDENCE_UPLOADED', evidenceId: doc.id, registration: doc.registration, tripId: doc.tripId || null });
    return doc;
  }
  const state = readLocalState();
  state.evidenceRecords ||= [];
  state.evidenceRecords = state.evidenceRecords.filter(x => x.id !== doc.id);
  state.evidenceRecords.push({ ...doc, uploadedAt: doc.uploadedAt instanceof Date ? doc.uploadedAt.toISOString() : doc.uploadedAt });
  writeLocalState(state);
  return state.evidenceRecords.at(-1);
}

export async function listEvidenceRecords({ registration = '', tripId = '' } = {}) {
  const reg = String(registration || '').trim().toUpperCase();
  const tid = String(tripId || '').trim();
  if (mongoDb) {
    const query = {};
    if (reg) query.registration = reg;
    if (tid) query.tripId = tid;
    return await mongoDb.collection('evidence_records').find(query).sort({ uploadedAt: -1 }).limit(200).toArray();
  }
  return (readLocalState().evidenceRecords || [])
    .filter(x => (!reg || x.registration === reg) && (!tid || x.tripId === tid))
    .sort((a, b) => String(b.uploadedAt).localeCompare(String(a.uploadedAt)))
    .slice(0, 200);
}

export async function getEvidenceRecord(id) {
  const key = String(id || '');
  if (mongoDb) return await mongoDb.collection('evidence_records').findOne({ id: key });
  return (readLocalState().evidenceRecords || []).find(x => x.id === key) || null;
}

export async function deleteEvidenceRecord(id) {
  const key = String(id || '');
  if (mongoDb) {
    const removed = (await mongoDb.collection('evidence_records').deleteOne({ id: key })).deletedCount || 0;
    if (removed) await mongoDb.collection('audit_log').insertOne({ at: new Date(), action: 'EVIDENCE_DELETED', evidenceId: key });
    return removed;
  }
  const state = readLocalState();
  const before = (state.evidenceRecords || []).length;
  state.evidenceRecords = (state.evidenceRecords || []).filter(x => x.id !== key);
  writeLocalState(state);
  return before - state.evidenceRecords.length;
}

export async function listWatchlistItems() {
  if (mongoDb) return await mongoDb.collection('watchlist').find({}).sort({ updatedAt: -1 }).toArray();
  return Object.values(readLocalState().watchlist || {}).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export async function saveWatchlistItem(registration, item) {
  const reg = String(registration || '').trim().toUpperCase();
  if (!reg) throw new Error('registration is required');
  const existing = mongoDb
    ? await mongoDb.collection('watchlist').findOne({ registration: reg })
    : readLocalState().watchlist?.[reg];
  const doc = {
    registration: reg,
    note: String(item.note || '').trim().slice(0, 1000),
    priority: ['Monitor','Priority','Critical'].includes(item.priority) ? item.priority : 'Monitor',
    createdAt: existing?.createdAt || new Date(),
    updatedAt: new Date()
  };
  if (mongoDb) {
    await mongoDb.collection('watchlist').replaceOne({ registration: reg }, doc, { upsert: true });
    await mongoDb.collection('audit_log').insertOne({ at: new Date(), action: 'WATCHLIST_SAVED', registration: reg, priority: doc.priority });
    return doc;
  }
  const state = readLocalState();
  state.watchlist ||= {};
  state.watchlist[reg] = { ...doc, createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt, updatedAt: doc.updatedAt.toISOString() };
  writeLocalState(state);
  return state.watchlist[reg];
}

export async function deleteWatchlistItem(registration) {
  const reg = String(registration || '').trim().toUpperCase();
  if (mongoDb) return (await mongoDb.collection('watchlist').deleteOne({ registration: reg })).deletedCount || 0;
  const state = readLocalState();
  state.watchlist ||= {};
  const existed = Boolean(state.watchlist[reg]);
  delete state.watchlist[reg];
  writeLocalState(state);
  return existed ? 1 : 0;
}
