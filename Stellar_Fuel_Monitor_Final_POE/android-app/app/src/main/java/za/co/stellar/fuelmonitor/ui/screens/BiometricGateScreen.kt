package za.co.stellar.fuelmonitor.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Fingerprint
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import za.co.stellar.fuelmonitor.localization.tr

@Composable
fun BiometricGateScreen(
    message: String?,
    canUseBiometrics: Boolean,
    onAuthenticate: () -> Unit,
    onContinueWithoutBiometric: (() -> Unit)?,
    onSignOut: () -> Unit
) {
    Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
        Card(Modifier.fillMaxWidth()) {
            Column(
                Modifier.padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Icon(Icons.Default.Fingerprint, contentDescription = null, modifier = Modifier.size(54.dp))
                Text(tr("Biometric verification required"), style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
                Text(
                    message ?: "Verify your identity with the fingerprint or face enrolled on this Android phone.",
                    textAlign = TextAlign.Center
                )
                Button(onClick = onAuthenticate, enabled = canUseBiometrics, modifier = Modifier.fillMaxWidth()) {
                    Text(tr("Unlock with biometrics"))
                }
                if (!canUseBiometrics && onContinueWithoutBiometric != null) {
                    OutlinedButton(onClick = onContinueWithoutBiometric, modifier = Modifier.fillMaxWidth()) {
                        Text(tr("Continue with SSO"))
                    }
                }
                TextButton(onClick = onSignOut) { Text(tr("Sign out")) }
            }
        }
    }
}
