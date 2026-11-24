package za.co.stellar.fuelmonitor.notifications

import android.Manifest
import android.app.PendingIntent
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import za.co.stellar.fuelmonitor.MainActivity
import za.co.stellar.fuelmonitor.R
import za.co.stellar.fuelmonitor.data.PushTokenRegistration
import za.co.stellar.fuelmonitor.network.ApiClient

/** Receives Firebase Cloud Messaging data/notification payloads in real time. */
class StellarMessagingService : FirebaseMessagingService() {
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.i(TAG, "FCM issued a new device token")
        serviceScope.launch {
            runCatching {
                ApiClient().api.registerPushToken(
                    PushTokenRegistration(
                        token = token,
                        deviceId = DeviceIdentity.id(applicationContext),
                        platform = "android"
                    )
                )
            }.onFailure { Log.e(TAG, "Could not send new FCM token to API", it) }
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        NotificationSupport.createChannel(this)
        val title = message.notification?.title ?: message.data["title"] ?: "Stellar Fuel Alert"
        val body = message.notification?.body ?: message.data["body"] ?: "A fleet record needs attention."

        val openIntent = Intent(this, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            putExtra("notification_alert_id", message.data["alertId"])
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            1001,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, NotificationSupport.CHANNEL_ID)
            .setSmallIcon(R.drawable.stellar_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        val canNotify = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ActivityCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
        if (canNotify) {
            NotificationManagerCompat.from(this).notify((System.currentTimeMillis() % Int.MAX_VALUE).toInt(), notification)
        } else {
            Log.w(TAG, "Notification permission is not granted")
        }
    }

    companion object {
        private const val TAG = "StellarMessaging"
    }
}
