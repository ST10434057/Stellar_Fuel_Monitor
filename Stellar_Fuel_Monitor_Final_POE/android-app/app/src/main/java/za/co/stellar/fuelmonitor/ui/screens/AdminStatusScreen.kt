package za.co.stellar.fuelmonitor.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import za.co.stellar.fuelmonitor.data.AnalyticsSettings
import za.co.stellar.fuelmonitor.data.ApiHealth
import za.co.stellar.fuelmonitor.data.StellarRepository
import za.co.stellar.fuelmonitor.localization.tr
import za.co.stellar.fuelmonitor.ui.components.*

@Composable
fun AdminStatusScreen(repository: StellarRepository, onBack: () -> Unit) {
    var health by remember { mutableStateOf<ApiHealth?>(null) }
    var settings by remember { mutableStateOf<AnalyticsSettings?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var refreshKey by remember { mutableIntStateOf(0) }

    LaunchedEffect(refreshKey) {
        error = null
        repository.safely("admin status") { repository.health() to repository.analyticsSettings() }
            .onSuccess { (h, s) -> health = h; settings = s }
            .onFailure { error = it.message }
    }

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        BackTitle("Administration", "Final POE service, storage and analytics readiness", onBack)
        if (health == null && error == null) LoadingBlock("Checking API status…")
        error?.let { ErrorCard(it, { refreshKey++ }) }
        health?.let { h ->
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp)) {
                    Text(tr("API health"), fontWeight = FontWeight.Bold)
                    KeyValue("Online", tr(if (h.ok) "Yes" else "No"))
                    KeyValue("Feature version", h.featureVersion ?: "—")
                    KeyValue("Data source", h.source ?: "—")
                    KeyValue("MongoDB connected", tr(if (h.mongoConnected) "Yes" else "No"))
                    KeyValue("Database", h.databaseName ?: "—")
                    KeyValue("Active trucks", (h.fleet?.activeTrucks ?: 0).toString())
                }
            }
            h.finalPoe?.let { final ->
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp)) {
                        Text(tr("Final POE advanced services"), fontWeight = FontWeight.Bold)
                        KeyValue("Azure Blob Storage", tr(if (final.blobStorage?.configured == true) "Yes" else "No"))
                        KeyValue("Blob provider", final.blobStorage?.provider ?: "—")
                        KeyValue("Firebase push", tr(if (final.pushNotifications?.configured == true) "Yes" else "No"))
                        KeyValue("Push provider", final.pushNotifications?.provider ?: "—")
                        final.pushNotifications?.error?.takeIf { it.isNotBlank() }?.let {
                            KeyValue("Push configuration", it)
                        }
                        KeyValue("Offline mode", final.offlineSync ?: "—")
                        KeyValue("Languages", final.languages.joinToString(", ").ifBlank { "—" })
                    }
                }
            }
        }
        settings?.let { s ->
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp)) {
                    Text(tr("Analytics settings"), fontWeight = FontWeight.Bold)
                    KeyValue("Poor threshold", s.poorDeviationPct?.let { "$it%" } ?: "—")
                    KeyValue("Review threshold", s.reviewDeviationPct?.let { "$it%" } ?: "—")
                    KeyValue("Minimum route samples", s.minSameVehicleDestinationSamples?.toString() ?: "—")
                    KeyValue("MAD outlier threshold", s.outlierMadThreshold?.toString() ?: "—")
                    KeyValue("Weight normalization", s.weightNormalizationEnabled?.toString() ?: "—")
                }
            }
        }
        Spacer(Modifier.height(12.dp))
    }
}
