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
import za.co.stellar.fuelmonitor.data.TripAnalysis
import za.co.stellar.fuelmonitor.localization.tr
import za.co.stellar.fuelmonitor.ui.components.*

@Composable
fun TripsScreen(repository: StellarRepository, onTrip: (String) -> Unit) {
    var trips by remember { mutableStateOf<List<TripAnalysis>>(emptyList()) }
    var date by remember { mutableStateOf("") }
    var query by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var refreshKey by remember { mutableIntStateOf(0) }

    LaunchedEffect(refreshKey) {
        loading = true; error = null
        repository.safely("day trips") { repository.dayTrips() }
            .onSuccess { date = it.date; trips = it.items }
            .onFailure { error = it.message }
        loading = false
    }

    val filtered = remember(trips, query) {
        if (query.isBlank()) trips else trips.filter {
            "${it.registration} ${it.destination} ${it.routeLabel} ${it.rating}".contains(query, ignoreCase = true)
        }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item { PageTitle("Trips", if (date.isBlank()) "Latest completed fuel cycles" else "Operating day $date") }
        item {
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                leadingIcon = { Icon(Icons.Default.Search, null) },
                label = { Text(tr("Search vehicle or destination")) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
        }
        if (loading) item { LoadingBlock("Loading trips…") }
        error?.let { item { ErrorCard(it, { refreshKey++ }) } }
        items(filtered, key = { it.id }) { trip ->
            Card(Modifier.fillMaxWidth().clickable { onTrip(trip.id) }) {
                Column(Modifier.padding(14.dp)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(trip.registration, fontWeight = FontWeight.Bold)
                        StatusPill(trip.rating)
                    }
                    Text(trip.routeLabel ?: trip.destination ?: "Destination unavailable")
                    Spacer(Modifier.height(6.dp))
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("${trip.kilometers?.toInt() ?: 0} km")
                        Text("${trip.litres.oneDecimal()} L")
                        Text(trip.analysedKmL.kmL(), fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }
        if (!loading && error == null && filtered.isEmpty()) item { EmptyState("No trips", "No trips match this search.") }
    }
}
