package za.co.stellar.fuelmonitor.network

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test
import retrofit2.http.GET
import retrofit2.http.DELETE
import retrofit2.http.PATCH
import retrofit2.http.POST

class StellarApiContractTest {
    private fun method(name: String) =
        StellarApi::class.java.declaredMethods.first { it.name == name }

    @Test
    fun healthEndpointMatchesServerContract() {
        val annotation = method("health").getAnnotation(GET::class.java)
        assertNotNull(annotation)
        assertEquals("health", annotation.value)
    }

    @Test
    fun dashboardEndpointMatchesServerContract() {
        val annotation = method("dashboardSummary").getAnnotation(GET::class.java)
        assertEquals("dashboard/summary", annotation.value)
    }

    @Test
    fun tripInvestigationEndpointMatchesServerContract() {
        val annotation = method("trip").getAnnotation(GET::class.java)
        assertEquals("analytics/trips/{id}", annotation.value)
    }

    @Test
    fun alertUpdateUsesPatchContract() {
        val annotation = method("updateAlert").getAnnotation(PATCH::class.java)
        assertEquals("alerts/{id}", annotation.value)
    }

    @Test
    fun fuelEstimateUsesPostContract() {
        val annotation = method("fuelEstimate").getAnnotation(POST::class.java)
        assertEquals("fuel-estimate", annotation.value)
    }

    @Test
    fun finalPoeNotificationContractsMatchServer() {
        assertEquals("notifications/register", method("registerPushToken").getAnnotation(POST::class.java).value)
        assertEquals("notifications/unregister", method("unregisterPushToken").getAnnotation(POST::class.java).value)
        assertEquals("notifications/test", method("testPush").getAnnotation(POST::class.java).value)
    }

    @Test
    fun finalPoeEvidenceVaultContractsMatchServer() {
        assertEquals("evidence", method("evidence").getAnnotation(GET::class.java).value)
        assertEquals("evidence", method("uploadEvidence").getAnnotation(POST::class.java).value)
    }

    @Test
    fun finalPoeWatchlistContractsMatchServer() {
        assertEquals("watchlist", method("watchlist").getAnnotation(GET::class.java).value)
        assertEquals("watchlist", method("saveWatchlist").getAnnotation(POST::class.java).value)
        assertEquals("watchlist/{registration}", method("deleteWatchlist").getAnnotation(DELETE::class.java).value)
    }
}
