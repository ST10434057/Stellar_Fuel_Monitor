package za.co.stellar.fuelmonitor.ui.screens

import android.app.Activity
import androidx.compose.foundation.Image
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Business
import androidx.compose.material.icons.filled.Login
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import za.co.stellar.fuelmonitor.BuildConfig
import za.co.stellar.fuelmonitor.R
import za.co.stellar.fuelmonitor.auth.AuthManager
import za.co.stellar.fuelmonitor.auth.UserSession
import za.co.stellar.fuelmonitor.ui.theme.StellarNavy
import za.co.stellar.fuelmonitor.localization.tr

@Composable
fun AuthScreen(authManager: AuthManager, onSignedIn: (UserSession) -> Unit) {
    val context = LocalContext.current
    val activity = context as? Activity
    val scope = rememberCoroutineScope()
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    Surface(Modifier.fillMaxSize()) {
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()).imePadding().padding(28.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Image(painterResource(R.drawable.stellar_logo), contentDescription = "Stellar logo", modifier = Modifier.size(110.dp))
            Spacer(Modifier.height(16.dp))
            Text(tr("Stellar Fuel Monitor"), style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold, color = StellarNavy)
            Text(tr("Final POE • Native Kotlin • Secure fleet intelligence"), style = MaterialTheme.typography.bodyMedium, textAlign = TextAlign.Center)
            Spacer(Modifier.height(28.dp))

            if (!authManager.isConfigured) {
                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer)) {
                    Text(
                        "Configure Firebase values in android-app/local.properties for Google/Microsoft SSO, biometrics and real-time notifications on the assessment phone.",
                        Modifier.padding(16.dp)
                    )
                }
                Spacer(Modifier.height(16.dp))
            }

            Button(
                enabled = !busy && activity != null && authManager.isConfigured,
                onClick = {
                    busy = true; error = null
                    scope.launch {
                        authManager.signInWithGoogle(activity!!)
                            .onSuccess(onSignedIn)
                            .onFailure { error = it.message ?: "Google sign-in failed" }
                        busy = false
                    }
                },
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(Icons.Default.Login, null)
                Spacer(Modifier.width(8.dp))
                Text(tr("Sign in with Google"))
            }
            Spacer(Modifier.height(10.dp))
            OutlinedButton(
                enabled = !busy && activity != null && authManager.isConfigured,
                onClick = {
                    busy = true; error = null
                    scope.launch {
                        authManager.signInWithMicrosoft(activity!!)
                            .onSuccess(onSignedIn)
                            .onFailure { error = it.message ?: "Microsoft sign-in failed" }
                        busy = false
                    }
                },
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(Icons.Default.Business, null)
                Spacer(Modifier.width(8.dp))
                Text(tr("Sign in with Microsoft"))
            }
            if (BuildConfig.DEBUG && !authManager.isConfigured) {
                Spacer(Modifier.height(10.dp))
                TextButton(onClick = {
                    onSignedIn(UserSession("local-preview", "Local Preview", "preview@stellar.local", null, "debug-preview"))
                }) { Text(tr("Continue in local preview (debug only)")) }
            }
            if (busy) {
                Spacer(Modifier.height(16.dp)); CircularProgressIndicator()
            }
            error?.let {
                Spacer(Modifier.height(12.dp))
                Text(it, color = MaterialTheme.colorScheme.error, textAlign = TextAlign.Center)
            }
        }
    }
}
