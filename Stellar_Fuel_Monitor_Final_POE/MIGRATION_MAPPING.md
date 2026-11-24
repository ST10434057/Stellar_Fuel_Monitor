# Angular -> Native Kotlin migration map

| Legacy Angular area | Native Kotlin destination |
|---|---|
| Login | `AuthScreen.kt` |
| Home dashboard | `DashboardScreen.kt` |
| Fleet | `VehiclesScreen.kt` |
| Vehicle profile / fuel history | `VehicleDetailScreen.kt` |
| Trip analytics | `TripsScreen.kt` |
| Trip investigation | `TripDetailScreen.kt` |
| Alerts | `AlertsScreen.kt` |
| Alert review | `AlertDetailScreen.kt` |
| Reports | `ReportsScreen.kt` |
| Fuel & Oil | `FuelRecordsScreen.kt` |
| Fuel Estimate | `FuelEstimateScreen.kt` |
| Administration | `AdminStatusScreen.kt` |
| Profile | `ProfileScreen` in `ProfileAndMoreScreens.kt` |
| Settings (new assessment requirement) | `SettingsScreen.kt` + DataStore |

The existing Node/Express/MongoDB backend is intentionally preserved because it is already the custom API required by the assessment and contains the heavy full-cycle analytics.
