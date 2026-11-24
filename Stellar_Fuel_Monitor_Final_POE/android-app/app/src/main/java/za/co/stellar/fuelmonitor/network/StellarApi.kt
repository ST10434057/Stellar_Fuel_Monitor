package za.co.stellar.fuelmonitor.network

import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query
import za.co.stellar.fuelmonitor.data.*

interface StellarApi {
    @GET("health") suspend fun health(): ApiHealth
    @GET("vehicles") suspend fun vehicles(@Query("search") search: String = "", @Query("status") status: String = ""): List<Vehicle>
    @GET("vehicles/{reg}") suspend fun vehicle(@Path("reg") registration: String): Vehicle
    @GET("vehicles/{reg}/transactions") suspend fun vehicleTransactions(@Path("reg") registration: String, @Query("limit") limit: Int = 100): List<FuelTransaction>
    @GET("transactions") suspend fun transactions(@Query("registration") registration: String = "", @Query("date") date: String = "", @Query("limit") limit: Int = 500): List<FuelTransaction>

    @GET("dashboard/summary") suspend fun dashboardSummary(@Query("date") date: String? = null): DailyAnalytics
    @GET("analytics/dates") suspend fun analyticsDates(): AnalyticsDatesResponse
    @GET("analytics/day-trips") suspend fun dayTrips(@Query("date") date: String? = null): DayTripsResponse
    @GET("analytics/trips/{id}") suspend fun trip(@Path("id") id: String): TripAnalysis
    @GET("analytics/trips/{id}/core") suspend fun tripCore(@Path("id") id: String): TripAnalysis
    @GET("analytics/vehicles/{reg}") suspend fun vehicleAnalytics(@Path("reg") registration: String, @Query("limit") limit: Int = 100): VehicleAnalytics

    @GET("alerts") suspend fun alerts(@Query("date") date: String? = null): List<FuelAlert>
    @GET("alerts/{id}") suspend fun alert(@Path("id") id: String): FuelAlert
    @PATCH("alerts/{id}") suspend fun updateAlert(@Path("id") id: String, @Body request: AlertUpdateRequest): FuelAlert

    @GET("reports/summary") suspend fun reportSummary(@Query("date") date: String? = null): ReportSummary
    @GET("settings/analytics") suspend fun analyticsSettings(): AnalyticsSettings
    @POST("fuel-estimate") suspend fun fuelEstimate(@Body request: FuelEstimateRequest): FuelEstimateResponse

    @POST("notifications/register") suspend fun registerPushToken(@Body request: PushTokenRegistration): ApiMessage
    @POST("notifications/unregister") suspend fun unregisterPushToken(@Body request: PushTokenRegistration): ApiMessage
    @POST("notifications/test") suspend fun testPush(@Body request: PushTestRequest): ApiMessage

    @GET("evidence") suspend fun evidence(
        @Query("registration") registration: String = "",
        @Query("tripId") tripId: String = ""
    ): List<EvidenceRecord>
    @POST("evidence") suspend fun uploadEvidence(@Body request: EvidenceUploadRequest): EvidenceRecord

    @GET("watchlist") suspend fun watchlist(): List<WatchlistItem>
    @POST("watchlist") suspend fun saveWatchlist(@Body request: WatchlistRequest): WatchlistItem
    @DELETE("watchlist/{registration}") suspend fun deleteWatchlist(@Path("registration") registration: String): ApiMessage
}
