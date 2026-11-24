# Firebase FCM setup for Matteo and Nick — Final POE

## What has and has not been configured

- This handover fixes the mismatch between Nick's requested `FIREBASE_SERVICE_ACCOUNT_BASE64` and the previous backend, which accepted only `FIREBASE_SERVICE_ACCOUNT_JSON`.
- Code is prepared to accept either server-side environment variable; nothing has been enabled in your actual Firebase or hosting account.
- To use real FCM, a project administrator must enable the API and configure a service account through Firebase Console (or connect an authorised integration).

## 1. Matteo: use the EXISTING Firebase project

1. Open https://console.firebase.google.com/ and sign in with the Google account that owns the Firebase project used by the Android app's existing SSO.
2. In **Project settings > General**, confirm the **Project ID** matches `FIREBASE_PROJECT_ID` in the Android app's private `android-app/local.properties`. Confirm the Android package is `za.co.stellar.fuelmonitor` and the Android app ID is correct. Do not create a second Firebase project.
3. Go to **Project settings > Cloud Messaging** and check **Firebase Cloud Messaging API (V1)** is enabled. If not, follow the console prompt to enable it in Google Cloud.
4. In **Project settings > Service accounts**, select an appropriate server-side service account and **Generate new private key**, if a key is necessary for your host. Download the JSON to a private folder on YOUR computer, e.g. `C:\secrets\stellar-firebase-adminsdk.json`. Treat it as a password.
5. The code's server-side signing implementation uses `client_email`, `private_key`, and `project_id` from this JSON. Project ID must correspond to the existing Android Firebase project.

**Security:** Keep your service-account JSON out of GitHub, out of the Android APK/`local.properties`, out of WhatsApp, and out of this chat. If it leaks, revoke the key in Google Cloud IAM immediately. A hosted workload identity is preferred over long-lived service account keys when supported.

## 2. Matteo: convert private JSON to Base64 on YOUR PC

From PowerShell in the project directory:

```powershell
.\tools\copy-firebase-base64-secret.ps1 -KeyPath 'C:\secrets\stellar-firebase-adminsdk.json'
```

This validates the JSON and copies the Base64 value to your Windows clipboard *without printing it*. Base64 is NOT encrypted: don't paste it in group messages or commit it. Paste only into the backend hosting provider's private environment-variable/secret UI as `FIREBASE_SERVICE_ACCOUNT_BASE64`. Clear clipboard after pasting using `Set-Clipboard -Value ''` (Windows clipboard history may need manual clearing).

Set `FIREBASE_PROJECT_ID` to the same Firebase Project ID in the server's environment. Do not populate `FIREBASE_SERVICE_ACCOUNT_JSON` at the same time. The server needs a fresh deployment/restart for changed environment variables to apply.

## 3. Nick: verify backend and device

1. Pull/merge this updated backend, so the Base64 variable is recognised.
2. Confirm `GET https://YOUR_API_HOST/api/health` reports `finalPoe.pushNotifications.configured: true`.
3. Run `cd server; npm test` and confirm the FCM configuration tests pass. The API's health check verifies *configuration only*, not actual push delivery.
4. Sign in on a physical Android phone and grant Android's notification permission. Confirm the phone registers an FCM token through the app's backend registration API.
5. Send a real test notification from the app/admin test control and observe it arrive on the phone. Record a timestamped screenshot and an API log excerpt WITHOUT bearer tokens, FCM registration tokens, or service account key.
6. If delivery fails, check Cloud Messaging API v1 is enabled, permission to send FCM messages, project ID, Android application Firebase project, network connectivity, and backend logs.

## 4. What to send the team

- Non-secret Firebase Project ID and confirmation that FCM v1 is enabled.
- Green CI/backend tests, redacted `/api/health` response, a screenshot of a successful physical-phone push and the backend environment-variable NAME (not its value).
- Never send any service-account JSON or Base64 string to Nick via WhatsApp. If Nick controls the hosting platform, have him grant you temporary access to enter the secret in its secure settings, or ask him to generate/store the key himself through his own authorised admin access.

## References

- Firebase FCM HTTP v1: https://firebase.google.com/docs/cloud-messaging/send/v1-api
- FCM server environment: https://firebase.google.com/docs/cloud-messaging/server-environment
- Google Cloud ADC best practices: https://cloud.google.com/docs/authentication
