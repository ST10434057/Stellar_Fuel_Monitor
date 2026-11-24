package za.co.stellar.fuelmonitor.domain

import kotlin.math.abs

/**
 * Display-side helpers only.
 *
 * The full-cycle analytics live on the API (`server/src/cycle-analytics.js`) and the
 * server is authoritative for every rating shown in the app. These functions exist so
 * the UI can label a locally derived figure with the same vocabulary the API uses -
 * they deliberately do not reimplement benchmarking, load adjustment or data-quality
 * validation.
 *
 * The thresholds below mirror the analytics settings served by
 * `getSettings()` in `server/src/repository.js` (`poorDeviationPct`,
 * `reviewDeviationPct`, `goodDeviationPct`, `outstandingDeviationPct`). If those are
 * changed server-side, change them here too, or the app will label a value differently
 * from the API that produced it.
 */
object FuelMath {
    const val POOR_DEVIATION_PCT = -15.0
    const val REVIEW_DEVIATION_PCT = -7.5
    const val GOOD_DEVIATION_PCT = 4.0
    const val OUTSTANDING_DEVIATION_PCT = 10.0

    fun kmPerLitre(distanceKm: Double, litres: Double): Double? {
        if (distanceKm <= 0.0 || litres <= 0.0) return null
        return distanceKm / litres
    }

    fun deviationPercent(current: Double, baseline: Double): Double? {
        if (baseline <= 0.0) return null
        return ((current - baseline) / baseline) * 100.0
    }

    fun basicStatus(deviationPct: Double?): String = when {
        deviationPct == null -> "Baseline"
        deviationPct <= POOR_DEVIATION_PCT -> "Poor"
        deviationPct <= REVIEW_DEVIATION_PCT -> "Review"
        deviationPct >= OUTSTANDING_DEVIATION_PCT -> "Outstanding"
        deviationPct >= GOOD_DEVIATION_PCT -> "Good"
        else -> "Average"
    }

    /**
     * Alert severity has exactly three levels, matching `severityForRating` in
     * `server/src/alerts.js`. A data-quality exception is never escalated as a
     * performance anomaly.
     */
    fun severityFor(rating: String?): String = when (rating) {
        "Poor" -> "High"
        "Data Warning" -> "Data Warning"
        else -> "Review"
    }

    fun nearlyEqual(a: Double, b: Double, tolerance: Double = 0.001): Boolean = abs(a - b) <= tolerance
}
