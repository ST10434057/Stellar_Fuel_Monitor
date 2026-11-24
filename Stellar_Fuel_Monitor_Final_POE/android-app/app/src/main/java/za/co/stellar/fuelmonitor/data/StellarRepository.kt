package za.co.stellar.fuelmonitor.data

import android.util.Log
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import android.util.Base64
import retrofit2.HttpException
import za.co.stellar.fuelmonitor.network.StellarApi
import za.co.stellar.fuelmonitor.offline.OfflineStore
import za.co.stellar.fuelmonitor.offline.PendingAction
import za.co.stellar.fuelmonitor.offline.SyncManager
import java.io.IOException

data class AlertUpdateOutcome(
    val alert: FuelAlert,
    val queuedOffline: Boolean
)

class StellarRepository(
    private val api: StellarApi,
    private val offlineStore: OfflineStore,
    private val syncManager: SyncManager
) {
    private val gson = Gson()

    suspend fun health() = api.health()

    suspend fun dashboard(date: String? = null): DailyAnalytics =
        cached("dashboard:${date ?: "latest"}") { api.dashboardSummary(date) }

    suspend fun vehicles(search: String = "", status: String = ""): List<Vehicle> =
        cached("vehicles:$search:$status") { api.vehicles(search, status) }

    suspend fun vehicleAnalytics(registration: String): VehicleAnalytics =
        cached("vehicle-analytics:${registration.uppercase()}") { api.vehicleAnalytics(registration) }

    suspend fun dayTrips(date: String? = null): DayTripsResponse =
        cached("day-trips:${date ?: "latest"}") { api.dayTrips(date) }

    suspend fun transactions(registration: String = "", date: String = ""): List<FuelTransaction> =
        cached("transactions:${registration.uppercase()}:$date") { api.transactions(registration, date) }

    suspend fun trip(id: String): TripAnalysis = cached("trip:$id") {
        runCatching { api.trip(id) }
            .recoverCatching { api.tripCore(id) }
            .getOrThrow()
    }

    suspend fun alerts(date: String? = null): List<FuelAlert> =
        cached("alerts:${date ?: "latest"}") { api.alerts(date) }

    suspend fun alert(id: String): FuelAlert =
        cached("alert:$id") { api.alert(id) }

    /**
     * Updates an alert online. If the connection is unavailable, the action is persisted in SQLite
     * and WorkManager automatically replays it when the phone reconnects.
     */
    suspend fun updateAlert(current: FuelAlert, status: String, comment: String): AlertUpdateOutcome {
        val request = AlertUpdateRequest(status, comment)
        return try {
            val updated = api.updateAlert(current.id, request)
            offlineStore.cachePut("alert:${current.id}", gson.toJson(updated))
            AlertUpdateOutcome(updated, queuedOffline = false)
        } catch (error: Throwable) {
            if (!isQueueableNetworkFailure(error)) throw error
            offlineStore.enqueue(OfflineStore.ACTION_ALERT_UPDATE, current.id, gson.toJson(request))
            syncManager.scheduleSync()
            val optimistic = current.copy(status = status, comment = comment)
            offlineStore.cachePut("alert:${current.id}", gson.toJson(optimistic))
            Log.i(TAG, "Alert ${current.id} update saved to offline queue")
            AlertUpdateOutcome(optimistic, queuedOffline = true)
        }
    }

    suspend fun reportSummary(date: String? = null): ReportSummary =
        cached("reports:${date ?: "latest"}") { api.reportSummary(date) }

    suspend fun analyticsSettings() = api.analyticsSettings()
    suspend fun fuelEstimate(request: FuelEstimateRequest) = api.fuelEstimate(request)

    suspend fun evidence(registration: String = "", tripId: String = ""): List<EvidenceRecord> =
        cached("evidence:${registration.uppercase()}:$tripId") { api.evidence(registration, tripId) }

    suspend fun uploadEvidence(
        bytes: ByteArray,
        fileName: String,
        contentType: String,
        registration: String,
        tripId: String,
        note: String
    ): EvidenceRecord {
        require(bytes.isNotEmpty()) { "Evidence file is empty" }
        require(bytes.size <= 5 * 1024 * 1024) { "Evidence file must be 5 MB or smaller" }
        require(registration.isNotBlank()) { "Registration is required" }
        val allowedTypes = setOf("image/jpeg", "image/png", "image/webp", "application/pdf")
        require(contentType.lowercase() in allowedTypes) { "Evidence must be JPEG, PNG, WEBP or PDF" }

        val uploaded = api.uploadEvidence(
            EvidenceUploadRequest(
                registration = registration.uppercase(),
                tripId = tripId.trim(),
                note = note.trim(),
                fileName = fileName,
                contentType = contentType,
                base64Data = Base64.encodeToString(bytes, Base64.NO_WRAP)
            )
        )
        // Keep the broad cache usable if connectivity drops immediately after a successful upload.
        updateCachedEvidence("evidence::", uploaded)
        updateCachedEvidence("evidence:${registration.uppercase()}:$tripId", uploaded)
        return uploaded
    }

    private fun updateCachedEvidence(key: String, uploaded: EvidenceRecord) {
        val existing = runCatching {
            val json = offlineStore.cacheGet(key) ?: return@runCatching emptyList<EvidenceRecord>()
            val type = object : TypeToken<List<EvidenceRecord>>() {}.type
            gson.fromJson<List<EvidenceRecord>>(json, type)
        }.getOrDefault(emptyList())
        val updated = listOf(uploaded) + existing.filterNot { it.id == uploaded.id }
        offlineStore.cachePut(key, gson.toJson(updated))
    }

    suspend fun watchlist(): List<WatchlistItem> = cached("watchlist") { api.watchlist() }

    suspend fun saveWatchlist(registration: String, note: String, priority: String): WatchlistItem {
        val saved = api.saveWatchlist(WatchlistRequest(registration.uppercase(), note.trim(), priority))
        // Refreshing on the next load is preferable to guessing the rest of the server-enriched list.
        offlineStore.cachePut("watchlist:last-saved", gson.toJson(saved))
        return saved
    }

    suspend fun deleteWatchlist(registration: String) = api.deleteWatchlist(registration.uppercase())

    fun pendingOfflineActions(): List<PendingAction> = offlineStore.pending()
    fun pendingOfflineCount(): Int = offlineStore.pendingCount()
    fun syncPendingNow() = syncManager.scheduleSync()

    suspend fun <T> safely(label: String, block: suspend () -> T): Result<T> = runCatching {
        Log.d(TAG, "Loading $label")
        block()
    }.onFailure { Log.e(TAG, "Failed $label", it) }

    private inline suspend fun <reified T> cached(key: String, crossinline loader: suspend () -> T): T {
        return try {
            val fresh = loader()
            offlineStore.cachePut(key, gson.toJson(fresh))
            fresh
        } catch (error: Throwable) {
            val cachedJson = offlineStore.cacheGet(key)
            if (cachedJson.isNullOrBlank()) throw error
            Log.w(TAG, "Using cached SQLite response for $key because live API failed", error)
            val type = object : TypeToken<T>() {}.type
            gson.fromJson<T>(cachedJson, type)
        }
    }

    private fun isQueueableNetworkFailure(error: Throwable): Boolean =
        error is IOException || (error is HttpException && error.code() >= 500)

    companion object {
        private const val TAG = "StellarRepository"
    }
}
