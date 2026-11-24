# Final POE Demonstration Video Runbook

Record the **completed app live on a physical Android phone** with a clear voice-over. Keep the hosted API, Firebase Console, MongoDB view and Azure Storage portal ready on a laptop for verification cutaways.

## Recommended sequence

### 1. Opening and identity (15–20 sec)

State the app name, that it is native Kotlin/Jetpack Compose, and that the phone is a physical Android device. Briefly state that the API is the group's custom hosted Express/MongoDB service.

### 2. SSO + biometric verification

1. Start from signed-out state.
2. Use Google SSO (and show Microsoft option).
3. Show the Firebase Authentication user record on the laptop.
4. Return to the phone and complete the fingerprint/face prompt.
5. Explain that SSO establishes identity and biometrics protects re-entry to the authenticated app.

### 3. Settings + three languages

1. Open Settings.
2. Change a normal preference and explain DataStore persistence.
3. Switch English → Afrikaans and navigate back to show translated common UI.
4. Switch to isiZulu and show another main screen.
5. Return to the preferred final language.

### 4. REST API and database round-trip

1. Open Dashboard, Vehicles and a Vehicle Detail.
2. Open Trips and a Trip Investigation to show the custom analytics/API heavy lifting.
3. Open Alerts and change a real alert while connected.
4. Show the API/network result and then the updated record in MongoDB/back-end evidence.

### 5. Offline mode + synchronisation — must be visually obvious

1. Keep an Alert Detail open.
2. Disable Wi-Fi and mobile data on the phone.
3. Show the offline banner.
4. Update alert status/comment.
5. Show the success message that says the action is **queued offline**.
6. Open More → Offline Sync and show the pending action.
7. Re-enable the network.
8. Wait for WorkManager automatic sync; refresh until pending count is zero.
9. Show the matching update in the hosted API/database.

### 6. Real-time FCM notification

1. Open Settings and confirm notifications are enabled.
2. Tap **Send real-time test notification**.
3. Show the notification arriving on the phone.
4. If possible, change an alert from a second session/device/API and show the live alert notification arriving.
5. Briefly show the registered token/server readiness without exposing the token or service-account secret.

### 7. User-defined feature 4 — Evidence Vault / Azure Blob

1. Open More → Evidence Vault.
2. Choose a small real assessment image or PDF.
3. Enter a valid registration, optional trip and note.
4. Upload.
5. Show the record in the app.
6. On laptop, show the new Azure blob and MongoDB evidence metadata.
7. State that the API validates type/size and the binary object is separated from NoSQL metadata.

### 8. User-defined feature 5 — Fleet Watchlist

1. Open More → Fleet Watchlist.
2. Add a real registration, note and Priority/Critical level.
3. Show current km/L, rating and open alerts.
4. Reload and show persistence.
5. Remove or edit as desired.

### 9. Administration / cloud readiness

Open Administration and show API online, MongoDB connected, Azure Blob configured, Firebase push configured, offline architecture label and supported languages. Do not display secret values.

### 10. GitHub, tests and release readiness

On laptop show:

- repository root and polished `README.md`;
- green GitHub Actions run(s);
- real contributor/commit history;
- `Final-POE` annotated tag;
- signed APK/AAB workflow artefact;
- `play-store/` content and real promotional screenshots.

### 11. Closing

Summarise that the final build is error-free on the physical device and that all Final POE additions integrate with the Part 2 analytics rather than replacing them.

## Recording quality check

- Voice is understandable and explains **why** each feature exists, not only what button is tapped.
- Screen is readable; avoid glare and rapid movement.
- No passwords, private keys, SAS signatures, JWTs, FCM tokens or connection strings are shown.
- All required features are demonstrated, not merely described.
- Use the real final build and real cloud data.
- Upload unlisted and paste the working URL into the root README before submission.
