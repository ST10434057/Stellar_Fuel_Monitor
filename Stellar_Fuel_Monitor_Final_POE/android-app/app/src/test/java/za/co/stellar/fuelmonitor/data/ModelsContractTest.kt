package za.co.stellar.fuelmonitor.data

import com.google.gson.Gson
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ModelsContractTest {
    private val gson = Gson()

    @Test
    fun parsesHealthPayloadUsedByAdministrationScreen() {
        val payload = """
            {
              "ok": true,
              "featureVersion": "task2-routes-security-ci-v23",
              "mongoConnected": true,
              "databaseName": "stellar_fuel_monitoring",
              "fleet": {
                "activeTrucks": 161,
                "historicalTrips": 12054,
                "latestCompleteDate": "2026-09-15"
              }
            }
        """.trimIndent()

        val health = gson.fromJson(payload, ApiHealth::class.java)

        assertTrue(health.ok)
        assertTrue(health.mongoConnected)
        assertEquals("stellar_fuel_monitoring", health.databaseName)
        assertEquals(161, health.fleet?.activeTrucks)
        assertEquals(12054, health.fleet?.historicalTrips)
        assertEquals("2026-09-15", health.fleet?.latestCompleteDate)
    }

    @Test
    fun parsesTripBenchmarkAndDataQualityEvidence() {
        val payload = """
            {
              "id": "cycle_123",
              "registration": "CA 987-654",
              "date": "2026-09-15",
              "analysedKmL": 1.82,
              "deviationPct": -22.2,
              "rating": "Poor",
              "likelyDataError": false,
              "qualityFlags": ["route-context-confirmed"],
              "benchmark": {
                "averageKmL": 2.34,
                "medianKmL": 2.35,
                "sampleSize": 12,
                "scope": "same-vehicle-destination",
                "confidence": "high"
              }
            }
        """.trimIndent()

        val trip = gson.fromJson(payload, TripAnalysis::class.java)

        assertEquals("cycle_123", trip.id)
        assertEquals(1.82, trip.analysedKmL!!, 0.0001)
        assertEquals(-22.2, trip.deviationPct!!, 0.0001)
        assertFalse(trip.likelyDataError ?: true)
        assertEquals(12, trip.benchmark?.sampleSize)
        assertEquals("same-vehicle-destination", trip.benchmark?.scope)
        assertEquals("high", trip.benchmark?.confidence)
    }

    @Test
    fun serialisesAlertUpdateAsTheExpressApiExpects() {
        val json = gson.toJson(
            AlertUpdateRequest(
                status = "Resolved",
                comment = "Checked against route history"
            )
        )

        assertTrue(json.contains("\"status\":\"Resolved\""))
        assertTrue(json.contains("\"comment\":\"Checked against route history\""))
    }

    @Test
    fun fuelEstimateRequestRetainsAllAssessmentInputs() {
        val request = FuelEstimateRequest(
            truckWeight = 8.5,
            trailerWeight = 6.2,
            cargoWeight = 28.0,
            returnCargoWeight = 0.0,
            loadedDistancePct = 50.0,
            distanceKm = 500.0,
            baselineRate = 38.0
        )

        assertEquals(500.0, request.distanceKm, 0.0001)
        assertEquals(38.0, request.baselineRate, 0.0001)
        assertEquals(0.6, request.weightPenalty, 0.0001)
    }
}
