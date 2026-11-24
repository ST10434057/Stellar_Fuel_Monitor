package za.co.stellar.fuelmonitor.notifications

import android.content.Context
import android.util.Log
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.tasks.await
import za.co.stellar.fuelmonitor.data.PushTestRequest
import za.co.stellar.fuelmonitor.data.PushTokenRegistration
import za.co.stellar.fuelmonitor.network.StellarApi

class PushRegistrationManager(
    private val context: Context,
    private val api: StellarApi
) {
    suspend fun register(userId: String?, email: String?): Result<String> = runCatching {
        val token = FirebaseMessaging.getInstance().token.await()
        api.registerPushToken(
            PushTokenRegistration(
                token = token,
                deviceId = DeviceIdentity.id(context),
                platform = "android",
                userId = userId,
                email = email
            )
        )
        Log.i(TAG, "FCM token registered with Stellar API")
        token
    }.onFailure { Log.e(TAG, "FCM token registration failed", it) }

    suspend fun unregister(): Result<Unit> = runCatching {
        val token = FirebaseMessaging.getInstance().token.await()
        api.unregisterPushToken(PushTokenRegistration(token = token, deviceId = DeviceIdentity.id(context)))
        Unit
    }.onFailure { Log.e(TAG, "FCM token unregister failed", it) }

    suspend fun sendTestNotification(): Result<String> = runCatching {
        val response = api.testPush(PushTestRequest(deviceId = DeviceIdentity.id(context)))
        response.message ?: "Test notification requested"
    }

    companion object {
        private const val TAG = "StellarPush"
    }
}
