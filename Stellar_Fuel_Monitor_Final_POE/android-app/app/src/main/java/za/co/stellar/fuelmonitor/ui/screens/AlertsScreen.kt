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
import za.co.stellar.fuelmonitor.data.FuelAlert
import za.co.stellar.fuelmonitor.data.StellarRepository
import za.co.stellar.fuelmonitor.ui.components.*

@Composable
fun AlertsScreen(repository: StellarRepository, onAlert: (String) -> Unit) {
    var alerts by remember { mutableStateOf<List<FuelAlert>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var refreshKey by remember { mutableIntStateOf(0) }

    LaunchedEffect(refreshKey) {
        loading = true; error = null
        repository.safely("alerts") { repository.alerts() }
            .onSuccess { alerts = it }
            .onFailure { error = it.message }
        loading = false
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item { PageTitle("Fuel Alerts", "Investigate the record, not the person") }
        if (loading) item { LoadingBlock("Loading alerts…") }
        error?.let { item { ErrorCard(it, { refreshKey++ }) } }
        if (!loading && error == null && alerts.isEmpty()) item { EmptyState("No open alerts", "No fuel anomalies or data warnings require attention.") }
        items(alerts, key = { it.id }) { alert ->
            Card(Modifier.fillMaxWidth().clickable { onAlert(alert.id) }) {
                Column(Modifier.padding(14.dp)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(alert.registration, fontWeight = FontWeight.Bold)
                        StatusPill(alert.severity)
                    }
                    Text(alert.reason)
                    Spacer(Modifier.height(6.dp))
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(alert.kmL.kmL())
                        Text(alert.deviationPct.percent())
                        StatusPill(alert.status)
                    }
                }
            }
        }
    }
}
