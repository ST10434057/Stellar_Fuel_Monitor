package za.co.stellar.fuelmonitor.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import za.co.stellar.fuelmonitor.data.FuelAlert
import za.co.stellar.fuelmonitor.data.StellarRepository
import za.co.stellar.fuelmonitor.localization.tr
import za.co.stellar.fuelmonitor.ui.components.*
import za.co.stellar.fuelmonitor.ui.theme.StellarGood

@Composable
fun AlertDetailScreen(id: String, repository: StellarRepository, onBack: () -> Unit, onTrip: (String) -> Unit) {
    var alert by remember(id) { mutableStateOf<FuelAlert?>(null) }
    var error by remember(id) { mutableStateOf<String?>(null) }
    var comment by remember { mutableStateOf("") }
    var saving by remember { mutableStateOf(false) }
    var saveMessage by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    suspend fun load() {
        error = null
        repository.safely("alert $id") { repository.alert(id) }
            .onSuccess { alert = it; comment = it.comment.orEmpty() }
            .onFailure { error = it.message }
    }
    LaunchedEffect(id) { load() }

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).imePadding().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        BackTitle("Alert Review", "Explainable anomaly investigation", onBack)
        if (alert == null && error == null) LoadingBlock("Loading alert…")
        error?.let { ErrorCard(it, onRetry = { scope.launch { load() } }) }
        alert?.let { a ->
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(a.registration, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                        StatusPill(a.severity)
                    }
                    Text(a.reason)
                    KeyValue("Observed", a.kmL.kmL())
                    KeyValue("Benchmark", a.benchmark ?: "—")
                    KeyValue("Variance", a.deviationPct.percent())
                    KeyValue("Destination", a.destination ?: "—")
                    KeyValue("Trailer", a.trailer ?: "—")
                    KeyValue("Load context", a.loadContext ?: "—")
                    KeyValue("Status", tr(a.status))
                }
            }
            if (!a.explanations.isNullOrEmpty()) {
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp)) {
                        Text(tr("Evidence"), fontWeight = FontWeight.Bold)
                        a.explanations.forEach { Text("• $it") }
                    }
                }
            }
            OutlinedTextField(
                value = comment,
                onValueChange = { comment = it.take(1000) },
                label = { Text(tr("Investigation notes")) },
                modifier = Modifier.fillMaxWidth(),
                minLines = 3
            )
            Text(tr("Update status"), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            listOf("Open", "Investigating", "Resolved").forEach { status ->
                val selected = a.status.equals(status, ignoreCase = true)
                if (selected) {
                    FilledTonalButton(onClick = {}, enabled = false, modifier = Modifier.fillMaxWidth()) {
                        Text("${tr(status)} (${tr("Status").lowercase()})")
                    }
                } else {
                    Button(
                        enabled = !saving,
                        modifier = Modifier.fillMaxWidth(),
                        onClick = {
                            saving = true
                            error = null
                            saveMessage = null
                            scope.launch {
                                repository.safely("update alert") { repository.updateAlert(a, status, comment) }
                                    .onSuccess { outcome ->
                                        alert = outcome.alert
                                        saveMessage = if (outcome.queuedOffline) {
                                            tr("Queued offline — will sync automatically when connection returns.")
                                        } else {
                                            "${tr("Status")}: ${tr(status)}"
                                        }
                                    }
                                    .onFailure { error = it.message }
                                saving = false
                            }
                        }
                    ) { Text(if (saving) "Saving…" else "${tr("Update status")}: ${tr(status)}") }
                }
            }
            saveMessage?.let { Text(it, color = StellarGood, fontWeight = FontWeight.SemiBold) }
            a.tripId?.let { tripId ->
                OutlinedButton(onClick = { onTrip(tripId) }, modifier = Modifier.fillMaxWidth()) {
                    Text(tr("Open linked trip evidence"))
                }
            }
            Spacer(Modifier.height(12.dp))
        }
    }
}
