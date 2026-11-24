package za.co.stellar.fuelmonitor.network

import android.util.Log
import com.google.gson.GsonBuilder
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import za.co.stellar.fuelmonitor.BuildConfig
import java.util.concurrent.TimeUnit

class ApiClient(
    private val tokenProvider: () -> String? = { null }
) {
    val api: StellarApi by lazy {
        val authInterceptor = Interceptor { chain ->
            val original = chain.request()
            val token = tokenProvider()
            val builder = original.newBuilder()
                .header("Accept", "application/json")
            if (!token.isNullOrBlank()) builder.header("Authorization", "Bearer $token")
            chain.proceed(builder.build())
        }

        val logger = HttpLoggingInterceptor { message -> Log.d("StellarApi", message) }
            .apply { level = if (BuildConfig.DEBUG) HttpLoggingInterceptor.Level.BASIC else HttpLoggingInterceptor.Level.NONE }

        val client = OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .addInterceptor(logger)
            .connectTimeout(20, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .build()

        val baseUrl = BuildConfig.STELLAR_API_BASE_URL.trim().let {
            when {
                it.isBlank() -> "http://10.0.2.2:3000/api/"
                it.endsWith("/") -> it
                else -> "$it/"
            }
        }

        Log.i("StellarApi", "Using API base URL: $baseUrl")
        Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create(GsonBuilder().serializeNulls().create()))
            .build()
            .create(StellarApi::class.java)
    }
}
