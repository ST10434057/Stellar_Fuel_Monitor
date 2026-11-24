package za.co.stellar.fuelmonitor.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import za.co.stellar.fuelmonitor.data.DailyAnalytics
import za.co.stellar.fuelmonitor.data.StellarRepository
import za.co.stellar.fuelmonitor.settings.SettingsRepository
import za.co.stellar.fuelmonitor.settings.UserSettings
import za.co.stellar.fuelmonitor.localization.tr
import za.co.stellar.fuelmonitor.ui.components.*

@Composable
fun DashboardScreen(repository: StellarRepository, settingsRepository: SettingsRepository, onTrip: (String) -> Unit, onAlerts: () -> Unit) {
    val settings by settingsRepository.settings.collectAsState(initial = UserSettings())
    var data by remember { mutableStateOf<DailyAnalytics?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var refreshKey by remember { mutableIntStateOf(0) }

    LaunchedEffect(refreshKey) {
        error = null
        repository.safely("dashboard") { repository.dashboard() }
            .onSuccess { data = it }
            .onFailure { error = it.message ?: "Unknown API error" }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item { PageTitle("Stellar Fuel Intelligence", "Full-cycle fuel monitoring and management investigation") }
        if (data == null && error == null) item { LoadingBlock("Loading fleet dashboard…") }
        error?.let { message -> item { ErrorCard(message, onRetry = { refreshKey++ }) } }
        data?.let { dashboard ->
            item {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    KpiCard("Fleet average", dashboard.averageKmL.kmL(), dashboard.date, Modifier.weight(1f))
                    KpiCard("Trips", dashboard.totalTrips.toString(), "completed cycles", Modifier.weight(1f))
                }
            }
            item {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    KpiCard("Poor", dashboard.counts.poor.toString(), "needs investigation", Modifier.weight(1f))
                    KpiCard("Review", dashboard.counts.review.toString(), "below expected", Modifier.weight(1f))
                }
            }
            item { KpiCard("Good", dashboard.counts.good.toString(), "above expected", Modifier.fillMaxWidth()) }
            item {
                Card(onClick = onAlerts) {
                    Row(Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                        Column { Text(tr("Priority investigations"), fontWeight = FontWeight.Bold); Text(tr("Open the alert queue"), style = MaterialTheme.typography.bodySmall) }
                        Text("${dashboard.needsReview.size + if (settings.showDataWarnings) dashboard.dataWarnings.size else 0}", style = MaterialTheme.typography.headlineSmall)
                    }
                }
            }
            item { Text(tr("Needs review"), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold) }
            val reviewItems = dashboard.needsReview.take(if (settings.compactCards) 3 else 6)
            if (reviewItems.isEmpty()) item { EmptyState("No priority investigations", "No poor/review records on this operating day.") }
            items(reviewItems, key = { it.id }) { trip ->
                Card(Modifier.fillMaxWidth().clickable { onTrip(trip.id) }) {
                    Row(Modifier.fillMaxWidth().padding(14.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                        Column(Modifier.weight(1f)) {
                            Text("${trip.registration} → ${trip.destination ?: "Route unavailable"}", fontWeight = FontWeight.Bold)
                            Text("${trip.openingDate ?: trip.date} → ${trip.closingDate ?: trip.date}", style = MaterialTheme.typography.bodySmall)
                            StatusPill(trip.rating)
                        }
                        Column {
                            Text(trip.analysedKmL.kmL(), fontWeight = FontWeight.Bold)
                            Text(trip.deviationPct.percent(), style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
            }
            item { Text(tr("Outstanding"), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold) }
            if (dashboard.outstanding.isEmpty()) item { EmptyState("No outstanding cycles", "No top-performing cycles are available for this operating day.") }
            items(dashboard.outstanding.take(3), key = { "out-${it.id}" }) { trip ->
                Card(Modifier.fillMaxWidth().clickable { onTrip(trip.id) }) {
                    Row(Modifier.fillMaxWidth().padding(14.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(trip.registration, fontWeight = FontWeight.Bold)
                        Text(trip.analysedKmL.kmL())
                        StatusPill(trip.rating)
                    }
                }
            }
        }
    }
}
