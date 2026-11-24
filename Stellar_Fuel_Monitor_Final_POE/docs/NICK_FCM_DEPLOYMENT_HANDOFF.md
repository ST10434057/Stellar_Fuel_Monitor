# Firebase Cloud Messaging handover — Nick and Matteo

## Confirmed NON-secret project information
- Firebase project ID: **`prog7314-poe-giggle-gang`** (from the service-account JSON supplied by Matteo).
- The JSON passed an offline parse, RSA private-key sign/verify check and the backend's `pushStatus()` parsing check on 6 Nov 2026.
- **No private key, private key identifier, service-account Base64, or OAuth token is included in this repository/ZIP.**

## Security: rotate the already uploaded key
The first key was shared into a chat as a source file. Before relying on it in production, have the project owner generate a replacement credential, deploy the replacement, disable the old key to verify nothing depends on it, then delete the old key through Google Cloud IAM. You can use workload identity or a managed identity instead where supported. Never share the replacement credential with Nick through WhatsApp or store it in Git.

## Matteo's one-time Firebase tasks
1. Sign into https://console.firebase.google.com/ with the Google account that owns the app's Firebase project, and open **`prog7314-poe-giggle-gang`**.
2. Under **Project settings > General**, verify the Android app for package `za.co.stellar.fuelmonitor` is registered in the SAME project. Read its **API key**, **Firebase Android App ID**, **project ID** and **sender ID**, plus the Google OAuth **Web client ID** used by SSO. These go in a PRIVATE `android-app/local.properties` on the Android build machine, NOT the Firebase Admin SDK JSON.
3. Under **Project settings > Cloud Messaging**, verify **Firebase Cloud Messaging API (V1)** is enabled. Record a screenshot of its enabled status without exposing credentials.
4. Under **Project settings > Service accounts**, generate a **new** server-side private key if the host cannot use workload identity. Keep the replacement JSON on a private machine, e.g., `C:\secrets\stellar-firebase-adminsdk.json`. The previous key sent in the chat should be retired after replacement.
5. Ask Nick where the backend is hosted. A project administrator should enter the secret directly into the hosting provider's encrypted environment/secrets UI. If Nick controls the host, grant restricted host access to Matteo to enter it privately, or have an authorised admin handle it without forwarding the file.

## Copy-only conversion (the owner runs on Windows)
From PowerShell at the extracted project root:
```powershell
.\tools\copy-firebase-base64-secret.ps1 -KeyPath 'C:\secrets\stellar-firebase-adminsdk.json'
```
The helper copies a Base64 version into the clipboard without printing it. Base64 is NOT encryption. Paste into **private host environment settings only**:

| Backend environment name | Value/owner |
|---|---|
| `FIREBASE_PROJECT_ID` | `prog7314-poe-giggle-gang` (non-secret) |
| `FIREBASE_SERVICE_ACCOUNT_BASE64` | Paste replacement credential's Base64 ONLY into private hosting secret manager (Matteo/admin) |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Leave blank if using the Base64 option |

Restart/redeploy host after saving. Clear clipboard using `Set-Clipboard -Value ''`. The Admin SDK JSON does NOT go into the Android app and does NOT belong in `local.properties`.

## Nick's backend sequence
1. Start with the updated project folder in this ZIP; it supports both Base64 and raw JSON in `server/src/notifications.js` (not both at once).
2. In `server`, run:
```bash
npm ci
npm run check
npm test
npm run verify:analytics -- --quiet
```
3. Merge to GitHub via normal commits. Confirm GitHub Actions passes Android build/tests and backend tests.
4. Deploy the API via HTTPS, with all service secrets configured on the hosting dashboard.
5. `GET https://YOUR_REAL_HOST/api/health`: verify `finalPoe.pushNotifications.configured` is `true` and `finalPoe.pushNotifications.projectId` is `prog7314-poe-giggle-gang`. These fields only prove configuration has been parsed.
6. On an actual Android phone configured for the SAME Firebase project, sign in and grant notification permission. Confirm `POST /api/notifications/register` occurs.
7. Trigger an in-app test notification and verify the phone receives it; `POST /api/notifications/test` should return `sent` > 0 and `failed` == 0. Record screen/phone timestamp, successful response with token values redacted, and log snippet without secrets.
8. Update an actual alert and prove push delivery after the change. Check MongoDB registration and alert-review collections where available.

## Common failure modes
- `pushNotifications.configured: false`: host env variables absent/invalid or stale deployment; confirm variables exist by NAME only.
- 401 / 403 on send: verify project, API v1 enablement, service account access, and that an old/deleted key isn't being used.
- 404 `No registered device token`: Android not configured, no FCM token, no registration, incorrect `deviceId`, or API mismatch.
- `sent: 1` but nothing arrives: phone permission, device connectivity, Android package/project mismatch, token validity, background/foreground behavior, notification channel.
- Release build cannot connect: production requires HTTPS; verify correct `STELLAR_API_BASE_URL` ending in `/api/`.

## Security review still required before public deployment
Existing code currently allows some FCM routes without JWT enforcement, and `server/.env.example` has `AUTH_REQUIRED=false`. Tightening backend auth requires matching Android token flows and regression testing. Don't claim production-secure access control until Nick and Matteo confirm that together.

## Official references
- https://firebase.google.com/docs/cloud-messaging/send/v1-api
- https://firebase.google.com/docs/cloud-messaging/server-environment
- https://cloud.google.com/docs/iam/docs/keys-create-delete
