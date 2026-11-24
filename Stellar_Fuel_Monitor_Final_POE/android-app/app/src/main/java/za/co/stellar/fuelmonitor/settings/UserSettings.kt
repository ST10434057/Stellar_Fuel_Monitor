package za.co.stellar.fuelmonitor.settings

data class UserSettings(
    val defaultPeriod: String = "Latest",
    val notificationsEnabled: Boolean = true,
    val compactCards: Boolean = false,
    val showDataWarnings: Boolean = true,
    val preferredLanguage: String = "English",
    val biometricEnabled: Boolean = true
)
