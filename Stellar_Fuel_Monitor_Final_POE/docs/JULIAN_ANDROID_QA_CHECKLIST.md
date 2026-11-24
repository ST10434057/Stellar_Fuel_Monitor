# Julian Android build and physical-device QA

This checklist records the final manual work that must be completed in Android Studio and on the assessment phone. The source has already received a responsive UI pass, explicit back navigation, improved loading/empty/error states and a clearer Vehicle Fuel Performance presentation.

## First Android Studio build

- [✓] Open `android-app/`, not the repository root.
- [✓ ] Select JDK 17 as the Gradle JDK.
- [✓ ] Install Android SDK Platform 35 and current SDK build/platform tools.
- [✓ ] Copy `local.properties.example` to `local.properties` without committing it.
- [ ✓] Set `STELLAR_API_BASE_URL` to the hosted API or the PC LAN address ending in `/api/`.
- [ ✓] Enter the real Firebase and Google OAuth values before testing live SSO.
- [ ✓] Sync Gradle without upgrading the pinned dependencies.
- [ ✓] Run `:app:testDebugUnitTest`.
- [✓ ] Run `:app:assembleDebug`.
- [ ✓] Record and fix the first real compiler error before dealing with follow-on errors.

The assessment project is pinned to Gradle 8.10.2, Android Gradle Plugin 8.7.3, Kotlin 2.0.21, JDK 17 and compile SDK 35. Run `powershell -ExecutionPolicy Bypass -File .\setup-gradle-wrapper.ps1` once in `android-app/` to download Gradle 8.10.2 and generate the standard wrapper.

## API connection check

- [✓ ] Start `server/` with `npm ci`, `npm test` and `npm start`.
- [✓ ] Confirm all 9 server tests pass.
- [ ] From the phone browser, open `http://<PC-LAN-IP>:3000/api/health` or the hosted HTTPS health endpoint.
- [ ✓] For local prototype testing, keep `AUTH_REQUIRED=false`; the Android client does not yet exchange its Firebase token for the server JWT.
- [ ✓] Allow Node.js through the Windows private-network firewall if the phone cannot connect.

## Screen regression

| Screen | Required result | Pass |
|---|---|---|
| Login | Google SSO opens; cancel and error states are understandable | [ ] |
| Session | Closing and reopening restores the Firebase session | [ ] |
| Dashboard | KPI cards fit, dashboard scrolls and alert/trip links open | [ ] |
| Vehicles | Search works and empty search results are clear | [ ] |
| Vehicle Fuel Performance | Current km/L, median, deviation, expected band and trend display | [ ] |
| Historical cycles | Route, dates, km/L, benchmark, deviation and rating display | [ ] |
| Trips | Search works and a selected trip opens | [ ] |
| Trip Investigation | Benchmark, distance, load, flags and evidence display | [ ] |
| Alerts | Alert list loads and empty state is clear | [ ] |
| Alert Review | Notes and each status update save successfully | [ ] |
| Reports | All cards fit on the assessment phone | [ ] |
| Fuel records | Records scroll and an empty API result is handled | [ ] |
| Fuel estimate | Keyboard does not hide fields; valid calculation returns a result | [ ] |
| Administration | API, database and analytics settings display | [ ] |
| Settings | Preferences remain saved after leaving/reopening the screen | [ ] |
| Profile | User details display and Sign out returns to Login | [ ] |

## Vehicle Fuel Performance evidence

Choose one vehicle with at least five completed cycles and record its registration here: `________________`.

- [✓ ] Compare current km/L against `GET /api/analytics/vehicles/{registration}`.
- [✓ ] Compare historical median and expected low/high band against the same response.
- [✓ ] Confirm “Latest vs benchmark” matches the latest trip's API `deviationPct`.
- [✓ ] Confirm the trend order and values match the ten latest completed cycles.
- [✓ ] Open a historical cycle and confirm its Trip Investigation evidence matches the API.
- [✓ ] Test a vehicle with null/missing values and confirm the screen displays `—` without crashing.
- [✓ ] Stop the API, confirm the error card appears, restart it and confirm Retry succeeds.

## Physical phone (not done yet)

- [ ] Enable Developer options and USB debugging.
- [ ] Connect with a data-capable USB cable and accept the RSA prompt.
- [ ] Confirm `adb devices` lists the phone as `device`, not `unauthorized`.
- [ ] Install/run the debug app from Android Studio.
- [ ] Test portrait layout at the phone's normal and largest font setting.
- [ ] Rotate key screens and confirm no clipping or crashes.
- [ ] Confirm every detail page has a working back arrow and Android system Back also works.
- [ ] Capture clean screenshots of Dashboard, Vehicle Fuel Performance, Trip Investigation, Alert Review, Settings and Administration.

## Definition of done

- [ ✓] Android unit tests pass.
- [ ] Debug APK builds and installs.
- [ ] All rows above pass on the actual assessment phone.
- [ ] Real SSO and logout pass.
- [ ] Hosted API read and alert-update round trips pass.
- [ ] Screenshots and known demonstration records are added to the README.
