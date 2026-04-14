# Bosch Milestone Analysis

## What This Is
Weekly KPI monitoring & RCA system for Bosch-Maersk shipments. Ingests raw Excel files (SC3/SC4 scenarios), extracts KPIs, generates root cause analysis, and serves an interactive React dashboard.

## Quick Start — Weekly Pipeline
```bash
# 1. Drop new SC3 + SC4 Excel files into "Bosch Milestone raw data/"
# 2. Run the pipeline (auto-detects new weeks):
python run_weekly.py
# Or with options:
python run_weekly.py --week CW14 --deploy --skip-pdca
```
This updates WEEKS configs, runs extraction, copies JSONs, builds dashboard, commits to dev.

## Data Flow
```
Raw Excel (Bosch Milestone raw data/) 
  -> rebaseline.py -> kpi_data.json (KPI metrics)
  -> extract_rca.py -> rca_data.json (milestone + shipment detail)
  -> cp to dashboard/public/ -> npx vite build -> Vercel deploy
```

## Scripts

| Script | Purpose | Output |
|--------|---------|--------|
| `rebaseline.py` | KPI extraction (completeness, timeliness, ETA, reference) | `kpi_data.json` |
| `extract_rca.py` | Milestone RCA + shipment-level detail | `rca_data.json` |
| `run_weekly.py` | Orchestrates full pipeline | Runs all scripts, builds, commits |
| `update_pdca.py` | Populates PDCA Excel template | Timestamped .xlsx |
| `eta_2d_deep_dive.py` | ETA 2D failure pattern analysis | `eta_2d_analysis.json` |
| `extract_eta_detail.py` | Shipment-level ETA/POD export | `ETA_Shipment_Detail_*.xlsx` |
| `generate_eta_report.py` | Professional ETA RCA Excel report | `ETA_2D_RCA_Analysis_*.xlsx` |
| `analyze_pod_patterns.py` | Last-mile transit time analysis | `pod_pattern_analysis.json` |

## KPI Definitions

| KPI | Formula | Source |
|-----|---------|--------|
| Completeness | Available / Required | TOTAL sheet, SC3+SC4 |
| Timeliness | In_Time / Required | TOTAL sheet, SC3+SC4 |
| ETA 2P | S07_Accepted / S07_measured (port ±48h) | SC4 Shipments sheet |
| ETA 2D | S31_Accepted / S31_measured (door ±48h) | SC4 Shipments sheet |
| Reference | Shipments with CIV or DN / Total | SC4 Shipments sheet |

**Critical milestones:** SC3: S02, S04, S07, S31 | SC4: S00, S02, S04, S07, S31

## Adding a New Week

If NOT using `run_weekly.py`, manually update these in both `rebaseline.py` and `extract_rca.py`:
```python
WEEKS = ["CW01", ..., "CW13", "CW14"]  # Add new week
SC3_FILES["CW14"] = "Maersk SC3_2026_CW14.xlsx"  # If CW10+ naming
SC4_FILES = {f"CW{i:02d}": f"Maersk SC4_2026_CW{i:02d}.xlsx" for i in range(1, 15)}
```
Then: `python rebaseline.py && python extract_rca.py && cp kpi_data.json rca_data.json dashboard/public/`

## Critical Gotchas

1. **Header row is row 3, not row 1.** Scripts detect dynamically via "UNIQUE_SHIPMENT_ID" marker. If detection fails, default is row 3.
2. **SC3 file naming changed at CW10.** CW01-CW09: `Maersk NGTM SC3_2026_CWxx.xlsx`. CW10+: `Maersk SC3_2026_CWxx.xlsx` (no NGTM).
3. **Column names may be Hungarian** (e.g., `EDIQ_EV_ETA_S31_Accepted osszege`). Scripts use substring matching (`"S31_Accepted" in key`).
4. **Detail sheet structure changed at CW08.** CW08+ has paired sheets: `FCL` (summary) + `FCL_` (detail). Scripts try `_` suffix first.
5. **ETA filtering:** Skip rows where Accepted=0 AND no actual date (in-transit/undelivered). If you count these as failures, metrics will be artificially low.
6. **SC3 has no ETA columns.** ETA 2P, 2D, and Reference are SC4-only metrics.

## Dashboard

**Stack:** React 19 + Recharts + Vite 7 (no Tailwind, no shadcn — inline styles via styles.js)

**Tabs:** Overview | RCA | ETA/Ref | Plausibility | Targets | HBL Analysis | Cancellations | Transmission Gap | Seeburger | POD Patterns | Tasks

**Local dev:** `cd dashboard && npx vite --host`

**Build:** `cd dashboard && npx vite build`

## Git Workflow
- **dev** branch: staging, where `run_weekly.py` commits
- **main** branch: production, Vercel auto-deploys on push
- Merge flow: work on dev -> verify -> `git checkout main && git merge dev && git push origin main`
- Remote: `https://github.com/hpuri84/bosch-milestone-analysis.git`

## Dependencies
- **Python:** openpyxl (only external dep). `pip install openpyxl`
- **Node:** React, Recharts, Vite. `cd dashboard && npm install`
- **Deployment:** Vercel (config in `dashboard/vercel.json`)

## File Naming Conventions
```
SC3: Maersk NGTM SC3_2026_CW01.xlsx  (CW01-CW09)
     Maersk SC3_2026_CW10.xlsx       (CW10+)
SC4: Maersk SC4_2026_CW01.xlsx       (all weeks)
```
Raw files go in `Bosch Milestone raw data/` folder.

## Don't
- Don't hardcode column indices — use dynamic header detection
- Don't count S00 as critical for SC3 (SC4 only)
- Don't include S45 in critical milestone calculations
- Don't push directly to main — always merge from dev
- Don't assume row 1 is the header row in Excel files
