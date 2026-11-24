package za.co.stellar.fuelmonitor.ui

import android.Manifest
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.util.Log
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import kotlinx.coroutines.launch
import za.co.stellar.fuelmonitor.AppContainer
import za.co.stellar.fuelmonitor.auth.UserSession
import za.co.stellar.fuelmonitor.localization.AppLanguage
import za.co.stellar.fuelmonitor.localization.LocalAppLanguage
import za.co.stellar.fuelmonitor.localization.tr
import za.co.stellar.fuelmonitor.settings.UserSettings
import za.co.stellar.fuelmonitor.ui.screens.*

private sealed class AppRoute(val route: String, val label: String, val icon: androidx.compose.ui.graphics.vector.ImageVector) {
    data object Dashboard : AppRoute("dashboard", "Home", Icons.Default.Home)
    data object Vehicles : AppRoute("vehicles", "Vehicles", Icons.Default.LocalShipping)
    data object Trips : AppRoute("trips", "Trips", Icons.Default.Route)
    data object Alerts : AppRoute("alerts", "Alerts", Icons.Default.WarningAmber)
    data object More : AppRoute("more", "More", Icons.Default.MoreHoriz)
}

private val bottomRoutes = listOf(AppRoute.Dashboard, AppRoute.Vehicles, AppRoute.Trips, AppRoute.Alerts, AppRoute.More)

@Composable
fun StellarRoot(container: AppContainer) {
    var session by remember { mutableStateOf(container.authManager.currentUser) }
    val settings by container.settingsRepository.settings.collectAsState(initial = UserSettings())
    val language = AppLanguage.fromStored(settings.preferredLanguage)

    CompositionLocalProvider(LocalAppLanguage provides language) {
        if (session == null) {
            AuthScreen(container.authManager) { signedIn ->
                Log.i("StellarLifecycle", "Authenticated user entered app")
                session = signedIn
            }
            return@CompositionLocalProvider
        }

        SecureAppGate(
            container = container,
            session = session!!,
            settings = settings,
            onSignOut = {
                container.authManager.signOut()
                session = null
            }
        )
    }
}

@Composable
private fun SecureAppGate(
    container: AppContainer,
    session: UserSession,
    settings: UserSettings,
    onSignOut: () -> Unit
) {
    val context = LocalContext.current
    val activity = context as? FragmentActivity
    val scope = rememberCoroutineScope()
    val capability = remember(activity) { activity?.let(container.biometricAuthenticator::capability) }
    var biometricVerified by remember(session.uid, settings.biometricEnabled) { mutableStateOf(!settings.biometricEnabled) }
    var biometricMessage by remember { mutableStateOf<String?>(null) }

    suspend fun authenticate() {
        val host = activity ?: run {
            biometricMessage = "Biometric verification requires a physical Android activity."
            return
        }
        biometricMessage = null
        container.biometricAuthenticator.authenticate(host)
            .onSuccess {
                biometricVerified = true
                Log.i("StellarBiometric", "Biometric gate passed for uid=${session.uid}")
            }
            .onFailure {
                biometricMessage = it.message ?: "Biometric verification failed"
                Log.w("StellarBiometric", "Biometric gate did not complete", it)
            }
    }

    LaunchedEffect(session.uid, settings.biometricEnabled, capability?.available) {
        if (settings.biometricEnabled && capability?.available == true && !biometricVerified) authenticate()
    }

    if (settings.biometricEnabled && !biometricVerified) {
        BiometricGateScreen(
            message = biometricMessage ?: capability?.message,
            canUseBiometrics = capability?.available == true,
            onAuthenticate = { scope.launch { authenticate() } },
            onContinueWithoutBiometric = if (capability?.available == false) ({ biometricVerified = true }) else null,
            onSignOut = onSignOut
        )
        return
    }

    FinalPoeApp(container, session, settings, onSignOut)
}

@Composable
private fun FinalPoeApp(container: AppContainer, session: UserSession, settings: UserSettings, onSignOut: () -> Unit) {
    val context = LocalContext.current
    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { }

    LaunchedEffect(session.uid, settings.notificationsEnabled) {
        if (settings.notificationsEnabled) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
            ) {
                permissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
            container.pushManager.register(session.uid, session.email)
        }
    }

    StellarNavigation(container, session, onSignOut)
}

@Composable
private fun StellarNavigation(container: AppContainer, session: UserSession, onSignOut: () -> Unit) {
    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val destination = backStackEntry?.destination
    val online by container.connectivityObserver.isOnline.collectAsState(initial = true)

    Scaffold(
        topBar = {
            if (!online) {
                Surface(modifier = Modifier.fillMaxWidth(), color = MaterialTheme.colorScheme.errorContainer) {
                    Text(
                        "${tr("Offline")} • ${tr("Queued offline — will sync automatically when connection returns.")}",
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onErrorContainer
                    )
                }
            }
        },
        bottomBar = {
            NavigationBar {
                bottomRoutes.forEach { screen ->
                    val selected = destination?.hierarchy?.any { it.route == screen.route } == true
                    NavigationBarItem(
                        selected = selected,
                        onClick = {
                            navController.navigate(screen.route) {
                                popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        icon = { Icon(screen.icon, contentDescription = tr(screen.label)) },
                        label = { Text(tr(screen.label)) }
                    )
                }
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = AppRoute.Dashboard.route,
            modifier = Modifier.padding(innerPadding)
        ) {
            composable(AppRoute.Dashboard.route) {
                DashboardScreen(
                    repository = container.repository,
                    settingsRepository = container.settingsRepository,
                    onTrip = { navController.navigate("trip/${Uri.encode(it)}") },
                    onAlerts = { navController.navigate(AppRoute.Alerts.route) }
                )
            }
            composable(AppRoute.Vehicles.route) {
                VehiclesScreen(container.repository) { reg -> navController.navigate("vehicle/${Uri.encode(reg)}") }
            }
            composable("vehicle/{registration}") { entry ->
                val reg = Uri.decode(entry.arguments?.getString("registration").orEmpty())
                VehicleDetailScreen(
                    registration = reg,
                    repository = container.repository,
                    onBack = { navController.popBackStack() },
                    onTrip = { id -> navController.navigate("trip/${Uri.encode(id)}") }
                )
            }
            composable(AppRoute.Trips.route) {
                TripsScreen(container.repository) { id -> navController.navigate("trip/${Uri.encode(id)}") }
            }
            composable("trip/{id}") { entry ->
                val id = Uri.decode(entry.arguments?.getString("id").orEmpty())
                TripDetailScreen(id, container.repository, onBack = { navController.popBackStack() })
            }
            composable(AppRoute.Alerts.route) {
                AlertsScreen(container.repository) { id -> navController.navigate("alert/${Uri.encode(id)}") }
            }
            composable("alert/{id}") { entry ->
                val id = Uri.decode(entry.arguments?.getString("id").orEmpty())
                AlertDetailScreen(
                    id = id,
                    repository = container.repository,
                    onBack = { navController.popBackStack() },
                    onTrip = { trip -> navController.navigate("trip/${Uri.encode(trip)}") }
                )
            }
            composable(AppRoute.More.route) {
                MoreScreen(
                    onReports = { navController.navigate("reports") },
                    onFuelRecords = { navController.navigate("fuel-records") },
                    onEstimate = { navController.navigate("fuel-estimate") },
                    onEvidence = { navController.navigate("evidence") },
                    onWatchlist = { navController.navigate("watchlist") },
                    onOfflineSync = { navController.navigate("offline-sync") },
                    onAdmin = { navController.navigate("admin") },
                    onSettings = { navController.navigate("settings") },
                    onProfile = { navController.navigate("profile") }
                )
            }
            composable("reports") { ReportsScreen(container.repository, onBack = { navController.popBackStack() }) }
            composable("fuel-records") { FuelRecordsScreen(container.repository, onBack = { navController.popBackStack() }) }
            composable("fuel-estimate") { FuelEstimateScreen(container.repository, onBack = { navController.popBackStack() }) }
            composable("evidence") { EvidenceVaultScreen(container.repository, onBack = { navController.popBackStack() }) }
            composable("watchlist") { WatchlistScreen(container.repository, onBack = { navController.popBackStack() }) }
            composable("offline-sync") { OfflineSyncScreen(container.repository, container.connectivityObserver, onBack = { navController.popBackStack() }) }
            composable("admin") { AdminStatusScreen(container.repository, onBack = { navController.popBackStack() }) }
            composable("settings") { SettingsScreen(container, onBack = { navController.popBackStack() }) }
            composable("profile") { ProfileScreen(session, onSignOut, onBack = { navController.popBackStack() }) }
        }
    }
}
