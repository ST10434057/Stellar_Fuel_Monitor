# Server QA Results

Date: 18 September 2026

The final Part 2 assessment copy retained the group's existing Express/Node.js analytics API rather than replacing tested fuel logic during the Android migration.

## Automated test result

Command:

```text
npm test
```

Result:

```text
9 tests passed
0 failed
```

Covered areas include:

- Google Routes graceful fallback without an API key
- road-route variance calculation
- full-cycle weighted fuel calculation
- proportional weighting of short poor segments
- model + route benchmark aggregation
- distance variance calculation
- missing-token rejection
- signed-token + role permission acceptance
- unauthorised role rejection

## Syntax verification

`node --check` passed for the server entry point and all JavaScript/MJS files under `src`, `scripts` and `test`.

## Android-side pure Kotlin check

`FuelMath.kt` was compiled independently with the available Kotlin compiler to verify its pure-Kotlin syntax. Full Android/Compose compilation still requires Android Studio/SDK and the Gradle dependencies described in `ANDROID_BUILD_FIRST_RUN.md`.

## Representative endpoint smoke test

The final packaged server was started with authentication disabled for local prototype QA and with MongoDB unavailable so the packaged cache fallback was exercised deliberately. The following returned HTTP 200 and valid JSON:

- `/api/health`
- `/api/vehicles?limit=2`
- `/api/dashboard/summary`
- `/api/alerts?limit=2`
- `/api/reports/summary`

The startup log reported the latest packaged data-cache source and loaded the precomputed analytics successfully. This confirms the fallback demo data path is functional; it does not replace the group's required hosted API/database verification before submission.
