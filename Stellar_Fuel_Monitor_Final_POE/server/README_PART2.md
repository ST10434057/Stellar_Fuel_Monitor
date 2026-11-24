# Stellar Express API — Part 2 backend

This is the current backend extracted from the supplied latest Stellar ZIP. It is kept as the custom REST API for the native Kotlin assessment app.

## Verification completed during conversion

- `npm test`: 9/9 tests passed.
- API started successfully without MongoDB by using the packaged latest-database-cache fallback.
- Representative endpoints returned data:
  - `/api/health`
  - `/api/vehicles`
  - `/api/dashboard/summary`
  - `/api/alerts`
  - `/api/reports/summary`

## Production/assessment setup

Copy `.env.example` to `.env`, set a strong `JWT_SECRET`, configure MongoDB if available, and configure CORS/hosting as required.

`AUTH_REQUIRED=false` is the packaged prototype default. If the group enables server-side JWT enforcement, Jival must add/verify an SSO-to-API token exchange or compatible authentication mechanism before submission.
