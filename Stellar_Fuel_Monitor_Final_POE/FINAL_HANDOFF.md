# Final Part 2 Handoff

Date: 18 September 2026

This folder is the separate PROG7314 Part 2 assessment copy of the Stellar Fuel Monitor project. The original uploaded Stellar ZIP was not overwritten.

## Assessment architecture

Native Kotlin / Jetpack Compose Android app -> Retrofit/HTTPS -> existing Express/Node.js REST API -> MongoDB (with packaged cache fallback for local verification).

The legacy Angular front end is retained under `legacy-angular-reference/` only as a migration reference. The Part 2 mobile submission is `android-app/`.

## Matteo allocation already implemented in source

- Firebase-backed Google SSO architecture using Android Credential Manager
- Microsoft SSO through Firebase OAuth Provider
- session restoration and logout
- authentication error/lifecycle logging
- persistent Settings using Android DataStore
- saved dashboard period, notification preference, compact-card preference, data-warning visibility and language preference

Real Firebase/OAuth credentials are intentionally not embedded. Follow `MATTEO_SSO_SETUP.md`.

## Conversion QA completed

- Express/Node automated tests: 9 passed, 0 failed
- server JS/MJS syntax checks: passed
- pure Kotlin `FuelMath.kt` compile check: passed
- API launched using packaged fallback data and representative endpoints returned valid responses:
  - `/api/health`
  - `/api/vehicles`
  - `/api/dashboard/summary`
  - `/api/alerts`
  - `/api/reports/summary`

## Required first real Android verification

A full Android APK compile cannot be certified from this packaging environment because the Android SDK/AGP dependencies are not installed here. The group must therefore:

1. Open `android-app/` in Android Studio.
2. Copy `local.properties.example` to `local.properties`.
3. enter the real Firebase/OAuth values and API base URL.
4. sync/build with SDK 35.
5. resolve any toolchain-specific compile issue if Android Studio reports one.
6. run the app on a physical Android device.
7. test the hosted API round-trip and all Part 2 workflows.

See `ANDROID_BUILD_FIRST_RUN.md`, `RUBRIC_STATUS.md`, and `GROUP_REMAINING_WORK.md`.

## GitHub submission note

Do not upload this ZIP to GitHub as one file. Extract it and commit the source through the shared repository so the assessment shows meaningful collaboration and commit history.
