package za.co.stellar.fuelmonitor.data

data class ApiHealth(
    val ok: Boolean = false,
    val featureVersion: String? = null,
    val source: String? = null,
    val mongoConnected: Boolean = false,
    val databaseName: String? = null,
    val lastLoadedAt: String? = null,
    val fleet: FleetSummary? = null,
    val dataset: DatasetSummary? = null,
    val finalPoe: FinalPoeStatus? = null
)


data class FinalPoeServiceStatus(
    val configured: Boolean = false,
    val provider: String? = null,
    val container: String? = null,
    val projectId: String? = null,
    val error: String? = null
)

data class FinalPoeStatus(
    val blobStorage: FinalPoeServiceStatus? = null,
    val pushNotifications: FinalPoeServiceStatus? = null,
    val offlineSync: String? = null,
    val languages: List<String> = emptyList()
)

data class FleetSummary(
    val activeTrucks: Int = 0,
    val historicalTrips: Int = 0,
    val latestCompleteDate: String? = null
)

data class DatasetSummary(
    val datasetName: String? = null,
    val datasetDate: String? = null,
    val assets: Int? = null,
    val trips: Int? = null,
    val fuelCoveragePct2026: Double? = null
)

data class Vehicle(
    val registration: String = "",
    val description: String? = null,
    val type: String? = null,
    val manufacturer: String? = null,
    val model: String? = null,
    val status: String? = null,
    val vehicleGroup: String? = null,
    val peerType: String? = null,
    val vin: String? = null,
    val odometerKm: Double? = null,
    val currentKmL: Double? = null,
    val currentRating: String? = null,
    val lastTripDate: String? = null,
    val historicalMedianKmL: Double? = null,
    val benchmarkLow: Double? = null,
    val benchmarkHigh: Double? = null,
    val openAlerts: Int = 0,
    val isTrailer: Boolean? = null,
    val axleConfiguration: String? = null,
    val estimatedTareKg: Double? = null,
    val tareEstimateSource: String? = null,
    val tareEstimateConfidence: String? = null
)

data class FuelTransaction(
    val id: String = "",
    val registration: String = "",
    val date: String = "",
    val litres: Double = 0.0,
    val distanceKm: Double? = null,
    val kmL: Double? = null,
    val location: String? = null,
    val cost: Double = 0.0,
    val source: String? = null,
    val fillUpLocation: String? = null,
    val destination: String? = null,
    val startKm: Double? = null,
    val endKm: Double? = null,
    val rating: String? = null,
    val expectedLitres: Double? = null,
    val excessLitres: Double? = null,
    val expectedDistanceKm: Double? = null,
    val extraKm: Double? = null
)

data class FuelAlert(
    val id: String = "",
    val tripId: String? = null,
    val registration: String = "",
    val date: String = "",
    val reason: String = "",
    val severity: String = "Review",
    val status: String = "Open",
    val kmL: Double? = null,
    val benchmark: String? = null,
    val driver: String? = null,
    val trailer: String? = null,
    val loadContext: String? = null,
    val comment: String? = null,
    val rating: String? = null,
    val deviationPct: Double? = null,
    val confidenceScore: Double? = null,
    val destination: String? = null,
    val explanations: List<String>? = null
)

data class TripBenchmark(
    val averageKmL: Double? = null,
    val medianKmL: Double? = null,
    val lowKmL: Double? = null,
    val highKmL: Double? = null,
    val sampleSize: Int = 0,
    val excludedOutliers: Int = 0,
    val method: String? = null,
    val scope: String? = null,
    val confidence: String? = null,
    val averageDistanceKm: Double? = null,
    val averageLitres: Double? = null,
    val weightedAverageKmL: Double? = null,
    val arithmeticAverageKmL: Double? = null,
    val distinctTruckCount: Int? = null,
    val modelLabel: String? = null
)

data class TripWeightContext(
    val applied: Boolean? = null,
    val trailerRegistration: String? = null,
    val productName: String? = null,
    val truckTareKg: Double? = null,
    val trailerTareKg: Double? = null,
    val outboundProductKg: Double? = null,
    val returnProductKg: Double? = null,
    val averageGrossKg: Double? = null,
    val loadAdjustedExpectedKmL: Double? = null,
    val confirmed: Boolean? = null,
    val evidenceSource: String? = null,
    val notes: String? = null
)

data class DistanceBenchmark(
    val expectedDistanceKm: Double? = null,
    val actualDistanceKm: Double? = null,
    val extraKm: Double? = null,
    val distanceVariancePct: Double? = null,
    val sampleSize: Int = 0,
    val scope: String? = null,
    val confidence: String? = null,
    val status: String? = null,
    val routeLabel: String? = null
)

data class GoogleRoadBenchmark(
    val available: Boolean = false,
    val status: String? = null,
    val provider: String? = null,
    val origin: String? = null,
    val destination: String? = null,
    val oneWayKm: Double? = null,
    val benchmarkKm: Double? = null,
    val actualDistanceKm: Double? = null,
    val varianceKm: Double? = null,
    val variancePct: Double? = null,
    val disclaimer: String? = null
)

data class RecentFuelHistoryRow(
    val id: String = "",
    val current: Boolean? = null,
    val date: String = "",
    val registration: String = "",
    val driver: String? = null,
    val fillUpLocation: String? = null,
    val destination: String? = null,
    val loadLocation: String? = null,
    val startKm: Double? = null,
    val endKm: Double? = null,
    val kilometers: Double? = null,
    val litres: Double? = null,
    val consumptionKmL: Double? = null,
    val expectedDistanceKm: Double? = null,
    val extraKm: Double? = null,
    val distanceVariancePct: Double? = null,
    val distanceStatus: String? = null,
    val contributesToCycle: Boolean? = null,
    val countedFuel: Boolean? = null,
    val contributionRole: String? = null
)

data class RecentFuelHistorySummary(
    val recordCount: Int = 0,
    val highlightedRecordCount: Int? = null,
    val countedFuelEventCount: Int? = null,
    val dieselTotalLitres: Double? = null,
    val kmTotal: Double? = null,
    val vehicleConsumptionKmL: Double? = null,
    val positiveExtraKm: Double? = null,
    val openingOdometer: Double? = null,
    val closingOdometer: Double? = null
)

data class RecentFuelHistory(
    val rows: List<RecentFuelHistoryRow> = emptyList(),
    val summary: RecentFuelHistorySummary = RecentFuelHistorySummary()
)

data class TripAnalysis(
    val id: String = "",
    val consumptionId: String? = null,
    val registration: String = "",
    val modelLabel: String? = null,
    val date: String = "",
    val cycleMode: Boolean? = null,
    val isFullTripCycle: Boolean? = null,
    val openingDate: String? = null,
    val closingDate: String? = null,
    val routeLabel: String? = null,
    val destinationStops: List<String>? = null,
    val destination: String? = null,
    val destinationSource: String? = null,
    val destinationConfidence: String? = null,
    val fillUpLocation: String? = null,
    val customerName: String? = null,
    val driverContext: String? = null,
    val kilometers: Double? = null,
    val startKm: Double? = null,
    val endKm: Double? = null,
    val litres: Double? = null,
    val distanceBenchmark: DistanceBenchmark? = null,
    val expectedDistanceKm: Double? = null,
    val extraKm: Double? = null,
    val distanceVariancePct: Double? = null,
    val distanceStatus: String? = null,
    val googleRoadBenchmark: GoogleRoadBenchmark? = null,
    val reportedKmL: Double? = null,
    val calculatedKmL: Double? = null,
    val weightedTripKmL: Double? = null,
    val analysedKmL: Double? = null,
    val rawAnalysedKmL: Double? = null,
    val corrected: Boolean? = null,
    val correction: String? = null,
    val likelyDataError: Boolean? = null,
    val qualityFlags: List<String> = emptyList(),
    val benchmark: TripBenchmark? = null,
    val modelBenchmark: TripBenchmark? = null,
    val truckBenchmark: TripBenchmark? = null,
    val benchmarkSelection: String? = null,
    val deviationPct: Double? = null,
    val robustZ: Double? = null,
    val performanceIndex: Double? = null,
    val expectedLitres: Double? = null,
    val excessLitres: Double? = null,
    val fuelVariancePct: Double? = null,
    val rating: String? = null,
    val confidenceScore: Double? = null,
    val hasFuelEvidence: Boolean? = null,
    val weight: TripWeightContext? = null,
    val explanations: List<String> = emptyList(),
    val recentFuelHistory: RecentFuelHistory? = null,
    val asset: Vehicle? = null
)

data class DailyCounts(
    val poor: Int = 0,
    val review: Int = 0,
    val average: Int = 0,
    val good: Int = 0,
    val outstanding: Int = 0,
    val baseline: Int = 0,
    val dataWarnings: Int = 0
)

data class DateNavigation(
    val selectedDate: String? = null,
    val previousDate: String? = null,
    val nextDate: String? = null,
    val minDate: String? = null,
    val maxDate: String? = null,
    val latestCompleteDate: String? = null,
    val hasData: Boolean = true
)

data class DailyAnalytics(
    val date: String = "",
    val totalTrips: Int = 0,
    val averageKmL: Double? = null,
    val counts: DailyCounts = DailyCounts(),
    val needsReview: List<TripAnalysis> = emptyList(),
    val outstanding: List<TripAnalysis> = emptyList(),
    val dataWarnings: List<TripAnalysis> = emptyList(),
    val trips: List<TripAnalysis> = emptyList(),
    val fleet: FleetSummary? = null,
    val source: ApiHealth? = null,
    val navigation: DateNavigation? = null
)

data class VehicleDestination(
    val destination: String = "",
    val count: Int = 0
)

data class VehicleAnalytics(
    val vehicle: Vehicle = Vehicle(),
    val destinations: List<VehicleDestination> = emptyList(),
    val trips: List<TripAnalysis> = emptyList()
)

data class DayTripsResponse(
    val date: String = "",
    val items: List<TripAnalysis> = emptyList()
)

data class AnalyticsDatesResponse(
    val dates: List<String> = emptyList(),
    val latestCompleteDate: String? = null
)

data class AlertUpdateRequest(
    val status: String,
    val comment: String = ""
)

data class ReportSummary(
    val vehicles: Int = 0,
    val transactions: Int = 0,
    val activeAlerts: Int = 0,
    val highAlerts: Int = 0,
    val outstanding: Int = 0,
    val date: String? = null
)

data class AnalyticsSettings(
    val poorDeviationPct: Double? = null,
    val reviewDeviationPct: Double? = null,
    val goodDeviationPct: Double? = null,
    val outstandingDeviationPct: Double? = null,
    val minSameVehicleDestinationSamples: Int? = null,
    val minFullCycleBenchmarkSamples: Int? = null,
    val homeFillLocationPatterns: List<String>? = null,
    val minPeerDestinationSamples: Int? = null,
    val outlierMadThreshold: Double? = null,
    val weightNormalizationEnabled: Boolean? = null,
    val weightSensitivity: Double? = null,
    val defaultReferenceGrossKg: Double? = null
)

data class FuelEstimateRequest(
    val truckWeight: Double,
    val trailerWeight: Double,
    val cargoWeight: Double,
    val returnCargoWeight: Double = 0.0,
    val loadedDistancePct: Double = 50.0,
    val distanceKm: Double,
    val baselineRate: Double,
    val weightPenalty: Double = 0.6
)

data class FuelEstimateResponse(
    val averageGrossTonnes: Double? = null,
    val averageCargoWeight: Double? = null,
    val adjustedRateLper100km: Double? = null,
    val fuelLitres: Double? = null,
    val note: String? = null
)

// ----- Final POE advanced feature models -----
data class PushTokenRegistration(
    val token: String,
    val deviceId: String,
    val platform: String = "android",
    val userId: String? = null,
    val email: String? = null
)

data class PushTestRequest(
    val deviceId: String? = null
)

data class ApiMessage(
    val ok: Boolean = false,
    val message: String? = null,
    val sent: Int? = null,
    val failed: Int? = null
)


data class EvidenceUploadRequest(
    val registration: String,
    val tripId: String = "",
    val note: String = "",
    val fileName: String,
    val contentType: String,
    val base64Data: String
)

data class EvidenceRecord(
    val id: String = "",
    val registration: String = "",
    val tripId: String? = null,
    val note: String? = null,
    val fileName: String = "",
    val contentType: String? = null,
    val sizeBytes: Long = 0,
    val blobUrl: String? = null,
    val storageProvider: String? = null,
    val uploadedAt: String? = null
)

data class WatchlistItem(
    val registration: String = "",
    val note: String? = null,
    val priority: String = "Monitor",
    val createdAt: String? = null,
    val updatedAt: String? = null,
    val currentKmL: Double? = null,
    val currentRating: String? = null,
    val openAlerts: Int = 0,
    val description: String? = null
)

data class WatchlistRequest(
    val registration: String,
    val note: String = "",
    val priority: String = "Monitor"
)
