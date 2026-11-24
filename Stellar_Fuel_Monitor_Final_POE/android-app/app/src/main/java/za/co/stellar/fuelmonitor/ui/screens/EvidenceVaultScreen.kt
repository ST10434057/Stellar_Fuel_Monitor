package za.co.stellar.fuelmonitor.ui.screens

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CloudDone
import androidx.compose.material.icons.filled.UploadFile
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import za.co.stellar.fuelmonitor.data.EvidenceRecord
import za.co.stellar.fuelmonitor.data.StellarRepository
import za.co.stellar.fuelmonitor.localization.tr
import za.co.stellar.fuelmonitor.ui.components.BackTitle
import za.co.stellar.fuelmonitor.ui.components.EmptyState
import za.co.stellar.fuelmonitor.ui.components.ErrorCard

@Composable
fun EvidenceVaultScreen(repository: StellarRepository, onBack: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var items by remember { mutableStateOf<List<EvidenceRecord>>(emptyList()) }
    var registration by remember { mutableStateOf("") }
    var tripId by remember { mutableStateOf("") }
    var note by remember { mutableStateOf("") }
    var selectedUri by remember { mutableStateOf<Uri?>(null) }
    var selectedName by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var success by remember { mutableStateOf<String?>(null) }

    suspend fun load() {
        repository.safely("evidence vault") { repository.evidence() }
            .onSuccess { items = it }
            .onFailure { error = it.message }
    }
    LaunchedEffect(Unit) { load() }

    val picker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        selectedUri = uri
        selectedName = uri?.let { queryDisplayName(context, it) }
        error = null
    }

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).imePadding().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        BackTitle("Evidence vault", "Upload receipt or fuel evidence to Azure Blob Storage", onBack)

        Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(tr("New evidence"), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                OutlinedTextField(
                    value = registration,
                    onValueChange = { registration = it.uppercase().take(20) },
                    label = { Text(tr("Registration")) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = tripId,
                    onValueChange = { tripId = it.take(120) },
                    label = { Text(tr("Trip ID")) },
                    supportingText = { Text(tr("Optional — link the evidence to a specific fuel cycle")) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = note,
                    onValueChange = { note = it.take(1000) },
                    label = { Text(tr("Note")) },
                    minLines = 2,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedButton(onClick = { picker.launch("*/*") }, modifier = Modifier.fillMaxWidth()) {
                    Icon(Icons.Default.UploadFile, null)
                    Spacer(Modifier.width(8.dp))
                    Text(selectedName ?: tr("Select image or PDF"))
                }
                Button(
                    enabled = !busy && selectedUri != null && registration.isNotBlank(),
                    onClick = {
                        val uri = selectedUri ?: return@Button
                        busy = true; error = null; success = null
                        scope.launch {
                            runCatching {
                                val upload = withContext(Dispatchers.IO) {
                                    val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
                                        ?: kotlin.error("Could not read the selected file")
                                    val mime = context.contentResolver.getType(uri) ?: "image/jpeg"
                                    val name = selectedName ?: "fuel-evidence.jpg"
                                    repository.uploadEvidence(bytes, name, mime, registration, tripId, note)
                                }
                                upload
                            }.onSuccess {
                                success = "Evidence uploaded to ${it.storageProvider ?: "blob storage"}."
                                selectedUri = null; selectedName = null; note = ""
                                load()
                            }.onFailure { error = it.message }
                            busy = false
                        }
                    },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    if (busy) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                    else Icon(Icons.Default.CloudDone, null)
                    Spacer(Modifier.width(8.dp))
                    Text(if (busy) "Uploading…" else tr("Upload"))
                }
            }
        }

        error?.let { ErrorCard(it) }
        success?.let { Text(it, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.SemiBold) }

        Text(tr("Uploaded evidence"), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        if (items.isEmpty()) {
            EmptyState("No evidence uploaded yet", "Upload a fuel receipt or supporting image to create a blob-backed evidence record.")
        } else {
            items.forEach { item ->
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text(item.registration, fontWeight = FontWeight.Bold)
                            Text(item.storageProvider ?: "storage", style = MaterialTheme.typography.labelSmall)
                        }
                        Text(item.fileName)
                        if (!item.tripId.isNullOrBlank()) Text("Trip: ${item.tripId}", style = MaterialTheme.typography.bodySmall)
                        if (!item.note.isNullOrBlank()) Text(item.note, style = MaterialTheme.typography.bodySmall)
                        Text("${item.sizeBytes / 1024} KB • ${item.uploadedAt ?: ""}", style = MaterialTheme.typography.labelSmall)
                    }
                }
            }
        }
        Spacer(Modifier.height(12.dp))
    }
}

private fun queryDisplayName(context: Context, uri: Uri): String? = runCatching {
    context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
        if (cursor.moveToFirst()) cursor.getString(0) else null
    }
}.getOrNull()
