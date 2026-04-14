
# ETA 2D Delivery Accuracy — Root Cause Analysis & Preventive Actions (CW12)

**Subject:** ETA 2D Delivery Accuracy — Root Cause Analysis & Preventive Actions (CW12)

---

Hi Team,

Please find below the detailed RCA for ETA 2D (±48h door delivery) accuracy. Current performance is at **30.2% (CW12)** against a **90%+ target** — a structural gap that requires coordinated action across multiple areas.

---

## Current State (CW09-CW12 Trend)

| Week | Measured | Accepted | Failed | Accuracy |
| --- | --- | --- | --- | --- |
| CW09 | 271 | 99 | 172 | 36.5% |
| CW10 | 278 | 78 | 200 | 28.1% |
| CW11 | 217 | 72 | 145 | 33.2% |
| CW12 | 285 | 86 | 199 | **30.2%** |

To reach 90%, we need **170 additional shipments** within the ±48h window — that means fixing 170 out of 199 current failures (85.4%).

---

## Root Causes Identified

### RC1: Stale ETA Baseline (~42% of failures)

The S31 measured ETA is captured early in the shipment lifecycle and **not updated after port arrival**. 83 out of 83 "early" failures show the measurement snapshot was outdated. This is a **data process issue**, not a transport performance issue.

### RC2: CN->DE Consolidation Delays (~33% of failures)

66 failed shipments on this single lane with avg **+17.9 days late** deviation. Last-mile transit after ATA averages 12-16 days in Germany, far exceeding the ±48h measurement window.

### RC3: Systematic Estimate Bias on HU/PT Lanes (~30% of failures)

Hungary (Miskolc, Hatvan) and Portugal (Braga) destinations show consistent early/late patterns, indicating **static ETAs not calibrated** to actual transit times for these corridors.

### RC4: No ETA Recalculation After Port Arrival (structural)

Average last-mile duration is 11.9 days for accepted vs 16.3 days for failed shipments. The ETA is **not updated post-ATA** to reflect customs clearance and inland transport time.

---

## What-If: Accuracy at Different Measurement Windows

| Window | Accepted | Total | Accuracy | Gap to 90% |
| --- | --- | --- | --- | --- |
| **±48h (2.0d)** | **72** | **284** | **25.4%** | **-64.6pp (CURRENT)** |
| ±72h (3.0d) | 108 | 284 | 38.0% | -52.0pp |
| ±96h (4.0d) | 141 | 284 | 49.6% | -40.4pp |
| ±120h (5.0d) | 152 | 284 | 53.5% | -36.5pp |
| ±168h (7.0d) | 190 | 284 | 66.9% | -23.1pp |
| ±240h (10.0d) | 213 | 284 | 75.0% | -15.0pp |
| ±336h (14.0d) | 237 | 284 | 83.5% | -6.5pp |

Even at ±14 days, accuracy reaches only 83.5%. The ETAs require fundamental recalibration to reach 90%.

---

## Top 10 Failure Lanes — Cumulative Benefit

These 10 lanes account for **85% of all CW12 failures**. Fixing all 10 reaches 89.5%.

| # | Lane | Total | Accepted | Failed | Lane Acc | Cum Fixed | New Overall Acc | Gain |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | CN->DE | 105 | 39 | 66 | 37.1% | 66 | **53.3%** | +23.1pp |
| 2 | CN->HU | 47 | 11 | 36 | 23.4% | 102 | **65.9%** | +35.7pp |
| 3 | CN->PT | 34 | 10 | 24 | 29.4% | 126 | **74.4%** | +44.2pp |
| 4 | HK->PT | 12 | 1 | 11 | 8.3% | 137 | **78.2%** | +48.0pp |
| 5 | CN->RO | 11 | 3 | 8 | 27.3% | 145 | **81.1%** | +50.9pp |
| 6 | CN->IT | 7 | 0 | 7 | 0.0% | 152 | **83.5%** | +53.3pp |
| 7 | JP->DE | 6 | 0 | 6 | 0.0% | 158 | **85.6%** | +55.4pp |
| 8 | TH->RO | 5 | 0 | 5 | 0.0% | 163 | **87.4%** | +57.2pp |
| 9 | TW->DE | 7 | 2 | 5 | 28.6% | 168 | **89.1%** | +58.9pp |
| 10 | CN->RS | 4 | 0 | 4 | 0.0% | 172 | **90.5%** | +60.4pp |
|  | **TOTAL** |  |  | **172** |  | **172** | **90.5%** | **+60.4pp** |

Fixing the top 10 lanes would theoretically reach 90.5%. Remaining 27 failures are spread across 15+ long-tail lanes.

---

## Early vs Late Breakdown (CW12 Failures)

| Direction | Count | % of Failures | Avg Deviation |
| --- | --- | --- | --- |
| Early (delivered too soon) | 83 | 41.7% | -7.7 days |
| Late (delivered too late) | 116 | 58.3% | +20.9 days |

### Early Failures — Pattern Analysis

Root cause: Stale ETA baseline not updated after faster-than-expected transit. The measurement snapshot was outdated, not the delivery.

**By Lane:**

| Lane | Count | Avg Dev (d) | % of Early |
| --- | --- | --- | --- |
| CN->DE | 16 | -5.5 | 19.3% |
| CN->HU | 15 | -10.0 | 18.1% |
| CN->PT | 14 | -6.6 | 16.9% |
| HK->PT | 10 | -8.7 | 12.0% |
| TH->RO | 5 | -2.7 | 6.0% |
| CN->RS | 4 | -7.3 | 4.8% |
| TR->JP | 3 | -10.6 | 3.6% |
| MY->PT | 3 | -1.8 | 3.6% |
| HK->RO | 2 | -28.1 | 2.4% |

**By Delivery City:**

| City | Count | Avg Dev (d) |
| --- | --- | --- |
| BRAGA (PT) | 24 | -6.6 |
| MISKOLC (HU) | 14 | -11.2 |
| Simanovci (RS) | 4 | -7.3 |
| Langenau (DE) | 4 | -5.2 |
| JUC-HERGHELIE (RO) | 3 | -2.9 |
| HATVAN (HU) | 3 | -3.2 |
| TSUCHIURA-SHI (JP) | 3 | -10.6 |

**Top City Lanes (Early):**

| City Lane | Count | Avg Dev (d) |
| --- | --- | --- |
| HONG KONG->BRAGA | 7 | -6.5 |
| CHANGSHU->BRAGA | 4 | -5.1 |
| SHANGHAI->BRAGA | 4 | -8.2 |
| Hangzhou->MISKOLC | 4 | -16.7 |
| SUZHOU->MISKOLC | 4 | -10.7 |
| BURSA->TSUCHIURA-SHI | 3 | -10.6 |
| AYUTTHAYA->JUC-HERGHELIE | 3 | -2.7 |
| SUZHOU->HATVAN | 3 | -3.2 |

**Early Deviation Distribution:**

| Bucket | Count |
| --- | --- |
| 2-3 days early | 21 |
| 3-5 days early | 14 |
| 5-7 days early | 17 |
| 7-14 days early | 19 |
| 14-30 days early | 8 |
| 30+ days early | 4 |

### Late Failures — Top Lanes

| Lane | Count | Avg Dev (d) | % of Late |
| --- | --- | --- | --- |
| CN->DE | 50 | +21.7 | 43.1% |
| CN->HU | 21 | +9.3 | 18.1% |
| CN->PT | 10 | +6.2 | 8.6% |
| CN->RO | 6 | +31.6 | 5.2% |
| JP->DE | 6 | +6.5 | 5.2% |
| CN->IT | 5 | +8.2 | 4.3% |

---

## By Service Type (CW12)

| Service | Total | Accepted | Failed | Accuracy | Avg Dev (h) |
| --- | --- | --- | --- | --- | --- |
| S03 (LCL) | 147 | 48 | 99 | 32.7% | +334.0 |
| S01 (FCL) | 86 | 25 | 61 | 29.1% | +39.1 |
| S02 (LCL/FCL) | 52 | 13 | 39 | 25.0% | -65.6 |

All service types are equally impacted — this is not a service-specific issue.

---

## By Destination Country (CW12)

| Country | Total | Accepted | Failed | Accuracy | Avg Dev (h) |
| --- | --- | --- | --- | --- | --- |
| DE | 132 | 52 | 80 | 39.4% | +379.9 |
| HU | 54 | 13 | 41 | 24.1% | +12.2 |
| PT | 51 | 13 | 38 | 25.5% | -72.0 |
| RO | 19 | 4 | 15 | 21.1% | +11.7 |
| IT | 7 | 0 | 7 | 0.0% | +197.3 |
| RS | 5 | 0 | 5 | 0.0% | -59.2 |
| JP | 4 | 0 | 4 | 0.0% | +47.2 |
| PL | 3 | 1 | 2 | 33.3% | -76.3 |
| ES | 3 | 3 | 0 | 100.0% | +12.0 |

---

## Top Failing Delivery Cities (CW12)

| City | Total | Accepted | Failed | Accuracy | Avg Dev (h) |
| --- | --- | --- | --- | --- | --- |
| BRAGA (PT) | 50 | 13 | 37 | 26.0% | -58.6 |
| MISKOLC (HU) | 39 | 10 | 29 | 25.6% | -6.9 |
| HATVAN (HU) | 13 | 3 | 10 | 23.1% | +73.5 |
| Immenstadt (DE) | 8 | 0 | 8 | 0.0% | +1,566.0 |
| WORMS (DE) | 11 | 4 | 7 | 36.4% | +776.8 |
| Tamm (DE) | 13 | 6 | 7 | 46.2% | +174.5 |
| JUC-HERGHELIE (RO) | 8 | 2 | 6 | 25.0% | +49.6 |
| HILDESHEIM (DE) | 14 | 9 | 5 | 64.3% | +150.2 |
| LANGENAU WUERTT (DE) | 6 | 1 | 5 | 16.7% | +315.3 |

---

## Last Mile Analysis (ATA to Delivered)

| Segment | Avg Last Mile Duration |
| --- | --- |
| Accepted shipments | 11.9 days |
| Failed shipments | 16.3 days |

The ±48h window cannot accommodate a 12-16 day last-mile leg. ETAs must account for this.

---

## Preventive Actions

| Priority | Action | Root Cause | Expected Impact | Owner | Timeline |
| --- | --- | --- | --- | --- | --- |
| **P1 - Critical** | Dynamic ETA update post-ATA: Recalculate S31 ETA after vessel arrival (S07) incorporating customs clearance and inland transit estimates per destination | RC#1: Stale ETA baseline, RC#4: No post-ATA update | +15-20pp | Bosch IT / EDI Team | CW16-CW20 |
| **P1 - Critical** | Calibrate last-mile transit buffers per destination cluster: DE (avg 12d), HU/Miskolc (avg 11d), PT/Braga (avg 10d) | RC#3: Systematic estimate bias on HU/PT/DE lanes | +10-15pp | Maersk Operations | CW14-CW18 |
| **P2 - High** | Investigate CN->DE consolidation delays: 66 failures with avg +17.9 days late. Root cause likely at origin CFS or transshipment | RC#2: CN->DE consolidation delays | +8-10pp | Origin Operations / CFS | CW14-CW16 |
| **P2 - High** | Add ETA measurement checkpoint at customs clearance (S16): Capture updated delivery ETA after customs release | RC#1 + RC#4 | +5-8pp | Bosch IT / Maersk IT | CW18-CW22 |
| **P3 - Medium** | Lane-specific ETA models: Build historical transit time distributions per origin-dest pair to replace static ETAs | All root causes | Long-term: 85-90%+ | Data & Analytics | CW20-CW30 |
| **P3 - Medium** | Negotiate measurement window review: Present data showing ±7d = 66.9%, ±14d = 83.5%. Discuss ±72h or phased targets with Bosch | Structural: ±48h too tight for ocean freight door delivery | Resets target | Account Management | CW14 |
| **P4 - Quick Win** | Fix Immenstadt (DE) deliveries: 8 shipments avg +65 days deviation — specific warehouse or customs issue | RC#2: Specific consignee | +3pp | DE Operations | CW13-CW14 |
| **P4 - Quick Win** | Fix WORMS / KANDEL (DE) deliveries: 11 shipments with multi-week deviations — investigate consignee-specific bottleneck | RC#2: Specific consignee | +4pp | DE Operations | CW13-CW14 |

---

## Key Takeaway

Reaching 90%+ with a ±48h window requires **fundamentally improving how and when the delivery ETA is set** — specifically:

1. Updating the estimate after port arrival (ATA) to reflect actual customs + last-mile transit
2. Calibrating per-destination transit buffers based on historical data
3. Addressing the CN->DE consolidation bottleneck (single largest failure lane — 66 of 199 failures)

The top 10 lanes cover 86% of all failures. Fixing these 10 lanes alone would reach 90.5%.

The attached Excel (`ETA_2D_RCA_Analysis_CW12.xlsx`) contains 8 sheets with full calculations, shipment-level detail (199 HBLs), and complete lane/destination/service type breakdowns.

Best regards
