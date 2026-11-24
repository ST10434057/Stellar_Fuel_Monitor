package za.co.stellar.fuelmonitor.notifications

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import android.provider.Settings
import java.security.MessageDigest
import java.util.UUID

object NotificationSupport {
    const val CHANNEL_ID = "stellar_realtime_alerts"
    const val CHANNEL_NAME = "Stellar real-time alerts"

    fun createChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Real-time fuel anomaly and fleet investigation updates"
                enableVibration(true)
            }
            manager.createNotificationChannel(channel)
        }
    }
}

object DeviceIdentity {
    private const val PREFS = "stellar_device_identity"
    private const val KEY = "installation_id"

    fun id(context: Context): String {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        prefs.getString(KEY, null)?.let { return it }
        val androidId = Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID).orEmpty()
        val seed = if (androidId.isNotBlank()) androidId else UUID.randomUUID().toString()
        val digest = MessageDigest.getInstance("SHA-256").digest(seed.toByteArray())
            .joinToString("") { "%02x".format(it) }
            .take(24)
        prefs.edit().putString(KEY, digest).apply()
        return digest
    }
}
