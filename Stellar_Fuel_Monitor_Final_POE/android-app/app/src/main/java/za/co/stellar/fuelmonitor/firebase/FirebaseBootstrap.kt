package za.co.stellar.fuelmonitor.firebase

import android.content.Context
import android.util.Log
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import za.co.stellar.fuelmonitor.BuildConfig

/**
 * Creates the default Firebase application from local.properties values.
 * Using the default app allows Firebase Authentication and Firebase Cloud Messaging
 * to share one correctly configured Firebase project without committing google-services.json.
 */
object FirebaseBootstrap {
    private const val TAG = "StellarFirebase"

    fun initialise(context: Context): FirebaseApp? {
        FirebaseApp.getApps(context).firstOrNull { it.name == FirebaseApp.DEFAULT_APP_NAME }?.let { return it }
        if (!isConfigured()) {
            Log.w(TAG, "Firebase is not configured. Add the Final POE Firebase values to android-app/local.properties.")
            return null
        }
        return runCatching {
            val builder = FirebaseOptions.Builder()
                .setApiKey(BuildConfig.FIREBASE_API_KEY)
                .setApplicationId(BuildConfig.FIREBASE_APP_ID)
                .setProjectId(BuildConfig.FIREBASE_PROJECT_ID)
            if (BuildConfig.FIREBASE_MESSAGING_SENDER_ID.isNotBlank()) {
                builder.setGcmSenderId(BuildConfig.FIREBASE_MESSAGING_SENDER_ID)
            }
            FirebaseApp.initializeApp(context, builder.build())
        }.onSuccess {
            Log.i(TAG, "Firebase default app initialised for ${BuildConfig.FIREBASE_PROJECT_ID}")
        }.onFailure {
            Log.e(TAG, "Firebase initialisation failed", it)
        }.getOrNull()
    }

    fun isConfigured(): Boolean =
        BuildConfig.FIREBASE_API_KEY.isNotBlank() &&
            BuildConfig.FIREBASE_APP_ID.isNotBlank() &&
            BuildConfig.FIREBASE_PROJECT_ID.isNotBlank()
}
