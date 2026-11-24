package za.co.stellar.fuelmonitor.offline

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.ListenableWorker.Result
import androidx.work.WorkerParameters
import com.google.gson.Gson
import retrofit2.HttpException
import za.co.stellar.fuelmonitor.data.AlertUpdateRequest
import za.co.stellar.fuelmonitor.network.ApiClient
import java.io.IOException

class OfflineSyncWorker(
    appContext: Context,
    params: WorkerParameters
) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result {
        val store = OfflineStore(applicationContext)
        val api = ApiClient().api
        val gson = Gson()
        val actions = store.pending()
        if (actions.isEmpty()) return Result.success()

        Log.i(TAG, "Syncing ${actions.size} pending offline action(s)")
        for (action in actions) {
            try {
                when (action.type) {
                    OfflineStore.ACTION_ALERT_UPDATE -> {
                        val payload = gson.fromJson(action.payloadJson, AlertUpdateRequest::class.java)
                        api.updateAlert(action.targetId, payload)
                    }
                    else -> {
                        Log.w(TAG, "Dropping unknown offline action type=${action.type}")
                    }
                }
                store.delete(action.id)
                Log.i(TAG, "Synced offline action id=${action.id}")
            } catch (error: Throwable) {
                store.markFailed(action.id, error.message ?: error.javaClass.simpleName)
                val retryable = error is IOException || (error is HttpException && error.code() >= 500)
                Log.w(TAG, "Offline action id=${action.id} failed; retryable=$retryable", error)
                if (retryable) return Result.retry()
                // A permanent 4xx error should not block newer queued work forever.
                store.delete(action.id)
            }
        }
        return Result.success()
    }

    companion object {
        private const val TAG = "StellarOfflineSync"
    }
}
