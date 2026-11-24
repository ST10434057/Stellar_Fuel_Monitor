import { estimateAssetTare, trailerReferencePayloadKg } from './weight-reference.js';
const PLACEHOLDERS = new Set(['', '-', '(NONE)', 'NONE', 'UNKNOWN', 'N/A', 'NULL']);

function num(v) { return typeof v === 'number' && Number.isFinite(v) ? v : null; }
function round(v, d = 2) { return v == null || !Number.isFinite(v) ? null : Number(v.toFixed(d)); }
function validText(v) { return typeof v === 'string' && !PLACEHOLDERS.has(v.trim().toUpperCase()); }
function median(values) {
  if (!values.length) return null;
  const a = [...values].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
function quantile(values, q) {
  if (!values.length) return null;
  const a = [...values].sort((x, y) => x - y);
  const pos = (a.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  if (lo === hi) return a[lo];
  return a[lo] + (a[hi] - a[lo]) * (pos - lo);
}
function robustClean(values, threshold = 3.5) {
  const vals = values.filter(v => typeof v === 'number' && Number.isFinite(v) && v > 0);
  if (vals.length < 5) return vals;
  const med = median(vals);
  const mad = median(vals.map(v => Math.abs(v - med)));
  if (mad && mad > 1e-9) {
    const sigma = 1.4826 * mad;
    const filtered = vals.filter(v => Math.abs(v - med) <= threshold * sigma);
    return filtered.length >= 3 ? filtered : vals;
  }
  const q1 = quantile(vals, .25), q3 = quantile(vals, .75), iqr = q3 - q1;
  if (!iqr) return vals;
  const filtered = vals.filter(v => v >= q1 - 1.5 * iqr && v <= q3 + 1.5 * iqr);
  return filtered.length >= 3 ? filtered : vals;
}
function robustStats(values, threshold = 3.5) {
  const cleaned = robustClean(values, threshold);
  if (!cleaned.length) return null;
  const med = median(cleaned);
  const mad = median(cleaned.map(v => Math.abs(v - med))) || 0;
  const avg = cleaned.reduce((a, b) => a + b, 0) / cleaned.length;
  return {
    average: avg,
    median: med,
    robustSigma: Math.max(1.4826 * mad, avg * .03, .03),
    sampleSize: cleaned.length,
    excludedOutliers: Math.max(0, values.length - cleaned.length),
    low: quantile(cleaned, .2),
    high: quantile(cleaned, .8)
  };
}

function brandFrom(asset) {
  const text = `${asset?.assetType || ''} ${asset?.description || ''}`.toUpperCase();
  const rules = [
    ['IVECO', 'IVECO'], ['ACTROS', 'Mercedes-Benz'], ['MERC', 'Mercedes-Benz'], ['FAW', 'FAW'],
    ['HINO', 'Hino'], ['TOYOTA', 'Toyota'], ['FORD', 'Ford'], ['ISUZU', 'Isuzu'], ['DAEWOO', 'Daewoo'],
    ['INTERNATIONAL', 'International'], ['SCANIA', 'Scania'], ['FOTON', 'Foton'], ['SITRAK', 'Sitrak'], ['SHACMAN', 'Shacman'], ['MITSUBISHI', 'Mitsubishi']
  ];
  for (const [needle, brand] of rules) if (text.includes(needle)) return brand;
  return asset?.assetType || asset?.vehicleGroup || 'Unknown';
}
function peerType(asset) {
  return asset?.assetType || asset?.vehicleGroup || brandFrom(asset) || 'Unknown';
}
function destinationFor(trip) {
  if (validText(trip.destinationSource) && (trip.locationMatchStatus === 'exact_csv_key_match' || (trip.matchedFuelEntryIds || []).length)) {
    return { value: trip.destinationSource.trim(), source: 'Fuel entry match', confidence: 'high' };
  }
  if (trip.matchStatus === 'matched' && ['high', 'medium'].includes(trip.matchConfidence) && validText(trip.inferredDestination)) {
    return { value: trip.inferredDestination.trim(), source: 'Loading Instruction inference', confidence: trip.matchConfidence };
  }
  if (validText(trip.destinationSource)) return { value: trip.destinationSource.trim(), source: 'Consumption source', confidence: 'medium' };
  return { value: null, source: 'Unavailable', confidence: 'none' };
}
function normalisePlace(value) {
  if (!validText(value)) return null;
  return String(value)
    .toUpperCase()
    .replace(/&/g, ' AND ')
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\b(MINE|SITE)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function actualDistanceKm(trip) {
  const start = num(Number(trip?.startKm ?? trip?.fuelInterval?.startOdometer));
  const end = num(Number(trip?.endKm ?? trip?.fuelInterval?.nextOdometer));
  if (start != null && end != null && end >= start) {
    const delta = end - start;
    if (delta > 0) return delta;
  }
  const reported = num(Number(trip?.kilometers ?? trip?.fuelInterval?.distanceKm));
  return reported != null && reported > 0 ? reported : null;
}
function distanceProfile(values, threshold = 3.5) {
  const source = values.filter(v => typeof v === 'number' && Number.isFinite(v) && v > 0 && v < 5000);
  if (!source.length) return null;
  const cleaned = robustClean(source, threshold);
  if (!cleaned.length) return null;
  const expected = median(cleaned);
  const average = cleaned.reduce((a, b) => a + b, 0) / cleaned.length;
  return {
    expectedDistanceKm: expected,
    averageDistanceKm: average,
    lowDistanceKm: quantile(cleaned, .2),
    highDistanceKm: quantile(cleaned, .8),
    sampleSize: cleaned.length,
    excludedOutliers: Math.max(0, source.length - cleaned.length)
  };
}

function correctedEfficiency(trip) {
  const km = num(trip.kilometers), litres = num(trip.litres), reported = num(trip.reportedKmL);
  const calculated = km != null && litres != null && km > 0 && litres > 0 ? km / litres : null;
  let value = calculated ?? reported;
  const flags = [];
  let correction = null;
  if (calculated != null && reported != null && reported > 0) {
    const relative = Math.abs(reported - calculated) / Math.max(calculated, .001);
    if (relative > .05) {
      const ratio = reported / calculated;
      if ((ratio > 9 && ratio < 11) || (ratio > .09 && ratio < .11)) correction = 'Decimal-position error corrected using distance ÷ litres';
      else correction = 'Reported km/L replaced by distance ÷ litres because the fields disagree';
      flags.push('reported_value_disagrees_with_distance_and_litres');
    }
  }
  if (km == null || km <= 0) flags.push('missing_or_zero_distance');
  if (litres == null || litres <= 0) flags.push('missing_or_zero_litres');
  if (value != null && (!Number.isFinite(value) || value <= 0)) value = null;
  return { value, calculated, reported, flags, correction };
}

function normaliseContext(c) {
  if (!c) return null;
  const fields = ['truckTareKg','trailerTareKg','outboundProductKg','returnProductKg','loadedDistancePct'];
  const out = { ...c };
  for (const f of fields) out[f] = num(Number(c[f]));
  if (out.loadedDistancePct == null) out.loadedDistancePct = 50;
  out.loadedDistancePct = Math.max(0, Math.min(100, out.loadedDistancePct));
  return out;
}
function contextMass(c) {
  const x = normaliseContext(c);
  if (!x) return null;
  const truck = x.truckTareKg || 0, trailer = x.trailerTareKg || 0, outbound = x.outboundProductKg || 0, ret = x.returnProductKg || 0;
  if (truck + trailer <= 0) return null;
  const loadedFraction = x.loadedDistancePct / 100;
  const avgPayload = outbound * loadedFraction + ret * (1 - loadedFraction);
  return { averageGrossKg: truck + trailer + avgPayload, averagePayloadKg: avgPayload, loadedFraction };
}

const VERIFIED_EVIDENCE_SOURCES = new Set(['timeworx', 'dispatch', 'weighbridge', 'verified-manual']);
function evidenceSourceLabel(value) {
  const key = String(value || '').trim().toLowerCase();
  const labels = {
    'timeworx': 'TimeWorx / telematics',
    'dispatch': 'Dispatch / loading documentation',
    'weighbridge': 'Weighbridge / load sheet',
    'verified-manual': 'Verified manual record',
    'unverified': 'Not verified'
  };
  return labels[key] || (validText(value) ? String(value) : 'Not verified');
}

export class AnalyticsEngine {
  constructor(snapshot, contexts = [], settings = {}) {
    this.snapshot = snapshot;
    this.settings = settings;
    this.assets = new Map(snapshot.assets.map(a => [a._id, a]));
    this.permitsByAsset = new Map();
    for (const p of snapshot.permits || []) {
      if (!this.permitsByAsset.has(p.assetId)) this.permitsByAsset.set(p.assetId, []);
      this.permitsByAsset.get(p.assetId).push(p);
    }
    this.contexts = new Map((contexts || []).map(c => [c.consumptionId, c]));
    this.rawTrips = snapshot.trips || [];
    this.prepared = [];
    this.byAsset = new Map();
    this.byType = new Map();
    this.byTypeDest = new Map();
    this.byBrand = new Map();
    this.byBrandDest = new Map();
    this.assetProfile = new Map();
    // Cache expensive daily analytics. Several UI endpoints request the same latest-day
    // analysis during startup; without caching those synchronous calculations queue up
    // and can leave Angular showing 'Connecting...' indefinitely.
    this.dailyCache = new Map();
    this.latestCompleteDateCache = undefined;
    this.fleetSummaryCache = null;
    // Fast lookup/caching for the Trip Investigation screen. The dashboard already
    // analyses many of these trips, so opening one should reuse that exact result.
    this.preparedById = new Map();
    this.analysisCache = new Map();
    // Persistent benchmark cache: the expensive robust historical averages are calculated
    // once and stored on disk. Page requests then reuse those values instead of scanning
    // historical trips every time.
    this.precomputedBenchmarks = new Map();
    this.precomputedEnabled = false;
    this.precomputedInfo = null;
    this.availableDatesCache = null;
    this.latestTripByAsset = new Map();
    this.vehicleListBaseCache = null;

    // Performance indexes used by all interactive screens.
    // The older code repeatedly scanned/sorted the complete historical dataset whenever
    // a user changed a truck or operating day. Keep those operations O(vehicle history)
    // or O(single day) instead of O(all historical trips).
    this.allTripsByAsset = new Map();
    this.tripsByDate = new Map();
    this.destinationsByAssetCache = new Map();
    this.tripListPageCache = new Map();
    this.recentFuelHistoryCache = new Map();

    this.distanceProfiles = {
      truckRoute: new Map(), truckDestination: new Map(),
      typeRoute: new Map(), typeDestination: new Map(),
      brandRoute: new Map(), brandDestination: new Map(),
      route: new Map(), destination: new Map()
    };
    this.prepare();
  }

  prepare() {
    const firstPass = [];
    for (const row of this.rawTrips) {
      const asset = this.assets.get(row.assetId) || null;
      if (!asset || asset.isTrailer === true) continue;
      const eff = correctedEfficiency(row);
      const dest = destinationFor(row);
      const prepared = { ...row, asset, peerType: peerType(asset), brand: brandFrom(asset), destination: dest.value, destinationMeta: dest, efficiency: eff };
      firstPass.push(prepared);
      if (eff.value != null) {
        if (!this.byAsset.has(row.assetId)) this.byAsset.set(row.assetId, []);
        this.byAsset.get(row.assetId).push(prepared);
      }
    }

    // Build a robust historical profile for each vehicle. Extreme values are treated as data-quality candidates, not performance awards/penalties.
    for (const [reg, rows] of this.byAsset.entries()) {
      const rough = rows.map(r => r.efficiency.value).filter(v => v != null && v >= .35 && v <= 20);
      const stats = robustStats(rough, Number(this.settings.outlierMadThreshold || 3.5));
      if (stats) this.assetProfile.set(reg, stats);
    }

    this.byAsset.clear();
    for (const p of firstPass) {
      const profile = this.assetProfile.get(p.assetId);
      let e = p.efficiency.value;
      const qualityFlags = [...p.efficiency.flags, ...(p.sourceQualityFlags || [])];
      let validForBenchmark = e != null;
      let likelyDataError = false;
      let profileDecimalCorrection = false;

      // Catch the classic 24.5 instead of 2.45 (or 0.245 instead of 2.45) entry error.
      // This never overwrites MongoDB. It is only used for analysis and is clearly flagged.
      if (e != null && profile?.median && profile.median > 0 && !p.efficiency.correction) {
        const ratio = e / profile.median;
        let candidate = null;
        if (ratio >= 7.5 && ratio <= 12.5) candidate = e / 10;
        else if (ratio >= .075 && ratio <= .125) candidate = e * 10;
        if (candidate != null) {
          const sigma = Math.max(profile.robustSigma || 0, profile.median * .08, .05);
          const robustDistance = Math.abs(candidate - profile.median) / sigma;
          if (candidate >= .25 && candidate <= 12 && robustDistance <= 4.5) {
            p.efficiency.value = candidate;
            e = candidate;
            p.efficiency.correction = 'Probable decimal-position error corrected using the vehicle’s robust historical profile';
            profileDecimalCorrection = true;
            qualityFlags.push('probable_decimal_position_corrected_from_vehicle_profile');
          }
        }
      }

      if (e != null) {
        if (e < .25 || e > 25) { likelyDataError = true; qualityFlags.push('physically_implausible_efficiency'); }
        if (profile?.median) {
          const ratio = e / profile.median;
          if (ratio > 2.35 || ratio < .25) {
            likelyDataError = true;
            qualityFlags.push('far_outside_vehicle_historical_profile');
          }
        }
      }
      if (likelyDataError || profileDecimalCorrection || p.efficiency.flags.includes('missing_or_zero_distance') || p.efficiency.flags.includes('missing_or_zero_litres')) validForBenchmark = false;
      p.profileDecimalCorrection = profileDecimalCorrection;
      p.qualityFlags = [...new Set(qualityFlags)];
      p.likelyDataError = likelyDataError;
      p.validForBenchmark = validForBenchmark;
      this.prepared.push(p);
      if (validForBenchmark) {
        if (!this.byAsset.has(p.assetId)) this.byAsset.set(p.assetId, []);
        this.byAsset.get(p.assetId).push(p);
        if (!this.byType.has(p.peerType)) this.byType.set(p.peerType, []);
        this.byType.get(p.peerType).push(p);
        if (!this.byBrand.has(p.brand)) this.byBrand.set(p.brand, []);
        this.byBrand.get(p.brand).push(p);
        if (p.destination) {
          const key = `${p.peerType}|||${p.destination.toUpperCase()}`;
          if (!this.byTypeDest.has(key)) this.byTypeDest.set(key, []);
          this.byTypeDest.get(key).push(p);
          const brandKey = `${p.brand}|||${p.destination.toUpperCase()}`;
          if (!this.byBrandDest.has(brandKey)) this.byBrandDest.set(brandKey, []);
          this.byBrandDest.get(brandKey).push(p);
        }
      }
    }
    this.preparedById = new Map(this.prepared.map(t => [t.consumptionId, t]));

    // Build fast all-trip indexes once. These include Data Warning rows too, because
    // Trip Analytics / Fuel History must show the complete source history.
    for (const trip of this.prepared) {
      if (!this.allTripsByAsset.has(trip.assetId)) this.allTripsByAsset.set(trip.assetId, []);
      this.allTripsByAsset.get(trip.assetId).push(trip);
      if (trip.date) {
        if (!this.tripsByDate.has(trip.date)) this.tripsByDate.set(trip.date, []);
        this.tripsByDate.get(trip.date).push(trip);
      }
    }
    for (const rows of this.allTripsByAsset.values()) {
      rows.sort((a, b) => {
        const d = String(b.date || '').localeCompare(String(a.date || ''));
        if (d) return d;
        return String(b.consumptionId || '').localeCompare(String(a.consumptionId || ''));
      });
    }
    for (const rows of this.tripsByDate.values()) {
      rows.sort((a, b) => String(a.assetId || '').localeCompare(String(b.assetId || '')));
    }
    for (const [reg, rows] of this.allTripsByAsset.entries()) {
      const counts = new Map();
      for (const t of rows) if (t.destination) counts.set(t.destination, (counts.get(t.destination) || 0) + 1);
      this.destinationsByAssetCache.set(
        reg,
        [...counts.entries()]
          .map(([destination, count]) => ({ destination, count }))
          .sort((a, b) => b.count - a.count || a.destination.localeCompare(b.destination))
      );
    }

    // Build the latest-trip index once. The old Fleet endpoint sorted each truck's
    // complete history every time /api/vehicles was opened.
    for (const [reg, rows] of this.byAsset.entries()) {
      let latest = null;
      for (const row of rows) {
        if (!latest || String(row.date).localeCompare(String(latest.date)) > 0) latest = row;
      }
      if (latest) this.latestTripByAsset.set(reg, latest);
    }

    this.buildDistanceProfiles();
  }

  routeKeyFor(trip) {
    const destination = normalisePlace(trip?.destination);
    const load = normalisePlace(trip?.loadLocation);
    return destination && load ? `${load}|||${destination}` : null;
  }

  buildDistanceProfiles() {
    const threshold = Number(this.settings.outlierMadThreshold || 3.5);
    const buckets = {
      truckRoute: new Map(), truckDestination: new Map(),
      typeRoute: new Map(), typeDestination: new Map(),
      brandRoute: new Map(), brandDestination: new Map(),
      route: new Map(), destination: new Map()
    };
    const add = (map, key, value) => {
      if (!key || value == null || value <= 0 || value >= 5000) return;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(value);
    };

    for (const trip of this.prepared) {
      const km = actualDistanceKm(trip);
      const destination = normalisePlace(trip.destination);
      if (km == null || !destination) continue;
      const route = this.routeKeyFor(trip);
      if (route) {
        add(buckets.truckRoute, `${trip.assetId}|||${route}`, km);
        add(buckets.typeRoute, `${trip.peerType}|||${route}`, km);
        add(buckets.brandRoute, `${trip.brand}|||${route}`, km);
        add(buckets.route, route, km);
      }
      add(buckets.truckDestination, `${trip.assetId}|||${destination}`, km);
      add(buckets.typeDestination, `${trip.peerType}|||${destination}`, km);
      add(buckets.brandDestination, `${trip.brand}|||${destination}`, km);
      add(buckets.destination, destination, km);
    }

    const profiles = {};
    for (const [name, map] of Object.entries(buckets)) {
      const built = new Map();
      for (const [key, values] of map.entries()) {
        const profile = distanceProfile(values, threshold);
        if (profile) built.set(key, profile);
      }
      profiles[name] = built;
    }
    this.distanceProfiles = profiles;
  }

  distanceBenchmarkFor(trip) {
    if (!trip) return null;
    const actualKm = actualDistanceKm(trip);
    const destination = normalisePlace(trip.destination);
    if (actualKm == null || !destination) return null;
    const route = this.routeKeyFor(trip);
    const p = this.distanceProfiles;
    const options = [];
    if (route) options.push(
      [p.truckRoute, `${trip.assetId}|||${route}`, 3, 'Same truck + same load/offload route', 'high'],
      [p.typeRoute, `${trip.peerType}|||${route}`, 5, `${trip.peerType} model/type + same load/offload route`, 'high'],
      [p.brandRoute, `${trip.brand}|||${route}`, 7, `${trip.brand} brand + same load/offload route`, 'medium'],
      [p.route, route, 8, 'All trucks + same load/offload route', 'medium']
    );
    options.push(
      [p.truckDestination, `${trip.assetId}|||${destination}`, 4, 'Same truck + same destination', 'high'],
      [p.typeDestination, `${trip.peerType}|||${destination}`, 6, `${trip.peerType} model/type + same destination`, 'medium'],
      [p.brandDestination, `${trip.brand}|||${destination}`, 8, `${trip.brand} brand + same destination`, 'medium'],
      [p.destination, destination, 10, 'All trucks + same destination', 'low']
    );

    let selected = null;
    for (const [map, key, min, scope, confidence] of options) {
      const profile = map?.get(key);
      if (profile && profile.sampleSize >= min) { selected = { ...profile, scope, confidence, routeSpecific: Boolean(route && String(key).includes(route)) }; break; }
    }
    if (!selected) return null;

    const expectedDistanceKm = selected.expectedDistanceKm;
    const extraKm = actualKm - expectedDistanceKm;
    const variancePct = expectedDistanceKm > 0 ? (extraKm / expectedDistanceKm) * 100 : null;
    const absPct = Math.abs(variancePct || 0);
    let status = 'Normal';
    if (variancePct != null && variancePct > 20) status = 'Extreme';
    else if (variancePct != null && variancePct > 10) status = 'High';
    else if (variancePct != null && variancePct > 5) status = 'Watch';
    else if (variancePct != null && variancePct < -10) status = 'Shorter';

    return {
      ...selected,
      expectedDistanceKm: round(expectedDistanceKm, 1),
      averageDistanceKm: round(selected.averageDistanceKm, 1),
      lowDistanceKm: round(selected.lowDistanceKm, 1),
      highDistanceKm: round(selected.highDistanceKm, 1),
      actualDistanceKm: round(actualKm, 1),
      extraKm: round(extraKm, 1),
      distanceVariancePct: round(variancePct, 1),
      status,
      routeLabel: trip.loadLocation && trip.destination ? `${trip.loadLocation} → ${trip.destination}` : (trip.destination || 'Destination unavailable'),
      calculation: 'Expected distance uses the robust median of comparable historical odometer distances after statistical outliers are removed.'
    };
  }

  recentFuelHistory(reg, { upToDate = '', fromDate = '', currentTripId = '', limit = 15, aroundDate = '', beforeCount = 0, afterCount = 0 } = {}) {
    const max = Math.max(5, Math.min(500, Number(limit) || 15));
    const before = Math.max(0, Math.min(250, Number(beforeCount) || 0));
    const after = Math.max(0, Math.min(250, Number(afterCount) || 0));
    const cacheKey = `${String(reg || '').toUpperCase()}|${fromDate}|${upToDate}|${currentTripId}|${aroundDate}|${before}|${after}|${max}`;
    if (this.recentFuelHistoryCache.has(cacheKey)) return this.recentFuelHistoryCache.get(cacheKey);

    // allTripsByAsset is newest-first. Keep every real fuel row so a monthly audit can
    // show the complete period, while Trip Investigation can request only a small window
    // around the selected full-cycle evidence.
    const allRows = (this.allTripsByAsset.get(reg) || [])
      .filter(t => num(Number(t.litres ?? t.fuelInterval?.fuelLoadedLitres)) > 0);

    let sourceRows = allRows.filter(t =>
      (!fromDate || String(t.date) >= String(fromDate)) &&
      (!upToDate || String(t.date) <= String(upToDate))
    );

    // When an investigation asks for nearby evidence, include a few newer rows (after the
    // selected trip in time) and enough older rows to cover the full highlighted cycle plus
    // a few rows before it. This prevents the investigation page from dumping months of data.
    if ((aroundDate || currentTripId) && (before > 0 || after > 0)) {
      let anchorIndex = allRows.findIndex(t => (t.consumptionId || t._id) === currentTripId);
      if (anchorIndex < 0 && aroundDate) anchorIndex = allRows.findIndex(t => String(t.date || '') <= String(aroundDate));
      if (anchorIndex >= 0) {
        const fromIndex = Math.max(0, anchorIndex - after);
        const toIndex = Math.min(allRows.length, anchorIndex + before + 1);
        sourceRows = allRows.slice(fromIndex, toIndex);
      }
    }

    const seen = new Set();
    const picked = [];
    for (const trip of sourceRows) {
      const startKm = num(Number(trip.startKm ?? trip.fuelInterval?.startOdometer));
      const endKm = num(Number(trip.endKm ?? trip.fuelInterval?.nextOdometer));
      const litres = num(Number(trip.litres ?? trip.fuelInterval?.fuelLoadedLitres));
      const key = `${trip.date}|${Math.round(endKm ?? -1)}|${round(litres, 1)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const kilometers = actualDistanceKm(trip);
      const distance = this.distanceBenchmarkFor(trip);
      picked.push({
        id: trip.consumptionId || trip._id,
        current: (trip.consumptionId || trip._id) === currentTripId,
        date: trip.date,
        registration: trip.assetId,
        driver: trip.driverAtReport || null,
        fillUpLocation: trip.fillUpLocation || trip.fuelInterval?.startFillLocation || trip.fuelInterval?.nextFillLocation || null,
        destination: trip.destination || null,
        loadLocation: trip.loadLocation || null,
        startKm,
        endKm,
        kilometers: round(kilometers, 1),
        litres: round(litres, 2),
        consumptionKmL: kilometers != null && litres != null && litres > 0 ? round(kilometers / litres, 2) : null,
        expectedDistanceKm: distance?.expectedDistanceKm ?? null,
        extraKm: distance?.extraKm ?? null,
        distanceVariancePct: distance?.distanceVariancePct ?? null,
        distanceStatus: distance?.status ?? 'Unavailable',
        distanceConfidence: distance?.confidence ?? null,
        distanceBenchmarkScope: distance?.scope ?? null,
        sourceKind: trip.sourceKind || 'historical_consumption_report'
      });
      if (picked.length >= max) break;
    }

    const litresTotal = picked.reduce((s, r) => s + (r.litres || 0), 0);
    const kmTotal = picked.reduce((s, r) => s + (r.kilometers || 0), 0);
    const positiveExtraKm = picked.reduce((s, r) => s + Math.max(0, r.extraKm || 0), 0);
    const netDistanceVarianceKm = picked.reduce((s, r) => s + (r.extraKm || 0), 0);
    const result = {
      rows: picked,
      summary: {
        recordCount: picked.length,
        dieselTotalLitres: round(litresTotal, 2),
        kmTotal: round(kmTotal, 1),
        vehicleConsumptionKmL: litresTotal > 0 ? round(kmTotal / litresTotal, 2) : null,
        positiveExtraKm: round(positiveExtraKm, 1),
        netDistanceVarianceKm: round(netDistanceVarianceKm, 1),
        openingOdometer: picked.length ? picked.at(-1)?.startKm ?? null : null,
        closingOdometer: picked.length ? picked[0]?.endKm ?? null : null
      }
    };
    if (this.recentFuelHistoryCache.size > 2500) this.recentFuelHistoryCache.clear();
    this.recentFuelHistoryCache.set(cacheKey, result);
    return result;
  }

  loadPrecomputedBenchmarks(benchmarks = {}, info = {}) {
    this.precomputedBenchmarks = new Map(Object.entries(benchmarks || {}));
    this.precomputedEnabled = true;
    this.precomputedInfo = { ...info, enabled: true };
    this.analysisCache.clear();
    this.dailyCache.clear();
    this.tripListPageCache.clear();
    this.recentFuelHistoryCache.clear();
  }

  buildPrecomputedBenchmarks() {
    const previousEnabled = this.precomputedEnabled;
    this.precomputedEnabled = false;
    const out = {};
    for (const trip of this.prepared) {
      const id = trip.consumptionId || trip._id;
      if (!id) continue;
      out[id] = this.benchmarkFor(trip);
    }
    this.precomputedEnabled = previousEnabled;
    return out;
  }

  precomputedStatus() {
    return {
      enabled: this.precomputedEnabled,
      benchmarkCount: this.precomputedBenchmarks.size,
      ...(this.precomputedInfo || {})
    };
  }

  availableDates() {
    if (this.availableDatesCache) return this.availableDatesCache;
    this.availableDatesCache = [...new Set(this.prepared.map(t => t.date).filter(Boolean))].sort();
    return this.availableDatesCache;
  }

  dateNavigation(date = null) {
    const latestCompleteDate = this.latestCompleteDate();
    // Do not navigate into the partially captured day after the latest complete operating day.
    const dates = this.availableDates().filter(d => !latestCompleteDate || d <= latestCompleteDate);
    const selectedDate = date || latestCompleteDate;
    if (!dates.length) return { selectedDate, previousDate: null, nextDate: null, minDate: null, maxDate: null, latestCompleteDate: null, hasData: false };
    const exact = dates.indexOf(selectedDate);
    if (exact >= 0) {
      return {
        selectedDate,
        previousDate: exact > 0 ? dates[exact - 1] : null,
        nextDate: exact < dates.length - 1 ? dates[exact + 1] : null,
        minDate: dates[0],
        maxDate: dates[dates.length - 1],
        latestCompleteDate,
        hasData: true
      };
    }
    let previousDate = null, nextDate = null;
    for (const d of dates) {
      if (d < selectedDate) previousDate = d;
      else if (d > selectedDate) { nextDate = d; break; }
    }
    return {
      selectedDate,
      previousDate,
      nextDate,
      minDate: dates[0],
      maxDate: dates[dates.length - 1],
      latestCompleteDate,
      hasData: false
    };
  }

  comparableValue(trip) {
    const weight = this.weightAdjustment(trip);
    return weight.applied ? weight.adjustedKmL : trip?.efficiency?.value;
  }

  benchmarkFor(trip) {
    if (!trip) return null;
    const precomputedId = trip.consumptionId || trip._id;
    if (this.precomputedEnabled && precomputedId && this.precomputedBenchmarks.has(precomputedId)) {
      return this.precomputedBenchmarks.get(precomputedId);
    }
    if (trip.efficiency?.value == null || trip.likelyDataError) return null;
    const date = trip.date;
    const currentId = trip.consumptionId;
    const historyLimit = Math.max(30, Number(this.settings.recentBenchmarkLimit || 180));
    const before = rows => rows
      .filter(r => r.consumptionId !== currentId && r.date && r.date < date && r.validForBenchmark)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .slice(0, historyLimit);
    let candidates = [];
    let scope = null;
    let confidence = 'medium';

    if (trip.destination) {
      const sameTruckDest = before(this.byAsset.get(trip.assetId) || []).filter(r => r.destination && r.destination.toUpperCase() === trip.destination.toUpperCase());
      if (sameTruckDest.length >= Number(this.settings.minSameVehicleDestinationSamples || 5)) {
        candidates = sameTruckDest; scope = 'Same truck + same destination'; confidence = 'high';
      }
    }
    if (!candidates.length && trip.destination) {
      const key = `${trip.peerType}|||${trip.destination.toUpperCase()}`;
      const peers = before(this.byTypeDest.get(key) || []);
      if (peers.length >= Number(this.settings.minPeerDestinationSamples || 8)) {
        candidates = peers; scope = `${trip.peerType} model/type + same destination`; confidence = 'high';
      }
    }
    if (!candidates.length && trip.destination) {
      const brandKey = `${trip.brand}|||${trip.destination.toUpperCase()}`;
      const brandPeers = before(this.byBrandDest.get(brandKey) || []);
      if (brandPeers.length >= Math.max(10, Number(this.settings.minPeerDestinationSamples || 8))) {
        candidates = brandPeers; scope = `${trip.brand} brand + same destination`; confidence = 'medium';
      }
    }
    if (!candidates.length) {
      const sameTruck = before(this.byAsset.get(trip.assetId) || []);
      if (sameTruck.length >= 8) { candidates = sameTruck; scope = 'Same truck across all destinations'; confidence = 'medium'; }
    }
    if (!candidates.length) {
      const peers = before(this.byType.get(trip.peerType) || []);
      if (peers.length >= 10) { candidates = peers; scope = `${trip.peerType} model/type across all destinations`; confidence = 'low'; }
    }
    if (!candidates.length) {
      const brandPeers = before(this.byBrand.get(trip.brand) || []);
      if (brandPeers.length >= 12) { candidates = brandPeers; scope = `${trip.brand} brand across all destinations`; confidence = 'low'; }
    }
    if (!candidates.length) return null;

    const values = candidates.map(r => this.comparableValue(r)).filter(v => v != null);
    const stats = robustStats(values, Number(this.settings.outlierMadThreshold || 3.5));
    if (!stats || stats.sampleSize < 3) return null;

    // The MAD/IQR rejection is a continuous range, so use the clean min/max to calculate
    // route-distance and litres context from the same records that support the benchmark.
    const cleanValues = robustClean(values, Number(this.settings.outlierMadThreshold || 3.5));
    const cleanMin = Math.min(...cleanValues), cleanMax = Math.max(...cleanValues);
    const cleanRows = candidates.filter(r => {
      const v = this.comparableValue(r);
      return v != null && v >= cleanMin - 1e-9 && v <= cleanMax + 1e-9;
    });
    const avgOf = field => {
      const vals = cleanRows.map(r => num(r[field])).filter(v => v != null && v > 0);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    };
    return {
      ...stats,
      scope,
      confidence,
      totalCandidateCount: candidates.length,
      averageDistanceKm: avgOf('kilometers'),
      averageLitres: avgOf('litres'),
      historyLimit
    };
  }

  trailerEvidence(trip) {
    const rawContext = this.contexts.get(trip?.consumptionId) || null;
    const context = normaliseContext(rawContext);
    const requestedReg = validText(context?.trailerRegistration) ? String(context.trailerRegistration).trim().toUpperCase() : null;
    const trailerAsset = requestedReg ? this.assets.get(requestedReg) : null;
    const trailerValid = Boolean(trailerAsset?.isTrailer === true);
    const permits = trailerValid ? (this.permitsByAsset.get(requestedReg) || []) : [];
    const capacities = permits.map(p => num(Number(p.permissibleWeightKgParsed))).filter(v => v != null && v > 0);
    const permitCapacityKg = capacities.length ? Math.max(...capacities) : null;
    const permit = permits.find(p => num(Number(p.permissibleWeightKgParsed)) === permitCapacityKg) || permits[0] || null;

    const evidenceKey = String(context?.evidenceSource || 'unverified').trim().toLowerCase();
    const actualMassComplete = Boolean(
      context && rawContext &&
      rawContext.truckTareKg !== null && rawContext.truckTareKg !== undefined &&
      rawContext.trailerTareKg !== null && rawContext.trailerTareKg !== undefined &&
      rawContext.outboundProductKg !== null && rawContext.outboundProductKg !== undefined &&
      rawContext.returnProductKg !== null && rawContext.returnProductKg !== undefined &&
      rawContext.loadedDistancePct !== null && rawContext.loadedDistancePct !== undefined &&
      num(context.truckTareKg) != null && context.truckTareKg > 0 &&
      num(context.trailerTareKg) != null && context.trailerTareKg > 0 &&
      num(context.outboundProductKg) != null && context.outboundProductKg >= 0 &&
      num(context.returnProductKg) != null && context.returnProductKg >= 0 &&
      num(context.loadedDistancePct) != null
    );
    const verified = Boolean(
      context?.confirmed === true &&
      VERIFIED_EVIDENCE_SOURCES.has(evidenceKey) &&
      trailerValid &&
      actualMassComplete
    );

    let status = 'Unknown';
    if (verified) status = 'Verified';
    else if (trailerValid || permitCapacityKg != null) status = 'Estimated';

    const loadingInstructionLinked = Boolean(trip?.loadingInstructionNo);
    const sourceLabel = verified
      ? evidenceSourceLabel(evidenceKey)
      : status === 'Estimated'
        ? 'Trailer master / permit data only'
        : 'No source-backed trip-level trailer assignment';

    const note = verified
      ? `Trip-level trailer and actual mass values are confirmed from ${sourceLabel}. Weight normalization may be applied.`
      : status === 'Estimated'
        ? 'The selected trailer and permit capacity can describe the equipment, but permit capacity is not actual trip load or trailer tare. It is displayed as an estimate only and does not alter the fuel rating.'
        : loadingInstructionLinked
          ? 'The Loading Instruction links this truck/date to route/customer evidence, but the supplied historical Loading Instruction data does not contain a trailer registration or actual product mass. The app will not invent that relationship.'
          : 'The supplied historical fuel/route sources do not contain a reliable trip-level truck-to-trailer or actual-load link for this record. The app leaves the weight evidence unknown rather than guessing.';

    return {
      status,
      canNormalize: verified,
      source: sourceLabel,
      sourceReference: validText(context?.sourceReference) ? String(context.sourceReference).trim() : null,
      trailerRegistration: trailerValid ? requestedReg : null,
      trailerDescription: trailerValid ? (trailerAsset.description || trailerAsset.assetType || 'Trailer') : null,
      trailerStatus: trailerValid ? (trailerAsset.vehicleStatus || null) : null,
      permitCapacityKg,
      permitCapacityRaw: permit?.permissibleWeightRaw || null,
      permitCategory: permit?.category || null,
      permitMake: permit?.make || null,
      permitCount: permits.length,
      productName: validText(context?.productName) ? String(context.productName).trim() : null,
      actualMassComplete,
      loadingInstructionLinked,
      loadingInstructionNo: trip?.loadingInstructionNo || null,
      routeMatchConfidence: trip?.matchConfidence || 'none',
      note
    };
  }

  weightAdjustment(trip) {
    const context = normaliseContext(this.contexts.get(trip.consumptionId));
    const mass = contextMass(context);
    const evidence = this.trailerEvidence(trip);
    if (!context || !mass || !this.settings.weightNormalizationEnabled || !evidence.canNormalize) return { context, applied: false, mass, evidence };
    const referenceGrossKg = num(Number(context.referenceGrossKg)) || num(Number(this.settings.defaultReferenceGrossKg)) || 42000;
    if (referenceGrossKg <= 0) return { context, applied: false, mass, evidence };
    const sensitivity = Math.max(0, Math.min(1, Number(this.settings.weightSensitivity ?? .35)));
    const massRatio = mass.averageGrossKg / referenceGrossKg;
    const fuelMultiplier = Math.max(.7, Math.min(1.5, 1 + sensitivity * (massRatio - 1)));
    const adjustedKmL = trip.efficiency.value != null ? trip.efficiency.value * fuelMultiplier : null;
    return {
      context,
      mass,
      applied: adjustedKmL != null,
      referenceGrossKg,
      sensitivity,
      fuelMultiplier,
      adjustedKmL,
      note: 'Prototype load normalization; calibrate with telematics/OEM data before production.',
      evidence
    };
  }

  analyseTrip(trip) {
    if (!trip) return null;
    const cacheKey = trip.consumptionId || trip._id;
    if (cacheKey && this.analysisCache.has(cacheKey)) return this.analysisCache.get(cacheKey);
    const benchmark = this.benchmarkFor(trip);
    const distanceBenchmark = this.distanceBenchmarkFor(trip);
    const weight = this.weightAdjustment(trip);
    const observed = trip.efficiency.value;
    const analysisValue = weight.applied ? weight.adjustedKmL : observed;
    let deviationPct = null, robustZ = null, performanceIndex = null, expectedRawKmL = null, expectedLitres = null, excessLitres = null, fuelVariancePct = null, rating = 'Data Warning';
    if (analysisValue != null && benchmark) {
      deviationPct = ((analysisValue - benchmark.average) / benchmark.average) * 100;
      robustZ = (analysisValue - benchmark.average) / benchmark.robustSigma;
      performanceIndex = (analysisValue / benchmark.average) * 100;
      const loadFactor = weight.applied ? weight.fuelMultiplier : 1;
      expectedRawKmL = benchmark.average / loadFactor;
      if (num(trip.kilometers) != null && trip.kilometers > 0 && expectedRawKmL > 0) {
        expectedLitres = trip.kilometers / expectedRawKmL;
        if (num(trip.litres) != null && trip.litres > 0) {
          excessLitres = trip.litres - expectedLitres;
          fuelVariancePct = (trip.litres / expectedLitres - 1) * 100;
        }
      }
      const poor = Number(this.settings.poorDeviationPct ?? -15);
      const review = Number(this.settings.reviewDeviationPct ?? -7.5);
      const good = Number(this.settings.goodDeviationPct ?? 4);
      const outstanding = Number(this.settings.outstandingDeviationPct ?? 10);
      if (deviationPct <= poor || robustZ <= -2) rating = 'Poor';
      else if (deviationPct <= review || robustZ <= -1) rating = 'Review';
      else if (deviationPct >= outstanding && robustZ >= 1.25 && benchmark.confidence === 'high') rating = 'Outstanding';
      else if (deviationPct >= good) rating = 'Good';
      else rating = 'Average';
    }
    if (trip.likelyDataError || observed == null) rating = 'Data Warning';

    const explanations = [];
    if (trip.efficiency.correction) explanations.push(trip.efficiency.correction + '.');
    if (trip.profileDecimalCorrection) explanations.push('This profile-based decimal correction is kept out of historical averages until the source distance/litres are verified.');
    if (trip.likelyDataError) explanations.push('This value is too far outside the vehicle’s robust historical profile to treat as genuine performance. It is excluded from averages and shown as a data warning.');
    if (benchmark) {
      explanations.push(`Benchmark uses ${benchmark.scope.toLowerCase()} with ${benchmark.sampleSize} clean historical records after ${benchmark.excludedOutliers} statistical outlier(s) were removed.`);
      if (deviationPct != null) explanations.push(`${round(Math.abs(deviationPct), 1)}% ${deviationPct < 0 ? 'below' : 'above'} the robust historical average.`);
      if (expectedLitres != null && excessLitres != null) {
        explanations.push(`For ${round(trip.kilometers, 0)} km, this benchmark implies about ${round(expectedLitres, 1)} L; the record used ${round(Math.abs(excessLitres), 1)} L ${excessLitres >= 0 ? 'more' : 'less'} than expected.`);
      }
      if (benchmark.averageDistanceKm && trip.kilometers > 0) {
        const distanceDelta = ((trip.kilometers - benchmark.averageDistanceKm) / benchmark.averageDistanceKm) * 100;
        if (Math.abs(distanceDelta) >= 25) explanations.push(`Trip distance is ${round(Math.abs(distanceDelta), 0)}% ${distanceDelta < 0 ? 'shorter' : 'longer'} than the average distance in the benchmark sample, so route/detour/idling context should be checked.`);
      }
    } else explanations.push('There are not enough clean historical records for a reliable benchmark.');
    if (trip.destination) explanations.push(`Destination context: ${trip.destination} (${trip.destinationMeta.source}, ${trip.destinationMeta.confidence} confidence).`);
    else explanations.push('Destination is not reliably available, so any comparison falls back to broader vehicle/type history.');

    if (distanceBenchmark) {
      const distanceDirection = distanceBenchmark.extraKm > 0 ? 'more' : distanceBenchmark.extraKm < 0 ? 'less' : 'the same distance';
      explanations.push(`Route distance check: ${round(distanceBenchmark.actualDistanceKm, 0)} km recorded versus about ${round(distanceBenchmark.expectedDistanceKm, 0)} km expected from ${distanceBenchmark.scope.toLowerCase()} (${distanceBenchmark.sampleSize} clean records).`);
      if (Math.abs(distanceBenchmark.extraKm || 0) >= 10) explanations.push(`The odometer interval is about ${round(Math.abs(distanceBenchmark.extraKm), 0)} km ${distanceDirection} than the route benchmark. This may help explain part of the fuel variance and should be checked for detours, additional movements or route changes.`);
    }

    if (trip.fuelInterval) {
      const conf = trip.fuelAttributionConfidence || trip.fuelInterval.attributionConfidence || 'unknown';
      explanations.push(`Fuel interval attribution: ${conf} confidence. ${round(trip.fuelInterval.fuelLoadedLitres, 1)} L was recorded at the interval start and compared with the odometer movement to the next fuel event.`);
      if ((trip.linkedLoadingInstructions || []).length > 1) explanations.push(`This fuel interval contains ${(trip.linkedLoadingInstructions || []).length} candidate Loading Instructions, so the litres are treated as interval-level fuel rather than being falsely assigned to one job.`);
      if (num(trip.totalStandingHours) != null) explanations.push(`Recorded load/offload standing time for the matched Loading Instruction totals about ${round(trip.totalStandingHours, 1)} hours. Standing time is operational context only and is not assumed to be engine idling.`);
    }

    if (weight.applied) {
      explanations.push(`Verified load normalization is applied using an average gross mass of ${round(weight.mass.averageGrossKg / 1000, 1)} t versus a ${round(weight.referenceGrossKg / 1000, 1)} t reference.`);
    } else if (weight.evidence?.status === 'Estimated') {
      explanations.push('Trailer/permit information is available only as estimated equipment context. Permit capacity is not actual trip load, so it is deliberately excluded from the fuel calculation.');
    } else {
      explanations.push('Trip-level trailer tare and actual product mass are not verified for this historical trip, so the score is not weight-normalized.');
    }
    if (trip.matchConfidence === 'ambiguous') explanations.push('More than one Loading Instruction route is plausible for this fuel interval, so the app does not invent a single route.');

    let confidenceScore = 35;
    if (benchmark?.confidence === 'high') confidenceScore += 30;
    else if (benchmark?.confidence === 'medium') confidenceScore += 20;
    else if (benchmark) confidenceScore += 10;
    if (benchmark?.sampleSize >= 20) confidenceScore += 10;
    else if (benchmark?.sampleSize >= 8) confidenceScore += 6;
    if (trip.destinationMeta.confidence === 'high') confidenceScore += 10;
    else if (trip.destination) confidenceScore += 5;
    if (weight.applied) confidenceScore += 10;
    if (trip.fuelAttributionConfidence === 'high') confidenceScore += 5;
    else if (trip.fuelAttributionConfidence === 'ambiguous') confidenceScore = Math.min(confidenceScore, 75);
    if (trip.profileDecimalCorrection) confidenceScore = Math.min(confidenceScore, 65);
    if (trip.likelyDataError) confidenceScore = Math.min(confidenceScore, 30);
    confidenceScore = Math.max(10, Math.min(100, confidenceScore));

    const result = {
      id: trip.consumptionId,
      consumptionId: trip.consumptionId,
      registration: trip.assetId,
      date: trip.date,
      asset: this.vehicleSummary(trip.assetId, false),
      destination: trip.destination,
      destinationSource: trip.destinationMeta.source,
      destinationConfidence: trip.destinationMeta.confidence,
      fillUpLocation: trip.fillUpLocation || null,
      customerName: trip.customerName || null,
      loadingInstructionNo: trip.loadingInstructionNo || null,
      routeMatchConfidence: trip.matchConfidence || 'none',
      driverContext: trip.driverAtReport || null,
      kilometers: round(actualDistanceKm(trip), 1),
      startKm: num(Number(trip.startKm ?? trip.fuelInterval?.startOdometer)),
      endKm: num(Number(trip.endKm ?? trip.fuelInterval?.nextOdometer)),
      litres: trip.litres,
      distanceBenchmark,
      expectedDistanceKm: distanceBenchmark?.expectedDistanceKm ?? null,
      extraKm: distanceBenchmark?.extraKm ?? null,
      distanceVariancePct: distanceBenchmark?.distanceVariancePct ?? null,
      distanceStatus: distanceBenchmark?.status ?? null,
      reportedKmL: round(trip.efficiency.reported),
      calculatedKmL: round(trip.efficiency.calculated),
      analysedKmL: round(analysisValue),
      rawAnalysedKmL: round(observed),
      corrected: Boolean(trip.efficiency.correction),
      correction: trip.efficiency.correction,
      likelyDataError: trip.likelyDataError,
      qualityFlags: trip.qualityFlags,
      validForBenchmark: trip.validForBenchmark,
      benchmark: benchmark ? {
        averageKmL: round(benchmark.average), medianKmL: round(benchmark.median), lowKmL: round(benchmark.low), highKmL: round(benchmark.high),
        sampleSize: benchmark.sampleSize, excludedOutliers: benchmark.excludedOutliers, scope: benchmark.scope, confidence: benchmark.confidence,
        averageDistanceKm: round(benchmark.averageDistanceKm, 0), averageLitres: round(benchmark.averageLitres, 1), historyLimit: benchmark.historyLimit
      } : null,
      deviationPct: round(deviationPct, 1), robustZ: round(robustZ, 2), performanceIndex: round(performanceIndex, 1),
      expectedRawKmL: round(expectedRawKmL), expectedLitres: round(expectedLitres, 1), excessLitres: round(excessLitres, 1), fuelVariancePct: round(fuelVariancePct, 1), rating,
      confidenceScore,
      fuelInterval: trip.fuelInterval ? {
        ...trip.fuelInterval,
        distanceKm: round(trip.fuelInterval.distanceKm, 1),
        fuelLoadedLitres: round(trip.fuelInterval.fuelLoadedLitres, 1)
      } : null,
      fuelAttributionConfidence: trip.fuelAttributionConfidence || null,
      fuelSourceConfirmation: trip.fuelSourceConfirmation || null,
      linkedLoadingInstructions: trip.linkedLoadingInstructions || [],
      loadStandingHours: round(trip.loadStandingHours, 1),
      offloadStandingHours: round(trip.offloadStandingHours, 1),
      totalStandingHours: round(trip.totalStandingHours, 1),
      sourceKind: trip.sourceKind || 'historical_consumption_report',
      trailerEvidence: weight.evidence || this.trailerEvidence(trip),
      weight: weight.applied ? {
        applied: true,
        trailerRegistration: weight.context.trailerRegistration || null,
        productName: weight.context.productName || null,
        truckTareKg: weight.context.truckTareKg,
        trailerTareKg: weight.context.trailerTareKg,
        outboundProductKg: weight.context.outboundProductKg,
        returnProductKg: weight.context.returnProductKg,
        loadedDistancePct: weight.context.loadedDistancePct,
        averagePayloadKg: round(weight.mass.averagePayloadKg, 0),
        averageGrossKg: round(weight.mass.averageGrossKg, 0),
        referenceGrossKg: round(weight.referenceGrossKg, 0),
        fuelMultiplier: round(weight.fuelMultiplier, 3),
        confirmed: true,
        evidenceSource: weight.context.evidenceSource || null,
        sourceReference: weight.context.sourceReference || null,
        note: weight.note
      } : { applied: false, ...(weight.context || {}) },
      explanations
    };
    if (cacheKey) this.analysisCache.set(cacheKey, result);
    return result;
  }

  vehicleSummary(reg, includeLatest = true) {
    const asset = this.assets.get(reg);
    if (!asset) return null;
    const tareEstimate = estimateAssetTare(asset);
    const latest = this.latestTripByAsset.get(reg) || null;
    const latestAnalysis = includeLatest && latest ? this.analyseTrip(latest) : null;
    const profile = this.assetProfile.get(reg);
    return {
      registration: reg,
      description: asset.description || asset.assetType || 'Vehicle',
      type: asset.isTrailer ? 'Trailer' : (asset.vehicleGroup || 'Vehicle'),
      manufacturer: brandFrom(asset),
      model: asset.assetType || asset.description || '',
      status: asset.vehicleStatus || 'Unknown',
      vehicleGroup: asset.vehicleGroup || asset.assetType || 'Unclassified',
      peerType: peerType(asset),
      vin: asset.vin || 'Not available',
      odometerKm: num(Number(latest?.endKm)) ?? asset.odometer ?? null,
      currentKmL: latestAnalysis?.analysedKmL ?? (latest ? round(latest.efficiency.value) : null),
      currentRating: latestAnalysis?.rating || null,
      lastTripDate: latest?.date || null,
      historicalMedianKmL: round(profile?.median),
      openAlerts: 0,
      isTrailer: Boolean(asset.isTrailer),
      axleConfiguration: asset.axleConfiguration || null,
      estimatedTareKg: tareEstimate.tareKg,
      tareEstimateSource: tareEstimate.source,
      tareEstimateConfidence: tareEstimate.confidence
    };
  }

  listVehicles({ search = '', status = '', limit = 500 } = {}) {
    const q = search.trim().toUpperCase();
    const max = Math.max(1, Math.min(1000, Number(limit) || 500));

    // Most Fleet page loads request the complete unfiltered vehicle list.
    // Cache that compact list in memory after the first construction.
    if (!q && !status && this.vehicleListBaseCache) return this.vehicleListBaseCache.slice(0, max);

    const items = [];
    for (const asset of this.assets.values()) {
      if (asset.isTrailer === true) continue;
      if (status && String(asset.vehicleStatus || '').toLowerCase() !== status.toLowerCase()) continue;
      const hay = `${asset._id} ${asset.description || ''} ${asset.assetType || ''} ${asset.vehicleGroup || ''} ${brandFrom(asset)}`.toUpperCase();
      if (q && !hay.includes(q)) continue;
      items.push(this.vehicleSummary(asset._id, false));
    }
    items.sort((a, b) => a.registration.localeCompare(b.registration));
    if (!q && !status) this.vehicleListBaseCache = items;
    return items.slice(0, max);
  }

  listTrailers({ search = '', limit = 500 } = {}) {
    const q = search.trim().toUpperCase();
    const out = [];
    for (const asset of this.assets.values()) {
      if (asset.isTrailer !== true) continue;
      const registration = String(asset._id || '').trim().toUpperCase();
      if (!registration || ['(NONE)','NONE','UNKNOWN','N/A','NULL'].includes(registration) || registration.startsWith('AWAITING')) continue;
      const hay = `${asset._id} ${asset.description || ''} ${asset.assetType || ''}`.toUpperCase();
      if (q && !hay.includes(q)) continue;
      const permits = this.permitsByAsset.get(asset._id) || [];
      const tare = estimateAssetTare(asset);
      const referencePayload = trailerReferencePayloadKg(asset, permits);
      out.push({
        registration: asset._id,
        description: asset.description || asset.assetType || 'Trailer',
        status: asset.vehicleStatus,
        assetType: asset.assetType || null,
        axleConfiguration: asset.axleConfiguration || null,
        permits,
        estimatedTareKg: tare.tareKg,
        tareEstimateSource: tare.source,
        tareEstimateConfidence: tare.confidence,
        referencePayloadKg: referencePayload.payloadKg,
        referencePayloadSource: referencePayload.source
      });
    }
    return out.slice(0, Math.min(1000, Number(limit) || 500));
  }

  tripById(id) {
    return this.preparedById.get(id) || null;
  }

  compactTripForList(trip) {
    const x = this.analyseTrip(trip);
    return {
      id: x.id,
      consumptionId: x.consumptionId,
      registration: x.registration,
      date: x.date,
      destination: x.destination,
      destinationSource: x.destinationSource,
      fillUpLocation: x.fillUpLocation,
      driverContext: x.driverContext,
      loadingInstructionNo: x.loadingInstructionNo,
      kilometers: x.kilometers,
      startKm: x.startKm ?? null,
      endKm: x.endKm ?? null,
      litres: x.litres,
      analysedKmL: x.analysedKmL,
      expectedDistanceKm: x.expectedDistanceKm ?? null,
      extraKm: x.extraKm ?? null,
      distanceVariancePct: x.distanceVariancePct ?? null,
      distanceStatus: x.distanceStatus ?? null,
      expectedLitres: x.expectedLitres ?? null,
      excessLitres: x.excessLitres ?? null,
      fuelVariancePct: x.fuelVariancePct ?? null,
      rating: x.rating,
      confidenceScore: x.confidenceScore,
      deviationPct: x.deviationPct,
      corrected: x.corrected,
      correction: x.correction,
      likelyDataError: x.likelyDataError,
      qualityFlags: x.qualityFlags,
      sourceKind: x.sourceKind,
      hasFuelEvidence: Boolean(x.fuelInterval || x.fuelSourceConfirmation),
      benchmark: x.benchmark ? {
        averageKmL: x.benchmark.averageKmL,
        sampleSize: x.benchmark.sampleSize,
        scope: x.benchmark.scope,
        confidence: x.benchmark.confidence
      } : null
    };
  }

  tripsForVehicle(reg, { destination = '', from = '', to = '', limit = 200 } = {}) {
    const dest = destination.trim().toUpperCase();
    return (this.allTripsByAsset.get(reg) || [])
      .filter(t => (!from || t.date >= from) && (!to || t.date <= to) && (!dest || (t.destination || '').toUpperCase() === dest))
      .slice(0, Math.min(500, Number(limit) || 200))
      .map(t => this.analyseTrip(t));
  }

  tripListPage(reg, { destination = '', from = '', to = '', limit = 100, offset = 0 } = {}) {
    const dest = destination.trim().toUpperCase();
    const max = Math.max(20, Math.min(200, Number(limit) || 100));
    const start = Math.max(0, Number(offset) || 0);
    const key = `${reg}|${dest}|${from}|${to}|${max}|${start}`;
    if (this.tripListPageCache.has(key)) return this.tripListPageCache.get(key);

    const source = this.allTripsByAsset.get(reg) || [];
    const filtered = source.filter(t =>
      (!from || t.date >= from) &&
      (!to || t.date <= to) &&
      (!dest || (t.destination || '').toUpperCase() === dest)
    );
    const items = filtered.slice(start, start + max).map(t => this.compactTripForList(t));
    const result = {
      registration: reg,
      total: filtered.length,
      offset: start,
      limit: max,
      hasMore: start + items.length < filtered.length,
      items
    };
    // Keep the cache bounded. Interactive filters only need a small working set.
    if (this.tripListPageCache.size > 120) this.tripListPageCache.clear();
    this.tripListPageCache.set(key, result);
    return result;
  }

  dayTripList(date = null) {
    const selectedDate = date || this.latestCompleteDate();
    return (this.tripsByDate.get(selectedDate) || []).map(t => this.compactTripForList(t));
  }

  destinationsForVehicle(reg) {
    return this.destinationsByAssetCache.get(reg) || [];
  }

  latestCompleteDate() {
    if (this.latestCompleteDateCache !== undefined) return this.latestCompleteDateCache;
    const sourceDeclared = String(this.snapshot?.meta?.latestCompleteFuelConsumptionDate || '').slice(0, 10);
    if (sourceDeclared && this.availableDates().includes(sourceDeclared)) {
      this.latestCompleteDateCache = sourceDeclared;
      return sourceDeclared;
    }
    const counts = new Map();
    for (const t of this.prepared) if (t.date && t.efficiency.value != null) counts.set(t.date, (counts.get(t.date) || 0) + 1);
    const dates = [...counts.keys()].sort().reverse();
    if (!dates.length) {
      this.latestCompleteDateCache = null;
      return null;
    }
    const recentCounts = dates.slice(0, 14).map(d => counts.get(d)).sort((a, b) => a - b);
    const typical = median(recentCounts) || 1;
    const minimum = Math.max(15, Math.floor(typical * .65));
    this.latestCompleteDateCache = dates.find(d => counts.get(d) >= minimum) || dates[0];
    return this.latestCompleteDateCache;
  }

  daily(date = null) {
    const selectedDate = date || this.latestCompleteDate();
    const cacheKey = selectedDate || '__none__';
    if (this.dailyCache.has(cacheKey)) return this.dailyCache.get(cacheKey);
    const rows = (this.tripsByDate.get(selectedDate) || []).map(t => this.analyseTrip(t));
    const order = { Poor: 0, Review: 1, 'Data Warning': 2, Average: 3, Good: 4, Outstanding: 5 };
    const actionable = rows.filter(x => ['Poor', 'Review'].includes(x.rating)).sort((a, b) => (a.deviationPct ?? 999) - (b.deviationPct ?? 999));
    const outstanding = rows.filter(x => ['Outstanding', 'Good'].includes(x.rating)).sort((a, b) => (b.deviationPct ?? -999) - (a.deviationPct ?? -999));
    const dataWarnings = rows.filter(x => x.rating === 'Data Warning');
    const valid = rows.filter(x => x.analysedKmL != null && x.rating !== 'Data Warning');
    const result = {
      date: selectedDate,
      totalTrips: rows.length,
      averageKmL: valid.length ? round(valid.reduce((s, x) => s + x.analysedKmL, 0) / valid.length) : null,
      counts: {
        poor: rows.filter(x => x.rating === 'Poor').length,
        review: rows.filter(x => x.rating === 'Review').length,
        average: rows.filter(x => x.rating === 'Average').length,
        good: rows.filter(x => x.rating === 'Good').length,
        outstanding: rows.filter(x => x.rating === 'Outstanding').length,
        dataWarnings: dataWarnings.length
      },
      needsReview: actionable,
      outstanding,
      dataWarnings,
      trips: rows.sort((a, b) => (order[a.rating] ?? 9) - (order[b.rating] ?? 9))
    };
    this.dailyCache.set(cacheKey, result);
    return result;
  }

  fleetSummary() {
    if (this.fleetSummaryCache) return this.fleetSummaryCache;
    const active = [...this.assets.values()].filter(a => a.isTrailer !== true && a.vehicleStatus === 'Active').length;
    this.fleetSummaryCache = { activeTrucks: active, historicalTrips: this.prepared.length, latestCompleteDate: this.latestCompleteDate() };
    return this.fleetSummaryCache;
  }
}
