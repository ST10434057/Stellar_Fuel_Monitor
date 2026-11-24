import test from 'node:test';
import assert from 'node:assert/strict';
import {
  weightedFuelEfficiency,
  weightedHistoricalBenchmark,
  routeVariance
} from '../src/logic.js';

test('weightedFuelEfficiency rejects invalid values', () => {
  assert.equal(weightedFuelEfficiency(0, 100), null);
  assert.equal(weightedFuelEfficiency(100, 0), null);
  assert.equal(weightedFuelEfficiency(-100, 50), null);
  assert.equal(weightedFuelEfficiency('bad', 50), null);
});

test('weightedHistoricalBenchmark excludes invalid cycles', () => {
  const result = weightedHistoricalBenchmark([
    { kilometers: 1000, litres: 500 },
    { kilometers: 0, litres: 100 },
    { kilometers: 400, litres: 0 },
    { kilometers: 500, litres: 250 }
  ]);

  assert.equal(result.sampleSize, 2);
  assert.equal(result.totalDistanceKm, 1500);
  assert.equal(result.totalLitres, 750);
  assert.equal(result.averageKmL, 2);
});

test('weightedHistoricalBenchmark handles no valid cycles', () => {
  const result = weightedHistoricalBenchmark([]);
  assert.equal(result.sampleSize, 0);
  assert.equal(result.totalDistanceKm, 0);
  assert.equal(result.totalLitres, 0);
  assert.equal(result.averageKmL, null);
});

test('routeVariance supports a route shorter than the benchmark', () => {
  const result = routeVariance(900, 1000);
  assert.equal(result.varianceKm, -100);
  assert.equal(result.variancePct, -10);
});

test('routeVariance rejects invalid benchmarks', () => {
  assert.deepEqual(
    routeVariance(1000, 0),
    { varianceKm: null, variancePct: null }
  );
  assert.deepEqual(
    routeVariance('bad', 1000),
    { varianceKm: null, variancePct: null }
  );
});
