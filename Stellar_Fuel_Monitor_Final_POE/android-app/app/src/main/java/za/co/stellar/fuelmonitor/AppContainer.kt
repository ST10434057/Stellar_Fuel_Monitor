package za.co.stellar.fuelmonitor

import android.content.Context
import za.co.stellar.fuelmonitor.auth.AuthManager
import za.co.stellar.fuelmonitor.biometric.BiometricAuthenticator
import za.co.stellar.fuelmonitor.connectivity.ConnectivityObserver
import za.co.stellar.fuelmonitor.data.StellarRepository
import za.co.stellar.fuelmonitor.network.ApiClient
import za.co.stellar.fuelmonitor.notifications.PushRegistrationManager
import za.co.stellar.fuelmonitor.offline.OfflineStore
import za.co.stellar.fuelmonitor.offline.SyncManager
import za.co.stellar.fuelmonitor.settings.SettingsRepository

class AppContainer(context: Context) {
    private val appContext = context.applicationContext

    val authManager = AuthManager(appContext)
    val biometricAuthenticator = BiometricAuthenticator()
    val settingsRepository = SettingsRepository(appContext)
    val offlineStore = OfflineStore(appContext)
    val syncManager = SyncManager(appContext)
    val connectivityObserver = ConnectivityObserver(appContext)

    private val apiClient = ApiClient(tokenProvider = { null })
    val repository = StellarRepository(apiClient.api, offlineStore, syncManager)
    val pushManager = PushRegistrationManager(appContext, apiClient.api)
}
