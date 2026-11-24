# Stellar Fuel Monitor — Final POE Release Notes

## Release

**Version:** 3.0-final-poe  
**Android versionCode:** 3  
**Release tag:** `Final-POE` (annotated tag message: `Final POE`)

## Final POE additions since Part 2

### Security and authentication

- Retained Firebase Google and Microsoft SSO.
- Added AndroidX biometric authentication using `BiometricPrompt` after a successful SSO session.
- Added capability/error handling for unavailable or unenrolled biometrics.
- Added biometric preference persistence in DataStore.
- Release builds block cleartext HTTP; debug builds retain an explicit LAN-development exception only.
- Release keystore paths/passwords are external configuration and are ignored by Git.

### Offline mode and synchronisation

- Added local SQLite storage for cached API responses and pending offline mutations.
- Added offline-capable alert status/comment updates.
- Added WorkManager replay with a connected-network constraint.
- Added connectivity observation and automatic scheduling when validated network access returns.
- Added an Offline Sync diagnostics screen with pending queue count, attempts/errors and manual sync.
- Added an app-wide offline banner.

### Real-time notifications

- Added Firebase Messaging client support and notification channel creation.
- Added Android 13+ notification permission handling.
- Added device-token registration/unregistration REST endpoints.
- Added server-side FCM HTTP v1 message delivery using short-lived OAuth tokens.
- Alert changes can broadcast live push updates without rolling back the database update if push delivery fails.
- Added a Settings test-notification action for demonstration evidence.

### Localisation

- Added English, Afrikaans and isiZulu selection.
- Language choice persists in DataStore and applies immediately to primary navigation, actions and common labels.
- Added localisation unit tests and safe fallback for untranslated fleet/business values.

### User-defined feature 4 — Evidence Vault

- Added file picker, registration/trip association and notes.
- Added image/PDF validation and 5 MB size limit.
- Added Azure Blob Storage upload support.
- Added MongoDB evidence metadata persistence and list endpoint.
- Added developer-only local fallback that can be disabled for production assessment.

### User-defined feature 5 — Fleet Watchlist

- Added persistent investigation watchlist.
- Added Monitor / Priority / Critical priorities and investigation notes.
- Added live enrichment with current km/L, fuel rating and open alerts.
- Added create/list/delete API endpoints and mobile UI.

### UI / quality / operations

- Added Administration readiness reporting for MongoDB, Azure Blob, FCM, offline mode and languages.
- Added final launcher/adaptive icon resources and notification icon.
- Added professional final README, release/setup/QA/video/store documentation.
- Added release minification/resource shrinking and signed APK/AAB workflow.
- Expanded Android API-contract and final-service tests.
- Added CI repository structure, secret and Android logging checks.
- Added explicit server production 5xx error masking.

## Evidence still requiring the team's real environment

The source code cannot create truthful assessment evidence for a physical phone, real cloud credentials, Play Console screenshots, GitHub contributor history, or a voice-over video. Follow the physical-device, video and Play Store checklists and insert the final demonstration URL into `README.md` before submission.
