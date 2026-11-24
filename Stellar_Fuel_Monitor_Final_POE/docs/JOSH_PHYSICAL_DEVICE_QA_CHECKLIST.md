# Josh — Physical Device QA Checklist

**Owner:** Josh Cullen Holmes (ST10322057)

This is the final regression checklist before recording the Part 2 demonstration.

Record the phone model, Android version, Git commit and date first.

| Test | Expected result | Pass/Fail | Evidence / defect |
|---|---|---|---|
| Cold launch | App opens without crashing |  |  |
| Google/Microsoft SSO | Authorised SSO reaches the app |  |  |
| Session restore | Reopening restores the valid session |  |  |
| Logout | Returns to authentication screen |  |  |
| Settings persistence | Changed setting remains after reopen |  |  |
| Dashboard | Real API data loads; errors are handled |  |  |
| Vehicle search/list | Vehicles display and search works |  |  |
| Vehicle Fuel Performance | km/L, benchmark, deviation and trend display correctly |  |  |
| Trips | Trip list opens and a selected trip loads |  |  |
| Trip/Destination Comparison | Scope, samples, deviation and confidence are clear |  |  |
| Alerts | Alerts load without crash |  |  |
| Alert Review | Evidence is understandable and contextual |  |  |
| Alert update | Status/comment PATCH round-trip persists |  |  |
| Reports | API report summary loads |  |  |
| Fuel records | Records load and empty state is safe |  |  |
| Fuel estimate | Valid input returns result; invalid input is handled |  |  |
| Administration | API/database/analytics status displays |  |  |
| API unavailable | Useful error + Retry; no crash |  |  |
| Background/foreground | Session/navigation remains stable |  |  |
| Largest font / portrait | No unusable clipping |  |  |
| System Back / app Back | Returns to the expected previous screen |  |  |
| Final demo path | Every recorded feature repeats reliably |  |  |

## Submission-blocking defects

Do not film the final video while any of these remain:

- crash or ANR on the demo path
- SSO failure
- Settings not persisting
- hosted API cannot be reached
- alert update does not persist
- custom feature displays incorrect evidence
- broken navigation
- GitHub Actions red on the final commit

## Sign-off

- Tester:
- Phone:
- Android version:
- Git commit:
- Date:
- Final result: PASS / FAIL
