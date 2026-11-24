# Stellar Fuel Analytics - Task 2 V23 cumulative update

This update preserves V17-V22.1 full-cycle analytics, weighted green-row evidence, model+route historical benchmarking, detailed Trip Investigation, Monthly Fuel History and the working launcher.

## Added
- Server-side Google Routes API `DRIVE` distance benchmark, API key from environment only, 30-day configurable disk cache, no-key/provider-error fallback, multi-stop safeguard, actual-vs-road variance and explicit heavy-truck disclaimer.
- Restrictive configurable CORS, Helmet headers, smaller JSON body limit, control-character/prototype-pollution input hygiene, API/auth rate limiting, role-aware JWT structure, configurable protected sensitive routes, safe error responses and JSONL mutation audit logging.
- Node automated tests for full-cycle weighted fuel maths, historical weighted benchmark, route variance, Google fallback/round trip, authentication and role authorization.
- GitHub Actions CI for server `npm ci/test/check`, Angular `npm ci/build`, plus credential-free deployment readiness.
- Responsive Trip Investigation presentation of the Google road benchmark and disclaimer.

## Security rollout note
`AUTH_REQUIRED` defaults to `false` so the current working prototype is not locked out by a partial authentication rollout. Before production, create/verify authorised users and roles, verify the Angular bearer-token flow, then set `AUTH_REQUIRED=true`. Sensitive mutation/admin routes are already wired to role middleware when enabled.

## Rubric evidence mapping
Security: `server/src/security/middleware.js`, auth routes, `.env.example`.
Testing: `server/test/*.test.js`.
CI/CD: `.github/workflows/ci.yml`, `DEPLOYMENT_TASK2.md`.
External service integration: `server/src/google-routes.js` and Trip Investigation UI.
Analytics: preserved `server/src/cycle-analytics.js` V20 model+route/full-cycle engine.
