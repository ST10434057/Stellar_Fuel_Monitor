# Demonstration Records — Part 2 Video

Six pre-checked records for the demonstration video, covering Vehicle Fuel Performance,
Trip/Destination Comparison and Fuel Anomaly Investigation. Every value below was taken from
the analytics engine running against the packaged Stellar dataset (2026-09-07 export) and
independently re-verified — see [ANALYTICS_ACCEPTANCE_RESULTS.md](ANALYTICS_ACCEPTANCE_RESULTS.md).

Regenerate the candidate list at any time, from the `server/` directory:

```bash
npm run demo:records
```

---

## Read this before filming

**There is no date picker in the app.** `DashboardScreen`, `TripsScreen` and `AlertsScreen` all
call their endpoints without a `date`, so they show the engine's latest complete operating day,
**2026-09-03**. That day contains:

| Rating | Count |
|---|---|
| Poor / Review / Average / Good / Outstanding | **0** |
| Baseline (not enough prior history to rate) | 12 |
| Data Warning | 2 |

So the **Alerts screen will list exactly two alerts, both `Data Warning`**, and the Trips screen
will show twelve Baseline cycles. There is no performance anomaly on the default date. The
Dashboard headline for that day reads **2.40 km/L** across 14 cycles.

**Consequence for the shoot:** reach every performance record through
**More → Vehicles → search the registration → tap the cycle card**. Each record below gives its
position in that vehicle's list (newest first; the screen renders the first 30). Use the Alerts
screen only for the data-quality story (Record D), or ask Jival whether
`AlertsScreen` should pass a date so `GET /api/alerts?date=2026-08-22` can show a full mix —
that is a one-line change and is outside this verification package.

**Tone.** The app's own subtitle is "Investigate the record, not the person." Keep the narration
on the record: what the numbers are, what they are compared against, and why the engine reached
its conclusion. Do not attribute a result to a driver.

---

## Record A — Vehicle Fuel Performance (the normal case)

**Cycle `cycle_4c960299bb4e91ddb0`**

| Field | On-screen value |
|---|---|
| Registration | **LJ79WBGP** (Iveco 480 · 6x4) |
| Cycle | 2026-08-05 → 2026-08-08 |
| Route | SISHEN |
| Distance | 1233 km |
| Fuel | 463.0 L |
| Cycle efficiency | **2.66 km/L** |
| Selected benchmark | 2.53 km/L |
| Median | 2.54 km/L |
| Samples | **634** (15 trucks) |
| Scope | Same model/type + axle (Iveco 480 · 6x4) + same destination |
| Confidence | high |
| Variance | **+5.1 %** |
| Robust z-score | 0.27 |
| Rating | **Good** |
| Data-quality flags | none |

Also shown: expected 486.6 L against 463.0 L actual, a 23.6 L saving; this truck's own Sishen
history is 2.63 km/L over 290 cycles.

**Path:** Vehicles → `LJ79WBGP` → card **9 of 327** → Trip Investigation.

> "This is one complete Stellar-to-Stellar fuel cycle: 1,233 kilometres on 463 litres, or 2.66
> kilometres per litre. It's measured against 634 previous cycles by fifteen equivalent Iveco 480s
> on this same Sishen route, which average 2.53. Five percent better than the peer group, so the
> engine rates it Good."

---

## Record B — Fuel Anomaly Investigation (the headline anomaly)

**Cycle `cycle_d30469d47db7707803`**

| Field | On-screen value |
|---|---|
| Registration | **HW50DXGP** (Iveco 480 · 6x4) |
| Cycle | 2026-08-14 → 2026-08-22 |
| Route | Sishen (destination confidence **high**) |
| Distance | 1842 km |
| Fuel | 920.0 L |
| Cycle efficiency | **2.00 km/L** |
| Selected benchmark | 2.53 km/L |
| Median | 2.54 km/L |
| Samples | **640** (16 trucks) |
| Confidence | high |
| Variance | **−20.9 %** |
| Robust z-score | −1.10 |
| Expected fuel | 728.0 L → **+192.0 L excess** |
| Rating / severity | **Poor** → **High** |
| Confidence score | 93 |
| Data-quality flags | none |

This cycle contains **1 intermediate top-up** across 2 fuel readings, so it also demonstrates that
mid-route fills are rolled into one weighted result. Note the Trip Investigation screen shows no
separate exact-truck benchmark here: HW50DXGP has fewer than three prior Sishen cycles of its own,
which is below the three-sample floor.

**Path:** Vehicles → `HW50DXGP` → card **2 of 182** → Trip Investigation.
Alert detail (if reached by id): `ALERT-cycle_d30469d47db7707803`.

> "Same route, same truck model, but 920 litres for 1,842 kilometres — two kilometres per litre
> against a peer benchmark of 2.53. That's twenty-one percent below expectation, about 192 litres
> more than this distance should have taken, so it's raised as a High-severity alert with the
> evidence attached: the benchmark, the sample size, and the confidence behind it."

**Alternate, if a starker number is wanted:** `cycle_4652ce063f189040a7`, HW50DXGP, 2026-08-10 →
2026-08-14, 1320 km / 858 L = 1.54 km/L, −39.3 %, z −2.07, +336.9 L excess, card **3 of 182**.

---

## Record C — The middle band (not every shortfall is an accusation)

**Cycle `cycle_96c96fb759d5019b8e`**

| Field | On-screen value |
|---|---|
| Registration | **HW50DZGP** (Iveco 480 · 6x4) |
| Cycle | 2026-08-10 → 2026-08-12 |
| Route | SISHEN |
| Distance | 1225 km |
| Fuel | 560.0 L |
| Cycle efficiency | **2.19 km/L** |
| Selected benchmark | 2.53 km/L (median 2.54) |
| Samples | **637** (15 trucks), confidence high |
| Variance | **−13.7 %** |
| Robust z-score | −0.72 |
| Expected fuel | 483.5 L → **+76.5 L** |
| Rating / severity | **Review** → **Review** |
| Data-quality flags | none |

**Path:** Vehicles → `HW50DZGP` → card **10 of 243** → Trip Investigation.

> "Below expectation but not far enough to be called Poor — the engine puts it in Review. That
> distinction matters: a fourteen-percent shortfall is worth a question, not a conclusion."

---

## Record D — Data quality kept separate from performance

**Cycle `cycle_a6c719c3c85cd7736b`** — alert id `ALERT-cycle_a6c719c3c85cd7736b`

This is the **first of the two alerts already on the Alerts screen's default date**, so it needs no
navigation at all.

| Field | On-screen value |
|---|---|
| Registration | **LG05SPGP** (DAEWOO · 6x4, a truck tractor) |
| Cycle | 2026-08-25 → **2026-09-03** |
| Route | *Route unavailable* |
| Distance | 2602 km |
| Fuel | 20.0 L |
| Cycle efficiency | **130.10 km/L** |
| Selected benchmark | **Insufficient clean history** |
| Samples | **—** |
| Variance | **—** |
| Robust z-score | **—** |
| Rating / severity | **Data Warning** → **Data Warning** |
| Confidence score | 30 |
| Data-quality flags | **`cycle_destination_unavailable`**, **`physically_implausible_full_cycle_efficiency`** |

The red "Data-quality flags" card is visible on Trip Investigation, and the pill is the brown
Data Warning colour, not the red used for Poor.

**Path:** Alerts → first card → Alert Review → "Open linked trip" for the full evidence.

> "2,602 kilometres recorded against twenty litres of fuel — a hundred and thirty kilometres per
> litre. That isn't a performance problem, it's a capture problem. The engine flags it as a data
> warning, refuses to give it a benchmark, a variance or a z-score, and leaves it out of every
> historical average — so one bad record can't contaminate the baseline other trucks are measured
> against."

This record is also the natural place to demonstrate the **alert status round-trip** (Open →
Investigating → Resolved with a note), which was verified end-to-end locally:
`PATCH /api/alerts/ALERT-cycle_a6c719c3c85cd7736b` persists and is returned by the next `GET`.

> ⚠️ **The second alert on that screen is a trap.** `ALERT-cycle_76c2d2478f5e1700a5` is MZ49WPGP,
> an Isuzu bakkie, flagged at 10.82 km/L. That is a perfectly normal figure for a light vehicle —
> it only trips the flag because the 0.20–6.50 km/L guardrail is tuned for trucks. If it is on
> screen, either say so plainly ("the guardrail is set for the heavy fleet, so light vehicles can
> trip it — that is a known limitation") or scroll past it. Do not present it as a real error.

**Backup, if a shorter and even starker record is wanted:** `cycle_28b865c7e47c7aedb0`, LG05SGGP
(DAEWOO · 6x4), 2026-06-26 → 2026-06-27, HWANGE, 28 km on 868.0 L = 0.03 km/L, same flag,
card **8 of 89** under Vehicles.

---

## Record E — Trip/Destination Comparison (deepest benchmark)

**Cycle `cycle_d1409d24e36c10f8ef`**

| Field | On-screen value |
|---|---|
| Registration | **LJ79WBGP** (Iveco 480 · 6x4) |
| Cycle | 2026-08-10 → 2026-08-13 |
| Route label | **Sishen × 2** (two visits in one cycle; destination confidence **high**) |
| Distance | 1255 km |
| Fuel | 501.0 L |
| Cycle efficiency | **2.50 km/L** |
| Selected benchmark | 2.53 km/L |
| Median | 2.54 km/L |
| Samples | **638** (15 trucks) |
| Scope | Same model/type + axle (Iveco 480 · 6x4) + same destination |
| Confidence | **high** |
| Variance | **−1.1 %** |
| Robust z-score | −0.06 |
| Rating | Average |
| Confidence score | 93 |

Exact-truck comparison shown separately: 2.63 km/L over 292 cycles. Expected distance 1318 km
against 1255 actual (−63 km).

**Path:** Vehicles → `LJ79WBGP` → card **7 of 327** → Trip Investigation.

> "This is the destination comparison in full. The route label shows Sishen visited twice inside a
> single fuel cycle. The comparison group is 638 prior cycles by fifteen equivalent trucks on the
> same route — high confidence — and this cycle lands one percent off that benchmark. The truck's
> own history is shown separately so you can see the peer group and the individual side by side."

---

## Record F — Proving the full-to-full rule on screen

**Cycle `cycle_a51b7047d5daa741cf`**

| Field | On-screen value |
|---|---|
| Registration | **JW25RXGP** (Iveco 480 · 6x4) |
| Cycle | 2026-07-25 → 2026-08-03 |
| Route | **NGEZI × 4** |
| Distance | 2397 km |
| Fuel | 1068.0 L |
| Cycle efficiency | **2.24 km/L** |
| Intermediate top-ups | **3** (4 fuel readings rolled into one result) |
| Selected benchmark | 2.13 km/L (median 2.19) |
| Samples | **435** (16 trucks), confidence high |
| Variance | **+5.4 %** |
| Expected fuel | 1125.6 L → 57.6 L saving |
| Rating | Good |

**Path:** Vehicles → `JW25RXGP` → card **6 of 190** → Trip Investigation. Scroll to "Fuel evidence
used in this cycle" to show the individual readings behind the single result.

> "One cycle, four deliveries to Ngezi, four fuel readings. The opening Stellar full-up is excluded
> and the three mid-route top-ups are counted, so the whole trip is 2,397 kilometres on 1,068
> litres. Each reading contributes only the kilometres and litres it actually represents — short
> segments are never averaged as equals with long ones."

---

## Do not demonstrate these

- **The 23 cycles listed under finding F2** in ANALYTICS_ACCEPTANCE_RESULTS.md. Their displayed
  variance sits exactly on a threshold while the badge shows the rating from the other side of it
  (the rating uses the unrounded value). On camera it reads as a bug.
- **Light vehicles rated Data Warning.** Most of the 888
  `physically_implausible_full_cycle_efficiency` cycles are bakkies and LDVs whose genuine ~12 km/L
  exceeds a guardrail tuned for trucks (0.20–6.50 km/L). That invites an awkward question. Record D
  is a real capture error on a heavy truck.
- **Cycles with `analysedKmL` of exactly 0.00** (finding F3, 24 cycles) — the screen renders
  "0.00 km/L" where it should show a dash.
- **Very long cycles** such as `cycle_9a2488bf69edb9d8f2` (100,740 km, 83 top-ups over nine months).
  These are trucks that did not return to a Stellar depot; they are valid but confusing on camera.

## Before the take

1. From `server/`, run `npm run verify:analytics` and confirm it exits 0.
2. Confirm `status().completedCycles` is still **12054**. If the dataset is re-imported, every
   value in this document must be regenerated.
3. Walk each path on the physical phone and check the numbers against the tables above.
