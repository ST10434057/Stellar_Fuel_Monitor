# Deployment-ready configuration - Task 2

CI validates server install/tests/syntax and Angular production build. No credentials are embedded.

Required deployment environment values: `MONGODB_URI`, `MONGODB_DB`, a long random `JWT_SECRET`, `JWT_EXPIRESIN`, `CORS_ALLOWED_ORIGINS`, and (when approved) `GOOGLE_ROUTES_API_KEY`. Set `AUTH_REQUIRED=true` only after users/roles and frontend bearer-token flow are verified in the target environment. Configure `GOOGLE_ROUTES_ORIGIN` to Stellar's approved dispatch/depot address.

Google Routes is a DRIVE road-route distance benchmark only. It does not certify heavy-truck legality, permits, height/weight restrictions, safety, site access, or dispatch suitability.
