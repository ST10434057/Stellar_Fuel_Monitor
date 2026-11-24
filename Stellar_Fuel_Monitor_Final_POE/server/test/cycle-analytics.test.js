/**
 * Boundary and behaviour tests for the V20 full-cycle analytics.
 *
 * These drive the REAL CycleAnalyticsEngine over a tiny synthetic fleet rather than
 * re-implementing its rules, so a change to the engine fails here. The fixture
 * builders live in scripts/verify/harness.mjs and are shared with the acceptance
 * harness.
 *
 * Fleet shape used by most tests: two trucks of the same model, each fuelling at a
 * Stellar depot. Consecutive Stellar full-ups become one cycle; the opening fill's
 * litres are excluded, so every prior cycle below is exactly 1000 km / 500 L = 2.00
 * km/L and a pooled benchmark comes out at exactly 2.0.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { fixtureEngine, fixtureRow, fixtureTruck, classifyRating } from '../scripts/verify/harness.mjs';
import { alertFromTrip, severityForRating } from '../src/alerts.js';

const DEFAULTS = {
  poorDeviationPct: -15, reviewDeviationPct: -7.5,
  goodDeviationPct: 4, outstandingDeviationPct: 10
};

/** Thresholds that are exact binary fractions, so boundary maths has no float slop. */
const EXACT = {
  poorDeviationPct: -12.5, reviewDeviationPct: -6.25,
  goodDeviationPct: 6.25, outstandingDeviationPct: 12.5
};

const truck = reg => fixtureTruck(reg);

/**
 * Three prior ALPHA cycles (two by T1, one by T2), then one target cycle on T1 whose
 * distance is `targetKm` against 100 L. The benchmark is exactly 2.0 km/L, so the
 * target's deviation is `targetKm / 2 - 100` percent.
 */
function fleetWithTarget(targetKm, { settings = {}, extraRows = [] } = {}) {
  const rows = [
    fixtureRow({ reg: 'T1', id: 'a0', date: '2026-01-01', startKm: 0, endKm: 1000, litres: 100, home: true }),
    fixtureRow({ reg: 'T1', id: 'a1', date: '2026-01-10', startKm: 1000, endKm: 2000, litres: 500, home: true, dest: 'ALPHA' }),
    fixtureRow({ reg: 'T1', id: 'a2', date: '2026-01-20', startKm: 2000, endKm: 3000, litres: 500, home: true, dest: 'ALPHA' }),
    fixtureRow({ reg: 'T2', id: 'b0', date: '2026-01-02', startKm: 0, endKm: 1000, litres: 100, home: true }),
    fixtureRow({ reg: 'T2', id: 'b1', date: '2026-01-12', startKm: 1000, endKm: 2000, litres: 500, home: true, dest: 'ALPHA' }),
    fixtureRow({ reg: 'T1', id: 'a3', date: '2026-02-01', startKm: 3000, endKm: 3000 + targetKm, litres: 100, home: true, dest: 'ALPHA' }),
    ...extraRows
  ];
  const engine = fixtureEngine({ rows, assets: [truck('T1'), truck('T2')], settings });
  const target = engine.cycles.find(c => c.closingTripId === 'a3');
  assert.ok(target, 'target cycle was not built');
  return { engine, target, analysis: engine.analyseCycle(target) };
}

/* ------------------------------------------------- pure threshold ladder --- */

test('classifyRating is inclusive on each threshold and flips just past it', () => {
  assert.equal(classifyRating(-15.0001, DEFAULTS), 'Poor');
  assert.equal(classifyRating(-15, DEFAULTS), 'Poor');
  assert.equal(classifyRating(-14.9999, DEFAULTS), 'Review');

  assert.equal(classifyRating(-7.5001, DEFAULTS), 'Review');
  assert.equal(classifyRating(-7.5, DEFAULTS), 'Review');
  assert.equal(classifyRating(-7.4999, DEFAULTS), 'Average');

  assert.equal(classifyRating(0, DEFAULTS), 'Average');
  assert.equal(classifyRating(3.9999, DEFAULTS), 'Average');
  assert.equal(classifyRating(4, DEFAULTS), 'Good');

  assert.equal(classifyRating(9.9999, DEFAULTS), 'Good');
  assert.equal(classifyRating(10, DEFAULTS), 'Outstanding');

  assert.equal(classifyRating(null, DEFAULTS), null);
});

/* --------------------------------------------------- severity mapping ----- */

test('alert severity has exactly three levels and never escalates a data warning', () => {
  assert.equal(severityForRating('Poor'), 'High');
  assert.equal(severityForRating('Data Warning'), 'Data Warning');
  for (const r of ['Review', 'Average', 'Good', 'Outstanding', 'Baseline', null, undefined]) {
    assert.equal(severityForRating(r), 'Review', `unexpected severity for ${r}`);
  }
});

test('alertFromTrip explains the record rather than accusing a driver', () => {
  const performance = alertFromTrip({
    id: 'cycle_x', registration: 'T1', date: '2026-02-01', rating: 'Poor',
    analysedKmL: 1.7, deviationPct: -15, confidenceScore: 80,
    benchmark: { averageKmL: 2, scope: 'Same model/type + axle + same destination' }
  });
  assert.equal(performance.id, 'ALERT-cycle_x');
  assert.equal(performance.tripId, 'cycle_x');
  assert.equal(performance.severity, 'High');
  assert.equal(performance.status, 'Open');
  assert.match(performance.reason, /15\.0% below Same model/);
  assert.match(performance.benchmark, /2\.00 km\/L/);

  const warning = alertFromTrip({ id: 'cycle_y', registration: 'T2', date: '2026-02-01', rating: 'Data Warning' });
  assert.equal(warning.severity, 'Data Warning');
  assert.match(warning.reason, /failed source-data validation/);
  assert.equal(warning.benchmark, 'Insufficient clean history');
});

/* ------------------------------------------------ full-to-full accounting -- */

test('a cycle excludes the opening fill and includes every intermediate top-up', () => {
  const rows = [
    fixtureRow({ reg: 'T1', id: 'a0', date: '2026-01-01', startKm: 0, endKm: 1000, litres: 999, home: true }),
    fixtureRow({ reg: 'T1', id: 'm1', date: '2026-01-04', startKm: 1000, endKm: 1400, litres: 200, dest: 'ALPHA' }),
    fixtureRow({ reg: 'T1', id: 'm2', date: '2026-01-07', startKm: 1400, endKm: 1700, litres: 150, dest: 'ALPHA' }),
    fixtureRow({ reg: 'T1', id: 'a1', date: '2026-01-10', startKm: 1700, endKm: 2000, litres: 150, home: true, dest: 'ALPHA' })
  ];
  const engine = fixtureEngine({ rows, assets: [truck('T1')] });
  assert.equal(engine.cycles.length, 1);
  const [cycle] = engine.cycles;

  // 1000 km from odometer 1000 -> 2000; 200 + 150 + 150 = 500 L. The opening 999 L is out.
  assert.equal(cycle.kilometers, 1000);
  assert.equal(cycle.litres, 500);
  assert.equal(cycle.analysedKmL, 2);
  assert.deepEqual(cycle.sourceRows, ['m1', 'm2', 'a1']);
  assert.ok(!cycle.sourceRows.includes('a0'), 'opening full-up must not be counted');
  assert.equal(cycle.intermediateFills.length, 2);
  assert.deepEqual(cycle.qualityFlags, []);
});

/* --------------------------------------------- rating boundary behaviour --- */

test('engine ratings are inclusive on each threshold (binary-exact deviations)', () => {
  // Benchmark is exactly 2.0 km/L, so deviation% === targetKm / 2 - 100.
  const cases = [
    [175, -12.5, 'Poor'],
    [187.5, -6.25, 'Review'],
    [200, 0, 'Average'],
    [212.5, 6.25, 'Good'],
    [225, 12.5, 'Outstanding']
  ];
  for (const [targetKm, expectedDeviation, expectedRating] of cases) {
    const { analysis } = fleetWithTarget(targetKm, { settings: EXACT });
    assert.equal(analysis.benchmark.averageKmL, 2, `benchmark drifted for ${targetKm} km`);
    // The rating is decided on the exact deviation; the DTO exposes it rounded to 1 dp.
    assert.equal(analysis.deviationPct, Number(expectedDeviation.toFixed(1)), `displayed deviation for ${targetKm} km`);
    assert.equal(analysis.rating, expectedRating, `rating at exactly ${expectedDeviation}%`);
  }
});

test('engine ratings use the shipped production thresholds', () => {
  for (const [targetKm, expectedRating] of [[160, 'Poor'], [180, 'Review'], [200, 'Average'], [212, 'Good'], [230, 'Outstanding']]) {
    const { analysis } = fleetWithTarget(targetKm);
    assert.equal(analysis.rating, expectedRating, `${targetKm} km should be ${expectedRating}`);
  }
});

/* -------------------------------------------------- benchmark selection --- */

test('a pooled model-route benchmark is preferred and is distance/fuel weighted', () => {
  const { analysis } = fleetWithTarget(200);
  assert.equal(analysis.benchmarkSelection, 'model-route');
  assert.equal(analysis.benchmark.sampleSize, 3);
  assert.equal(analysis.benchmark.distinctTruckCount, 2);
  // 3000 historical km / 1500 historical L, not the mean of the per-cycle km/L values.
  assert.equal(analysis.benchmark.totalDistanceKm, 3000);
  assert.equal(analysis.benchmark.totalLitres, 1500);
  assert.equal(analysis.benchmark.averageKmL, 2);
  // The three-sample floor applies to the secondary exact-truck benchmark too: T1 has
  // only two prior ALPHA cycles of its own, so no separate truck figure is offered.
  assert.equal(analysis.truckBenchmark, null);
});

test('fewer than three prior cycles leaves the record Baseline, not Poor', () => {
  const rows = [
    fixtureRow({ reg: 'T1', id: 'a0', date: '2026-01-01', startKm: 0, endKm: 1000, litres: 100, home: true }),
    fixtureRow({ reg: 'T1', id: 'a1', date: '2026-01-10', startKm: 1000, endKm: 2000, litres: 500, home: true, dest: 'ALPHA' }),
    fixtureRow({ reg: 'T2', id: 'b0', date: '2026-01-02', startKm: 0, endKm: 1000, litres: 100, home: true }),
    fixtureRow({ reg: 'T2', id: 'b1', date: '2026-01-12', startKm: 1000, endKm: 2000, litres: 500, home: true, dest: 'ALPHA' }),
    // Target: only 2 prior cycles exist, below minFullCycleBenchmarkSamples = 3.
    fixtureRow({ reg: 'T1', id: 'a2', date: '2026-02-01', startKm: 2000, endKm: 2100, litres: 100, home: true, dest: 'ALPHA' })
  ];
  const engine = fixtureEngine({ rows, assets: [truck('T1'), truck('T2')] });
  const target = engine.cycles.find(c => c.closingTripId === 'a2');
  const analysis = engine.analyseCycle(target);

  assert.equal(analysis.rating, 'Baseline');
  assert.equal(analysis.benchmark, null);
  assert.equal(analysis.deviationPct, null);
  assert.equal(analysis.benchmarkSelection, 'baseline');
});

test('one truck cannot form a model pool, so it falls back to its own route history', () => {
  const rows = [
    fixtureRow({ reg: 'T1', id: 'a0', date: '2026-01-01', startKm: 0, endKm: 1000, litres: 100, home: true }),
    fixtureRow({ reg: 'T1', id: 'a1', date: '2026-01-10', startKm: 1000, endKm: 2000, litres: 500, home: true, dest: 'ALPHA' }),
    fixtureRow({ reg: 'T1', id: 'a2', date: '2026-01-20', startKm: 2000, endKm: 3000, litres: 500, home: true, dest: 'ALPHA' }),
    fixtureRow({ reg: 'T1', id: 'a3', date: '2026-01-25', startKm: 3000, endKm: 4000, litres: 500, home: true, dest: 'ALPHA' }),
    fixtureRow({ reg: 'T1', id: 'a4', date: '2026-02-01', startKm: 4000, endKm: 4200, litres: 100, home: true, dest: 'ALPHA' })
  ];
  const engine = fixtureEngine({ rows, assets: [truck('T1')] });
  const analysis = engine.analyseCycle(engine.cycles.find(c => c.closingTripId === 'a4'));

  assert.equal(analysis.benchmarkSelection, 'truck-route-fallback');
  assert.equal(analysis.modelBenchmark, null, 'one truck is below minModelBenchmarkTrucks = 2');
  assert.equal(analysis.truckBenchmark.sampleSize, 3);
  assert.equal(analysis.benchmark.averageKmL, 2);
});

test('a later cycle never leaks into an earlier cycle benchmark', () => {
  const future = [
    fixtureRow({ reg: 'T2', id: 'b2', date: '2026-03-01', startKm: 2000, endKm: 3000, litres: 500, home: true, dest: 'ALPHA' })
  ];
  const withoutFuture = fleetWithTarget(200);
  const withFuture = fleetWithTarget(200, { extraRows: future });

  assert.equal(withFuture.analysis.benchmark.sampleSize, withoutFuture.analysis.benchmark.sampleSize);
  assert.ok(withFuture.analysis.benchmark.historyEndDate <= withFuture.target.date,
    'benchmark history must end on or before the cycle being rated');
});

test('cycles older than the benchmark window are excluded', () => {
  // 2023-01-05 is more than 36 months before the 2026-02-01 target.
  const stale = [
    fixtureRow({ reg: 'T2', id: 'c0', date: '2022-12-01', startKm: 5000, endKm: 6000, litres: 100, home: true }),
    fixtureRow({ reg: 'T2', id: 'c1', date: '2022-12-20', startKm: 6000, endKm: 7000, litres: 500, home: true, dest: 'ALPHA' })
  ];
  const { analysis } = fleetWithTarget(200, { extraRows: stale });
  assert.equal(analysis.benchmark.sampleSize, 3, 'the 2022 cycle is outside the 36-month window');
  assert.ok(analysis.benchmark.historyStartDate >= '2023-02-01');
});

test('confidence tiering needs both the sample count and the truck count', () => {
  const build = (truckCount, cyclesPerTruck) => {
    const rows = [];
    const assets = [];
    for (let t = 0; t < truckCount; t++) {
      const reg = `V${t}`;
      assets.push(truck(reg));
      rows.push(fixtureRow({ reg, id: `${reg}-0`, date: '2026-01-01', startKm: 0, endKm: 1000, litres: 100, home: true }));
      for (let i = 1; i <= cyclesPerTruck; i++) {
        rows.push(fixtureRow({
          reg, id: `${reg}-${i}`, date: `2026-01-${String(i + 1).padStart(2, '0')}`,
          startKm: i * 1000, endKm: (i + 1) * 1000, litres: 500, home: true, dest: 'ALPHA'
        }));
      }
    }
    // Target on V0, after everything above.
    const last = cyclesPerTruck + 1;
    rows.push(fixtureRow({
      reg: 'V0', id: 'target', date: '2026-03-01',
      startKm: last * 1000, endKm: last * 1000 + 200, litres: 100, home: true, dest: 'ALPHA'
    }));
    const engine = fixtureEngine({ rows, assets });
    return engine.analyseCycle(engine.cycles.find(c => c.closingTripId === 'target')).benchmark;
  };

  assert.equal(build(2, 3).confidence, 'low', '6 samples is below the medium tier');
  assert.equal(build(2, 4).confidence, 'medium', '8 samples reaches medium');
  assert.equal(build(3, 7).confidence, 'medium', '21 samples but only 3 trucks stays medium');
  assert.equal(build(4, 5).confidence, 'high', '20 samples across 4 trucks reaches high');
});

/* ------------------------------------------ data quality vs real anomaly --- */

test('a data-quality failure is never rated as a performance anomaly', () => {
  const rows = [
    fixtureRow({ reg: 'T1', id: 'a0', date: '2026-01-01', startKm: 0, endKm: 1000, litres: 100, home: true }),
    // 1000 km on 10 L is 100 km/L - far outside the 0.20-6.50 physical guardrail.
    fixtureRow({ reg: 'T1', id: 'a1', date: '2026-01-10', startKm: 1000, endKm: 2000, litres: 10, home: true, dest: 'ALPHA' })
  ];
  const engine = fixtureEngine({ rows, assets: [truck('T1')] });
  const [cycle] = engine.cycles;
  const analysis = engine.analyseCycle(cycle);

  assert.ok(cycle.qualityFlags.includes('physically_implausible_full_cycle_efficiency'));
  assert.equal(cycle.validFuelCycle, false);
  assert.equal(cycle.validForBenchmark, false);
  assert.equal(analysis.rating, 'Data Warning');
  assert.equal(severityForRating(analysis.rating), 'Data Warning');
  assert.equal(analysis.benchmark, null, 'a data warning gets no benchmark');
  assert.equal(analysis.deviationPct, null, 'a data warning gets no deviation');
  assert.equal(analysis.robustZ, null);
  assert.equal(analysis.likelyDataError, true);
});

test('an invalid cycle is excluded from the benchmark pool it would otherwise join', () => {
  // A fourth prior ALPHA cycle exists, but it is physically implausible.
  const bad = [
    fixtureRow({ reg: 'T2', id: 'b2', date: '2026-01-14', startKm: 2000, endKm: 3000, litres: 10, home: true, dest: 'ALPHA' })
  ];
  const { engine, analysis } = fleetWithTarget(200, { extraRows: bad });
  const badCycle = engine.cycles.find(c => c.closingTripId === 'b2');

  assert.equal(badCycle.validForBenchmark, false);
  assert.equal(analysis.benchmark.sampleSize, 3, 'the invalid cycle must not be pooled');
  assert.equal(analysis.benchmark.totalDistanceKm, 3000, 'its kilometres must not be counted');
  assert.equal(analysis.benchmark.totalLitres, 1500, 'its litres must not be counted');
  assert.equal(analysis.benchmark.averageKmL, 2);
});

test('the daily view keeps data warnings out of the review queue and the average', () => {
  const rows = [
    fixtureRow({ reg: 'T1', id: 'a0', date: '2026-01-01', startKm: 0, endKm: 1000, litres: 100, home: true }),
    fixtureRow({ reg: 'T1', id: 'a1', date: '2026-02-01', startKm: 1000, endKm: 2000, litres: 500, home: true, dest: 'ALPHA' }),
    fixtureRow({ reg: 'T2', id: 'b0', date: '2026-01-01', startKm: 0, endKm: 1000, litres: 100, home: true }),
    // 1000 km on 10 L -> 100 km/L, a capture error on the same operating day.
    fixtureRow({ reg: 'T2', id: 'b1', date: '2026-02-01', startKm: 1000, endKm: 2000, litres: 10, home: true, dest: 'ALPHA' })
  ];
  const engine = fixtureEngine({ rows, assets: [truck('T1'), truck('T2')] });
  const daily = engine.daily('2026-02-01');

  assert.equal(daily.totalTrips, 2);
  assert.equal(daily.counts.dataWarnings, 1);
  assert.equal(daily.dataWarnings.length, 1);
  assert.equal(daily.needsReview.length, 0);

  const warnIds = new Set(daily.dataWarnings.map(x => x.id));
  assert.ok(!daily.needsReview.some(x => warnIds.has(x.id)), 'the buckets must not intersect');

  // The good cycle is 2.00 km/L; the 100 km/L capture error must not move the headline.
  assert.equal(daily.averageKmL, 2);
});

/* ----------------------------------------------------- settings contract -- */

test('the shipped analytics settings match the thresholds the app mirrors', async () => {
  const { getSettings } = await import('../src/repository.js');
  const settings = await getSettings();
  assert.equal(settings.poorDeviationPct, -15);
  assert.equal(settings.reviewDeviationPct, -7.5);
  assert.equal(settings.goodDeviationPct, 4);
  assert.equal(settings.outstandingDeviationPct, 10);
  assert.equal(settings.minFullCycleBenchmarkSamples, 3);
  assert.equal(settings.minModelBenchmarkTrucks, 2);
  assert.equal(settings.modelBenchmarkMonths, 36);
  assert.deepEqual(settings.homeFillLocationPatterns, ['STELLAR']);
});
