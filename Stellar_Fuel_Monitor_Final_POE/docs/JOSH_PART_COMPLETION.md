# Josh Cullen Holmes — Part 2 Integration Summary

**Student:** Josh Cullen Holmes  
**Student number:** ST10322057

This update was rebuilt specifically against the latest uploaded group ZIP. It does not replace Julian's UI work, Nickolas's analytics acceptance work, Jival's API work or Matteo's SSO/Settings source.

## Josh source-side work integrated

### GitHub / DevOps
- Strengthened `.github/workflows/ci.yml`.
- Added repository structure and tracked-secret/build-output checks.
- Added Android unit-test report and debug APK artifacts.
- Added server syntax check and analytics verification to CI.
- Added PR and bug-report templates.
- Added `CONTRIBUTING.md`.

### Automated testing
- Repaired the malformed `FuelMathTest.kt` found in the latest ZIP.
- Aligned Kotlin threshold tests with the current API contract:
  - Poor: -15%
  - Review: -7.5%
  - Good: +4%
  - Outstanding: +10%
- Added settings tests.
- Added Gson/API model-contract tests.
- Added Retrofit endpoint-contract tests.
- Added additional server edge-case regression tests.

### Final QA / evidence
- Added a physical-device QA checklist.
- Added a demonstration-video runbook.
- Added a submission-evidence checklist.
- Expanded README guidance for testing, CI, collaboration and final evidence.

## Important work that cannot honestly be completed inside a ZIP

Josh/the group still need to perform these real-world actions:

- push/merge through the shared GitHub repository
- achieve genuine multi-member commit history
- obtain a real green remote Actions run
- install and test the APK on the actual Android phone
- complete the physical-device checklist
- capture final screenshots
- record the live demonstration video
- insert the final video URL into README

These are explicitly left as real evidence tasks rather than being falsely marked complete.
