# QA_SIGNOFF.md - Stellar Fuel Monitor (PROG7314 Final POE)

**QA lead:** Josh Holmes
**Overall status:**  **SIGNED OFF - Testing successfully executed on physical device.**

## 1. Tested build

| Field | Value |
| APK type (debug / signed release) | Signed Release APK |
| Device & Android version | [Samsung A26] |
| Test period (2026/11/06) |
| Testers | Josh Holmes, Jival (device), Matteo/Nick (support) |

## 2. Results summary 

| Area | Tests | Pass | Fail | Blocked | Not run |
| Authentication (SSO) | 7 | 7 | 0 | 0 | 0 |
| Biometrics | 7 | 7 | 0 | 0 | 0 |
| Settings | 5 | 5 | 0 | 0 | 0 |
| Languages | 7 | 7 | 0 | 0 | 0 |
| REST API / DB | 10 | 10 | 0 | 0 | 0 |
| Offline & sync | 10 | 10 | 0 | 0 | 0 |
| Push (FCM) | 6 | 6 | 0 | 0 | 0 |
| Evidence Vault | 8 | 8 | 0 | 0 | 0 |
| Fleet Watchlist | 7 | 7 | 0 | 0 | 0 |
| Core regression | 10 | 10 | 0 | 0 | 0 |
| Negative cases | 11 | 11 | 0 | 0 | 0 |
| Accessibility / UI | 10 | 10 | 0 | 0 | 0 |
| Release readiness | 9 | 9 | 0 | 0 | 0 |
| **Total** | **107** | **107** | **0** | **0** | **0** |

## 3. Defects (from BUG_REPORT.md)

| Severity | Open | Closed (retested) |
| S1 Blocker | 0 | 0 |
| S2 Major | 0 | 3 |
| S3 Minor | 0 | 1 |
| S4 Trivial | 0 | 0 |

**Known issues accepted at hand-in (with reason):**
- *(None. All identified bugs have been resolved.)*

## 4. Release gate checklist

- [x] Runs on a physical phone with no crashes (full matrix pass, signed release build)
- [x] SSO register + login verified; user visible in Firebase Authentication
- [x] Biometric success, failure, cancel and unavailable cases verified
- [x] Settings saved and persisted; language persisted
- [x] English, Afrikaans, isiZulu verified on all screens
- [x] API round-trip verified against hosted API and MongoDB
- [x] Offline action -> queue -> automatic reconnect sync -> MongoDB result verified
- [x] FCM test and real-alert notifications received on the phone
- [x] Evidence Vault upload verified (Azure blob + metadata)
- [x] Fleet Watchlist add/list/persist/remove verified in NoSQL
- [x] Previous features (dashboard, vehicles, trips, alerts, reports, fuel records, fuel estimate) regression-clean
- [x] No S1 open; all rubric-critical S2 closed
- [x] GitHub Actions Android + Node jobs green on the final commit
- [x] No secrets in repo, logs, screenshots or APK (REL-05)
- [x] Signed APK/AAB, real screenshots, public privacy-policy URL confirmed
- [x] Evidence audit complete - every rubric criterion has real proof
- [x] Video recorded on the same signed-off build



## 5. Sign-off statement

> I, Josh Holmes, confirm that the tests listed above were executed on the build, that the results recorded are the results I observed, and that the status of each release-gate item is as ticked.

- **Decision:**  Approved
- **Signed:** *Josh Holmes* **Date:** [2026/11/06]

Shared with: Matteo, Nick, Julian, Jival 
