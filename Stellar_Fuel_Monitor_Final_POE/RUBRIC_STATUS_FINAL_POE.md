# Final POE Rubric Status — Marks-Oriented Checklist

This matrix separates **implemented code** from **evidence still required** so the group does not lose marks by assuming source code alone proves runtime behaviour.

| Rubric item | Marks | Code status | What must be shown for the highest band |
|---|---:|---|---|
| App runs on mobile device | 5 | Implemented / build-configured | Release app launches and runs without crashes on a physical Android phone |
| Biometric authentication | 10 | Implemented | Successful SSO followed by real fingerprint/face prompt; failure/cancel/retry behaviour |
| Offline mode | 10 | Implemented | Disconnect network, update an alert, show queued SQLite item, reconnect, show automatic WorkManager sync and server/database result |
| Real-time notification | 10 | Implemented | Device registers FCM token and receives a real test/alert notification from hosted API |
| Multi-language | 10 | Implemented | Switch English → Afrikaans → isiZulu and navigate multiple screens showing immediate persistent change |
| User-defined 4 | 10 | Evidence Vault implemented | Upload real image/PDF, show app record + Azure blob + Mongo metadata |
| User-defined 5 | 10 | Fleet Watchlist implemented | Add priority/note, show live enrichment, persist through API/Mongo, remove item |
| User interface | 10 | Final Compose UI + common states | Consistent typography/cards/navigation, input validation, empty/loading/error states, no clipping on test phone |
| Play Store preparation | 5 | Code/docs prepared | Signed production APK/AAB + real promotional screenshots + listing/privacy/data-safety material |
| AI-use write-up | 5 | Complete | Submit `AI_USAGE_FINAL_POE.md`; keep it transparent and <=500 words |
| GitHub/README/testing | 10 | CI + README + tests complete | Green workflow runs, real 75+ commit history if achieved, multiple real contributors, final tag, no ZIP/manual upload workflow |
| Demonstration video | 5 | Runbook prepared | Professional physical-phone recording with voice-over and every required verification point |

## Final requirement coverage beyond the rubric rows

- Custom REST API remains the primary analytics/backend layer.
- MongoDB provides NoSQL reads/writes for operational and Final POE records.
- Azure Blob Storage stores Evidence Vault binary assets.
- Android logging is present for lifecycle/auth/API/biometric/sync flows.
- GitHub Actions runs repository QA, Android tests/build, Node tests and signed-tag release build.
- Release notes are in `RELEASE_NOTES_FINAL_POE.md`.
- Final deployment should be annotated/tagged `Final-POE` with message `Final POE`.

## Non-code blockers before claiming “complete”

1. Insert the final video URL in `README.md`.
2. Confirm the official group is no more than four students.
3. Run a clean GitHub Actions build in the real repository.
4. Verify every advanced feature on a physical phone.
5. Configure real Firebase/Mongo/Azure values on the hosted environment.
6. Generate the signed production APK/AAB with the group's release key.
7. Capture and add the real Play Store screenshots.
8. Confirm the real Git history/contributors satisfy the rubric evidence; do not fabricate commit history.
