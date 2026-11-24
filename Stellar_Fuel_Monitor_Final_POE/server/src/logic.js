export function weightedFuelEfficiency(distanceKm, litres) {
  const km = Number(distanceKm), l = Number(litres);
  return Number.isFinite(km) && Number.isFinite(l) && km > 0 && l > 0 ? km / l : null;
}

export function weightedHistoricalBenchmark(rows = []) {
  const valid = rows.filter(r => Number(r?.kilometers) > 0 && Number(r?.litres) > 0);
  const totalDistanceKm = valid.reduce((s, r) => s + Number(r.kilometers), 0);
  const totalLitres = valid.reduce((s, r) => s + Number(r.litres), 0);
  return { totalDistanceKm, totalLitres, averageKmL: weightedFuelEfficiency(totalDistanceKm, totalLitres), sampleSize: valid.length };
}

export function routeVariance(actualKm, benchmarkKm) {
  const actual = Number(actualKm), benchmark = Number(benchmarkKm);
  if (!(Number.isFinite(actual) && Number.isFinite(benchmark) && benchmark > 0)) return { varianceKm: null, variancePct: null };
  const varianceKm = actual - benchmark;
  return { varianceKm, variancePct: (varianceKm / benchmark) * 100 };
}
