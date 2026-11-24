package za.co.stellar.fuelmonitor.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import za.co.stellar.fuelmonitor.data.FuelTransaction
import za.co.stellar.fuelmonitor.data.StellarRepository
import za.co.stellar.fuelmonitor.ui.components.*

@Composable
fun FuelRecordsScreen(repository: StellarRepository, onBack: () -> Unit) {
    var rows by remember { mutableStateOf<List<FuelTransaction>>(emptyList()) }
    var error by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(true) }
    var refreshKey by remember { mutableIntStateOf(0) }

    LaunchedEffect(refreshKey) {
        loading = true; error = null
        repository.safely("fuel transactions") { repository.transactions() }
            .onSuccess { rows = it }
            .onFailure { error = it.message }
        loading = false
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        item { BackTitle("Fuel & Oil Records", "Source fuel evidence from the existing Stellar API", onBack) }
        if (loading) item { LoadingBlock("Loading fuel records…") }
        error?.let { item { ErrorCard(it, { refreshKey++ }) } }
        if (!loading && error == null && rows.isEmpty()) {
            item { EmptyState("No fuel records", "The API returned no fuel or oil records.") }
        }
        items(rows.take(100), key = { it.id }) { row ->
            Card {
                Column(Modifier.fillMaxWidth().padding(12.dp)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(row.registration, fontWeight = FontWeight.Bold)
                        Text(row.date)
                    }
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("${row.litres.oneDecimal()} L")
                        Text(row.distanceKm?.let { "${it.toInt()} km" } ?: "—")
                        Text(row.kmL.kmL())
                    }
                    Text(row.fillUpLocation ?: row.destination ?: row.location ?: "Location unavailable", style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}
