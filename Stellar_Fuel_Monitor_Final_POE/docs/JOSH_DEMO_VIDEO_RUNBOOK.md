# Josh — Part 2 Demonstration Video Runbook

**Owner:** Josh Cullen Holmes (ST10322057)

Record this only after the physical-device QA checklist passes.

## Recommended sequence

1. **Opening — 15 to 20 seconds**
   - State Stellar Fuel Monitor Mobile, PROG7314 Part 2 and the app's purpose.
   - Show that the app is running on a physical Android phone.

2. **SSO — 30 to 45 seconds**
   - Demonstrate a real SSO sign-in.
   - Show successful authentication without exposing secrets.

3. **Settings — 20 to 30 seconds**
   - Change a meaningful preference.
   - Leave and reopen Settings to prove persistence.

4. **Hosted API / database — 30 to 45 seconds**
   - Load real data from the hosted API.
   - Show the cloud/API/database evidence required by the brief.

5. **User Defined 1: Vehicle Fuel Performance — 45 to 60 seconds**
   - Use a known verified vehicle.
   - Explain current km/L, historical benchmark, deviation and trend.

6. **User Defined 2: Trip/Destination Comparison — 45 to 60 seconds**
   - Use a record from `ANALYTICS_DEMO_RECORDS.md`.
   - Explain benchmark scope, sample count, deviation and confidence.

7. **User Defined 3: Fuel Anomaly / Alert Investigation — 45 to 60 seconds**
   - Explain observed performance versus evidence.
   - Demonstrate a status/comment update and show that it persists.

8. **GitHub / CI — 20 to 30 seconds**
   - Show multiple contributors and meaningful commit history.
   - Show the latest green GitHub Actions run.

9. **Closing — 10 to 15 seconds**
   - Confirm successful physical-device execution.

## Recording rules

- Use an explanatory voice-over throughout.
- Rehearse using the exact known demo records.
- Never expose Firebase secrets, API keys or passwords.
- Do not present a data-quality warning as driver blame.
- Add the final video URL to `README.md`.
