import crypto from 'node:crypto';
import { estimateAssetTare, trailerReferencePayloadKg } from './weight-reference.js';
import { weightedFuelEfficiency } from './logic.js';

// V20 MODEL + ROUTE BENCHMARKING + V19 WEIGHTED FUEL CONTRIBUTION
// A trip result is still total full-cycle km / total counted litres.
// Performance is now primarily compared with prior full cycles by the SAME fleet-master
// truck model/type + axle configuration on the SAME route. The exact truck's own route
// history remains visible as a secondary diagnostic benchmark.

function finite(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function round(v, d = 2) {
  return v == null || !Number.isFinite(Number(v)) ? null : Number(Number(v).toFixed(d));
}
function mean(values) {
  const a = values.filter(v => Number.isFinite(v));
  return a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;
}
function median(values) {
  const a = values.filter(v => Number.isFinite(v)).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
function stddev(values) {
  const a = values.filter(v => Number.isFinite(v));
  if (a.length < 2) return 0;
  const avg = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + ((v - avg) ** 2), 0) / (a.length - 1));
}
function quantile(values, q) {
  const a = values.filter(v => Number.isFinite(v)).sort((x, y) => x - y);
  if (!a.length) return null;
  const pos = (a.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  if (lo === hi) return a[lo];
  return a[lo] + (a[hi] - a[lo]) * (pos - lo);
}
function normalizePlace(value) {
  if (!value) return null;
  const x = String(value)
    .toUpperCase()
    .replace(/&/g, ' AND ')
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\b(MINE|SITE)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return x || null;
}
function normalizeModelToken(value) {
  if (!value) return null;
  const x = String(value).toUpperCase().replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  return x || null;
}
function normalizeAxle(value) {
  const x = normalizeModelToken(value);
  if (!x) return null;
  if (/\b6 X 4\b|\b6X4\b/.test(x)) return '6x4';
  if (/\b4 X 2\b|\b4X2\b|\b2 X 4\b|\b2X4\b/.test(x)) return '4x2';
  if (/3 AXLE|3 SINGLE/.test(x)) return '3 axle';
  if (/2 AXLE|2 DOUBLE/.test(x)) return '2 axle';
  if (/1 AXLE|1 SINGLE/.test(x)) return '1 axle';
  return x.toLowerCase();
}
function modelIdentity(asset) {
  if (!asset) return { key: null, label: 'Model unavailable', type: null, axle: null, source: 'No fleet master record' };
  const rawType = String(asset.assetType || asset.description || '').trim();
  const typeKey = normalizeModelToken(rawType);
  if (!typeKey) return { key: null, label: 'Model unavailable', type: null, axle: normalizeAxle(asset.axleConfiguration), source: 'Fleet master model/type unavailable' };
  const axle = normalizeAxle(asset.axleConfiguration);
  const key = `${typeKey}|||${normalizeModelToken(axle || 'AXLE UNKNOWN')}`;
  return {
    key,
    label: `${rawType}${axle ? ` · ${axle}` : ''}`,
    type: rawType,
    axle,
    source: asset.assetType ? 'Fleet master assetType + axle configuration' : 'Fleet master description + axle configuration'
  };
}
function dateMonthsBefore(dateString, months) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateString || ''));
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  d.setUTCMonth(d.getUTCMonth() - Math.max(0, Number(months) || 0));
  return d.toISOString().slice(0, 10);
}
function sum(values) {
  return values.filter(v => Number.isFinite(v)).reduce((s, v) => s + v, 0);
}
function cycleId(reg, openingId, closingId) {
  const h = crypto.createHash('sha1').update(`${reg}|${openingId}|${closingId}`).digest('hex').slice(0, 18);
  return `cycle_${h}`;
}
function uniqueBy(items, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = keyFn(item);
    if (key == null || seen.has(key)) continue;
    seen.add(key); out.push(item);
  }
  return out;
}

/**
 * Full-to-full fuel cycle analytics.
 *
 * A performance cycle starts immediately AFTER a verified Stellar fuel event and closes
 * at the next Stellar fuel event for the same truck. All fuel rows after the opening
 * event through and including the closing event are included in the cycle.
 *
 * This is the normal full-to-full / brim-to-brim accounting rule when the boundary
 * events restore the tank to the same state: opening fill litres are excluded; all
 * intermediate top-ups plus the closing full-up are included.
 */
export class CycleAnalyticsEngine {
  constructor(rawEngine, contexts = [], settings = {}) {
    this.rawEngine = rawEngine;
    this.settings = settings || {};
    this.contexts = new Map((contexts || []).map(c => [c.consumptionId, c]));
    this.homePatterns = Array.isArray(this.settings.homeFillLocationPatterns) && this.settings.homeFillLocationPatterns.length
      ? this.settings.homeFillLocationPatterns.map(x => String(x).trim().toUpperCase()).filter(Boolean)
      : ['STELLAR'];
    this.minBenchmarkSamples = Math.max(1, Number(this.settings.minFullCycleBenchmarkSamples || 3));
    this.modelBenchmarkMonths = Math.max(6, Math.min(120, Number(this.settings.modelBenchmarkMonths || 36)));
    this.minModelBenchmarkTrucks = Math.max(2, Number(this.settings.minModelBenchmarkTrucks || 2));
    this.cycles = [];
    this.byId = new Map();
    this.byAsset = new Map();
    this.byModel = new Map();
    this.byDate = new Map();
    this.analysisCache = new Map();
    this.dashboardCache = new Map();
    this.destinationCache = new Map();
    this.build();
  }

  isHomeFill(row) {
    const loc = String(row?.fillUpLocation || '').trim().toUpperCase();
    return Boolean(loc) && this.homePatterns.some(p => loc.includes(p));
  }

  rowSort(a, b) {
    const d = String(a.date || '').localeCompare(String(b.date || ''));
    if (d) return d;
    const ak = finite(a.endKm), bk = finite(b.endKm);
    if (ak != null && bk != null && ak !== bk) return ak - bk;
    return String(a.consumptionId || '').localeCompare(String(b.consumptionId || ''));
  }

  build() {
    const rawRows = Array.isArray(this.rawEngine?.prepared) ? this.rawEngine.prepared : [];
    const grouped = new Map();
    for (const row of rawRows) {
      if (!row?.assetId) continue;
      if (!grouped.has(row.assetId)) grouped.set(row.assetId, []);
      grouped.get(row.assetId).push(row);
    }

    for (const [reg, source] of grouped.entries()) {
      const rows = [...source].sort((a, b) => this.rowSort(a, b));
      const anchors = [];
      for (let i = 0; i < rows.length; i++) {
        const endKm = finite(rows[i].endKm ?? rows[i].fuelInterval?.nextOdometer);
        const litres = finite(rows[i].litres);
        if (this.isHomeFill(rows[i]) && endKm != null && endKm > 0 && litres != null && litres > 0) anchors.push(i);
      }

      const vehicleCycles = [];
      for (let p = 0; p < anchors.length - 1; p++) {
        const openingIndex = anchors[p], closingIndex = anchors[p + 1];
        if (closingIndex <= openingIndex) continue;
        const opening = rows[openingIndex], closing = rows[closingIndex];
        const included = rows.slice(openingIndex + 1, closingIndex + 1);
        const cycle = this.makeCycle(reg, opening, closing, included, vehicleCycles.length);
        if (!cycle) continue;
        vehicleCycles.push(cycle);
        this.cycles.push(cycle);
        this.byId.set(cycle.id, cycle);
        if (cycle.modelKey) {
          if (!this.byModel.has(cycle.modelKey)) this.byModel.set(cycle.modelKey, []);
          this.byModel.get(cycle.modelKey).push(cycle);
        }
        if (!this.byDate.has(cycle.date)) this.byDate.set(cycle.date, []);
        this.byDate.get(cycle.date).push(cycle);
      }
      vehicleCycles.sort((a, b) => this.rowSort(a, b));
      this.byAsset.set(reg, vehicleCycles);
    }

    this.cycles.sort((a, b) => {
      const d = String(a.date || '').localeCompare(String(b.date || ''));
      if (d) return d;
      return (a.closingOdometer || 0) - (b.closingOdometer || 0);
    });
    for (const rows of this.byDate.values()) rows.sort((a, b) => String(a.assetId).localeCompare(String(b.assetId)));
  }

  makeCycle(reg, opening, closing, included, sequence) {
    if (!included.length) return null;
    const openingOdometer = finite(opening.endKm ?? opening.fuelInterval?.nextOdometer);
    const closingOdometer = finite(closing.endKm ?? closing.fuelInterval?.nextOdometer);
    const odometerDistance = openingOdometer != null && closingOdometer != null ? closingOdometer - openingOdometer : null;
    const intervalDistance = included.reduce((s, r) => s + Math.max(0, finite(r.kilometers ?? r.fuelInterval?.distanceKm) || 0), 0);
    const kilometers = odometerDistance != null && odometerDistance > 0 ? odometerDistance : intervalDistance;
    const litres = included.reduce((s, r) => s + Math.max(0, finite(r.litres ?? r.fuelInterval?.fuelLoadedLitres) || 0), 0);

    const qualityFlags = [];
    if (!(kilometers > 0)) qualityFlags.push('missing_or_nonpositive_cycle_distance');
    if (!(litres > 0)) qualityFlags.push('missing_or_nonpositive_cycle_fuel');
    if (odometerDistance != null && intervalDistance > 0) {
      const delta = Math.abs(odometerDistance - intervalDistance);
      if (delta > Math.max(50, odometerDistance * 0.08)) qualityFlags.push('cycle_odometer_interval_disagreement');
    }

    // Each positive-distance row is a fuel-to-fuel observation in the source report.
    // If litres are missing from one of those rows, a full-to-full total would be incomplete.
    const incompleteRows = included.filter(r => {
      const km = finite(r.kilometers ?? r.fuelInterval?.distanceKm) || 0;
      const l = finite(r.litres ?? r.fuelInterval?.fuelLoadedLitres) || 0;
      return km > 20 && l <= 0;
    });
    if (incompleteRows.length) qualityFlags.push('missing_intermediate_fuel_capture');

    // Gather Loading Instructions across the WHOLE full-to-full cycle, not one fuel reading.
    const liRows = [];
    for (const row of included) {
      for (const li of (row.linkedLoadingInstructions || [])) {
        if (li?.loadingInstructionNo != null) liRows.push({ ...li, _sourceTripId: row.consumptionId });
      }
    }
    const loadingInstructions = uniqueBy(liRows, li => String(li.loadingInstructionNo))
      .sort((a, b) => String(a.transactionDate || '').localeCompare(String(b.transactionDate || '')) || Number(a.loadingInstructionNo || 0) - Number(b.loadingInstructionNo || 0));

    const stopLabels = [];
    for (const li of loadingInstructions) if (li.offloadLocation) stopLabels.push(String(li.offloadLocation).trim());
    if (!stopLabels.length) {
      // When a single LI could not be selected, the route matcher still preserves candidate
      // offload places. Use those only at cycle level: one repeated candidate is useful route
      // evidence; several different candidates form an explicit multi-route cycle rather than
      // pretending one fuel row belonged to one job.
      for (const row of included) {
        // Pick ONE best route destination per source interval. Do not count every candidate
        // as a separate stop: candidateRoutes are alternatives produced by route matching.
        // A medium/high matched inferred destination is preferred; otherwise use the
        // consumption-source destination, then a single candidate offload as last resort.
        let best = null;
        if (row.matchStatus === 'matched' && ['high', 'medium'].includes(String(row.matchConfidence || '').toLowerCase()) && row.inferredDestination) {
          best = row.inferredDestination;
        } else if (row.destination) {
          best = row.destination;
        } else {
          const candidate = (row.candidateRoutes || [])[0];
          best = typeof candidate === 'string' ? candidate : candidate?.offloadLocation || candidate?.destination || null;
        }
        if (best) stopLabels.push(String(best).trim());
      }
    }
    const uniqueStops = [];
    const normToLabel = new Map();
    for (const label of stopLabels) {
      const key = normalizePlace(label);
      if (!key) continue;
      if (!normToLabel.has(key)) { normToLabel.set(key, label); uniqueStops.push(label); }
    }
    const stopCounts = new Map();
    for (const label of stopLabels) {
      const key = normalizePlace(label); if (!key) continue;
      stopCounts.set(key, (stopCounts.get(key) || 0) + 1);
    }

    let destination = null, routeKey = null, routeLabel = null, destinationConfidence = 'none';
    if (uniqueStops.length === 1) {
      destination = uniqueStops[0];
      routeKey = `DEST:${normalizePlace(destination)}`;
      const visits = stopCounts.get(normalizePlace(destination)) || 1;
      routeLabel = visits > 1 ? `${destination} × ${visits}` : destination;
      destinationConfidence = loadingInstructions.length ? 'high' : 'medium';
    } else if (uniqueStops.length > 1) {
      const normalized = uniqueStops.map(normalizePlace).filter(Boolean).sort();
      destination = uniqueStops.join(' + ');
      routeKey = `MULTI:${normalized.join('|')}`;
      routeLabel = uniqueStops.join(' → ');
      destinationConfidence = 'medium';
    } else {
      qualityFlags.push('cycle_destination_unavailable');
    }

    const efficiency = weightedFuelEfficiency(kilometers, litres);
    // Wide physical guardrail only. Genuine poor historical cycles remain in the benchmark.
    if (efficiency != null && (efficiency < 0.20 || efficiency > 6.50)) qualityFlags.push('physically_implausible_full_cycle_efficiency');

    let continuityProblems = 0;
    let previousEnd = openingOdometer;
    for (const row of included) {
      const start = finite(row.startKm ?? row.fuelInterval?.startOdometer);
      const end = finite(row.endKm ?? row.fuelInterval?.nextOdometer);
      if (previousEnd != null && start != null && Math.abs(start - previousEnd) > 50) continuityProblems++;
      if (end != null && end > 0) previousEnd = end;
    }
    if (continuityProblems) qualityFlags.push('cycle_odometer_discontinuity');

    const invalidFlags = new Set([
      'missing_or_nonpositive_cycle_distance', 'missing_or_nonpositive_cycle_fuel',
      'missing_intermediate_fuel_capture', 'physically_implausible_full_cycle_efficiency',
      'cycle_odometer_discontinuity'
    ]);
    const validFuelCycle = !qualityFlags.some(f => invalidFlags.has(f));
    const validForBenchmark = validFuelCycle && Boolean(routeKey);

    const asset = this.rawEngine?.assets?.get(reg) || null;
    const model = modelIdentity(asset);

    const intermediateFills = included.slice(0, -1).map(r => ({
      id: r.consumptionId,
      date: r.date,
      fillUpLocation: r.fillUpLocation || null,
      startKm: finite(r.startKm),
      endKm: finite(r.endKm),
      kilometers: finite(r.kilometers),
      litres: finite(r.litres),
      sourceKmL: finite(r.efficiency?.value),
      destination: r.destination || null,
      sourceKind: r.sourceKind || null
    }));

    return {
      id: cycleId(reg, opening.consumptionId, closing.consumptionId),
      consumptionId: cycleId(reg, opening.consumptionId, closing.consumptionId),
      assetId: reg,
      registrationNormalized: reg,
      modelKey: model.key,
      modelLabel: model.label,
      modelType: model.type,
      modelAxleConfiguration: model.axle,
      modelIdentitySource: model.source,
      sequence,
      date: closing.date,
      openingDate: opening.date,
      closingDate: closing.date,
      openingTripId: opening.consumptionId,
      closingTripId: closing.consumptionId,
      openingFillLocation: opening.fillUpLocation || null,
      closingFillLocation: closing.fillUpLocation || null,
      openingOdometer,
      closingOdometer,
      startKm: openingOdometer,
      endKm: closingOdometer,
      kilometers,
      litres,
      analysedKmL: efficiency,
      rawAnalysedKmL: efficiency,
      destination,
      routeKey,
      routeLabel: routeLabel || destination,
      destinationConfidence,
      destinationSource: loadingInstructions.length ? 'Loading Instructions across full fuel cycle' : (destination ? 'Matched trip destinations across full fuel cycle' : 'Unavailable'),
      destinationStops: uniqueStops,
      destinationVisitCount: stopLabels.length,
      loadingInstructions,
      intermediateFills,
      sourceRows: included.map(r => r.consumptionId),
      sourceRowCount: included.length,
      qualityFlags: [...new Set(qualityFlags)],
      validFuelCycle,
      validForBenchmark,
      driverContext: closing.driverAtReport || included.map(r => r.driverAtReport).find(Boolean) || null,
      customerName: loadingInstructions.map(x => x.customerName).find(Boolean) || null,
      fillUpLocation: closing.fillUpLocation || null,
      sourceKind: 'stellar_full_to_full_cycle',
      boundaryAssumption: `Fuel rows matching ${this.homePatterns.join(', ')} are treated as Stellar full-up boundaries until a source full/partial-fill flag is supplied.`,
      openingRow: opening,
      closingRow: closing,
      includedRows: included
    };
  }

  cycleById(id) { return this.byId.get(id) || null; }
  availableDates() { return [...this.byDate.keys()].sort(); }
  latestCompleteDate() { return this.availableDates().at(-1) || null; }

  isPriorCycle(candidate, cycle) {
    if (!candidate || !cycle || candidate.id === cycle.id) return false;
    if (String(candidate.date) < String(cycle.date)) return true;
    if (String(candidate.date) > String(cycle.date)) return false;
    return (candidate.closingOdometer || 0) < (cycle.closingOdometer || 0);
  }

  withinBenchmarkWindow(candidate, cycle) {
    const cutoff = dateMonthsBefore(cycle?.date, this.modelBenchmarkMonths);
    return !cutoff || String(candidate?.date || '') >= cutoff;
  }

  summariseBenchmark(history, { scope, benchmarkType, modelLabel = null, minimumTrucks = 1 } = {}) {
    const rows = (history || []).filter(c => c?.validForBenchmark && Number.isFinite(c.analysedKmL) && c.kilometers > 0 && c.litres > 0);
    const distinctTrucks = new Set(rows.map(c => c.assetId).filter(Boolean));
    if (rows.length < this.minBenchmarkSamples || distinctTrucks.size < minimumTrucks) return null;

    // The main average is physically weighted in exactly the same way as the selected trip:
    // combine ALL historical distance and ALL historical fuel, then total km / total litres.
    // This prevents a short 100 km observation from carrying the same weight as a 1,000 km trip.
    const values = rows.map(c => c.analysedKmL).filter(Number.isFinite);
    const distances = rows.map(c => Number(c.kilometers)).filter(v => Number.isFinite(v) && v > 0);
    const litres = rows.map(c => Number(c.litres)).filter(v => Number.isFinite(v) && v > 0);
    const totalDistanceKm = sum(distances);
    const totalLitres = sum(litres);
    const weightedAverage = totalDistanceKm > 0 && totalLitres > 0 ? totalDistanceKm / totalLitres : null;
    if (!(weightedAverage > 0)) return null;
    const arithmeticAverage = mean(values);
    const sd = stddev(values);
    const dates = rows.map(c => String(c.date || '')).filter(Boolean).sort();
    return {
      average: weightedAverage,
      weightedAverage,
      arithmeticAverage,
      median: median(values),
      low: quantile(values, 0.2),
      high: quantile(values, 0.8),
      standardDeviation: sd,
      robustSigma: Math.max(sd, weightedAverage * 0.03, 0.03),
      sampleSize: values.length,
      excludedOutliers: 0,
      totalCandidateCount: values.length,
      distinctTruckCount: distinctTrucks.size,
      registrations: [...distinctTrucks].sort(),
      scope,
      benchmarkType,
      modelLabel,
      confidence: values.length >= 20 && distinctTrucks.size >= 4 ? 'high' : values.length >= 8 ? 'medium' : 'low',
      averageDistanceKm: mean(distances),
      averageLitres: mean(litres),
      totalDistanceKm,
      totalLitres,
      historyLimit: values.length,
      historyMonths: this.modelBenchmarkMonths,
      historyStartDate: dates[0] || null,
      historyEndDate: dates.at(-1) || null,
      method: `Distance/fuel-weighted historical average: total kilometres across every valid prior matching full cycle divided by total litres across those cycles. Median is the median of the individual full-cycle km/L results. Genuine Poor history is retained; only source-data-invalid cycles are excluded. Window: prior ${this.modelBenchmarkMonths} months.`
    };
  }

  truckBenchmarkFor(cycle) {
    if (!cycle?.validForBenchmark || !cycle.routeKey) return null;
    const history = (this.byAsset.get(cycle.assetId) || []).filter(c =>
      c.validForBenchmark && c.routeKey === cycle.routeKey && this.isPriorCycle(c, cycle) && this.withinBenchmarkWindow(c, cycle)
    );
    return this.summariseBenchmark(history, {
      scope: cycle.destinationStops?.length > 1 ? 'Same truck + same full-cycle route set' : 'Same exact truck + same destination',
      benchmarkType: 'truck-route',
      modelLabel: cycle.modelLabel,
      minimumTrucks: 1
    });
  }

  modelBenchmarkFor(cycle) {
    if (!cycle?.validForBenchmark || !cycle.routeKey || !cycle.modelKey) return null;
    const history = (this.byModel.get(cycle.modelKey) || []).filter(c =>
      c.validForBenchmark && c.routeKey === cycle.routeKey && this.isPriorCycle(c, cycle) && this.withinBenchmarkWindow(c, cycle)
    );
    return this.summariseBenchmark(history, {
      scope: cycle.destinationStops?.length > 1
        ? `Same model/type + axle (${cycle.modelLabel}) + same full-cycle route set`
        : `Same model/type + axle (${cycle.modelLabel}) + same destination`,
      benchmarkType: 'model-route',
      modelLabel: cycle.modelLabel,
      minimumTrucks: this.minModelBenchmarkTrucks
    });
  }

  benchmarkFor(cycle) {
    // Primary performance benchmark: pooled equivalent trucks on the same route.
    // If the fleet master cannot provide at least two equivalent trucks, fall back to
    // the exact truck's own route history rather than inventing a peer group.
    return this.modelBenchmarkFor(cycle) || this.truckBenchmarkFor(cycle);
  }

  publicBenchmark(benchmark) {
    if (!benchmark) return null;
    return {
      averageKmL: round(benchmark.average),
      weightedAverageKmL: round(benchmark.weightedAverage),
      arithmeticAverageKmL: round(benchmark.arithmeticAverage),
      medianKmL: round(benchmark.median),
      lowKmL: round(benchmark.low),
      highKmL: round(benchmark.high),
      standardDeviationKmL: round(benchmark.standardDeviation),
      sampleSize: benchmark.sampleSize,
      excludedOutliers: 0,
      scope: benchmark.scope,
      confidence: benchmark.confidence,
      averageDistanceKm: round(benchmark.averageDistanceKm, 0),
      averageLitres: round(benchmark.averageLitres, 1),
      totalDistanceKm: round(benchmark.totalDistanceKm, 0),
      totalLitres: round(benchmark.totalLitres, 1),
      distinctTruckCount: benchmark.distinctTruckCount,
      registrations: benchmark.registrations,
      benchmarkType: benchmark.benchmarkType,
      modelLabel: benchmark.modelLabel,
      historyLimit: benchmark.historyLimit,
      historyMonths: benchmark.historyMonths,
      historyStartDate: benchmark.historyStartDate,
      historyEndDate: benchmark.historyEndDate,
      method: benchmark.method
    };
  }



  updateContext(id, context) {
    if (!id) return;
    this.contexts.set(id, context || {});
    this.analysisCache.delete(id);
    this.dashboardCache.clear();
  }

  weightAdjustment(cycle, benchmark) {
    const context = this.contexts.get(cycle?.id) || {};
    const assets = this.rawEngine?.assets || new Map();
    const permitsByAsset = this.rawEngine?.permitsByAsset || new Map();
    const truckAsset = assets.get(cycle?.assetId) || null;
    const trailerReg = typeof context?.trailerRegistration === 'string' && context.trailerRegistration.trim()
      ? context.trailerRegistration.trim().toUpperCase()
      : null;
    const trailerAsset = trailerReg ? assets.get(trailerReg) || null : null;
    const trailerValid = Boolean(trailerAsset?.isTrailer === true);
    const permits = trailerValid ? (permitsByAsset.get(trailerReg) || []) : [];

    const truckEstimate = estimateAssetTare(truckAsset);
    const trailerEstimate = trailerValid
      ? estimateAssetTare(trailerAsset)
      : { tareKg: null, source: 'Select a trailer', confidence: 'none', isEstimate: true };
    const referencePayload = trailerValid
      ? trailerReferencePayloadKg(trailerAsset, permits)
      : { payloadKg: 30000, source: 'generic heavy-trailer reference payload', confidence: 'estimated' };

    const savedTruckTare = finite(context?.truckTareKg);
    const savedTrailerTare = finite(context?.trailerTareKg);
    const truckTareKg = savedTruckTare != null && savedTruckTare > 0 ? savedTruckTare : truckEstimate.tareKg;
    const trailerTareKg = savedTrailerTare != null && savedTrailerTare > 0 ? savedTrailerTare : trailerEstimate.tareKg;
    const outboundProductKg = finite(context?.outboundProductKg);
    const returnProductKg = Math.max(0, finite(context?.returnProductKg) ?? 0);
    const loadedDistancePct = Math.max(0, Math.min(100, finite(context?.loadedDistancePct) ?? 50));
    const loadedFraction = loadedDistancePct / 100;

    const permitValues = permits
      .map(p => finite(p?.permissibleWeightKgParsed))
      .filter(v => v != null && v >= 5000 && v <= 50000);
    const permitCapacityKg = permitValues.length ? Math.max(...permitValues) : null;
    const permit = permits.find(p => finite(p?.permissibleWeightKgParsed) === permitCapacityKg) || permits[0] || null;

    const complete = Boolean(
      trailerValid &&
      truckTareKg != null && truckTareKg > 0 &&
      trailerTareKg != null && trailerTareKg > 0 &&
      outboundProductKg != null && outboundProductKg >= 0
    );

    const verifiedSources = new Set(['timeworx', 'dispatch', 'weighbridge', 'verified-manual']);
    const evidenceSource = String(context?.evidenceSource || 'calculator').trim().toLowerCase();
    const verified = complete && context?.confirmed === true && verifiedSources.has(evidenceSource);
    const status = verified ? 'Verified' : (complete ? 'Estimated' : (trailerValid ? 'Estimated' : 'Unknown'));

    const evidence = {
      status,
      canNormalize: complete,
      source: verified ? evidenceSource : (complete ? 'Trip calculator + fleet tare estimates' : 'Fleet asset master / permit context'),
      sourceReference: typeof context?.sourceReference === 'string' && context.sourceReference.trim() ? context.sourceReference.trim() : null,
      trailerRegistration: trailerValid ? trailerReg : null,
      trailerDescription: trailerValid ? (trailerAsset.description || trailerAsset.assetType || 'Trailer') : null,
      trailerStatus: trailerValid ? (trailerAsset.vehicleStatus || null) : null,
      permitCapacityKg,
      permitCapacityRaw: permit?.permissibleWeightRaw || null,
      permitCategory: permit?.category || null,
      permitMake: permit?.make || null,
      permitCount: permits.length,
      productName: typeof context?.productName === 'string' && context.productName.trim() ? context.productName.trim() : null,
      actualMassComplete: complete,
      loadingInstructionLinked: Boolean(cycle?.loadingInstructions?.length),
      loadingInstructionNo: cycle?.loadingInstructions?.[0]?.loadingInstructionNo || null,
      routeMatchConfidence: cycle?.destinationConfidence || 'none',
      note: complete
        ? `${status} load calculator applied. Truck tare ${Math.round(truckTareKg)} kg and trailer tare ${Math.round(trailerTareKg)} kg are included automatically; product load is supplied for this full cycle.`
        : 'Select a trailer and enter the product load to calculate the trip mass and load-adjusted benchmark.'
    };

    if (!complete) {
      return {
        applied: false,
        context,
        evidence,
        truckTareKg,
        trailerTareKg,
        truckTareSource: savedTruckTare != null && savedTruckTare > 0 ? 'saved trip tare' : truckEstimate.source,
        trailerTareSource: savedTrailerTare != null && savedTrailerTare > 0 ? 'saved trip tare' : trailerEstimate.source,
        referencePayloadKg: referencePayload.payloadKg,
        referencePayloadSource: referencePayload.source,
        outboundProductKg,
        returnProductKg,
        loadedDistancePct,
        massInputUnit: context?.massInputUnit === 'kg' ? 'kg' : 't'
      };
    }

    const averagePayloadKg = outboundProductKg * loadedFraction + returnProductKg * (1 - loadedFraction);
    const averageGrossKg = truckTareKg + trailerTareKg + averagePayloadKg;
    const savedReferencePayload = finite(context?.referencePayloadKg);
    const referencePayloadKg = Math.max(0, savedReferencePayload ?? referencePayload.payloadKg ?? 30000);
    const referenceAveragePayloadKg = referencePayloadKg * loadedFraction;
    const referenceGrossKg = truckTareKg + trailerTareKg + referenceAveragePayloadKg;
    const sensitivity = Math.max(0, Math.min(1, Number(this.settings?.weightSensitivity ?? 0.35)));
    const massRatio = referenceGrossKg > 0 ? averageGrossKg / referenceGrossKg : 1;
    const fuelMultiplier = Math.max(0.75, Math.min(1.35, 1 + sensitivity * (massRatio - 1)));
    const loadAdjustedExpectedKmL = benchmark?.average > 0 ? benchmark.average / fuelMultiplier : null;
    const referenceNormalisedKmL = cycle?.analysedKmL != null ? cycle.analysedKmL * fuelMultiplier : null;

    return {
      applied: true,
      context,
      evidence,
      trailerRegistration: trailerReg,
      productName: typeof context?.productName === 'string' && context.productName.trim() ? context.productName.trim() : null,
      truckTareKg,
      trailerTareKg,
      truckTareSource: savedTruckTare != null && savedTruckTare > 0 ? 'saved trip tare' : truckEstimate.source,
      trailerTareSource: savedTrailerTare != null && savedTrailerTare > 0 ? 'saved trip tare' : trailerEstimate.source,
      outboundProductKg,
      returnProductKg,
      loadedDistancePct,
      averagePayloadKg,
      averageGrossKg,
      referencePayloadKg,
      referencePayloadSource: referencePayload.source,
      referenceGrossKg,
      fuelMultiplier,
      loadAdjustedExpectedKmL,
      referenceNormalisedKmL,
      massInputUnit: context?.massInputUnit === 'kg' ? 'kg' : 't',
      confirmed: verified,
      evidenceSource: evidenceSource || 'calculator',
      sourceReference: evidence.sourceReference,
      note: 'Load adjustment changes only the expected km/L target for this trip. The measured full-cycle km/L and the raw historical same-truck/same-route average are never rewritten.'
    };
  }

  analyseCycle(cycle) {
    if (!cycle) return null;
    if (this.analysisCache.has(cycle.id)) return this.analysisCache.get(cycle.id);
    const modelBenchmark = this.modelBenchmarkFor(cycle);
    const truckBenchmark = this.truckBenchmarkFor(cycle);
    const benchmark = modelBenchmark || truckBenchmark;
    const observed = finite(cycle.analysedKmL);
    const weight = this.weightAdjustment(cycle, benchmark);
    const expectedTargetKmL = weight.applied && weight.loadAdjustedExpectedKmL > 0
      ? weight.loadAdjustedExpectedKmL
      : (benchmark?.average ?? null);
    let rating = 'Baseline';
    let deviationPct = null, performanceIndex = null, robustZ = null;
    let expectedLitres = null, excessLitres = null, fuelVariancePct = null;

    if (!cycle.validFuelCycle || observed == null) rating = 'Data Warning';
    else if (benchmark && expectedTargetKmL > 0) {
      deviationPct = ((observed - expectedTargetKmL) / expectedTargetKmL) * 100;
      performanceIndex = (observed / expectedTargetKmL) * 100;
      robustZ = (observed - expectedTargetKmL) / Math.max(benchmark.standardDeviation || 0, benchmark.average * 0.03, 0.03);
      if (cycle.kilometers > 0) {
        expectedLitres = cycle.kilometers / expectedTargetKmL;
        excessLitres = cycle.litres - expectedLitres;
        fuelVariancePct = (cycle.litres / expectedLitres - 1) * 100;
      }
      const poor = Number(this.settings.poorDeviationPct ?? -15);
      const review = Number(this.settings.reviewDeviationPct ?? -7.5);
      const good = Number(this.settings.goodDeviationPct ?? 4);
      const outstanding = Number(this.settings.outstandingDeviationPct ?? 10);
      if (deviationPct <= poor) rating = 'Poor';
      else if (deviationPct <= review) rating = 'Review';
      else if (deviationPct >= outstanding) rating = 'Outstanding';
      else if (deviationPct >= good) rating = 'Good';
      else rating = 'Average';
    }

    const distanceSourceBenchmark = truckBenchmark || benchmark;
    const expectedDistanceKm = distanceSourceBenchmark?.averageDistanceKm ?? null;
    const extraKm = expectedDistanceKm != null ? cycle.kilometers - expectedDistanceKm : null;
    const distanceVariancePct = expectedDistanceKm > 0 ? (extraKm / expectedDistanceKm) * 100 : null;
    const distanceStatus = distanceVariancePct == null ? null : Math.abs(distanceVariancePct) >= 20 ? 'High' : Math.abs(distanceVariancePct) >= 10 ? 'Watch' : 'Normal';
    const distanceBenchmark = distanceSourceBenchmark && expectedDistanceKm != null ? {
      expectedDistanceKm: round(expectedDistanceKm, 0),
      averageDistanceKm: round(expectedDistanceKm, 0),
      lowDistanceKm: null,
      highDistanceKm: null,
      actualDistanceKm: round(cycle.kilometers, 0),
      extraKm: round(extraKm, 0),
      distanceVariancePct: round(distanceVariancePct, 1),
      sampleSize: distanceSourceBenchmark.sampleSize,
      excludedOutliers: 0,
      scope: distanceSourceBenchmark.scope,
      confidence: distanceSourceBenchmark.confidence,
      status: distanceStatus,
      routeLabel: cycle.routeLabel || cycle.destination || 'Full cycle route',
      calculation: 'Full-cycle closing odometer minus opening odometer compared with previous full cycles to the same route.',
      routeSpecific: true
    } : null;

    const explanations = [];
    explanations.push(`Performance is calculated once for the complete fuel cycle from ${cycle.openingDate} ${cycle.openingFillLocation || 'Stellar'} to ${cycle.closingDate} ${cycle.closingFillLocation || 'Stellar'}.`);
    explanations.push(`${cycle.sourceRowCount} fuel-consumption reading(s) are rolled into one weighted full-trip result: add every counted segment's kilometres and litres, then ${round(cycle.kilometers, 0)} km ÷ ${round(cycle.litres, 1)} L = ${round(observed, 2)} km/L. A short low-efficiency segment is included only for the kilometres and litres it actually represents; readings are never averaged equally.`);
    if (cycle.intermediateFills.length) explanations.push(`${cycle.intermediateFills.length} intermediate top-up(s) are included in the total litres before the closing Stellar full-up.`);
    if (cycle.destination) explanations.push(`Cycle route context: ${cycle.routeLabel || cycle.destination}.`);
    else explanations.push('No reliable destination could be established for the full cycle, so the result is shown as a data/baseline record rather than compared with another route.');
    if (modelBenchmark) {
      explanations.push(`Primary benchmark: ${modelBenchmark.sampleSize} prior valid full cycle(s) by ${modelBenchmark.distinctTruckCount} equivalent ${cycle.modelLabel} truck(s) on this same route in the prior ${modelBenchmark.historyMonths} months.`);
      explanations.push(`Model-route weighted average = ${round(modelBenchmark.totalDistanceKm, 0)} historical km ÷ ${round(modelBenchmark.totalLitres, 1)} historical L = ${round(modelBenchmark.average, 2)} km/L; median completed trip = ${round(modelBenchmark.median, 2)} km/L.`);
      if (truckBenchmark) explanations.push(`This exact truck's own same-route history is also shown separately: ${truckBenchmark.sampleSize} prior cycle(s), weighted average ${round(truckBenchmark.average, 2)} km/L, median ${round(truckBenchmark.median, 2)} km/L.`);
    } else if (truckBenchmark) {
      explanations.push(`Not enough equivalent same-model trucks exist for a pooled route benchmark, so performance falls back to this exact truck's ${truckBenchmark.sampleSize} prior valid same-route full cycle(s) from the prior ${truckBenchmark.historyMonths} months.`);
      explanations.push(`Exact-truck weighted average = ${round(truckBenchmark.totalDistanceKm, 0)} km ÷ ${round(truckBenchmark.totalLitres, 1)} L = ${round(truckBenchmark.average, 2)} km/L; median ${round(truckBenchmark.median, 2)} km/L.`);
    }
    if (benchmark) {
      if (weight.applied) {
        explanations.push(`Raw historical weighted average stays ${round(benchmark.average, 2)} km/L. With the selected trailer and product mass, the expected target for this cycle becomes ${round(expectedTargetKmL, 2)} km/L.`);
        explanations.push(`${round(Math.abs(deviationPct), 1)}% ${deviationPct < 0 ? 'below' : 'above'} the load-adjusted target.`);
      } else {
        explanations.push(`${round(Math.abs(deviationPct), 1)}% ${deviationPct < 0 ? 'below' : 'above'} the primary historical weighted average of ${round(benchmark.average, 2)} km/L.`);
      }
      if (excessLitres != null) explanations.push(`At this cycle distance, the current expected target implies about ${round(expectedLitres, 1)} L; actual replenishment was ${round(cycle.litres, 1)} L (${excessLitres >= 0 ? '+' : ''}${round(excessLitres, 1)} L).`);
    } else if (rating !== 'Data Warning') {
      explanations.push(`There is not yet enough prior same-model/same-route or same-truck/same-route history inside the ${this.modelBenchmarkMonths}-month window, so this cycle remains Baseline rather than being labelled Good or Poor.`);
    }
    if (cycle.qualityFlags.length) explanations.push(`Cycle data checks: ${cycle.qualityFlags.join(', ')}.`);
    if (weight.applied) {
      explanations.push(`Load calculator: truck tare ${round(weight.truckTareKg / 1000, 1)} t + trailer tare ${round(weight.trailerTareKg / 1000, 1)} t + weighted-average product ${round(weight.averagePayloadKg / 1000, 1)} t = ${round(weight.averageGrossKg / 1000, 1)} t average gross mass.`);
    } else {
      explanations.push('No load adjustment is applied until a trailer is selected and a product mass is entered.');
    }
    explanations.push(cycle.boundaryAssumption);

    let confidenceScore = 45;
    if (cycle.destinationConfidence === 'high') confidenceScore += 15;
    else if (cycle.destinationConfidence === 'medium') confidenceScore += 8;
    if (benchmark?.confidence === 'high') confidenceScore += 25;
    else if (benchmark?.confidence === 'medium') confidenceScore += 18;
    else if (benchmark) confidenceScore += 10;
    if (benchmark?.sampleSize >= 12) confidenceScore += 8;
    if (!cycle.validFuelCycle) confidenceScore = Math.min(confidenceScore, 30);
    if (!cycle.routeKey) confidenceScore = Math.min(confidenceScore, 45);
    confidenceScore = Math.max(10, Math.min(100, confidenceScore));

    const context = this.contexts.get(cycle.id) || {};
    const result = {
      id: cycle.id,
      consumptionId: cycle.id,
      cycleId: cycle.id,
      cycleMode: true,
      isFullTripCycle: true,
      registration: cycle.assetId,
      modelKey: cycle.modelKey,
      modelLabel: cycle.modelLabel,
      modelType: cycle.modelType,
      modelAxleConfiguration: cycle.modelAxleConfiguration,
      modelIdentitySource: cycle.modelIdentitySource,
      date: cycle.date,
      startDate: cycle.openingDate,
      endDate: cycle.closingDate,
      openingDate: cycle.openingDate,
      closingDate: cycle.closingDate,
      startFullUpLocation: cycle.openingFillLocation,
      closingFullUpLocation: cycle.closingFillLocation,
      deliveryCount: cycle.loadingInstructions.length || cycle.destinationVisitCount || 0,
      cycleFuelEventCount: cycle.sourceRowCount,
      intermediateTopUpCount: cycle.intermediateFills.length,
      sourceReadingCount: cycle.sourceRowCount,
      mixedDestinations: (cycle.destinationStops || []).length > 1,
      destinationCandidates: cycle.destinationStops || [],
      calculationMethod: 'Distance/fuel-weighted complete cycle: Stellar full-up → route work/top-ups → next Stellar full-up. Sum the kilometres and litres from every counted interval, then calculate total km ÷ total litres. This naturally gives each reading only its real share of the trip.',
      openingFillLocation: cycle.openingFillLocation,
      closingFillLocation: cycle.closingFillLocation,
      openingOdometer: round(cycle.openingOdometer, 0),
      closingOdometer: round(cycle.closingOdometer, 0),
      destination: cycle.destination,
      destinationStops: cycle.destinationStops,
      destinationVisitCount: cycle.destinationVisitCount,
      routeLabel: cycle.routeLabel,
      destinationSource: cycle.destinationSource,
      destinationConfidence: cycle.destinationConfidence,
      fillUpLocation: cycle.closingFillLocation,
      customerName: cycle.customerName,
      loadingInstructionNo: cycle.loadingInstructions[0]?.loadingInstructionNo || null,
      routeMatchConfidence: cycle.destinationConfidence,
      driverContext: cycle.driverContext,
      kilometers: round(cycle.kilometers, 1),
      startKm: round(cycle.openingOdometer, 0),
      endKm: round(cycle.closingOdometer, 0),
      litres: round(cycle.litres, 2),
      reportedKmL: null,
      calculatedKmL: round(observed),
      weightedTripKmL: round(observed),
      weightedTripLPer100Km: cycle.kilometers > 0 ? round((cycle.litres / cycle.kilometers) * 100, 2) : null,
      analysedKmL: round(observed),
      rawAnalysedKmL: round(observed),
      corrected: false,
      correction: null,
      likelyDataError: !cycle.validFuelCycle,
      qualityFlags: cycle.qualityFlags,
      validForBenchmark: cycle.validForBenchmark,
      benchmark: benchmark ? this.publicBenchmark(benchmark) : null,
      modelBenchmark: modelBenchmark ? this.publicBenchmark(modelBenchmark) : null,
      truckBenchmark: truckBenchmark ? this.publicBenchmark(truckBenchmark) : null,
      benchmarkSelection: modelBenchmark ? 'model-route' : (truckBenchmark ? 'truck-route-fallback' : 'baseline'),
      deviationPct: round(deviationPct, 1),
      robustZ: round(robustZ, 2),
      performanceIndex: round(performanceIndex, 1),
      expectedRawKmL: benchmark ? round(benchmark.average) : null,
      loadAdjustedExpectedKmL: expectedTargetKmL != null ? round(expectedTargetKmL) : null,
      expectedLitres: round(expectedLitres, 1),
      excessLitres: round(excessLitres, 1),
      fuelVariancePct: round(fuelVariancePct, 1),
      rating,
      confidenceScore,
      distanceBenchmark,
      expectedDistanceKm: distanceBenchmark?.expectedDistanceKm ?? null,
      extraKm: distanceBenchmark?.extraKm ?? null,
      distanceVariancePct: distanceBenchmark?.distanceVariancePct ?? null,
      distanceStatus: distanceBenchmark?.status ?? null,
      fuelInterval: {
        intervalMode: 'stellar_full_to_full_cycle',
        startDate: cycle.openingDate,
        nextFuelDate: cycle.closingDate,
        startOdometer: round(cycle.openingOdometer, 0),
        nextOdometer: round(cycle.closingOdometer, 0),
        distanceKm: round(cycle.kilometers, 1),
        fuelLoadedLitres: round(cycle.litres, 2),
        startFillLocation: cycle.openingFillLocation,
        nextFillLocation: cycle.closingFillLocation,
        sourceConfirmation: 'aggregated_full_cycle_source_rows',
        attributionConfidence: cycle.validFuelCycle ? 'high' : 'low',
        linkedLoadingInstructionCount: cycle.loadingInstructions.length,
        method: 'Full-to-full method: exclude the opening Stellar full-up litres; add every subsequent partial/top-up fuel issue through and including the closing Stellar full-up; divide opening-to-closing odometer distance by that total fuel.'
      },
      fuelAttributionConfidence: cycle.validFuelCycle ? 'high' : 'low',
      fuelSourceConfirmation: 'aggregated_full_cycle_source_rows',
      hasFuelEvidence: true,
      linkedLoadingInstructions: cycle.loadingInstructions,
      sourceKind: 'stellar_full_to_full_cycle',
      cycleEvidence: {
        openingTripId: cycle.openingTripId,
        closingTripId: cycle.closingTripId,
        sourceRowCount: cycle.sourceRowCount,
        sourceRows: cycle.sourceRows,
        intermediateFills: cycle.intermediateFills,
        boundaryAssumption: cycle.boundaryAssumption
      },
      trailerEvidence: weight.evidence,
      weight: weight.applied ? {
        applied: true,
        trailerRegistration: weight.trailerRegistration,
        productName: weight.productName,
        truckTareKg: round(weight.truckTareKg, 0),
        trailerTareKg: round(weight.trailerTareKg, 0),
        outboundProductKg: round(weight.outboundProductKg, 0),
        returnProductKg: round(weight.returnProductKg, 0),
        loadedDistancePct: round(weight.loadedDistancePct, 1),
        averagePayloadKg: round(weight.averagePayloadKg, 0),
        averageGrossKg: round(weight.averageGrossKg, 0),
        referencePayloadKg: round(weight.referencePayloadKg, 0),
        referenceGrossKg: round(weight.referenceGrossKg, 0),
        fuelMultiplier: round(weight.fuelMultiplier, 3),
        loadAdjustedExpectedKmL: round(weight.loadAdjustedExpectedKmL, 2),
        referenceNormalisedKmL: round(weight.referenceNormalisedKmL, 2),
        truckTareSource: weight.truckTareSource,
        trailerTareSource: weight.trailerTareSource,
        referencePayloadSource: weight.referencePayloadSource,
        massInputUnit: weight.massInputUnit,
        confirmed: weight.confirmed,
        evidenceSource: weight.evidenceSource,
        sourceReference: weight.sourceReference,
        note: weight.note
      } : {
        applied: false,
        ...(context || {}),
        truckTareKg: round(weight.truckTareKg, 0),
        trailerTareKg: round(weight.trailerTareKg, 0),
        referencePayloadKg: round(weight.referencePayloadKg, 0),
        truckTareSource: weight.truckTareSource,
        trailerTareSource: weight.trailerTareSource,
        referencePayloadSource: weight.referencePayloadSource,
        massInputUnit: weight.massInputUnit,
        note: 'Select a trailer and enter product mass, then recalculate. Estimated truck/trailer tare is available automatically from the fleet profile.'
      },
      explanations,
      asset: this.vehicleSummary(cycle.assetId, false)
    };
    this.analysisCache.set(cycle.id, result);
    return result;
  }

  analyseById(id) { return this.analyseCycle(this.cycleById(id)); }

  cycleHistory(cycle, limit = 60) {
    if (!cycle) {
      return {
        rows: [],
        summary: {
          recordCount: 0,
          highlightedRecordCount: 0,
          countedFuelEventCount: 0,
          dieselTotalLitres: null,
          kmTotal: null,
          vehicleConsumptionKmL: null,
          vehicleConsumptionLPer100Km: null,
          positiveExtraKm: null,
          netDistanceVarianceKm: null,
          openingOdometer: null,
          closingOdometer: null
        }
      };
    }

    // V21 investigation window: show only a few fuel rows immediately after the selected
    // cycle, every row that forms the highlighted full cycle, and a few rows immediately
    // before it. The complete monthly ledger is available on the dedicated Fuel History page.
    const afterRows = 3;
    const beforeRows = Math.max(4, Number(cycle.sourceRowCount || 0) + 4);
    const requestedLimit = Math.max(10, Math.min(120, Number(cycle.sourceRowCount || 0) + 8));
    const history = this.rawEngine?.recentFuelHistory?.(cycle.assetId, {
      currentTripId: cycle.closingTripId,
      aroundDate: cycle.closingDate,
      afterCount: afterRows,
      beforeCount: beforeRows,
      limit: requestedLimit
    }) || { rows: [], summary: {} };

    const countedFuelIds = new Set(cycle.sourceRows || []);
    const openingId = cycle.openingTripId;
    const closingId = cycle.closingTripId;
    const totalKm = Math.max(0, finite(cycle.kilometers) || 0);
    const totalLitres = Math.max(0, finite(cycle.litres) || 0);

    const rows = (history.rows || []).map(r => {
      const id = r.id;
      const isOpeningBoundary = id === openingId;
      const countedFuel = countedFuelIds.has(id);
      const isClosingBoundary = id === closingId;
      const contributesToCycle = isOpeningBoundary || countedFuel;
      const km = Math.max(0, finite(r.kilometers) || 0);
      const litres = Math.max(0, finite(r.litres) || 0);
      const segmentKmL = km > 0 && litres > 0 ? km / litres : null;
      const segmentLPer100Km = km > 0 && litres > 0 ? (litres / km) * 100 : null;
      const countedDistanceKm = countedFuel ? km : 0;
      const countedFuelLitres = countedFuel ? litres : 0;
      const distanceSharePct = countedFuel && totalKm > 0 ? (countedDistanceKm / totalKm) * 100 : 0;
      const fuelSharePct = countedFuel && totalLitres > 0 ? (countedFuelLitres / totalLitres) * 100 : 0;

      let contributionRole = 'Not part of selected trip';
      if (isOpeningBoundary) contributionRole = 'Opening full-up boundary · litres excluded';
      else if (isClosingBoundary && countedFuel) contributionRole = 'Closing full-up · fuel counted';
      else if (countedFuel) contributionRole = 'Intermediate fuel event · fuel counted';

      return {
        ...r,
        current: isClosingBoundary,
        contributesToCycle,
        countedFuel,
        isOpeningBoundary,
        isClosingBoundary,
        contributionRole,
        countedDistanceKm: round(countedDistanceKm, 1),
        countedFuelLitres: round(countedFuelLitres, 2),
        distanceSharePct: round(distanceSharePct, 1),
        fuelSharePct: round(fuelSharePct, 1),
        segmentKmL: round(segmentKmL, 2),
        segmentLPer100Km: round(segmentLPer100Km, 2)
      };
    });

    const vehicleConsumptionLPer100Km = totalKm > 0 ? (totalLitres / totalKm) * 100 : null;
    return {
      rows,
      summary: {
        recordCount: rows.length,
        highlightedRecordCount: rows.filter(r => r.contributesToCycle).length,
        countedFuelEventCount: cycle.sourceRowCount,
        dieselTotalLitres: round(totalLitres, 2),
        kmTotal: round(totalKm, 1),
        vehicleConsumptionKmL: round(cycle.analysedKmL, 2),
        vehicleConsumptionLPer100Km: round(vehicleConsumptionLPer100Km, 2),
        positiveExtraKm: round(history.summary?.positiveExtraKm ?? 0, 1),
        netDistanceVarianceKm: round(history.summary?.netDistanceVarianceKm ?? 0, 1),
        openingOdometer: round(cycle.openingOdometer, 0),
        closingOdometer: round(cycle.closingOdometer, 0),
        calculationMethod: 'Weighted full-trip fuel accounting: add the actual kilometres and actual litres from every green counted row, then calculate total km ÷ total litres. Individual km/L readings are never averaged equally.'
      }
    };
  }

  detail(id) {
    const cycle = this.cycleById(id); if (!cycle) return null;
    return { ...this.analyseCycle(cycle), recentFuelHistory: this.cycleHistory(cycle, 50) };
  }

  navigation(selectedDate) {
    const dates = this.availableDates();
    const latestCompleteDate = dates.at(-1) || null;
    if (!dates.length) return { selectedDate, previousDate: null, nextDate: null, minDate: null, maxDate: null, latestCompleteDate, hasData: false };
    const exact = dates.indexOf(selectedDate);
    if (exact >= 0) return { selectedDate, previousDate: exact > 0 ? dates[exact - 1] : null, nextDate: exact < dates.length - 1 ? dates[exact + 1] : null, minDate: dates[0], maxDate: dates.at(-1), latestCompleteDate, hasData: true };
    let previousDate = null, nextDate = null;
    for (const d of dates) { if (d < selectedDate) previousDate = d; else if (d > selectedDate) { nextDate = d; break; } }
    return { selectedDate, previousDate, nextDate, minDate: dates[0], maxDate: dates.at(-1), latestCompleteDate, hasData: false };
  }

  daily(date = null) {
    const selected = date || this.latestCompleteDate();
    if (this.dashboardCache.has(selected)) return this.dashboardCache.get(selected);
    const analyses = (this.byDate.get(selected) || []).map(c => this.analyseCycle(c));
    const counts = { poor: 0, review: 0, average: 0, good: 0, outstanding: 0, baseline: 0, dataWarnings: 0 };
    for (const a of analyses) {
      if (a.rating === 'Poor') counts.poor++;
      else if (a.rating === 'Review') counts.review++;
      else if (a.rating === 'Average') counts.average++;
      else if (a.rating === 'Good') counts.good++;
      else if (a.rating === 'Outstanding') counts.outstanding++;
      else if (a.rating === 'Baseline') counts.baseline++;
      else counts.dataWarnings++;
    }
    const needsReview = analyses.filter(a => ['Poor', 'Review'].includes(a.rating)).sort((a, b) => (a.deviationPct ?? 0) - (b.deviationPct ?? 0));
    const outstanding = analyses.filter(a => a.rating === 'Outstanding').sort((a, b) => (b.deviationPct ?? 0) - (a.deviationPct ?? 0));
    const dataWarnings = analyses.filter(a => a.rating === 'Data Warning');
    const distanceRows = analyses.filter(a => a.distanceBenchmark);
    const result = {
      date: selected,
      totalTrips: analyses.length,
      // Data Warning cycles failed source-data validation and are already excluded from
      // every benchmark, so they must not move the headline fleet average either. Before
      // this filter a handful of bad captures dragged 2026-09-03 to 12.13 km/L against a
      // true fleet figure of 2.40 km/L.
      averageKmL: round(mean(analyses.filter(a => a.rating !== 'Data Warning').map(a => a.analysedKmL).filter(v => Number.isFinite(v))), 2),
      counts,
      needsReview, outstanding, dataWarnings, trips: analyses,
      distanceSummary: {
        tripsWithBenchmark: distanceRows.length,
        positiveExtraKm: round(distanceRows.reduce((s, a) => s + Math.max(0, a.extraKm || 0), 0), 0),
        flaggedPositiveExtraKm: round(needsReview.reduce((s, a) => s + Math.max(0, a.extraKm || 0), 0), 0)
      },
      navigation: this.navigation(selected),
      cycleMethod: true,
      methodNote: 'Only completed Stellar full-up → route work/top-ups → Stellar full-up cycles receive performance ratings.'
    };
    this.dashboardCache.set(selected, result);
    return result;
  }

  dayCycleList(date = null) { return this.daily(date).trips; }

  destinationsForVehicle(reg) {
    reg = String(reg || '').toUpperCase();
    if (this.destinationCache.has(reg)) return this.destinationCache.get(reg);
    const counts = new Map();
    for (const c of (this.byAsset.get(reg) || [])) if (c.destination) counts.set(c.destination, (counts.get(c.destination) || 0) + 1);
    const out = [...counts.entries()].map(([destination, count]) => ({ destination, count })).sort((a, b) => b.count - a.count || a.destination.localeCompare(b.destination));
    this.destinationCache.set(reg, out); return out;
  }

  cycleListPage(reg, { destination = '', from = '', to = '', limit = 100, offset = 0 } = {}) {
    reg = String(reg || '').toUpperCase();
    const q = normalizePlace(destination);
    let rows = [...(this.byAsset.get(reg) || [])].reverse();
    if (q) rows = rows.filter(c => normalizePlace(c.destination) === q || (c.destinationStops || []).some(x => normalizePlace(x) === q));
    if (from) rows = rows.filter(c => c.date >= from);
    if (to) rows = rows.filter(c => c.date <= to);
    const total = rows.length;
    const off = Math.max(0, Number(offset) || 0), lim = Math.max(1, Math.min(500, Number(limit) || 100));
    const items = rows.slice(off, off + lim).map(c => this.analyseCycle(c));
    return { items, total, offset: off, limit: lim, hasMore: off + items.length < total, registration: reg };
  }

  tripsForVehicle(reg, options = {}) { return this.cycleListPage(reg, { ...options, offset: 0 }).items; }

  vehicleSummary(reg, includeLatest = true) {
    const base = this.rawEngine.vehicleSummary(reg, false);
    if (!base) return null;
    const cycles = this.byAsset.get(String(reg || '').toUpperCase()) || [];
    const latest = cycles.at(-1) || null;
    const latestAnalysis = includeLatest && latest ? this.analyseCycle(latest) : null;
    const valid = cycles.filter(c => c.validFuelCycle).map(c => c.analysedKmL).filter(Number.isFinite);
    return {
      ...base,
      currentKmL: latestAnalysis?.analysedKmL ?? null,
      currentRating: latestAnalysis?.rating ?? null,
      lastTripDate: latest?.date || null,
      historicalMedianKmL: round(median(valid), 2),
      odometerKm: latest?.closingOdometer ?? base.odometerKm,
      performanceCycleCount: cycles.length
    };
  }

  listVehicles(options = {}) {
    return this.rawEngine.listVehicles(options).map(v => {
      const summary = this.vehicleSummary(v.registration, true);
      return summary ? { ...v, ...summary } : v;
    });
  }

  vehicleAnalytics(reg, limit = 60) {
    const vehicle = this.vehicleSummary(reg, true);
    if (!vehicle) return null;
    return { vehicle, destinations: this.destinationsForVehicle(reg), trips: this.cycleListPage(reg, { limit, offset: 0 }).items };
  }

  status() {
    const benchmarkable = this.cycles.filter(c => c.validForBenchmark).length;
    const routeKnown = this.cycles.filter(c => c.routeKey).length;
    return {
      enabled: true,
      mode: 'stellar-full-to-full-model-route-weighted-v20',
      homeFillPatterns: this.homePatterns,
      minBenchmarkSamples: this.minBenchmarkSamples,
      modelBenchmarkMonths: this.modelBenchmarkMonths,
      minModelBenchmarkTrucks: this.minModelBenchmarkTrucks,
      modelGroups: this.byModel.size,
      completedCycles: this.cycles.length,
      routeKnownCycles: routeKnown,
      benchmarkableCycles: benchmarkable,
      latestCycleDate: this.latestCompleteDate()
    };
  }
}
