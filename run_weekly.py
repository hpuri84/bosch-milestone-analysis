#!/usr/bin/env python3
"""
Weekly Automation Wrapper for Bosch Milestone Analysis

End-to-end pipeline:
  1. Detect new SC3/SC4 Excel files for the latest week
  2. Update WEEKS config in rebaseline.py and extract_rca.py
  3. Run KPI extraction (rebaseline.py) -> kpi_data.json
  4. Run RCA extraction (extract_rca.py) -> rca_data.json
  5. Copy JSONs to dashboard/public/
  6. Update PDCA template
  7. Build dashboard
  8. Optionally deploy to Vercel

Usage:
    python run_weekly.py                    # Auto-detect new week
    python run_weekly.py --week CW09        # Specify week
    python run_weekly.py --deploy           # Also deploy to Vercel
    python run_weekly.py --skip-pdca        # Skip PDCA update
"""

import argparse
import glob
import os
import re
import shutil
import subprocess
import sys
import json
from datetime import datetime

BASE = "/Users/harsh.puri/Documents/work-maersk/Prototype Playground/Bosch Milestone Analysis"
RAW_DIR = os.path.join(BASE, "Bosch Milestone raw data")
DASHBOARD_DIR = os.path.join(BASE, "dashboard")
DASHBOARD_PUBLIC = os.path.join(DASHBOARD_DIR, "public")


def log(msg, level="INFO"):
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] [{level}] {msg}")


def detect_weeks():
    """Scan raw data directory for SC3/SC4 files and return available weeks."""
    sc3_weeks = set()
    sc4_weeks = set()

    for f in os.listdir(RAW_DIR):
        if f.startswith("~$"):
            continue
        m = re.search(r"SC3_2026_CW(\d+)", f)
        if m:
            sc3_weeks.add(int(m.group(1)))
        m = re.search(r"SC4_2026_CW(\d+)", f)
        if m:
            sc4_weeks.add(int(m.group(1)))

    # Weeks where we have both SC3 and SC4
    complete = sc3_weeks & sc4_weeks
    return sorted(complete)


def update_script_weeks(script_path, weeks):
    """Update the WEEKS and file mapping in a Python script."""
    with open(script_path) as f:
        content = f.read()

    week_list = ", ".join(f'"CW{w:02d}"' for w in weeks)
    max_week = max(weeks)

    # Replace WEEKS = [...]
    content = re.sub(
        r'WEEKS\s*=\s*\[.*?\]',
        f'WEEKS = [{week_list}]',
        content,
        count=1
    )

    # Replace SC3_FILES range
    content = re.sub(
        r'SC3_FILES\s*=\s*\{.*?\}',
        f'SC3_FILES = {{f"CW{{i:02d}}": f"Maersk NGTM SC3_2026_CW{{i:02d}}.xlsx" for i in range(1, {max_week + 1})}}',
        content,
        count=1
    )

    # Replace SC4_FILES range
    content = re.sub(
        r'SC4_FILES\s*=\s*\{.*?\}',
        f'SC4_FILES = {{f"CW{{i:02d}}": f"Maersk SC4_2026_CW{{i:02d}}.xlsx" for i in range(1, {max_week + 1})}}',
        content,
        count=1
    )

    with open(script_path, "w") as f:
        f.write(content)


def run_script(script_path, description):
    """Run a Python script and check for errors."""
    log(f"Running: {description}")
    result = subprocess.run(
        [sys.executable, script_path],
        capture_output=True, text=True, cwd=BASE
    )
    if result.returncode != 0:
        log(f"FAILED: {description}", "ERROR")
        log(f"stderr: {result.stderr[:500]}", "ERROR")
        return False
    if result.stdout:
        for line in result.stdout.strip().split("\n")[-5:]:
            log(f"  {line}")
    return True


def copy_data_files():
    """Copy generated JSON files to dashboard/public/."""
    files = [
        (os.path.join(BASE, "kpi_data.json"), os.path.join(DASHBOARD_PUBLIC, "kpi_data.json")),
        (os.path.join(BASE, "rca_data.json"), os.path.join(DASHBOARD_PUBLIC, "rca_data.json")),
    ]
    for src, dst in files:
        if os.path.exists(src):
            shutil.copy2(src, dst)
            size = os.path.getsize(dst) / 1024
            log(f"  Copied {os.path.basename(src)} ({size:.0f} KB)")
        else:
            log(f"  Missing: {src}", "WARN")


def build_dashboard():
    """Build the Vite dashboard."""
    log("Building dashboard...")
    result = subprocess.run(
        ["npx", "vite", "build"],
        capture_output=True, text=True, cwd=DASHBOARD_DIR
    )
    if result.returncode != 0:
        log(f"Build failed: {result.stderr[:300]}", "ERROR")
        return False
    log("  Dashboard built successfully")
    return True


def deploy_vercel():
    """Deploy to Vercel."""
    log("Deploying to Vercel...")
    result = subprocess.run(
        ["npx", "vercel", "--prod", "--yes"],
        capture_output=True, text=True, cwd=DASHBOARD_DIR
    )
    if result.returncode != 0:
        log(f"Deploy failed: {result.stderr[:300]}", "ERROR")
        return False

    # Extract URL from output
    for line in result.stdout.split("\n"):
        if "vercel.app" in line and "http" in line:
            log(f"  Deployed: {line.strip()}")
            break
    return True


def git_commit_and_push(week):
    """Commit updated data and push to dev."""
    log("Committing changes...")
    subprocess.run(["git", "add", "-A"], cwd=DASHBOARD_DIR, capture_output=True)
    result = subprocess.run(
        ["git", "commit", "-m", f"Weekly update: {week} KPI data and RCA extraction"],
        cwd=DASHBOARD_DIR, capture_output=True, text=True
    )
    if result.returncode == 0:
        subprocess.run(["git", "push", "origin", "dev"], cwd=DASHBOARD_DIR, capture_output=True)
        log("  Pushed to dev")
    else:
        log("  No changes to commit or commit failed")


def main():
    parser = argparse.ArgumentParser(description="Weekly Bosch Milestone Analysis pipeline")
    parser.add_argument("--week", help="Specify week (e.g. CW09). Auto-detects if omitted.")
    parser.add_argument("--deploy", action="store_true", help="Deploy to Vercel after build")
    parser.add_argument("--skip-pdca", action="store_true", help="Skip PDCA template update")
    parser.add_argument("--skip-build", action="store_true", help="Skip dashboard build")
    parser.add_argument("--no-push", action="store_true", help="Don't git push")
    args = parser.parse_args()

    log("=" * 60)
    log("Bosch Milestone Analysis — Weekly Pipeline")
    log("=" * 60)

    # Step 1: Detect available weeks
    available_weeks = detect_weeks()
    log(f"Available weeks: {['CW{:02d}'.format(w) for w in available_weeks]}")

    if args.week:
        target_week = args.week.upper()
        week_num = int(target_week.replace("CW", ""))
        if week_num not in available_weeks:
            log(f"Warning: {target_week} raw files not found in {RAW_DIR}", "WARN")
    else:
        target_week = f"CW{max(available_weeks):02d}"

    log(f"Target week: {target_week}")
    log("")

    # Step 2: Update script configs
    log("Step 1: Updating extraction script configs...")
    update_script_weeks(os.path.join(BASE, "rebaseline.py"), available_weeks)
    update_script_weeks(os.path.join(BASE, "extract_rca.py"), available_weeks)
    log("  Updated WEEKS and file mappings")
    log("")

    # Step 3: Run KPI extraction
    log("Step 2: KPI Extraction")
    if not run_script(os.path.join(BASE, "rebaseline.py"), "rebaseline.py (KPI data)"):
        log("Pipeline aborted at KPI extraction", "ERROR")
        return 1
    log("")

    # Step 4: Run RCA extraction
    log("Step 3: RCA Extraction")
    if not run_script(os.path.join(BASE, "extract_rca.py"), "extract_rca.py (RCA data)"):
        log("Pipeline aborted at RCA extraction", "ERROR")
        return 1
    log("")

    # Step 5: Copy to dashboard
    log("Step 4: Copying data to dashboard...")
    copy_data_files()
    log("")

    # Step 6: Update PDCA
    if not args.skip_pdca:
        log("Step 5: Updating PDCA template...")
        result = subprocess.run(
            [sys.executable, os.path.join(BASE, "update_pdca.py"), "--week", target_week],
            capture_output=True, text=True, cwd=BASE
        )
        if result.returncode == 0:
            for line in result.stdout.strip().split("\n")[-3:]:
                log(f"  {line}")
        else:
            log(f"  PDCA update failed: {result.stderr[:200]}", "WARN")
    else:
        log("Step 5: Skipped PDCA update")
    log("")

    # Step 7: Build dashboard
    if not args.skip_build:
        log("Step 6: Building dashboard...")
        if not build_dashboard():
            log("Pipeline aborted at build", "ERROR")
            return 1
    else:
        log("Step 6: Skipped build")
    log("")

    # Step 8: Git commit and push
    if not args.no_push:
        log("Step 7: Git commit and push...")
        git_commit_and_push(target_week)
    else:
        log("Step 7: Skipped git push")
    log("")

    # Step 9: Deploy
    if args.deploy:
        log("Step 8: Deploying to Vercel...")
        deploy_vercel()
    else:
        log("Step 8: Skipped Vercel deploy (use --deploy to enable)")
    log("")

    log("=" * 60)
    log(f"Pipeline complete for {target_week}")
    log("=" * 60)

    # Print summary
    kpi_path = os.path.join(DASHBOARD_PUBLIC, "kpi_data.json")
    if os.path.exists(kpi_path):
        with open(kpi_path) as f:
            kpi = json.load(f)
        latest = kpi[-1]
        log("")
        log(f"Latest KPIs ({latest['week']}):")
        log(f"  Completeness (All):  {latest['all']['completeness']:.1%}")
        log(f"  Timeliness (All):    {latest['all']['timeliness']:.1%}")
        log(f"  ETA 2P:              {latest.get('eta_2p', 0):.1%}")
        log(f"  ETA 2D:              {latest.get('eta_2d', 0):.1%}")
        log(f"  Reference:           {latest.get('ref_comp', 0):.1%}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
