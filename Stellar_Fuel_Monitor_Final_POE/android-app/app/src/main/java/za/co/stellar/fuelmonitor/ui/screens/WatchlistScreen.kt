package za.co.stellar.fuelmonitor.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BookmarkAdd
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import za.co.stellar.fuelmonitor.data.StellarRepository
import za.co.stellar.fuelmonitor.data.WatchlistItem
import za.co.stellar.fuelmonitor.localization.tr
import za.co.stellar.fuelmonitor.ui.components.*

@Composable
fun WatchlistScreen(repository: StellarRepository, onBack: () -> Unit) {
    val scope = rememberCoroutineScope()
    var items by remember { mutableStateOf<List<WatchlistItem>>(emptyList()) }
    var registration by remember { mutableStateOf("") }
    var note by remember { mutableStateOf("") }
    var priority by remember { mutableStateOf("Monitor") }
    var priorityMenu by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    suspend fun load() {
        repository.safely("fleet watchlist") { repository.watchlist() }
            .onSuccess { items = it }
            .onFailure { error = it.message }
    }
    LaunchedEffect(Unit) { load() }

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).imePadding().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        BackTitle("Fleet watchlist", "Priority vehicles and investigation notes", onBack)
        Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(tr("Add a vehicle"), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                OutlinedTextField(
                    value = registration,
                    onValueChange = { registration = it.uppercase().take(20) },
                    label = { Text(tr("Registration")) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = note,
                    onValueChange = { note = it.take(1000) },
                    label = { Text(tr("Investigation notes")) },
                    minLines = 2,
                    modifier = Modifier.fillMaxWidth()
                )
                Box {
                    OutlinedButton(onClick = { priorityMenu = true }) { Text("Priority: $priority") }
                    DropdownMenu(priorityMenu, onDismissRequest = { priorityMenu = false }) {
                        listOf("Monitor", "Priority", "Critical").forEach { value ->
                            DropdownMenuItem(text = { Text(value) }, onClick = { priority = value; priorityMenu = false })
                        }
                    }
                }
                Button(
                    enabled = !busy && registration.isNotBlank(),
                    onClick = {
                        busy = true; error = null
                        scope.launch {
                            repository.safely("save watchlist") { repository.saveWatchlist(registration, note, priority) }
                                .onSuccess { registration = ""; note = ""; load() }
                                .onFailure { error = it.message }
                            busy = false
                        }
                    },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(Icons.Default.BookmarkAdd, null)
                    Spacer(Modifier.width(8.dp))
                    Text(tr("Add to watchlist"))
                }
            }
        }

        error?.let { ErrorCard(it) }
        if (items.isEmpty()) {
            EmptyState("Watchlist is empty", "Add a vehicle that needs focused monitoring or follow-up.")
        } else {
            items.forEach { item ->
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text(item.registration, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                            StatusPill(item.priority)
                        }
                        if (!item.description.isNullOrBlank()) Text(item.description)
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            KpiCard("Current", item.currentKmL.kmL(), item.currentRating, Modifier.weight(1f))
                            KpiCard("Open alerts", item.openAlerts.toString(), "active", Modifier.weight(1f))
                        }
                        if (!item.note.isNullOrBlank()) Text(item.note, style = MaterialTheme.typography.bodySmall)
                        TextButton(
                            onClick = {
                                scope.launch {
                                    repository.safely("remove watchlist") { repository.deleteWatchlist(item.registration) }
                                        .onSuccess { load() }
                                        .onFailure { error = it.message }
                                }
                            }
                        ) {
                            Icon(Icons.Default.DeleteOutline, null)
                            Spacer(Modifier.width(6.dp))
                            Text(tr("Remove"))
                        }
                    }
                }
            }
        }
        Spacer(Modifier.height(12.dp))
    }
}
