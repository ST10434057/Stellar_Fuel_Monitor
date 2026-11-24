# Final POE Setup Guide

This guide configures the Final POE without committing secrets. Use a **physical Android phone** for final verification.

## 1. Prerequisites

- Android Studio with Android SDK 35
- JDK 17 for the Android build/CI target
- Node.js 22 + npm
- MongoDB database reachable by the hosted API
- Firebase project with Android app + Authentication + Cloud Messaging
- Google OAuth web client ID for Google SSO
- Microsoft provider configured in Firebase Authentication if Microsoft SSO is demonstrated
- Azure Storage account/container for Evidence Vault
- A hosted HTTPS endpoint for the Express API
- Private Android release keystore for the signed release

## 2. API configuration

From `server/` copy `.env.example` to `.env` and configure at minimum:

```env
PORT=3000
MONGODB_URI=<hosted Mongo connection string>
MONGODB_DB=stellar_fuel_monitoring
CORS_ALLOWED_ORIGINS=<only browser origins you actually use>
GOOGLE_ROUTES_API_KEY=<optional but recommended for route benchmark demo>

FIREBASE_PROJECT_ID=<Firebase project id>
FIREBASE_SERVICE_ACCOUNT_BASE64=<base64-encoded service-account JSON; stored as a private server secret>

AZURE_BLOB_CONTAINER_SAS_URL=<container SAS URL with read/add/create/write/delete/list (sp=racwdl)>
AZURE_BLOB_CONTAINER_NAME=stellar-evidence
BLOB_ALLOW_LOCAL_FALLBACK=false
```

Do not commit `.env`. The Azure SAS should be scoped to the assessment container and granted only the permissions the API requires. Rotate it after the assessment if it is temporary.

Run:

```powershell
cd server
npm ci
npm test
npm run check
npm run verify:analytics -- --quiet
npm start
```

Verify `GET /api/health`. For final evidence, the response should report `mongoConnected: true`, `finalPoe.blobStorage.configured: true` and `finalPoe.pushNotifications.configured: true`.

### API authentication note

The existing server contains optional custom JWT/role middleware controlled by `AUTH_REQUIRED`. The Android assessment client authenticates the user with Firebase SSO and does **not** exchange that Firebase token for the legacy custom JWT. Therefore do not switch `AUTH_REQUIRED=true` unless your group also deliberately wires the API's custom login/token flow into the Android client. This does not affect the required Firebase SSO feature.

## 3. Firebase client configuration

In Firebase Console:

1. Add the Android application package `za.co.stellar.fuelmonitor`.
2. Add SHA-1/SHA-256 fingerprints for the debug and release certificates as required by the authentication providers.
3. Enable Google authentication.
4. Enable/configure Microsoft authentication if it is part of the demo.
5. Enable Firebase Cloud Messaging API v1.
6. Create a service account for the server-side FCM sender; for this updated build, store either `FIREBASE_SERVICE_ACCOUNT_BASE64` (preferred for copy/paste hosting environments) or `FIREBASE_SERVICE_ACCOUNT_JSON` as a private server-host secret. Never add the private key, or its Base64 representation, to Git, Android `local.properties`, or chat.

The app intentionally initialises Firebase from external build configuration rather than committing `google-services.json`.

## 4. Android configuration

From `android-app/`, copy `local.properties.example` to `local.properties`:

```properties
STELLAR_API_BASE_URL=https://<hosted-api>/api/
FIREBASE_API_KEY=<web api key>
FIREBASE_APP_ID=<android app id>
FIREBASE_PROJECT_ID=<project id>
FIREBASE_MESSAGING_SENDER_ID=<project number/sender id>
GOOGLE_WEB_CLIENT_ID=<OAuth web client id>
PLAY_STORE_PRIVACY_URL=https://<real-public-privacy-policy-url>
```

For a local debug-only LAN test you may use an `http://192.168.x.x:3000/api/` URL because `src/debug/AndroidManifest.xml` explicitly enables cleartext for debug. The release manifest blocks cleartext, so the assessed production release must use HTTPS.

## 5. Azure Evidence Vault

Create a dedicated Blob container. Generate a scoped container SAS with read, add, create, write, delete and list permissions (the API also streams evidence back and deletes it), HTTPS only, and an expiry after marking. Set `AZURE_BLOB_CONTAINER_SAS_URL` on the server. In final assessment mode set:

```env
BLOB_ALLOW_LOCAL_FALLBACK=false
```

This ensures a missing Azure configuration becomes visible instead of silently saving evidence to the server filesystem.

## 6. Release signing

Never commit the keystore. You can create one locally with Android Studio's **Generate Signed Bundle / APK** wizard or use `keytool`. Place it outside Git or under ignored `android-app/release/` and add to `local.properties`:

```properties
RELEASE_KEYSTORE_PATH=release/stellar-final-poe.jks
RELEASE_KEYSTORE_PASSWORD=<secret>
RELEASE_KEY_ALIAS=stellar-final-poe
RELEASE_KEY_PASSWORD=<secret>
```

Build:

```powershell
cd android-app
gradle :app:testDebugUnitTest
gradle :app:assembleRelease :app:bundleRelease
```

GitHub Actions can build the signed APK/AAB from GitHub Secrets when a tag beginning `Final-POE` is pushed. See `docs/PLAY_STORE_READINESS.md` for the exact secret names.

## 7. Final physical-phone acceptance

Complete `docs/FINAL_POE_PHYSICAL_DEVICE_QA.md` with the **release** build. Do not mark a row passed based only on source inspection. Capture screenshots and cloud-console/database evidence while the real services are connected.
