package za.co.stellar.fuelmonitor.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import za.co.stellar.fuelmonitor.data.StellarRepository
import za.co.stellar.fuelmonitor.data.TripAnalysis
import za.co.stellar.fuelmonitor.data.VehicleAnalytics
import za.co.stellar.fuelmonitor.localization.tr
import za.co.stellar.fuelmonitor.ui.components.*
import za.co.stellar.fuelmonitor.ui.theme.StellarBlue

@Composable
fun VehicleDetailScreen(registration: String, repository: StellarRepository, onBack: () -> Unit, onTrip: (String) -> Unit) {
    var data by remember(registration) { mutableStateOf<VehicleAnalytics?>(null) }
    var error by remember(registration) { mutableStateOf<String?>(null) }
    var refreshKey by remember { mutableIntStateOf(0) }

    LaunchedEffect(registration, refreshKey) {
        error = null; data = null
        repository.safely("vehicle $registration") { repository.vehicleAnalytics(registration) }
            .onSuccess { data = it }
            .onFailure { error = it.message }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item { BackTitle("Vehicle Fuel Performance", registration, onBack) }
        if (data == null && error == null) item { LoadingBlock("Loading vehicle performance…") }
        error?.let { item { ErrorCard(it, { refreshKey++ }) } }
        data?.let { analytics ->
            val v = analytics.vehicle
            val latestTrip = analytics.trips.firstOrNull()
            item {
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.fillMaxWidth().padding(16.dp)) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Column(Modifier.weight(1f)) {
                                Text(v.registration, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                                Text("${v.manufacturer.orEmpty()} ${v.model.orEmpty()}".trim().ifBlank { "Vehicle details unavailable" })
                            }
                            Spacer(Modifier.width(8.dp))
                            StatusPill(v.currentRating)
                        }
                        Spacer(Modifier.height(12.dp))
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            KpiCard("Latest", v.currentKmL.kmL(), v.lastTripDate, Modifier.weight(1f))
                            KpiCard("Historical median", v.historicalMedianKmL.kmL(), "full-cycle baseline", Modifier.weight(1f))
                        }
                        Spacer(Modifier.height(8.dp))
                        KpiCard(
                            "Latest vs benchmark",
                            latestTrip?.deviationPct.percent(),
                            latestTrip?.benchmark?.scope ?: latestTrip?.benchmarkSelection ?: "Selected historical benchmark",
                            Modifier.fillMaxWidth()
                        )
                        Spacer(Modifier.height(8.dp))
                        val expectedBand = if (v.benchmarkLow != null && v.benchmarkHigh != null) {
                            "${v.benchmarkLow.kmL()} – ${v.benchmarkHigh.kmL()}"
                        } else "—"
                        KeyValue("Expected performance band", expectedBand)
                        KeyValue("Comparison group", v.peerType ?: v.vehicleGroup ?: "—")
                        KeyValue("Odometer", v.odometerKm?.let { "${it.toInt()} km" } ?: "—")
                        KeyValue("Destinations", analytics.destinations.size.toString())
                    }
                }
            }
            item { Text(tr("Recent fuel trend"), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold) }
            item { SimpleTrend(analytics.trips.filter { it.analysedKmL != null }.take(10).reversed()) }
            item { Text(tr("Historical cycles"), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold) }
            if (analytics.trips.isEmpty()) {
                item { EmptyState("No historical cycles", "No completed fuel cycles are available for this vehicle.") }
            }
            items(analytics.trips.take(30), key = { it.id }) { trip ->
                Card(Modifier.fillMaxWidth().clickable { onTrip(trip.id) }) {
                    Column(Modifier.padding(12.dp)) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text(trip.routeLabel ?: trip.destination ?: "Unknown route", fontWeight = FontWeight.Bold)
                            StatusPill(trip.rating)
                        }
                        Text("${trip.openingDate ?: trip.date} → ${trip.closingDate ?: trip.date}", style = MaterialTheme.typography.bodySmall)
                        Spacer(Modifier.height(6.dp))
                        KeyValue("Cycle efficiency", trip.analysedKmL.kmL())
                        KeyValue("Selected benchmark", trip.benchmark?.averageKmL.kmL())
                        KeyValue("Deviation", trip.deviationPct.percent())
                    }
                }
            }
        }
    }
}

@Composable
private fun SimpleTrend(trips: List<TripAnalysis>) {
    if (trips.isEmpty()) { EmptyState("No trend data", "No completed fuel cycles are available."); return }
    val max = trips.mapNotNull { it.analysedKmL }.maxOrNull()?.coerceAtLeast(1.0) ?: 1.0
    Card(Modifier.fillMaxWidth()) {
        LazyRow(
            modifier = Modifier.fillMaxWidth().height(190.dp),
            contentPadding = PaddingValues(12.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            items(trips, key = { "trend-${it.id}" }) { trip ->
                val ratio = ((trip.analysedKmL ?: 0.0) / max).coerceIn(0.05, 1.0).toFloat()
                Column(
                    Modifier.width(54.dp).fillMaxHeight(),
                    horizontalAlignment = androidx.compose.ui.Alignment.CenterHorizontally
                ) {
                    Text(trip.analysedKmL?.let { String.format("%.1f", it) } ?: "—", style = MaterialTheme.typography.labelSmall)
                    Spacer(Modifier.height(4.dp))
                    Box(Modifier.fillMaxWidth().weight(1f), contentAlignment = androidx.compose.ui.Alignment.BottomCenter) {
                        Surface(
                            Modifier.fillMaxWidth().fillMaxHeight(ratio),
                            color = if (trip.rating in listOf("Poor", "Review")) MaterialTheme.colorScheme.error else StellarBlue.copy(alpha = 0.75f),
                            shape = MaterialTheme.shapes.small
                        ) {}
                    }
                    Spacer(Modifier.height(4.dp))
                    Text((trip.closingDate ?: trip.date).takeLast(5), style = MaterialTheme.typography.labelSmall, color = Color.DarkGray)
                }
            }
        }
    }
}
