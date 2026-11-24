# Backend hosting runbook: Azure App Service (Nick)

This is the hosting-specific companion to `FINAL_POE_SETUP.md` (general API configuration) and `docs/NICK_FCM_DEPLOYMENT_HANDOFF.md` (Firebase key handling). It takes the Express API to an HTTPS Azure App Service connected to MongoDB Atlas, Azure Blob Storage and Firebase Cloud Messaging.

> **Secrets rule.** The MongoDB URI, SAS URL, Firebase service-account key and publish profile only go into Azure App Settings and GitHub Secrets. They never go into Git, WhatsApp, the README or a screenshot.

## What's already verified (6 Nov 2026)

The API was run on Nick's machine against the group's real services. It passed 28/28 smoke checks; see `docs/NICK_API_TEST_REPORT.md`.

- **MongoDB Atlas** `stellar_fuel_monitoring`: watchlist save, replay and delete went through Atlas, as did the evidence-record writes and reads, all recorded in `audit_log`. The collections and unique indexes were created on first start.
- **Azure Blob** (`prog7135` / `evidence`): an image was uploaded, downloaded back through the API with a matching SHA-256, then deleted.
- **FCM HTTP v1** (`prog7314-poe-giggle-gang`): Google authenticated the server's service account and rejected only a deliberately fake device token. So the API is enabled and the credentials work. Real delivery still needs a phone token.
- **Not yet verified:** the API running *on* App Service (it currently serves Azure's placeholder page) and receiving a push on a phone.

## 1. App Service settings

Create the app with:
- Runtime **Node 22 LTS** on **Linux**
- Plan **Basic B1** (F1's CPU quota is too small for the analytics warm-up)
- Region South Africa North

In *Settings → Configuration → General settings*:
- **Startup command:** `npm start`
- **HTTPS Only:** On
- **Always On:** On
- **SCM Basic Auth Publishing Credentials:** On (needed for the publish profile)

In *Monitoring → Health check*, set the path to `/api/health`.

*Settings → Environment variables → App settings*:

| Name | Value |
|---|---|
| `MONGODB_URI` / `MONGODB_DB` | Atlas SRV string / `stellar_fuel_monitoring` |
| `JWT_SECRET` | long random string |
| `AUTH_REQUIRED` | `false` (see the auth note in `FINAL_POE_SETUP.md`) |
| `AZURE_BLOB_CONTAINER_SAS_URL` | full container SAS URL (§3) |
| `AZURE_BLOB_CONTAINER_NAME` | `evidence` |
| `BLOB_ALLOW_LOCAL_FALLBACK` | **`false`** |
| `FIREBASE_PROJECT_ID` | `prog7314-poe-giggle-gang` |
| `FIREBASE_SERVICE_ACCOUNT_BASE64` | **the replacement key, entered by Matteo** (§4) |
| `TRUST_PROXY` | `1` (Azure's front end proxies requests; rate limits need the real client IP) |
| `NODE_ENV` | `production` |
| `SCM_DO_BUILD_DURING_DEPLOYMENT` | `false` (the workflow ships the installed `node_modules`) |
| `WEBSITES_CONTAINER_START_TIME_LIMIT` | `600` (analytics caches load before the server listens) |

`PORT` is set by Azure automatically. The Android app sends no `Origin` header, so `CORS_ALLOWED_ORIGINS` only matters for browser clients.

## 2. MongoDB Atlas network access

Add the App Service's *Properties → Outbound IP addresses* **and** *Additional outbound IP addresses* to Atlas *Network Access*. Use a database user with `readWrite` on `stellar_fuel_monitoring` only.

## 3. Azure Blob container SAS

Generate the SAS on the private `evidence` container (*Shared access tokens*) with:
- permissions **Read, Add, Create, Write, Delete, List**
- **HTTPS only**
- an expiry after marking

Read and delete are needed because the API downloads evidence (`GET /api/evidence/:id/file`) and removes it (`DELETE /api/evidence/:id`). `/api/health` shows the account, container and `sasExpiresOn`, but never the signature.

## 4. Firebase key

The key shared in chat (id ending `570b3e`) is being **rotated by Matteo**. It was used only for local verification and must not go onto the host. Matteo generates the replacement and pastes its Base64 straight into `FIREBASE_SERVICE_ACCOUNT_BASE64` on App Service, following `docs/NICK_FCM_DEPLOYMENT_HANDOFF.md`. Once `/api/health` shows `pushNotifications.configured: true` with the new key, he disables and deletes the old one.

## 5. Deploy from GitHub Actions

1. App Service → *Overview* → **Download publish profile**.
2. GitHub → *Settings → Secrets and variables → Actions*:
   - secret **`AZURE_WEBAPP_PUBLISH_PROFILE`** = the publish-profile XML
   - variable **`AZURE_WEBAPP_NAME`** = the App Service name
3. Merge to `main` (or *Actions → Deploy API to Azure → Run workflow*). The job tests the API, zip-deploys it, polls `/api/health` and prints the `finalPoe` block.

## 6. Verify the hosted API

```powershell
$api = "https://prog7314-apf6hdftdxdag9ak.southafricanorth-01.azurewebsites.net/api"
curl.exe -s "$api/health" | ConvertFrom-Json | Select-Object ok, featureVersion, source, mongoConnected, finalPoe | ConvertTo-Json -Depth 5
cd Stellar_Fuel_Monitor_Final_POE\server
npm run smoke:final-poe -- --base $api --keep
```

Expect:
- `source: "mongodb"` and `mongoConnected: true`
- `finalPoe.blobStorage.mode: "azure"`
- `finalPoe.pushNotifications.configured: true`

The smoke test rewrites `docs/NICK_API_TEST_REPORT.md` with the hosted results. Commit that file.

- `--keep` leaves the watchlist row and evidence blob in place for screenshots. Remove them in the app afterwards.
- With Jival's phone: read its FCM token and `deviceId` from the app log, then add `--push-token <token> --device-id <id>`. The push must actually arrive on the phone.

## 7. Evidence checklist (no secrets on screen)

- [ ] Green **Stellar Final POE CI** and **Deploy API to Azure** runs
- [ ] `docs/NICK_API_TEST_REPORT.md` from the hosted run
- [ ] `/api/health` JSON with `finalPoe`; it contains no secrets by design
- [ ] Atlas: rows in `watchlist`, `evidence_records`, `alert_reviews` and `audit_log` after phone actions. **Hide the `token` column of `device_tokens`.**
- [ ] Azure portal: the uploaded blob under `evidence/<REG>/<date>/`. Don't open *Shared access tokens* on screen.
- [ ] The phone receiving the test push and an "Alert Investigating" push after an alert update
- [ ] Firebase console: Cloud Messaging API (V1) *Enabled*, plus the SSO user under Authentication

## 8. Handoff note for Jival (send privately)

> **Live API:** `https://prog7314-apf6hdftdxdag9ak.southafricanorth-01.azurewebsites.net/api` (health: `/api/health`). Demo vehicle **`<REG>`**.
>
> - **Watchlist:** save it with priority, then show `watchlist` in Atlas.
> - **Evidence Vault:** attach a photo to it, then show the blob in the Azure `evidence` container and the row in `evidence_records`.
> - **Alert update:** change an alert's status, then show `alert_reviews` and the push on the phone.
> - **Offline:** with flight mode on, update the alert (it's queued in Offline Sync). Turn flight mode off and WorkManager replays it.
