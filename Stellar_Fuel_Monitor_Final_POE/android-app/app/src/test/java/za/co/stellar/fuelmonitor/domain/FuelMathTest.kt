package za.co.stellar.fuelmonitor.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Display-side regression tests.
 *
 * The API remains authoritative for heavy fuel analytics. These tests ensure the
 * small Kotlin helpers stay aligned with the threshold contract used by the API.
 */
class FuelMathTest {

    @Test
    fun calculatesKmPerLitre() {
        assertEquals(2.5, FuelMath.kmPerLitre(500.0, 200.0)!!, 0.0001)
    }

    @Test
    fun rejectsInvalidFuelMathInputs() {
        assertNull(FuelMath.kmPerLitre(0.0, 200.0))
        assertNull(FuelMath.kmPerLitre(-1.0, 200.0))
        assertNull(FuelMath.kmPerLitre(500.0, 0.0))
        assertNull(FuelMath.kmPerLitre(500.0, -1.0))
    }

    @Test
    fun calculatesPositiveNegativeAndZeroDeviation() {
        assertEquals(-20.0, FuelMath.deviationPercent(2.0, 2.5)!!, 0.0001)
        assertEquals(0.0, FuelMath.deviationPercent(2.5, 2.5)!!, 0.0001)
        assertEquals(20.0, FuelMath.deviationPercent(3.0, 2.5)!!, 0.0001)
        assertNull(FuelMath.deviationPercent(2.0, 0.0))
        assertNull(FuelMath.deviationPercent(2.0, -1.0))
    }

    @Test
    fun statusThresholdsMatchTheLatestServerContract() {
        assertEquals(-15.0, FuelMath.POOR_DEVIATION_PCT, 0.0)
        assertEquals(-7.5, FuelMath.REVIEW_DEVIATION_PCT, 0.0)
        assertEquals(4.0, FuelMath.GOOD_DEVIATION_PCT, 0.0)
        assertEquals(10.0, FuelMath.OUTSTANDING_DEVIATION_PCT, 0.0)
    }

    @Test
    fun statusBoundariesAreInclusiveOnTheirOwnSide() {
        assertEquals("Baseline", FuelMath.basicStatus(null))

        assertEquals("Poor", FuelMath.basicStatus(-15.0))
        assertEquals("Review", FuelMath.basicStatus(-14.99))

        assertEquals("Review", FuelMath.basicStatus(-7.5))
        assertEquals("Average", FuelMath.basicStatus(-7.49))

        assertEquals("Average", FuelMath.basicStatus(3.99))
        assertEquals("Good", FuelMath.basicStatus(4.0))

        assertEquals("Good", FuelMath.basicStatus(9.99))
        assertEquals("Outstanding", FuelMath.basicStatus(10.0))
    }

    @Test
    fun mapsSeverityWithoutTurningDataWarningsIntoPerformanceAnomalies() {
        assertEquals("High", FuelMath.severityFor("Poor"))
        assertEquals("Data Warning", FuelMath.severityFor("Data Warning"))
        assertEquals("Review", FuelMath.severityFor("Review"))
        assertEquals("Review", FuelMath.severityFor("Average"))
        assertEquals("Review", FuelMath.severityFor("Good"))
        assertEquals("Review", FuelMath.severityFor("Outstanding"))
        assertEquals("Review", FuelMath.severityFor("Baseline"))
        assertEquals("Review", FuelMath.severityFor(null))
    }

    @Test
    fun nearlyEqualHonoursTolerance() {
        assertTrue(FuelMath.nearlyEqual(2.0, 2.0005))
        assertFalse(FuelMath.nearlyEqual(2.0, 2.01))
        assertTrue(FuelMath.nearlyEqual(2.0, 2.01, tolerance = 0.02))
    }
}
