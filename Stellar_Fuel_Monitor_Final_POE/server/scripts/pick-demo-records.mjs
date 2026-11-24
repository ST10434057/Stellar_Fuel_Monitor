#!/usr/bin/env node
/**
 * Picks demonstration records for the Final POE video and prints everything the
 * presenter needs: the on-screen values, the in-app navigation path, and the
 * position of the record in the vehicle's cycle list.
 *
 * Candidates are filtered so nothing awkward reaches the camera:
 *  - no cycle whose displayed (rounded) variance contradicts its rating
 *  - no data-quality record that is really a light vehicle tripping a truck-tuned guardrail
 *  - nothing below the first 30 cycles of a vehicle list (the app renders take(30))
 *
 *   node scripts/pick-demo-records.mjs
 */
import { bootOffline, buildIndex, classifyRating } from './verify/harness.mjs';
import { alertFromTrip } from '../src/alerts.js';

const { cycleEngine, settings } = await bootOffline();
const latest = cycleEngine.latestCompleteDate();

/* --------------------------------------- what the default screens will show --- */

const daily = cycleEngine.daily(latest);
console.log(`\n=== Latest complete date: ${latest} ===`);
console.log(`Trips / Alerts / Dashboard all default to this date (no date picker in the app).`);
console.log(`counts: ${JSON.stringify(daily.counts)}`);
console.log(`averageKmL: ${daily.averageKmL}`);
console.log(`needsReview: ${daily.needsReview.length}  dataWarnings: ${daily.dataWarnings.length}`);
const alertsHere = [...daily.needsReview, ...daily.dataWarnings].map(alertFromTrip);
console.log(`Alerts screen will list ${alertsHere.length}: ` +
  JSON.stringify(alertsHere.reduce((m, a) => { m[a.severity] = (m[a.severity] || 0) + 1; return m; }, {})));

/* ------------------------------------------------------------- candidates --- */

// Position of each cycle within its vehicle's newest-first list, as the app renders it.
const positionOf = new Map();
for (const [reg, list] of cycleEngine.byAsset.entries()) {
  const newestFirst = [...list].reverse();
  newestFirst.forEach((c, i) => positionOf.set(c.id, { reg, position: i + 1, total: newestFirst.length }));
}

const LIGHT_VEHICLE = /RANGER|LDV|BAKKIE|HILUX|D-MAX|DMAX|NP300|PICK ?UP/i;

const rows = [];
for (const cycle of cycleEngine.cycles) {
  const a = cycleEngine.analyseCycle(cycle);
  const pos = positionOf.get(cycle.id);
  if (!pos || pos.position > 30) continue;            // not reachable in the app list

  // Skip the cycles whose displayed variance disagrees with their badge.
  if (a.deviationPct != null && a.rating !== 'Data Warning' && a.rating !== 'Baseline' &&
      classifyRating(a.deviationPct, settings) !== a.rating) continue;

  rows.push({ cycle, a, pos });
}

function show(title, picks) {
  console.log(`\n=== ${title} ===`);
  if (!picks.length) { console.log('(no candidate met the criteria)'); return; }
  for (const { cycle, a, pos } of picks) {
    console.log([
      `id            ${a.id}`,
      `registration  ${a.registration}   (${a.modelLabel})`,
      `cycle         ${a.openingDate} -> ${a.closingDate}`,
      `route         ${a.routeLabel || a.destination || '(none)'}   confidence=${a.destinationConfidence}`,
      `distance      ${a.kilometers} km      fuel ${a.litres} L`,
      `efficiency    ${a.analysedKmL} km/L`,
      `benchmark     ${a.benchmark?.averageKmL ?? '-'} km/L   median ${a.benchmark?.medianKmL ?? '-'}`,
      `samples       ${a.benchmark?.sampleSize ?? '-'}  trucks ${a.benchmark?.distinctTruckCount ?? '-'}  confidence ${a.benchmark?.confidence ?? '-'}`,
      `scope         ${a.benchmark?.scope ?? '-'}`,
      `variance      ${a.deviationPct ?? '-'} %      robust z ${a.robustZ ?? '-'}`,
      `expected L    ${a.expectedLitres ?? '-'}      excess ${a.excessLitres ?? '-'} L`,
      `rating        ${a.rating}   severity ${alertFromTrip(a).severity}   confidenceScore ${a.confidenceScore}`,
      `top-ups       ${a.intermediateTopUpCount}   fuel readings ${a.cycleFuelEventCount}`,
      `flags         ${cycle.qualityFlags.join(', ') || '(none)'}`,
      `app path      Vehicles -> ${pos.reg} -> card ${pos.position} of ${pos.total} (newest first)`,
      `on ${latest}? ${a.date === latest ? 'YES - also visible on Trips/Alerts' : 'no - reach via Vehicles'}`
    ].map(l => '  ' + l).join('\n'));
    console.log('  ' + '-'.repeat(70));
  }
}

const byQuality = (x, y) => (y.a.benchmark?.sampleSize ?? 0) - (x.a.benchmark?.sampleSize ?? 0);

// A: a clean, well-benchmarked good cycle - the "normal" Vehicle Fuel Performance story.
show('A. Good / well benchmarked', rows.filter(r =>
  r.a.rating === 'Good' && !r.cycle.qualityFlags.length &&
  r.a.benchmark?.confidence === 'high' && r.a.analysedKmL > 1.5 && r.a.analysedKmL < 4
).sort(byQuality).slice(0, 3));

// B: a genuine performance anomaly, clear of the -15 boundary, plausible km/L.
show('B. Poor / High severity anomaly', rows.filter(r =>
  r.a.rating === 'Poor' && !r.cycle.qualityFlags.length &&
  r.a.deviationPct <= -18 && r.a.deviationPct >= -45 &&
  r.a.analysedKmL > 1.2 && r.a.benchmark?.sampleSize >= 20
).sort(byQuality).slice(0, 3));

// C: the middle band - below expected but not an accusation.
show('C. Review / middle band', rows.filter(r =>
  r.a.rating === 'Review' && !r.cycle.qualityFlags.length &&
  r.a.deviationPct <= -9 && r.a.deviationPct >= -14 &&
  r.a.benchmark?.sampleSize >= 20
).sort(byQuality).slice(0, 3));

// D: a real capture error on a heavy vehicle - not a light vehicle tripping the guardrail.
show('D. Data Warning / genuine capture error', rows.filter(r => {
  if (r.a.rating !== 'Data Warning') return false;
  if (LIGHT_VEHICLE.test(`${r.a.modelLabel} ${r.cycle.assetId}`)) return false;
  // A truck reading well under 1 km/L is a capture problem, not a fast bakkie.
  return r.cycle.analysedKmL > 0 && r.cycle.analysedKmL < 0.5 && r.cycle.litres > 200;
}).sort((x, y) => y.cycle.litres - x.cycle.litres).slice(0, 3));

// E: the strongest destination-comparison story - many samples, many trucks.
show('E. Trip/Destination Comparison / deep benchmark', rows.filter(r =>
  r.a.benchmark?.confidence === 'high' && r.a.benchmark.distinctTruckCount >= 4 &&
  !r.cycle.qualityFlags.length && ['Average', 'Good'].includes(r.a.rating)
).sort(byQuality).slice(0, 3));

// F: proves the full-to-full rule on screen - intermediate top-ups counted.
show('F. Cycle with intermediate top-ups (proves the full-to-full rule)', rows.filter(r =>
  r.a.intermediateTopUpCount >= 2 && !r.cycle.qualityFlags.length && r.a.benchmark
).sort((x, y) => y.a.intermediateTopUpCount - x.a.intermediateTopUpCount).slice(0, 3));
