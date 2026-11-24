package za.co.stellar.fuelmonitor.localization

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

class AppLocalizationTest {
    @Test
    fun `Afrikaans translates core navigation`() {
        assertEquals("Tuis", translate("Home", AppLanguage.AFRIKAANS))
        assertEquals("Voertuie", translate("Vehicles", AppLanguage.AFRIKAANS))
        assertEquals("Instellings", translate("Settings", AppLanguage.AFRIKAANS))
    }

    @Test
    fun `isiZulu translates core navigation`() {
        assertEquals("Ikhaya", translate("Home", AppLanguage.ISIZULU))
        assertEquals("Izimoto", translate("Vehicles", AppLanguage.ISIZULU))
        assertEquals("Izilungiselelo", translate("Settings", AppLanguage.ISIZULU))
    }

    @Test
    fun `unknown business data is preserved instead of corrupted`() {
        val registration = "ABC123GP"
        assertEquals(registration, translate(registration, AppLanguage.AFRIKAANS))
        assertNotEquals("Home", translate("Home", AppLanguage.ISIZULU))
    }

    @Test
    fun `final POE feature labels are translated in both local languages`() {
        val labels = listOf(
            "Evidence vault",
            "Fleet watchlist",
            "Offline sync",
            "Biometric security",
            "Send real-time test notification",
            "Uploaded evidence"
        )
        labels.forEach { label ->
            assertNotEquals(label, translate(label, AppLanguage.AFRIKAANS))
            assertNotEquals(label, translate(label, AppLanguage.ISIZULU))
        }
    }
}
