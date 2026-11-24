package za.co.stellar.fuelmonitor.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import za.co.stellar.fuelmonitor.auth.UserSession
import za.co.stellar.fuelmonitor.localization.tr
import za.co.stellar.fuelmonitor.ui.components.BackTitle
import za.co.stellar.fuelmonitor.ui.components.KeyValue
import za.co.stellar.fuelmonitor.ui.components.PageTitle

@Composable
fun MoreScreen(
    onReports: () -> Unit,
    onFuelRecords: () -> Unit,
    onEstimate: () -> Unit,
    onEvidence: () -> Unit,
    onWatchlist: () -> Unit,
    onOfflineSync: () -> Unit,
    onAdmin: () -> Unit,
    onSettings: () -> Unit,
    onProfile: () -> Unit
) {
    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        PageTitle("More", "Reports, utilities and account preferences")
        MoreRow(Icons.Default.Assessment, "Reports & insights", "Fleet summary and alert counts", onReports)
        MoreRow(Icons.Default.LocalGasStation, "Fuel & oil records", "Source fuel evidence", onFuelRecords)
        MoreRow(Icons.Default.Calculate, "Fuel estimate", "Weight-aware fuel planning calculator", onEstimate)
        MoreRow(Icons.Default.CloudUpload, "Evidence vault", "Upload receipt or fuel evidence to Azure Blob Storage", onEvidence)
        MoreRow(Icons.Default.Bookmarks, "Fleet watchlist", "Priority vehicles and investigation notes", onWatchlist)
        MoreRow(Icons.Default.Sync, "Offline sync", "Queued actions and connectivity", onOfflineSync)
        MoreRow(Icons.Default.AdminPanelSettings, "Administration", "API and analytics status", onAdmin)
        MoreRow(Icons.Default.Settings, "Settings", "Saved app preferences", onSettings)
        MoreRow(Icons.Default.Person, "Profile", "SSO account and sign out", onProfile)
        Spacer(Modifier.height(12.dp))
    }
}

@Composable
private fun MoreRow(icon: androidx.compose.ui.graphics.vector.ImageVector, title: String, subtitle: String, onClick: () -> Unit) {
    Card(Modifier.fillMaxWidth().clickable(onClick = onClick)) {
        Row(Modifier.padding(16.dp)) {
            Icon(icon, null)
            Spacer(Modifier.width(12.dp))
            Column {
                Text(tr(title), fontWeight = FontWeight.Bold)
                Text(tr(subtitle), style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

@Composable
fun ProfileScreen(session: UserSession, onSignOut: () -> Unit, onBack: () -> Unit) {
    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        BackTitle("My Profile", "Identity is supplied by Single Sign-On", onBack)
        Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp)) {
                Text(session.displayName, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                KeyValue("Email", session.email.ifBlank { "Not supplied" })
                KeyValue("Provider", session.provider)
                KeyValue("User ID", session.uid)
            }
        }
        Button(
            onClick = onSignOut,
            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
            modifier = Modifier.fillMaxWidth()
        ) { Text(tr("Sign out")) }
    }
}
