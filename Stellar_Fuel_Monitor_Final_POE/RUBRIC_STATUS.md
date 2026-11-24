# Part 2 Rubric Status - 18 September 2026

Status meanings:
- **SOURCE READY** - implementation exists in the assessment copy but still needs Android Studio/device verification.
- **VERIFIED** - tested in this conversion environment.
- **REMAINING** - requires group account, cloud, GitHub or physical-device work.

| Part 2 area | Current status | Evidence / next action |
|---|---|---|
| Native Kotlin source | SOURCE READY | `android-app/app/src/main/java/...`; Angular retained only under `legacy-angular-reference/`. |
| Android lifecycle/state logging | SOURCE READY | `MainActivity`, repository, SSO and settings include Android `Log` calls. |
| SSO | SOURCE READY | Google Credential Manager + Firebase and Microsoft Firebase provider implemented. Real Firebase values + device sign-in still required. |
| Settings | SOURCE READY | DataStore-backed preferences implemented and exposed in Compose Settings screen. Device persistence test still required. |
| REST API creation | VERIFIED | Existing Express API retained; all 9 packaged server tests pass and JS syntax checks pass. |
| REST API integration | SOURCE READY | Retrofit/OkHttp/Gson API client, repository and Compose screens are connected to real endpoint contracts. Android build/device round-trip still required. |
| User Defined 1 - Vehicle Fuel Performance | SOURCE READY | Vehicle list/details, historical trend and benchmark presentation implemented. |
| User Defined 2 - Trip/Destination Comparison | SOURCE READY | Full Trip Investigation displays selected benchmark, sample count, scope/confidence, deviation and route context. |
| User Defined 3 - Fuel Anomaly Investigation | SOURCE READY | Alerts + Alert Review + status/comment update flow implemented; hosted update round-trip needs live verification. |
| User Interface | SOURCE READY | Compose navigation and major screens implemented. Physical phone visual QA/polish remaining. |
| Android unit testing | SOURCE READY | `FuelMathTest.kt` exists; CI configured to execute `testDebugUnitTest`. Remote build must confirm dependencies/toolchain. |
| API automated testing | VERIFIED | `npm test`: 9/9 passed on final assessment copy. |
| GitHub Actions | SOURCE READY | `.github/workflows/ci.yml` builds/tests Android and server on push/PR. Requires upload to GitHub and green remote run. |
| README | SOURCE READY | Technical README exists; final screenshots, hosted API details and video URL still need adding. |
| Physical-device run | REMAINING | Must be done by group using Android Studio + SDK 35 and a real Android phone. |
| Demonstration video | REMAINING | Record after physical QA; must include SSO, settings, API/DB proof and custom features. |
| Git commit history/collaboration | REMAINING | ZIP contains source, not Git history. Team must develop/merge through shared GitHub repository. |
| AI Sub-Report | SOURCE READY | `AI_USAGE_PART2.md` draft exists; group must review for accuracy before submission. |

## Conversion QA already completed

- Express/Node test suite: **9 passed, 0 failed**.
- Server JavaScript syntax checks: **passed**.
- Pure Kotlin `FuelMath.kt` compile check with Kotlin compiler: **passed**.
- Android project structure, manifest, Gradle scripts, Compose source, Retrofit contracts and Firebase/DataStore source are present.

## Verification limitation

A full Android APK compile was not possible in the conversion runtime because the Android SDK/Android Gradle dependency toolchain is not installed and external dependency download is unavailable. This is why the first Android Studio compile and physical-device run are explicitly assigned as remaining verification work rather than falsely reported as complete.
