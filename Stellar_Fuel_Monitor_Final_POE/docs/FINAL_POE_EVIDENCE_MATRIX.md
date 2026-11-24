# Final POE Code and Evidence Matrix

| Assessment capability | Primary Android code | Server/backend code | Runtime evidence |
|---|---|---|---|
| SSO | `auth/AuthManager.kt`, `AuthScreen.kt` | Firebase Authentication | Firebase user + successful phone login |
| Biometrics | `biometric/BiometricAuthenticator.kt`, `BiometricGateScreen.kt`, `StellarRoot.kt` | n/a | Real fingerprint/face prompt |
| Settings | `settings/`, `SettingsScreen.kt` | n/a | Preference survives restart |
| REST API | `network/StellarApi.kt`, `ApiClient.kt`, repository | `server/src/index.js`, analytics modules | Mobile data + API response + DB data |
| Offline/cache | `offline/OfflineStore.kt`, `StellarRepository.kt` | existing alert endpoint | Cached screen while disconnected |
| Auto sync | `OfflineSyncWorker.kt`, `SyncManager.kt` | PATCH `/api/alerts/:id` | Queue before reconnect, DB after reconnect |
| FCM | `notifications/` + Settings | `notifications.js`, notification routes | Real notification arrival |
| Languages | `localization/AppLocalization.kt` | n/a | English/Afrikaans/isiZulu switch |
| Blob storage | `EvidenceVaultScreen.kt` | `blob-storage.js`, evidence routes | App record + Azure blob |
| MongoDB NoSQL | API models/repository | `repository.js` | Mongo collection changes |
| User feature 4 | Evidence Vault screen | Evidence API/blob/meta | Upload + cloud proof |
| User feature 5 | Watchlist screen | Watchlist API/repository | Add/persist/remove |
| Testing | `app/src/test/` | `server/test/` | Green CI run |
| Logging | `Log.*` throughout final flows | server logs/audit | Logcat during demo/QA if requested |
| Play release | Gradle release config + manifests | n/a | Signed APK/AAB + screenshots |
