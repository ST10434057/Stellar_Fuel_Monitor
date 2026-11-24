package za.co.stellar.fuelmonitor.ui.screens

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.fragment.app.FragmentActivity
import kotlinx.coroutines.launch
import za.co.stellar.fuelmonitor.AppContainer
import za.co.stellar.fuelmonitor.BuildConfig
import za.co.stellar.fuelmonitor.localization.AppLanguage
import za.co.stellar.fuelmonitor.localization.tr
import za.co.stellar.fuelmonitor.settings.UserSettings
import za.co.stellar.fuelmonitor.ui.components.BackTitle

@Composable
fun SettingsScreen(container: AppContainer, onBack: () -> Unit) {
    val settingsRepository = container.settingsRepository
    val settings by settingsRepository.settings.collectAsState(initial = UserSettings())
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val activity = context as? FragmentActivity
    var periodMenu by remember { mutableStateOf(false) }
    var languageMenu by remember { mutableStateOf(false) }
    var pushMessage by remember { mutableStateOf<String?>(null) }
    val biometricCapability = remember(activity) { activity?.let(container.biometricAuthenticator::capability) }

    val notificationPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        pushMessage = if (granted) "Notification permission granted." else "Notification permission was not granted."
    }

    LaunchedEffect(settings.notificationsEnabled) {
        if (settings.notificationsEnabled && container.authManager.currentUser != null) {
            container.pushManager.register(container.authManager.currentUser?.uid, container.authManager.currentUser?.email)
        }
    }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp)) {
        BackTitle("Settings", "Preferences are saved locally with Android DataStore.", onBack)
        Spacer(Modifier.height(16.dp))

        Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp)) {
                Text(tr("Dashboard"), fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(8.dp))
                Box {
                    OutlinedButton(onClick = { periodMenu = true }) {
                        Text("${tr("Default period")}: ${settings.defaultPeriod}")
                    }
                    DropdownMenu(expanded = periodMenu, onDismissRequest = { periodMenu = false }) {
                        listOf("Latest", "7 days", "30 days").forEach { value ->
                            DropdownMenuItem(
                                text = { Text(value) },
                                onClick = { periodMenu = false; scope.launch { settingsRepository.setDefaultPeriod(value) } }
                            )
                        }
                    }
                }
                SettingSwitch(tr("Show data-quality warnings"), settings.showDataWarnings) {
                    scope.launch { settingsRepository.setShowDataWarnings(it) }
                }
                SettingSwitch(tr("Compact cards"), settings.compactCards) {
                    scope.launch { settingsRepository.setCompactCards(it) }
                }
            }
        }

        Spacer(Modifier.height(12.dp))
        Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp)) {
                Text(tr("Biometric security"), fontWeight = FontWeight.Bold)
                SettingSwitch(
                    tr("Require biometric unlock"),
                    settings.biometricEnabled,
                    enabled = biometricCapability?.available == true
                ) { enabled -> scope.launch { settingsRepository.setBiometricEnabled(enabled) } }
                Text(
                    biometricCapability?.message ?: "Biometric capability is checked on the physical Android device.",
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }

        Spacer(Modifier.height(12.dp))
        Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp)) {
                Text(tr("Notifications & language"), fontWeight = FontWeight.Bold)
                SettingSwitch(tr("Notification preference"), settings.notificationsEnabled) { enabled ->
                    scope.launch {
                        settingsRepository.setNotificationsEnabled(enabled)
                        if (enabled) {
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                                notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
                            }
                            container.pushManager.register(container.authManager.currentUser?.uid, container.authManager.currentUser?.email)
                                .onSuccess { pushMessage = "This phone is registered for Firebase Cloud Messaging." }
                                .onFailure { pushMessage = it.message }
                        } else {
                            container.pushManager.unregister()
                            pushMessage = "Push notifications disabled for this phone."
                        }
                    }
                }
                Spacer(Modifier.height(8.dp))
                OutlinedButton(
                    onClick = {
                        scope.launch {
                            pushMessage = "Requesting real-time test notification…"
                            container.pushManager.sendTestNotification()
                                .onSuccess { pushMessage = it }
                                .onFailure { pushMessage = it.message }
                        }
                    },
                    enabled = settings.notificationsEnabled,
                    modifier = Modifier.fillMaxWidth()
                ) { Text(tr("Send real-time test notification")) }
                pushMessage?.let { Text(it, style = MaterialTheme.typography.bodySmall) }

                Spacer(Modifier.height(12.dp))
                Box {
                    OutlinedButton(onClick = { languageMenu = true }) {
                        Text("${tr("Preferred language")}: ${AppLanguage.fromStored(settings.preferredLanguage).nativeName}")
                    }
                    DropdownMenu(expanded = languageMenu, onDismissRequest = { languageMenu = false }) {
                        AppLanguage.entries.forEach { language ->
                            DropdownMenuItem(
                                text = { Text(language.nativeName) },
                                onClick = {
                                    languageMenu = false
                                    scope.launch { settingsRepository.setPreferredLanguage(language.displayName) }
                                }
                            )
                        }
                    }
                }
                Text(tr("English, Afrikaans and isiZulu are applied immediately across the main app navigation, actions and common labels."), style = MaterialTheme.typography.bodySmall)
            }
        }

        Spacer(Modifier.height(12.dp))
        Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp)) {
                Text(tr("Connection"), fontWeight = FontWeight.Bold)
                Text(BuildConfig.STELLAR_API_BASE_URL, style = MaterialTheme.typography.bodySmall)
                Text("Final POE ${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})", style = MaterialTheme.typography.bodySmall)
                Text(tr("Use the hosted HTTPS API for the assessed physical-phone demonstration."), style = MaterialTheme.typography.bodySmall)
            }
        }
        Spacer(Modifier.height(12.dp))
    }
}

@Composable
private fun SettingSwitch(label: String, checked: Boolean, enabled: Boolean = true, onCheckedChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, Modifier.weight(1f))
        Switch(checked = checked, enabled = enabled, onCheckedChange = onCheckedChange)
    }
}
