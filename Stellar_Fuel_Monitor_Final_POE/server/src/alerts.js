/**
 * Alert projection for the full-cycle analytics.
 *
 * Extracted from index.js so the severity mapping and the alert shape can be unit
 * tested without booting Express, MongoDB and the whole analytics pipeline.
 * The behaviour is unchanged.
 */

/**
 * Alert severity has exactly three levels. There is deliberately no CRITICAL tier:
 * a data-quality exception is never escalated as a performance anomaly, and every
 * non-Poor performance result is an invitation to review the record rather than an
 * accusation.
 */
export function severityForRating(rating) {
  if (rating === 'Poor') return 'High';
  if (rating === 'Data Warning') return 'Data Warning';
  return 'Review';
}

export function alertFromTrip(x) {
  const severity = severityForRating(x.rating);
  const reason = x.rating === 'Data Warning'
    ? (x.correction || 'Full fuel cycle failed source-data validation and is excluded from performance benchmarks')
    : `${x.rating} full-cycle performance: ${Math.abs(x.deviationPct || 0).toFixed(1)}% ${x.deviationPct < 0 ? 'below' : 'above'} ${x.benchmark?.scope || 'the historical full-cycle benchmark'}`;
  return {
    id: `ALERT-${x.id}`,
    tripId: x.id,
    registration: x.registration,
    date: x.date,
    reason,
    severity,
    status: 'Open',
    kmL: x.analysedKmL,
    benchmark: x.benchmark ? `${x.benchmark.averageKmL.toFixed(2)} km/L · ${x.benchmark.scope}` : 'Insufficient clean history',
    driver: x.driverContext || 'Not confirmed',
    trailer: x.weight?.trailerRegistration || 'Trip trailer not confirmed',
    loadContext: x.weight?.applied ? `${Math.round((x.weight.averageGrossKg || 0) / 1000)} t average gross` : 'Exact trailer/payload not confirmed',
    rating: x.rating,
    deviationPct: x.deviationPct,
    confidenceScore: x.confidenceScore,
    destination: x.destination,
    explanations: x.explanations
  };
}
