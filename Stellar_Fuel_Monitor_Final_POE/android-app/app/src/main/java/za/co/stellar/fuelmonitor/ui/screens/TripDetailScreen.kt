package za.co.stellar.fuelmonitor.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import za.co.stellar.fuelmonitor.data.StellarRepository
import za.co.stellar.fuelmonitor.data.TripAnalysis
import za.co.stellar.fuelmonitor.localization.tr
import za.co.stellar.fuelmonitor.ui.components.*

@Composable
fun TripDetailScreen(id: String, repository: StellarRepository, onBack: () -> Unit) {
    var trip by remember(id) { mutableStateOf<TripAnalysis?>(null) }
    var error by remember(id) { mutableStateOf<String?>(null) }
    var refreshKey by remember { mutableIntStateOf(0) }

    LaunchedEffect(id, refreshKey) {
        error = null; trip = null
        repository.safely("trip $id") { repository.trip(id) }
            .onSuccess { trip = it }
            .onFailure { error = it.message }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item { BackTitle("Trip Investigation", "Full-cycle fuel evidence and destination comparison", onBack) }
        if (trip == null && error == null) item { LoadingBlock("Loading trip investigation…") }
        error?.let { item { ErrorCard(it, { refreshKey++ }) } }
        trip?.let { t ->
            item {
                Card {
                    Column(Modifier.padding(16.dp)) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text(t.registration, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                            StatusPill(t.rating)
                        }
                        Text(t.routeLabel ?: t.destination ?: "Route unavailable")
                        KeyValue("Cycle", "${t.openingDate ?: t.date} → ${t.closingDate ?: t.date}")
                        KeyValue("Distance", t.kilometers?.let { "${it.toInt()} km" } ?: "—")
                        KeyValue("Fuel", t.litres?.let { "${it.oneDecimal()} L" } ?: "—")
                        KeyValue("Cycle efficiency", t.analysedKmL.kmL())
                        KeyValue("Reported efficiency", t.reportedKmL.kmL())
                    }
                }
            }

            item {
                Card {
                    Column(Modifier.padding(16.dp)) {
                        Text(tr("Historical comparison"), fontWeight = FontWeight.Bold)
                        KeyValue("Selected benchmark", t.benchmark?.averageKmL.kmL())
                        KeyValue("Median", t.benchmark?.medianKmL.kmL())
                        KeyValue("Samples", (t.benchmark?.sampleSize ?: 0).toString())
                        KeyValue("Scope", t.benchmark?.scope ?: t.benchmarkSelection ?: "Baseline")
                        KeyValue("Confidence", t.benchmark?.confidence ?: "—")
                        KeyValue("Variance", t.deviationPct.percent())
                        KeyValue("Robust z-score", t.robustZ?.let { String.format("%.2f", it) } ?: "—")
                    }
                }
            }

            item {
                Card {
                    Column(Modifier.padding(16.dp)) {
                        Text(tr("Distance & load context"), fontWeight = FontWeight.Bold)
                        KeyValue("Expected distance", t.expectedDistanceKm?.let { "${it.toInt()} km" } ?: "—")
                        KeyValue("Extra km", t.extraKm?.let { String.format("%+.0f km", it) } ?: "—")
                        KeyValue("Trailer", t.weight?.trailerRegistration ?: "Not confirmed")
                        KeyValue("Product/load", t.weight?.productName ?: "Not confirmed")
                        KeyValue("Gross weight", t.weight?.averageGrossKg?.let { String.format("%.1f t", it / 1000.0) } ?: "—")
                        t.googleRoadBenchmark?.takeIf { it.available }?.let { g ->
                            KeyValue("Google road benchmark", g.benchmarkKm?.let { "${it.toInt()} km" } ?: "—")
                        }
                    }
                }
            }

            if (t.qualityFlags.isNotEmpty()) item {
                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)) {
                    Column(Modifier.padding(16.dp)) {
                        Text(tr("Data-quality flags"), fontWeight = FontWeight.Bold)
                        t.qualityFlags.forEach { Text("• $it") }
                    }
                }
            }

            if (t.explanations.isNotEmpty()) item { Text(tr("Why this result was classified"), fontWeight = FontWeight.Bold) }
            items(t.explanations) { explanation -> Card { Text(explanation, Modifier.padding(14.dp)) } }

            t.recentFuelHistory?.let { history ->
                item { Text(tr("Fuel evidence used in this cycle"), fontWeight = FontWeight.Bold) }
                items(history.rows.take(20), key = { "hist-${it.id}-${it.date}" }) { row ->
                    Card {
                        Row(Modifier.fillMaxWidth().padding(12.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                            Column(Modifier.weight(1f)) { Text(row.date, fontWeight = FontWeight.SemiBold); Text(row.fillUpLocation ?: row.destination ?: "Fuel record", style = MaterialTheme.typography.bodySmall) }
                            Text(row.litres?.let { "${it.oneDecimal()} L" } ?: "—")
                            Spacer(Modifier.width(10.dp))
                            Text(row.consumptionKmL.kmL())
                        }
                    }
                }
            }
        }
    }
}
