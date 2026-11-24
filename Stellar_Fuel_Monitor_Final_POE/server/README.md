# Stellar Fuel Analytics API — Final POE

Express.js REST API used by the native Kotlin application. The service owns the heavy fuel/trip analytics and persists operational/Final POE records in MongoDB when configured.

Final POE additions include:

- Firebase Cloud Messaging registration/test/broadcast endpoints;
- Azure Blob Evidence Vault uploads with MongoDB metadata (magic-byte validated; files can be streamed back with `GET /api/evidence/:id/file` and removed with `DELETE /api/evidence/:id`);
- Fleet Watchlist persistence;
- Final POE readiness data on `/api/health`;
- hardened production 5xx responses and existing rate-limit/audit controls.

Setup is documented in the repository root `FINAL_POE_SETUP.md`. Copy `.env.example` to `.env`; never commit the real file.

```bash
npm ci
npm run check
npm test
npm run verify:analytics -- --quiet
npm start
```

Against a running API (local or hosted), the end-to-end check writes `../docs/NICK_API_TEST_REPORT.md`:

```bash
npm run smoke:final-poe -- --base https://<host>/api
```

Hosting on Azure App Service: `../docs/NICK_BACKEND_CLOUD_SETUP.md`.
