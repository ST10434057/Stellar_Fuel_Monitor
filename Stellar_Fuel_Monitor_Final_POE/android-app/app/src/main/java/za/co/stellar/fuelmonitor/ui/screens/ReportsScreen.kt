package za.co.stellar.fuelmonitor.ui.screens

import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import za.co.stellar.fuelmonitor.data.ReportSummary
import za.co.stellar.fuelmonitor.data.StellarRepository
import za.co.stellar.fuelmonitor.ui.components.*

@Composable
fun ReportsScreen(repository: StellarRepository, onBack: () -> Unit) {
    var data by remember { mutableStateOf<ReportSummary?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var refreshKey by remember { mutableIntStateOf(0) }

    LaunchedEffect(refreshKey) {
        data = null; error = null
        repository.safely("report summary") { repository.reportSummary() }
            .onSuccess { data = it }
            .onFailure { error = it.message }
    }

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        BackTitle("Reports & Insights", "Latest fleet summary from the Stellar API", onBack)
        if (data == null && error == null) LoadingBlock("Loading report…")
        error?.let { ErrorCard(it, { refreshKey++ }) }
        data?.let { r ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                KpiCard("Vehicles", r.vehicles.toString(), r.date, Modifier.weight(1f))
                KpiCard("Fuel cycles", r.transactions.toString(), "selected day", Modifier.weight(1f))
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                KpiCard("Active alerts", r.activeAlerts.toString(), "review + data warnings", Modifier.weight(1f))
                KpiCard("High alerts", r.highAlerts.toString(), "poor cycles", Modifier.weight(1f))
            }
            KpiCard("Outstanding", r.outstanding.toString(), "top-performing cycles", Modifier.fillMaxWidth())
            Card(Modifier.fillMaxWidth()) {
                Text(
                    "Final POE reporting summarises the live fleet, fuel cycles and alert workload from the hosted API. Evidence uploads and watchlist investigations are available from More.",
                    Modifier.padding(16.dp)
                )
            }
        }
        Spacer(Modifier.height(12.dp))
    }
}
