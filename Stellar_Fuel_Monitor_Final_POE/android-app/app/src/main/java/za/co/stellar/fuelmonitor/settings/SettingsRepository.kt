package za.co.stellar.fuelmonitor.settings

import android.content.Context
import android.util.Log
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.settingsDataStore by preferencesDataStore(name = "stellar_user_settings")

/** Persistent user settings used by the final native Android application. */
class SettingsRepository(private val context: Context) {
    private object Keys {
        val DEFAULT_PERIOD = stringPreferencesKey("default_period")
        val NOTIFICATIONS = booleanPreferencesKey("notifications_enabled")
        val COMPACT_CARDS = booleanPreferencesKey("compact_cards")
        val SHOW_DATA_WARNINGS = booleanPreferencesKey("show_data_warnings")
        val LANGUAGE = stringPreferencesKey("preferred_language")
        val BIOMETRIC = booleanPreferencesKey("biometric_enabled")
    }

    val settings: Flow<UserSettings> = context.settingsDataStore.data.map { prefs ->
        UserSettings(
            defaultPeriod = prefs[Keys.DEFAULT_PERIOD] ?: "Latest",
            notificationsEnabled = prefs[Keys.NOTIFICATIONS] ?: true,
            compactCards = prefs[Keys.COMPACT_CARDS] ?: false,
            showDataWarnings = prefs[Keys.SHOW_DATA_WARNINGS] ?: true,
            preferredLanguage = prefs[Keys.LANGUAGE] ?: "English",
            biometricEnabled = prefs[Keys.BIOMETRIC] ?: true
        )
    }

    suspend fun setDefaultPeriod(value: String) = update("default period") { it[Keys.DEFAULT_PERIOD] = value }
    suspend fun setNotificationsEnabled(value: Boolean) = update("notifications") { it[Keys.NOTIFICATIONS] = value }
    suspend fun setCompactCards(value: Boolean) = update("compact cards") { it[Keys.COMPACT_CARDS] = value }
    suspend fun setShowDataWarnings(value: Boolean) = update("data warnings") { it[Keys.SHOW_DATA_WARNINGS] = value }
    suspend fun setPreferredLanguage(value: String) = update("language") { it[Keys.LANGUAGE] = value }
    suspend fun setBiometricEnabled(value: Boolean) = update("biometric") { it[Keys.BIOMETRIC] = value }

    private suspend inline fun update(label: String, crossinline block: (androidx.datastore.preferences.core.MutablePreferences) -> Unit) {
        context.settingsDataStore.edit { prefs -> block(prefs) }
        Log.i("StellarSettings", "Saved $label setting")
    }
}
