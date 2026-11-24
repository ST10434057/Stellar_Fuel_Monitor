# QA_TEST_MATRIX.md - Stellar Fuel Monitor (PROG7314 Final POE)

**QA owner:** Josh Holmes
**Status:**  **Execution Complete - All 107 tests PASSED on physical device.**

## 0. Test run header

| Field | Value |
| Device make & model | [Samsung A26] |
| Screen size / density | [164 mm × 77.5 mm × 7.7 mm] |
| Biometric hardware (Facial Recognition) | Fingerprint/Face |
| Tester(s) / date | Josh Holmes & Jival / [2026/11/06] | 
| Network used (Wi-Fi and Mobile Data) | Wi-Fi & Mobile Data |


## 1. Authentication — SSO
| ID | Requirement | Scenario | Expected result | Observed | Device/Build | Result |
| AUTH-01 | SSO register | First-time Google sign-in | Account created; user lands on dashboard | Account created successfully, visible in Firebase. | [Samsung A26] | PASS |
| AUTH-02 | SSO login | Returning user sign-in | Same user/UID, data preserved | Logged in successfully, data intact. | [Samsung A26] | PASS |

## 6. Offline mode & sync
| ID | Requirement | Scenario | Expected result | Observed | Device/Build | Result |
| OFF-01 | Offline action | Perform supported action offline | Action accepted locally; UI shows queued state | Action accepted; queue showed 1 pending. | [Samsung A26] | PASS |
| OFF-03 | Auto-sync | Reconnect | WorkManager syncs automatically; queue returns to 0 | Synced automatically upon reconnect. | [Samsung A26] | PASS |
| OFF-04 | Server verification | Change reaches MongoDB | Change present exactly once | Confirmed in MongoDB with Nick. | [Samsung A26] | PASS |

## 14. Evidence audit vs rubric (pages 21–23)
*(All criteria verified and confirmed by Josh)*

| Rubric criterion (marks) | Required proof | Owner(s) | Evidence file / URL | Verified by Josh (Y/N) |
| App runs on mobile device (5) | Physical-phone footage, no crashes | Jival | `https://drive.google.com/file/d/1G54iZpUpv4ySkrfGczObMD6ulrR_gDoc/view?usp=sharing\` | Y |
| Biometric authentication (10) | Biometric prompt in video | Jival, Matteo | `https://drive.google.com/file/d/1G54iZpUpv4ySkrfGczObMD6ulrR_gDoc/view?usp=sharing\` | Y |
| Offline mode (10) | Offline action -> queue -> sync -> Mongo | Jival, Matteo | `https://drive.google.com/file/d/1G54iZpUpv4ySkrfGczObMD6ulrR_gDoc/view?usp=sharing\` | Y |
| Real-time notification (10) | Real FCM push received | Nick, Jival | `https://drive.google.com/file/d/1G54iZpUpv4ySkrfGczObMD6ulrR_gDoc/view?usp=sharing\` | Y |
| Multi-language (10) | EN / AF / ZU + persistence | Jival, Josh | `https://drive.google.com/file/d/1G54iZpUpv4ySkrfGczObMD6ulrR_gDoc/view?usp=sharing\` | Y |
| User-defined 4 - Evidence Vault (10)| Upload + Azure blob + Mongo metadata | Nick, Jival | `https://drive.google.com/file/d/1G54iZpUpv4ySkrfGczObMD6ulrR_gDoc/view?usp=sharing\` | Y |
| User-defined 5 - Fleet Watchlist (10)| Add/list/persist/remove + collection entry | Nick, Jival | `https://drive.google.com/file/d/1G54iZpUpv4ySkrfGczObMD6ulrR_gDoc/view?usp=sharing\` | Y |
| User interface (10) | Consistent, user-friendly screens | Josh (QA), Matteo | `https://drive.google.com/file/d/1G54iZpUpv4ySkrfGczObMD6ulrR_gDoc/view?usp=sharing\` | Y |
| AI-use write-up (5) | +/- 500 words, accurate | Julian | Y |
| GitHub, README, automated testing (10)| Green CI, 75+ commits, contributors, README | Nick, Matteo, Josh | `https://github.com/EMGPSD/prog7314-g4-2026-prog7314-poe-giggle-gang.git` | Y |
| Demonstration video (5) | Unlisted URL, voice-over, all required features | Jival | `https://drive.google.com/file/d/1G54iZpUpv4ySkrfGczObMD6ulrR_gDoc/view?usp=sharing\` | Y |
| SSO, settings, REST API (carried through)| Firebase user, saved settings, API/DB round-trip | Jival, Nick | `https://drive.google.com/file/d/1G54iZpUpv4ySkrfGczObMD6ulrR_gDoc/view?usp=sharing\` | Y |
