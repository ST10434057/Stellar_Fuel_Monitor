package za.co.stellar.fuelmonitor.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import za.co.stellar.fuelmonitor.connectivity.ConnectivityObserver
import za.co.stellar.fuelmonitor.data.StellarRepository
import za.co.stellar.fuelmonitor.localization.tr
import za.co.stellar.fuelmonitor.offline.PendingAction
import za.co.stellar.fuelmonitor.ui.components.BackTitle
import za.co.stellar.fuelmonitor.ui.components.EmptyState

@Composable
fun OfflineSyncScreen(repository: StellarRepository, connectivityObserver: ConnectivityObserver, onBack: () -> Unit) {
    val online by connectivityObserver.isOnline.collectAsState(initial = true)
    var pending by remember { mutableStateOf<List<PendingAction>>(emptyList()) }

    LaunchedEffect(Unit) {
        while (true) {
            pending = repository.pendingOfflineActions()
            delay(1500)
        }
    }

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        BackTitle("Offline sync", "Queued actions and connectivity", onBack)
        Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(tr("Connection"), fontWeight = FontWeight.Bold)
                    AssistChip(onClick = {}, enabled = false, label = { Text(tr(if (online) "Online" else "Offline")) })
                }
                Text("${tr("Pending actions")}: ${pending.size}")
                Text(tr("Alert status changes made without a connection are stored in SQLite and replayed automatically by WorkManager once Android reports a validated network."), style = MaterialTheme.typography.bodySmall)
                Button(
                    onClick = { repository.syncPendingNow() },
                    enabled = online && pending.isNotEmpty(),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(Icons.Default.Sync, null)
                    Spacer(Modifier.width(8.dp))
                    Text(tr("Sync now"))
                }
            }
        }

        if (pending.isEmpty()) {
            EmptyState(tr("Nothing waiting to sync"), "The local SQLite write queue is clear.")
        } else {
            pending.forEach { action ->
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(14.dp)) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Icon(Icons.Default.CloudOff, null)
                            Text(action.type.replace('_', ' '), fontWeight = FontWeight.Bold)
                        }
                        Text("Target: ${action.targetId}")
                        Text("Attempts: ${action.attempts}", style = MaterialTheme.typography.bodySmall)
                        action.lastError?.let { Text("Last error: $it", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error) }
                    }
                }
            }
        }
    }
}
