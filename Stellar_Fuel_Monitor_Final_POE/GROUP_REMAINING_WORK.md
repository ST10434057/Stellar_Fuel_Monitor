# PROG7314 Part 2 - Remaining Work After Kotlin Conversion

## Important context

The assessment copy has already been converted from the Angular/Ionic mobile interface to a native Kotlin / Jetpack Compose Android application. Matteo's allocated SSO and Settings source has also been implemented. The existing Express/Node.js + MongoDB backend has been retained because it already contains the Stellar full-cycle analytics and passed all 9 packaged automated tests during conversion QA.

The remaining work below therefore focuses on **verification, deployment, refinement and submission evidence**, not rebuilding what is already present.

Matteo is not included in this split because his allocated Part 2 coding work has already been completed in the assessment copy. The only unavoidable account-owner step is entering the group's real Firebase/OAuth values before the live SSO test; see `MATTEO_SSO_SETUP.md`.

---

## Jival Ganesh - ST10442123
### Live API deployment, API contract verification and data proof

**Primary goal:** turn the already-working packaged API into the reliable hosted web service that the Android app will demonstrate.

1. Deploy `server/` to the group's approved cloud host and configure environment variables securely.
2. Connect the hosted API to the intended MongoDB database and confirm the packaged cache fallback is not being mistaken for the live database in the final demo.
3. Verify the following endpoints against the Kotlin DTOs and correct any field mismatches found during Android compilation/device testing:
   - `/api/health`
   - `/api/vehicles`
   - `/api/analytics/vehicles/:registration`
   - `/api/dashboard/summary`
   - `/api/analytics/day-trips`
   - `/api/analytics/trips/:id`
   - `/api/alerts`
   - `/api/alerts/:id`
   - `/api/reports/summary`
4. Verify the `PATCH /api/alerts/:id` round-trip so the video can show a real modification passing from phone -> API -> database/data layer -> phone.
5. Tighten production CORS, HTTPS and environment-variable handling for the deployed host.
6. Confirm Google Routes remains optional and fails gracefully if the API key is unavailable.
7. Add API evidence/screenshots and hosted endpoint notes to the README.

**Definition of done:** the physical Android phone can use the hosted HTTPS API, read real Stellar data, update an alert, and the group can visually prove the corresponding backend/database change in the demonstration video.

---

## Julian Lew Morrison - ST10440539
### Android Studio build owner, Compose UI polish and physical-device integration

**Primary goal:** take the converted native Android source through its first full Android Studio compile and make the user experience submission-ready.

1. Open `android-app/` in Android Studio with SDK 35 and perform the first dependency sync/build.
2. Fix any Android/Compose compiler or dependency issues revealed by the real Android toolchain without changing the agreed architecture.
3. Test every converted screen and navigation path:
   - Login
   - Dashboard
   - Vehicles
   - Vehicle Details/Fuel History
   - Trips/Trip Investigation
   - Alerts/Alert Review
   - Reports
   - Fuel records
   - Fuel estimate
   - Admin/API status
   - Settings
   - Profile/logout
4. Polish spacing, typography, card consistency, scrolling, loading, empty and error states.
5. Verify the Vehicle Fuel Performance feature clearly shows current km/L, historical comparison, trend and related evidence.
6. Verify layout on the actual phone size chosen for the assessment and fix clipping/overflow.
7. Capture clean Android screenshots for the README after the final visual pass.

**Definition of done:** the native Android project compiles, installs and runs cleanly on the team's physical Android phone; all major screens are usable and visually consistent.

---

## Nickolas Kelly - ST10442063
### Analytics acceptance testing, destination comparison and anomaly/alert verification

**Primary goal:** prove that the converted Android app presents the Part 1 custom fuel-intelligence rules correctly and that the backend calculations remain credible.

1. Validate representative full fuel cycles against the original Stellar logic and Part 1 requirements.
2. Verify the Trip/Destination Comparison screen shows the correct:
   - current analysed km/L
   - selected historical benchmark
   - sample size
   - benchmark scope/confidence
   - variance/deviation
   - route/destination context
3. Verify data-quality exceptions remain separate from genuine performance anomalies.
4. Verify the Alerts list and Alert Review screens provide understandable evidence instead of accusing a driver.
5. Verify alert status updates and notes after Jival confirms the hosted PATCH round-trip.
6. Add additional automated tests where useful for calculation boundaries/status interpretation, while keeping heavy analytics on the API rather than duplicating it in the phone.
7. Select at least three representative demonstration records in advance: normal/good, poor/review, and a data-quality or contextual case.
8. Document the exact demo values so the group knows what to show in the video.

**Definition of done:** the group can demonstrate Vehicle Fuel Performance, Trip/Destination Comparison and Fuel Anomaly Investigation with known, checked data and explain why each result appears.

---

## Josh Cullen Holmes - ST10322057
### GitHub/CI, testing, final QA, README and demonstration package

**Primary goal:** convert the working source into strong submission evidence for the GitHub, testing, physical-device and video marks.

1. Create/use the shared GitHub repository and commit the source directly - do not upload the ZIP to GitHub.
2. Preserve `.github/workflows/ci.yml` and confirm both jobs pass remotely:
   - native Android unit tests + debug build
   - Express API tests
3. Coordinate a professional commit history with contributions from Jival, Julian and Nickolas; aim for 50+ meaningful total commits before submission rather than artificial one-line spam commits.
4. Expand/coordinate unit tests around the final feature fixes and ensure all tests remain green.
5. Update `README.md` with:
   - app purpose/scope
   - architecture
   - setup instructions
   - screenshots
   - API/DB evidence
   - version-control workflow
   - GitHub Actions explanation
   - final video link
6. Run the final physical-device QA checklist and log every defect until resolved.
7. Coordinate and record the professional Part 2 demonstration video with voice-over showing:
   - real SSO login
   - saved Settings change
   - hosted REST API round-trip
   - visible backend/database/authentication evidence
   - Vehicle Fuel Performance
   - Trip/Destination Comparison
   - Fuel Anomaly/Alert Investigation
8. Confirm the AI Usage write-up remains below 500 words and accurately describes actual AI use.

**Definition of done:** GitHub Actions is green, the README is complete, the app passes the physical-phone test, the repository demonstrates collaboration, and the video covers every Part 2 rubric requirement.

---

## Shared integration order

1. **Jival:** deploy/verify the hosted API and database.
2. **Julian:** complete the first Android Studio compile and device install using the hosted API URL.
3. **Nickolas:** verify analytics/custom-feature outputs against known Stellar records.
4. **Josh:** keep CI/tests/README current while fixes are merged.
5. **All four:** perform one final physical-device regression run.
6. **Josh coordinates:** film the final video only after the regression run passes.

## Work that should NOT distract Part 2

The following remain Final POE features unless the required prototype is already stable:

- biometric authentication
- RoomDB/SQLite offline synchronisation
- Firebase Cloud Messaging push notifications
- full English/Afrikaans localisation
- Play Store production release assets

