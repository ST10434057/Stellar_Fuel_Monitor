import test from 'node:test'; import assert from 'node:assert/strict';
import { weightedFuelEfficiency, weightedHistoricalBenchmark, routeVariance } from '../src/logic.js';
test('full-cycle weighted fuel uses total km / total litres',()=>assert.equal(weightedFuelEfficiency(1000,500),2));
test('short poor segment is weighted by physical distance/fuel, not equally averaged',()=>{ const b=weightedHistoricalBenchmark([{kilometers:100,litres:125},{kilometers:900,litres:375}]); assert.equal(b.averageKmL,2); assert.notEqual(b.averageKmL,(0.8+2.4)/2); });
test('model+route benchmark aggregates valid matching cycle totals',()=>{ const b=weightedHistoricalBenchmark([{kilometers:800,litres:400},{kilometers:1200,litres:500}]); assert.equal(b.sampleSize,2); assert.ok(Math.abs(b.averageKmL-2000/900)<1e-12); });
test('route variance calculates km and percentage',()=>assert.deepEqual(routeVariance(1100,1000),{varianceKm:100,variancePct:10}));
