# Nick — Backend, cloud and CI test script

## Before tests
- Use the existing group repository and merge changes; do not upload a ZIP to GitHub.
- Verify your backend hosting HTTPS URL and runtime environment. Avoid publishing passwords, SAS URLs or credentials.
- Ensure the Android app's OAuth/Firebase project matches the server Firebase project.

## Local / GitHub Actions
From `server`:
```bash
npm ci
npm run check
npm test
npm run verify:analytics -- --quiet
```
Record timestamped actual output (passing/failing counts, runtime, commit SHA), not estimated results. The system is built to run tests on every push in `.github/workflows/ci.yml`; review the real workflow results in GitHub.

## MongoDB
1. Configure `MONGODB_URI` and `MONGODB_DB` privately on the API host.
2. Confirm `/api/health`'s database readiness fields are correct; a DB connection is not proof that data writes work.
3. Create or edit a test fleet-watchlist record using the application or API. Read it back from API and MongoDB. Repeat for an alert review and Evidence Vault metadata.
4. Capture before/after screenshots of the relevant collections; redact usernames, connection strings, identifiers that should not be shown.
5. Restart the API and confirm records persist.

## Azure Blob Storage — evidence files
1. Create a private blob container with limited access. Configure `AZURE_BLOB_CONTAINER_SAS_URL` in host environment (never in Git).
2. Set `BLOB_ALLOW_LOCAL_FALLBACK=false` on the assessment cloud deployment to prevent locally stored files being mistaken for Azure success.
3. Upload a small JPG/PNG/PDF from the app, linked to a trip or vehicle. Confirm an HTTP success, blob exists in Azure, and MongoDB metadata references it.
4. Read evidence record back from API and test a missing/invalid input with graceful errors. Capture Azure blob screenshot and MongoDB record without the SAS query string.

## Firebase Cloud Messaging
- Confirm FCM HTTP v1 enabled and private host credentials loaded; see `NICK_FCM_DEPLOYMENT_HANDOFF.md`.
- Register Android FCM token, verify device registration exists, request test send, verify actual receipt on physical Android phone.
- Demonstrate an alert update causes real-time push, not merely HTTP 200 or configured=true.
- Save anonymised test proof for Julian's README and Jival's voice-over video.

## API / stability / security
- Check `/api/health` over HTTPS.
- Test expected success paths AND error paths (missing token, unsupported evidence file, network failure, offline sync replay).
- Do not enable `AUTH_REQUIRED=true` blindly: the Android `AppContainer` currently creates an API client without a JWT. Agree on token propagation and auth tests with Matteo first.
- Existing FCM routes need a deliberate access-control review before a publicly exposed release. Never disclose access tokens or the Firebase service account.
- Coordinate device testing with Josh and Jival, and send only anonymised proof to Julian.

## Evidence to supply the group
- Final backend URL (non-secret), GitHub branch/commit, successful CI run URL, test outputs.
- Redacted `/api/health` screenshot or JSON.
- MongoDB before/after screenshot and relevant API response.
- Azure blob screenshot paired with a MongoDB evidence metadata entry.
- FCM v1 enabled screenshot, API `sent>0` response, and actual phone receipt.
- Any open defects with severity, reproduction and assigned owner.
