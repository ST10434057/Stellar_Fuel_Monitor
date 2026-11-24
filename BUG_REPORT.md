# BUG_REPORT.md — Stellar Fuel Monitor (PROG7314 Final POE)

**Maintained by:** Josh Holmes (QA).

## Summary dashboard

| Severity | Open | Fixed – awaiting retest | Closed |
| S1 Blocker | 0 | 0 | 0 |
| S2 Major | 0 | 0 | 3 |
| S3 Minor | 0 | 0 | 1 |
| S4 Trivial | 0 | 0 | 0 |

## Defect register

| ID | Title | Area | Severity | Status | Owner | Found in build | Test ID | Retest build | Retest result |
| BUG-001 | Dashboard shows contradictory investigation counts | UI / Logic | S2 Major | Closed | Matteo | Visual Pass | REG-01 | [Release APK v1.0] | Pass |
| BUG-002 | Missing "Save" action for Investigation Notes | UI / UX | S2 Major | Closed | Matteo | Visual Pass | REG-04 | [Release APK v1.0] | Pass |
| BUG-003 | Trip Destinations showing as "unavailable" | API / Data | S2 Major | Closed | Nick | Visual Pass | REG-03 | [Release APK v1.0] | Pass |
| BUG-004 | Vehicle Make/Model strings duplicated | UI / Data | S3 Minor | Closed | Nick | Visual Pass | REG-02 | [Release APK v1.0] | Pass |

---

## Triage checklist before the video is recorded
- [x] All S1 tickets closed with retest evidence
- [x] All S2 tickets on rubric-critical features (SSO, biometrics, offline sync, push, languages, Evidence Vault, Watchlist) closed
- [x] Remaining S3/S4 items listed in QA_SIGNOFF.md as known issues
- [x] Video is recorded on the **same build** that was signed off
