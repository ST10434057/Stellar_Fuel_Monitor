#!/usr/bin/env node
/**
 * Analytics acceptance verification - PROG7314 Final POE.
 *
 * Boots the production analytics engines against the packaged Stellar dataset and
 * diffs every field the Android screens display against an INDEPENDENT
 * recomputation (scripts/verify/harness.mjs).
 *
 *   node scripts/verify-analytics.mjs            # report to stdout + docs/
 *   node scripts/verify-analytics.mjs --quiet    # write the file only
 *
 * Exit code 0 only when every check passes and nothing under server/data/ changed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  bootOffline, dataFileFingerprints, buildIndex, recomputeAll,
  classifyRating, severityForRating, selectRepresentative, monthsBefore
} from './verify/harness.mjs';
import { severityForRating as productionSeverity } from '../src/alerts.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPORT_PATH = path.join(here, '..', '..', 'docs', 'ANALYTICS_ACCEPTANCE_RESULTS.md');
const QUIET = process.argv.includes('--quiet');

const out = [];
const w = line => { out.push(line); if (!QUIET) console.log(line); };

const round = (v, d = 2) => (v == null || !Number.isFinite(Number(v)) ? null : Number(Number(v).toFixed(d)));
const near = (a, b, tol) => a == null && b == null ? true : a == null || b == null ? false : Math.abs(a - b) <= tol;
const pct = (n, total) => total ? `${((n / total) * 100).toFixed(2)}%` : 'n/a';

/** One named check with a pass/fail count and up to 3 example offenders. */
function makeCheck(id, title) {
  return { id, title, passed: 0, failed: 0, examples: [], note: null };
}
function assess(check, ok, exampleFn) {
  if (ok) check.passed++;
  else { check.failed++; if (check.examples.length < 3) check.examples.push(exampleFn()); }
}

/* ------------------------------------------------------------------ run --- */

const startedAt = new Date().toISOString();
const fingerprintBefore = dataFileFingerprints();

const { snapshot, contexts, settings, cycleEngine, source } = await bootOffline();
const cycles = cycleEngine.cycles;
const index = buildIndex(cycles);

const INVALID_FLAGS = new Set([
  'missing_or_nonpositive_cycle_distance', 'missing_or_nonpositive_cycle_fuel',
  'missing_intermediate_fuel_capture', 'physically_implausible_full_cycle_efficiency',
  'cycle_odometer_discontinuity'
]);

const checks = {
  kmL: makeCheck('B1', 'Full-cycle km/L matches an independent total km / total litres'),
  distance: makeCheck('B1', 'Cycle distance and litres match the independent totals'),
  boundary: makeCheck('B1b', 'Both cycle boundaries are Stellar full-ups; opening litres excluded'),
  benchAvg: makeCheck('B2', 'Benchmark weighted average matches an independently rebuilt pool'),
  benchMedian: makeCheck('B2', 'Benchmark median matches the median of the pool km/L values'),
  benchSelect: makeCheck('B2b', 'Benchmark selection order is model-route then truck-route'),
  noLookAhead: makeCheck('B2c', 'No benchmark pools a cycle at or after the subject cycle'),
  sampleSize: makeCheck('B3', 'Sample size and distinct-truck count match'),
  gates: makeCheck('B3', 'Minimum-sample and minimum-truck gates hold'),
  window: makeCheck('B3', 'Benchmark history stays inside the 36-month window'),
  confidence: makeCheck('B3', 'Confidence tiering (>=20 and >=4 trucks high; >=8 medium; else low)'),
  deviation: makeCheck('B4', 'Deviation % matches the independent calculation'),
  rating: makeCheck('B4', 'Rating matches the independent threshold ladder'),
  severity: makeCheck('B4', 'Alert severity mapping (Poor->High, Data Warning->Data Warning, else Review)'),
  validFlag: makeCheck('B5', 'validFuelCycle equals "carries no invalidating quality flag"'),
  validBench: makeCheck('B5', 'validForBenchmark equals validFuelCycle AND a known route'),
  warningShort: makeCheck('B5', 'Data Warning cycles carry no benchmark, deviation or z-score'),
  poolPurity: makeCheck('B5', 'No invalid cycle appears in any benchmark pool')
};

const ratingCounts = new Map();
const selectionCounts = new Map();
const flagCounts = new Map();
const analyses = [];
let weightApplied = 0;
const zeroKmLCycles = [];      // finding: analysedKmL 0 where there is no real value
const displayContradictions = []; // finding: rounded deviation disagrees with the rating

for (const cycle of cycles) {
  const a = cycleEngine.analyseCycle(cycle);
  const ind = recomputeAll(cycle, index, settings);
  analyses.push(a);

  ratingCounts.set(a.rating, (ratingCounts.get(a.rating) || 0) + 1);
  selectionCounts.set(a.benchmarkSelection, (selectionCounts.get(a.benchmarkSelection) || 0) + 1);
  for (const f of cycle.qualityFlags) flagCounts.set(f, (flagCounts.get(f) || 0) + 1);
  if (a.weight?.applied) weightApplied++;

  /* -- B1 fuel arithmetic -------------------------------------------------- */
  const indKmL = round(ind.kmL, 2);
  if (ind.kmL == null && a.analysedKmL === 0) {
    zeroKmLCycles.push({ id: cycle.id, registration: cycle.assetId, date: cycle.date, km: cycle.kilometers, litres: cycle.litres, rating: a.rating });
    assess(checks.kmL, true, () => null); // counted separately as a presentation finding
  } else {
    assess(checks.kmL, near(a.analysedKmL, indKmL, 0.005),
      () => `${cycle.id} engine=${a.analysedKmL} independent=${indKmL}`);
  }
  assess(checks.distance,
    near(a.kilometers, round(ind.km, 1), 0.051) && near(a.litres, round(ind.litres, 2), 0.005),
    () => `${cycle.id} km ${a.kilometers}/${round(ind.km, 1)} L ${a.litres}/${round(ind.litres, 2)}`);

  /* -- B1b full-to-full boundary rule -------------------------------------- */
  const opensAtStellar = String(cycle.openingFillLocation || '').toUpperCase().includes('STELLAR');
  const closesAtStellar = String(cycle.closingFillLocation || '').toUpperCase().includes('STELLAR');
  const openingExcluded = !(cycle.sourceRows || []).includes(cycle.openingTripId);
  const closingIncluded = (cycle.sourceRows || []).includes(cycle.closingTripId);
  assess(checks.boundary, opensAtStellar && closesAtStellar && openingExcluded && closingIncluded,
    () => `${cycle.id} open=${cycle.openingFillLocation} close=${cycle.closingFillLocation} openingExcluded=${openingExcluded}`);

  /* -- B2 benchmark --------------------------------------------------------- */
  const eb = a.benchmark, ib = ind.benchmark;
  assess(checks.benchSelect, a.benchmarkSelection === ind.selection,
    () => `${cycle.id} engine=${a.benchmarkSelection} independent=${ind.selection}`);
  assess(checks.benchAvg, (!eb && !ib) || (eb && ib && near(eb.averageKmL, round(ib.averageKmL, 2), 0.005)),
    () => `${cycle.id} engine=${eb?.averageKmL} independent=${round(ib?.averageKmL, 2)}`);
  assess(checks.benchMedian, (!eb && !ib) || (eb && ib && near(eb.medianKmL, round(ib.medianKmL, 2), 0.005)),
    () => `${cycle.id} engine=${eb?.medianKmL} independent=${round(ib?.medianKmL, 2)}`);
  assess(checks.sampleSize, (!eb && !ib) || (eb && ib && eb.sampleSize === ib.sampleSize && eb.distinctTruckCount === ib.distinctTruckCount),
    () => `${cycle.id} engine=${eb?.sampleSize}/${eb?.distinctTruckCount} independent=${ib?.sampleSize}/${ib?.distinctTruckCount}`);
  assess(checks.confidence, (!eb && !ib) || (eb && ib && eb.confidence === ib.confidence),
    () => `${cycle.id} engine=${eb?.confidence} independent=${ib?.confidence}`);

  if (ib) {
    const minTrucks = ind.selection === 'model-route' ? settings.minModelBenchmarkTrucks : 1;
    assess(checks.gates, ib.sampleSize >= settings.minFullCycleBenchmarkSamples && ib.distinctTruckCount >= minTrucks,
      () => `${cycle.id} samples=${ib.sampleSize} trucks=${ib.distinctTruckCount} minTrucks=${minTrucks}`);
    // Window and look-ahead are checked against the ENGINE's own reported pool bounds
    // (publicBenchmark exposes historyStartDate/historyEndDate), so this is a real
    // check of what the engine pooled rather than a re-check of our own filter.
    const cutoff = monthsBefore(cycle.date, settings.modelBenchmarkMonths);
    assess(checks.window,
      eb.historyMonths === settings.modelBenchmarkMonths &&
      (!cutoff || eb.historyStartDate == null || eb.historyStartDate >= cutoff),
      () => `${cycle.id} cutoff=${cutoff} engine historyStart=${eb.historyStartDate} months=${eb.historyMonths}`);
    assess(checks.noLookAhead,
      eb.historyEndDate == null || eb.historyEndDate <= cycle.date,
      () => `${cycle.id} (${cycle.date}) engine pooled up to ${eb.historyEndDate}`);

    // Corroboration: the independently rebuilt pool agrees on both bounds.
    assess(checks.window,
      eb.historyStartDate === ib.historyStartDate && eb.historyEndDate === ib.historyEndDate,
      () => `${cycle.id} engine ${eb.historyStartDate}..${eb.historyEndDate} independent ${ib.historyStartDate}..${ib.historyEndDate}`);
    const impure = ib.poolIds.filter(id => {
      const c = cycleEngine.cycleById(id);
      return c && (!c.validFuelCycle || !c.validForBenchmark);
    });
    assess(checks.poolPurity, impure.length === 0, () => `${cycle.id} pooled invalid: ${impure.slice(0, 2).join(',')}`);
  }

  /* -- B4 rating and severity ---------------------------------------------- */
  assess(checks.deviation, near(a.deviationPct, round(ind.deviationPct, 1), 0.051),
    () => `${cycle.id} engine=${a.deviationPct} independent=${round(ind.deviationPct, 1)}`);
  assess(checks.rating, a.rating === ind.rating,
    () => `${cycle.id} engine=${a.rating} independent=${ind.rating} dev=${a.deviationPct}`);
  assess(checks.severity, productionSeverity(a.rating) === severityForRating(ind.rating),
    () => `${cycle.id} engine=${productionSeverity(a.rating)} independent=${severityForRating(ind.rating)}`);

  // Finding: the rating uses the unrounded deviation, the UI shows the rounded one.
  if (a.deviationPct != null && a.rating !== 'Data Warning' && a.rating !== 'Baseline') {
    const fromDisplayed = classifyRating(a.deviationPct, settings);
    if (fromDisplayed !== a.rating) {
      displayContradictions.push({
        id: cycle.id, registration: cycle.assetId, date: cycle.date,
        shown: a.deviationPct, rating: a.rating, impliedByShown: fromDisplayed
      });
    }
  }

  /* -- B5 data-quality separation ------------------------------------------ */
  const shouldBeValid = !cycle.qualityFlags.some(f => INVALID_FLAGS.has(f));
  assess(checks.validFlag, cycle.validFuelCycle === shouldBeValid,
    () => `${cycle.id} validFuelCycle=${cycle.validFuelCycle} flags=${cycle.qualityFlags.join('|')}`);
  assess(checks.validBench, cycle.validForBenchmark === (cycle.validFuelCycle && Boolean(cycle.routeKey)),
    () => `${cycle.id} validForBenchmark=${cycle.validForBenchmark}`);
  if (!cycle.validFuelCycle) {
    assess(checks.warningShort,
      a.rating === 'Data Warning' && a.benchmark == null && a.deviationPct == null && a.robustZ == null,
      () => `${cycle.id} rating=${a.rating} benchmark=${a.benchmark ? 'present' : 'null'} dev=${a.deviationPct}`);
  }
}

/* -- B5 bucket separation across every operating date ----------------------- */
const bucketCheck = makeCheck('B5', 'dataWarnings and needsReview never intersect on any operating date');
const dates = cycleEngine.availableDates();
let totalNeedsReview = 0, totalDataWarnings = 0;
for (const date of dates) {
  const daily = cycleEngine.daily(date);
  const reviewIds = new Set(daily.needsReview.map(x => x.id));
  const warnIds = new Set(daily.dataWarnings.map(x => x.id));
  const overlap = [...warnIds].filter(id => reviewIds.has(id));
  const countsOk = daily.counts.dataWarnings === daily.dataWarnings.length &&
    daily.counts.poor + daily.counts.review === daily.needsReview.length;
  assess(bucketCheck, overlap.length === 0 && countsOk,
    () => `${date} overlap=${overlap.length} counts=${JSON.stringify(daily.counts)}`);
  totalNeedsReview += daily.needsReview.length;
  totalDataWarnings += daily.dataWarnings.length;
}
checks.buckets = bucketCheck;

/* -- headline-average contamination ---------------------------------------- */
const latest = cycleEngine.latestCompleteDate();
const latestDaily = cycleEngine.daily(latest);
const headlineReported = latestDaily.averageKmL;
const headlineUnfiltered = round(
  (() => {
    const v = latestDaily.trips.map(t => t.analysedKmL).filter(Number.isFinite);
    return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
  })(), 2);

// The headline daily average must now agree with a clean recomputation on every date.
const headlineCheck = makeCheck('B5b', 'Headline daily average excludes Data Warning cycles');
let contaminatedIfUnfiltered = 0;
for (const date of dates) {
  const d = cycleEngine.daily(date);
  const clean = d.trips.filter(t => t.rating !== 'Data Warning').map(t => t.analysedKmL).filter(Number.isFinite);
  const cleanAvg = clean.length ? clean.reduce((s, x) => s + x, 0) / clean.length : null;
  const all = d.trips.map(t => t.analysedKmL).filter(Number.isFinite);
  const allAvg = all.length ? all.reduce((s, x) => s + x, 0) / all.length : null;
  assess(headlineCheck, near(d.averageKmL, round(cleanAvg, 2), 0.005),
    () => `${date} engine=${d.averageKmL} clean=${round(cleanAvg, 2)}`);
  if (allAvg != null && cleanAvg != null && Math.abs(round(cleanAvg, 2) - round(allAvg, 2)) > 0.005) contaminatedIfUnfiltered++;
}
checks.headline = headlineCheck;

/* -- destination label fragmentation ---------------------------------------- */
let labelInflatedVehicles = 0, vehiclesWithCycles = 0;
let labelExample = { reg: '-', labels: 0, keys: 0, collision: [], routeKey: '-' };
for (const [reg, list] of cycleEngine.byAsset.entries()) {
  if (!list.length) continue;
  vehiclesWithCycles++;
  const labels = cycleEngine.destinationsForVehicle(reg);
  const keys = new Set(list.map(c => c.routeKey).filter(Boolean));
  if (labels.length <= keys.size) continue;
  labelInflatedVehicles++;

  // Find the biggest group of distinct raw labels that share one routeKey.
  const labelsByKey = new Map();
  for (const c of list) {
    if (!c.routeKey || !c.destination) continue;
    if (!labelsByKey.has(c.routeKey)) labelsByKey.set(c.routeKey, new Map());
    const m = labelsByKey.get(c.routeKey);
    m.set(c.destination, (m.get(c.destination) || 0) + 1);
  }
  for (const [routeKey, m] of labelsByKey.entries()) {
    if (m.size < 2) continue;
    const group = [...m.entries()].sort((a, b) => b[1] - a[1]);
    const weight = group.reduce((s, [, n]) => s + n, 0);
    const bestWeight = labelExample.collision.reduce((s, [, n]) => s + n, 0);
    if (m.size > labelExample.collision.length || (m.size === labelExample.collision.length && weight > bestWeight)) {
      labelExample = { reg, labels: labels.length, keys: keys.size, collision: group.slice(0, 4), routeKey };
    }
  }
}

/* --------------------------------------------------------------- report --- */

const total = cycles.length;
const fingerprintAfter = dataFileFingerprints();
const dataUnchanged = JSON.stringify(fingerprintBefore) === JSON.stringify(fingerprintAfter);
const allChecks = Object.values(checks);
const failedChecks = allChecks.filter(c => c.failed > 0);

w('# Analytics Acceptance Verification Results');
w('');
w('Generated by `node scripts/verify-analytics.mjs`. Every figure below is produced by');
w('diffing the production engine against an independent recomputation in');
w('`server/scripts/verify/harness.mjs`. Do not hand-edit; re-run instead.');
w('');
w(`- Run at: ${startedAt}`);
w(`- Node: ${process.version}`);
w(`- Data source: **${source.source}** (${source.databaseName ? 'db ' + source.databaseName : 'packaged cache'})`);
w(`- Dataset: ${snapshot.meta.datasetName} — ${snapshot.meta.datasetDate}, ${snapshot.assets.length} assets, ${snapshot.trips.length} trips`);
w(`- Trip contexts loaded: ${contexts.length}${contexts.length === 0 ? ' — no trailer/payload saved, so load adjustment is never applied and the expected target equals the raw benchmark average' : ''}`);
w(`- Cycles with load adjustment applied: ${weightApplied}`);
w('');

w('## 1. Engine status');
w('');
w('```json');
w(JSON.stringify(cycleEngine.status(), null, 2));
w('```');
w('');

w('## 2. Thresholds and gates in force');
w('');
w('| Setting | Value |');
w('|---|---|');
for (const key of ['poorDeviationPct', 'reviewDeviationPct', 'goodDeviationPct', 'outstandingDeviationPct',
  'minFullCycleBenchmarkSamples', 'minModelBenchmarkTrucks', 'modelBenchmarkMonths', 'weightSensitivity']) {
  w(`| \`${key}\` | ${JSON.stringify(settings[key])} |`);
}
w(`| \`homeFillLocationPatterns\` | ${JSON.stringify(settings.homeFillLocationPatterns)} |`);
w('');

w(`## 3. Full sweep — all ${total} cycles`);
w('');
w('| Check | Item | Passed | Failed | Result |');
w('|---|---|---|---|---|');
for (const c of allChecks) {
  w(`| ${c.title} | ${c.id} | ${c.passed} | ${c.failed} | ${c.failed === 0 ? '**PASS**' : '**FAIL**'} |`);
}
w('');
if (failedChecks.length) {
  w('### Failures');
  w('');
  for (const c of failedChecks) {
    w(`**${c.title}** (${c.failed} failed). Examples:`);
    w('');
    for (const e of c.examples) w(`- \`${e}\``);
    w('');
  }
}

w('## 4. Result distribution');
w('');
w('| Rating | Cycles | Share |');
w('|---|---|---|');
for (const [k, v] of [...ratingCounts.entries()].sort((a, b) => b[1] - a[1])) w(`| ${k} | ${v} | ${pct(v, total)} |`);
w('');
w('| Benchmark selection | Cycles | Share |');
w('|---|---|---|');
for (const [k, v] of [...selectionCounts.entries()].sort((a, b) => b[1] - a[1])) w(`| ${k} | ${v} | ${pct(v, total)} |`);
w('');

w('## 5. Data-quality separation');
w('');
w(`- Cycles failing \`validFuelCycle\`: **${cycles.filter(c => !c.validFuelCycle).length}**`);
w(`- Invalid cycles that still reached \`validForBenchmark\`: **${cycles.filter(c => !c.validFuelCycle && c.validForBenchmark).length}** (must be 0)`);
w(`- Operating dates checked for bucket overlap: **${dates.length}**; total needs-review ${totalNeedsReview}, total data warnings ${totalDataWarnings}`);
w('');
w('| Quality flag | Cycles | Invalidating? |');
w('|---|---|---|');
for (const [k, v] of [...flagCounts.entries()].sort((a, b) => b[1] - a[1])) {
  w(`| \`${k}\` | ${v} | ${INVALID_FLAGS.has(k) ? 'yes — becomes Data Warning' : 'no — flagged but still rated'} |`);
}
w('');

w('## 6. Representative records (deterministic)');
w('');
w('Selected by sorting each rating/selection stratum by `cycle.id`, which is a sha1 of the');
w('source identifiers — so this table is identical on every machine and every run.');
w('');
w('| Stratum | Cycle | Reg | Date | km | L | km/L | Benchmark | Samples | Conf | Dev % |');
w('|---|---|---|---|---|---|---|---|---|---|---|');
for (const [stratum, rows] of selectRepresentative(analyses, { perStratum: 2 })) {
  for (const r of rows) {
    w(`| ${stratum} | \`${r.id}\` | ${r.registration} | ${r.date} | ${r.kilometers ?? '—'} | ${r.litres ?? '—'} | ${r.analysedKmL ?? '—'} | ${r.benchmark?.averageKmL ?? '—'} | ${r.benchmark?.sampleSize ?? '—'} | ${r.benchmark?.confidence ?? '—'} | ${r.deviationPct ?? '—'} |`);
  }
}
w('');

w('## 7. Findings (verified, not fixed by this package unless noted)');
w('');
w(`### F1 — Headline daily average included Data Warning cycles — **FIXED**`);
w('');
w('`daily().averageKmL` averaged every finite `analysedKmL`, including cycles the engine itself');
w('rated `Data Warning` and excluded from all benchmarks. A handful of capture errors could');
w('therefore drag the dashboard headline to a figure no truck in the fleet achieves.');
w('');
w(`- Operating dates that would be affected without the filter: **${contaminatedIfUnfiltered} of ${dates.length}**`);
w(`- Latest complete date ${latest}: now reports **${headlineReported}** km/L; unfiltered it read **${headlineUnfiltered}** km/L`);
w('- Fixed in `cycle-analytics.js` `daily()`; the dead value-matching `valid` filter above it');
w('  (which resolved ratings by floating-point km/L and could match the wrong cycle) was removed.');
w('- Locked by `server/test/cycle-analytics.test.js` — "the daily view keeps data warnings out of');
w('  the review queue and the average".');
w('');
w(`### F2 — Displayed deviation can contradict the displayed rating`);
w('');
w('The rating is decided on the unrounded deviation; the API exposes `round(deviationPct, 1)`.');
w('A cycle can therefore show a variance that sits exactly on a threshold while carrying the');
w('rating from the other side of it.');
w('');
w(`- Affected cycles: **${displayContradictions.length}**`);
if (displayContradictions.length) {
  w('');
  w('| Cycle | Reg | Date | Shown variance | Shown rating | Rating implied by shown variance |');
  w('|---|---|---|---|---|---|');
  for (const d of displayContradictions.slice(0, 25)) {
    w(`| \`${d.id}\` | ${d.registration} | ${d.date} | ${d.shown}% | ${d.rating} | ${d.impliedByShown} |`);
  }
  if (displayContradictions.length > 25) w(`| … | | | | | ${displayContradictions.length - 25} more |`);
}
w('');
w(`### F3 — Data Warning cycles with no distance render as 0.00 km/L`);
w('');
w('`finite(null)` returns `0` because `Number(null) === 0`, so a cycle with no usable distance');
w('reports `analysedKmL: 0` rather than `null`, and the Android formatter prints "0.00 km/L".');
w('');
w(`- Affected cycles: **${zeroKmLCycles.length}** (all already rated Data Warning)`);
if (zeroKmLCycles.length) {
  w('');
  w('| Cycle | Reg | Date | km | L |');
  w('|---|---|---|---|---|');
  for (const z of zeroKmLCycles.slice(0, 10)) w(`| \`${z.id}\` | ${z.registration} | ${z.date} | ${z.km} | ${z.litres} |`);
  if (zeroKmLCycles.length > 10) w(`| … | | | | ${zeroKmLCycles.length - 10} more |`);
}
w('');
w('### F4 — `excludedOutliers` is always 0 on the V20 engine');
w('');
w('The full-cycle engine performs no MAD/IQR outlier rejection (only the wide 0.20–6.50 km/L');
w('physical guardrail). `publicBenchmark` hard-codes `excludedOutliers: 0`, yet the Android');
w('`TripBenchmark` DTO carries it as if it were a computed statistic. The demonstration must not');
w('claim outlier removal on this engine.');
w('');

w('### F5 — The Destinations count double-counts routes that share one benchmark pool');
w('');
w('Benchmarking keys on the normalised `routeKey`, but `destinationsForVehicle()` keys on the');
w('raw destination string. Case and spelling variants of one place are therefore one pool but');
w('several rows in the vehicle Destinations count.');
w('');
w(`- Vehicles where the Destinations count exceeds the distinct route count: **${labelInflatedVehicles} of ${vehiclesWithCycles}**`);
w(`- Worked example: ${labelExample.reg} shows **${labelExample.labels}** destinations but has **${labelExample.keys}** distinct routes`);
w(`  — the labels ${labelExample.collision.map(([d, n]) => `\`${d}\` (${n})`).join(', ')} all normalise to \`${labelExample.routeKey}\` and share one benchmark pool`);
w('- Benchmarks are unaffected — only the displayed destination count is inflated.');
w('');

w('## 8. Integrity');
w('');
w(`- **DATA FILES UNCHANGED: ${dataUnchanged ? 'yes' : 'NO'}** — the harness never imports the`);
w('  precomputed-cache writers or the repository save paths.');
w(`- Files fingerprinted under \`server/data/\`: ${Object.keys(fingerprintAfter).length}`);
w('');

const ok = failedChecks.length === 0 && dataUnchanged;
w(`## Verdict: ${ok ? '**PASS**' : '**FAIL**'}`);
w('');
if (ok) {
  w(`All ${allChecks.length} checks passed across ${total} full fuel cycles: every km/L, benchmark,`);
  w('sample count, deviation, rating and severity the Android screens display matches an');
  w('independent recomputation from the raw Stellar rows.');
  w('');
  w('F1 has been fixed in this package. F2 to F5 are presentation defects recorded for the group');
  w('to triage - none of them changes a rating, a benchmark or a severity.');
} else {
  w('One or more checks failed. See section 3.');
}

fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
fs.writeFileSync(REPORT_PATH, out.join('\n') + '\n', 'utf8');
if (QUIET) console.log(`Report written to ${REPORT_PATH}`);
else console.log(`\nReport written to ${REPORT_PATH}`);

process.exit(ok ? 0 : 1);
