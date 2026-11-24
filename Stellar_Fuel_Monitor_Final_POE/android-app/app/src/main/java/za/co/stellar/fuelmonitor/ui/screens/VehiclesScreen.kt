package za.co.stellar.fuelmonitor.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import za.co.stellar.fuelmonitor.data.StellarRepository
import za.co.stellar.fuelmonitor.data.Vehicle
import za.co.stellar.fuelmonitor.localization.tr
import za.co.stellar.fuelmonitor.ui.components.*

@Composable
fun VehiclesScreen(repository: StellarRepository, onVehicle: (String) -> Unit) {
    var vehicles by remember { mutableStateOf<List<Vehicle>>(emptyList()) }
    var query by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var refreshKey by remember { mutableIntStateOf(0) }

    LaunchedEffect(refreshKey) {
        loading = true; error = null
        repository.safely("vehicles") { repository.vehicles(status = "Active") }
            .onSuccess { vehicles = it }
            .onFailure { error = it.message }
        loading = false
    }

    val filtered = remember(vehicles, query) {
        if (query.isBlank()) vehicles else vehicles.filter {
            listOf(it.registration, it.manufacturer, it.model, it.vehicleGroup, it.description).joinToString(" ").contains(query, ignoreCase = true)
        }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item { PageTitle("Fleet Performance", "Active trucks from the Stellar asset master") }
        item {
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                leadingIcon = { Icon(Icons.Default.Search, null) },
                label = { Text(tr("Search registration, make or model")) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
        }
        if (loading) item { LoadingBlock("Loading vehicles…") }
        error?.let { item { ErrorCard(it, { refreshKey++ }) } }
        if (!loading && error == null && filtered.isEmpty()) item { EmptyState("No vehicles", "No active vehicles match this search.") }
        items(filtered, key = { it.registration }) { vehicle ->
            Card(Modifier.fillMaxWidth().clickable { onVehicle(vehicle.registration) }) {
                Column(Modifier.padding(14.dp)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(vehicle.registration, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                        StatusPill(vehicle.currentRating)
                    }
                    Text("${vehicle.manufacturer.orEmpty()} ${vehicle.model.orEmpty()}".trim())
                    Text(vehicle.peerType ?: vehicle.vehicleGroup ?: "Comparison group unavailable", style = MaterialTheme.typography.bodySmall)
                    Spacer(Modifier.height(8.dp))
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Latest ${vehicle.currentKmL.kmL()}")
                        Text(vehicle.lastTripDate ?: "No recent trip", style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        }
    }
}
