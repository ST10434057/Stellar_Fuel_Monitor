package za.co.stellar.fuelmonitor.settings

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class UserSettingsTest {
    @Test
    fun `final POE secure defaults are sensible`() {
        val settings = UserSettings()
        assertEquals("Latest", settings.defaultPeriod)
        assertEquals("English", settings.preferredLanguage)
        assertTrue(settings.notificationsEnabled)
        assertTrue(settings.biometricEnabled)
    }
}
