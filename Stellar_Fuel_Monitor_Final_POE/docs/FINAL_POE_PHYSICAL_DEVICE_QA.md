# Final POE Physical Android Device QA

**Device:** ____________________  **Android version:** ______  **Tester:** ____________________  **Date:** __________

Only tick a row after observing it on the physical device.

## Build and launch

- [ ] Install the release/signed APK on the physical Android phone.
- [ ] Fresh launch completes without crash or ANR.
- [ ] App icon and name display correctly on launcher.
- [ ] All primary screens fit the phone width; no text/buttons are clipped.
- [ ] Back navigation is predictable on detail/utility screens.

## Authentication and biometrics

- [ ] Google SSO completes with the configured Firebase project.
- [ ] Microsoft SSO completes if included in the final demo.
- [ ] Existing Firebase session restores correctly after relaunch.
- [ ] Biometric prompt appears after SSO when enabled.
- [ ] Successful fingerprint/face verification unlocks the app.
- [ ] Cancel/retry does not crash or accidentally bypass an available biometric gate.
- [ ] Device without enrolled strong biometric shows a clear fallback message instead of a dead end.
- [ ] Sign out returns to authentication screen.

## Settings and language

- [ ] Dashboard period persists after process restart.
- [ ] Compact cards and data-warning settings persist.
- [ ] Notification preference persists.
- [ ] Biometric setting persists.
- [ ] English renders correctly.
- [ ] Afrikaans applies immediately to navigation/common actions.
- [ ] isiZulu applies immediately to navigation/common actions.
- [ ] Selected language remains after app restart.

## API / database / analytics

- [ ] Administration reports API online.
- [ ] Administration reports MongoDB connected.
- [ ] Dashboard data round-trip succeeds from hosted API.
- [ ] Vehicles list/detail load.
- [ ] Trips and Trip Investigation load.
- [ ] Alerts and Alert Detail load.
- [ ] Reports, Fuel Records and Fuel Estimate load/validate inputs.
- [ ] Invalid input shows an understandable message and does not crash.

## Offline mode and automatic sync

- [ ] Load representative data online first so a response snapshot is cached.
- [ ] Disable Wi-Fi/mobile data.
- [ ] Offline banner appears.
- [ ] Cached supported screens remain usable.
- [ ] Change an alert status/comment while offline.
- [ ] App confirms the update was queued rather than falsely claiming remote success.
- [ ] Offline Sync screen shows the queued action.
- [ ] Re-enable network.
- [ ] WorkManager automatically replays the pending action.
- [ ] Pending count returns to zero.
- [ ] Hosted API/database shows the new alert state.
- [ ] Failed/permanent invalid action is handled without an app crash.

## Firebase Cloud Messaging

- [ ] Android 13+ permission prompt is handled.
- [ ] Device FCM token registers through the custom REST API.
- [ ] Settings → Send real-time test notification returns success.
- [ ] Notification visibly arrives on the phone.
- [ ] Tapping notification opens the app.
- [ ] Changing an alert triggers the real-time alert push path.

## User-defined feature 4 — Evidence Vault

- [ ] Select a JPEG/PNG/WEBP/PDF <=5 MB.
- [ ] Invalid/oversized input is blocked cleanly.
- [ ] Use a valid fleet registration and optional trip ID.
- [ ] Upload succeeds through the hosted REST API.
- [ ] Evidence appears in the app list.
- [ ] Azure Storage shows the uploaded blob.
- [ ] MongoDB shows the evidence metadata record.
- [ ] Administration reports Azure Blob configured.

## User-defined feature 5 — Fleet Watchlist

- [ ] Add an existing registration.
- [ ] Save investigation note and priority.
- [ ] Current km/L, rating and open-alert context display.
- [ ] Restart/reload and confirm persistence from API/MongoDB.
- [ ] Remove the watchlist item successfully.

## Release and regression

- [ ] `npm test` is green in CI.
- [ ] Android unit tests are green in CI.
- [ ] Debug/release builds are green in CI.
- [ ] No credentials/keystores are tracked.
- [ ] Signed release APK installs.
- [ ] Release AAB is generated.
- [ ] Store screenshots captured from real app/device.
- [ ] Final video runbook completed without skipped requirement.
