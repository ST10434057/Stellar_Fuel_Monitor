# Nick — outstanding evidence and issue register

Do not label an item complete until it has an actual linked screenshot or test result.

| Item | Owner | Current status | Evidence needed |
|---|---|---|---|
| FCM project identity from uploaded JSON | Matteo | Verified locally | Project ID shown in handover; not key contents |
| Key format + RSA signature + code parse | Matteo | Verified, including online (6 Nov): Google issued an OAuth token for the key | Local validation record; not real FCM delivery |
| Replacement of uploaded service-account key | Matteo | Pending | Owner confirms old key disabled/deleted after new key works |
| Cloud Messaging API v1 enabled | Matteo / Nick | **Verified via API (6 Nov).** FCM authenticated the server and rejected only a deliberately fake token ("not a valid FCM registration token"); see `docs/NICK_API_TEST_REPORT.md` | Firebase console screenshot still to capture |
| Backend host secrets configured | Matteo / Nick | Pending | Screenshot showing names (values hidden) |
| Cloud HTTPS URL deploy | Nick | Pending. App Service `prog7314-apf6hdftdxdag9ak.southafricanorth-01.azurewebsites.net` exists but serves Azure's placeholder page; the deploy workflow and runbook (`docs/NICK_BACKEND_CLOUD_SETUP.md`) are ready | URL and deploy run ID |
| Backend `npm ci`, tests, CI green | Nick | **Local (6 Nov):** `npm ci`, `npm run check` (36 files), `npm test` 52/52, analytics verification all PASS, `npm audit` 0 vulnerabilities. CI pending the first push (workflow now at the repo root) | Link and logs |
| MongoDB connected and CRUD persisted | Nick | **Verified against Atlas with the API running locally (6 Nov):** watchlist save, replay and delete plus evidence-record write, read and delete, recorded in `audit_log`. Hosted run pending | API and DB screenshots |
| Azure blob upload and metadata | Nick | **Verified against `prog7135/evidence` with the API running locally (6 Nov):** upload, then download with SHA-256 match, then delete. Hosted run pending | Blob and MongoDB screenshots |
| Android Firebase config matches project | Matteo / Jival | **Blocked.** Firebase Authentication isn't initialised in `prog7314-poe-giggle-gang` (the Admin SDK returns `auth/configuration-not-found`). Enable Authentication + the Google provider in this project, or confirm which project the app's SSO uses. It must be the same project as FCM | Safe Firebase project settings confirmation |
| FCM phone registration and receipt | Nick + Jival | Pending | Physical-phone video and redacted responses |
| API auth & test endpoint security review | Nick + Matteo | Partly addressed: input validation, rate limits on the test push and uploads, dead-token pruning, key/SAS redaction in `/api/health`, magic-byte evidence checks. **Still open:** endpoints accept unauthenticated calls, because the Android `AppContainer` sends no token (`tokenProvider = { null }`) | Decision, patch and regression results |
| Josh QA confirmation | Josh | Pending | Test matrix / defect log |
| Julian written evidence | Julian | Pending | README/technical report updated with proven evidence |

## Handoff template (Nick fills)
- GitHub repo URL: https://github.com/EMGPSD/prog7314-g4-2026-prog7314-poe-giggle-gang
- Branch / commit SHA: `nick/final-poe-integration` (not pushed yet)
- CI run URL / result:
- Backend HTTPS base URL: https://prog7314-apf6hdftdxdag9ak.southafricanorth-01.azurewebsites.net/api (API not deployed yet)
- Firebase Cloud Messaging API v1 confirmed enabled (yes/no + screenshot): yes, via the API on 6 Nov; console screenshot pending
- `GET /api/health` status (timestamp, redacted JSON):
- MongoDB write/read proof:
- Azure Blob object + MongoDB metadata proof:
- Physical Android FCM push receipt proof:
- Auth/security outstanding problems:
- Remaining blocker and owner:
