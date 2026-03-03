#!/usr/bin/env python3
"""
Bosch Milestone KPI Analysis - Reusable Weekly Dashboard
=========================================================
Reads weekly SC3 (Road/NGTM) and SC4 (Sea) milestone data from
'Bosch Milestone raw data/' folder and produces aggregate KPIs.

Targets:  Completeness -> 95%   |   Timeliness -> 70%

Key Bosch Milestones:
  - S02 (Collected)      - all scenarios
  - S04 (Vessel/flight departed) - all scenarios
  - S07 (Vessel/flight arrived)  - all scenarios
  - S31 (Delivered)       - all scenarios
  - S00 (Shipment created) - SC4 only

Usage:
  python3 bosch_milestone_kpi_analysis.py

Output:
  bosch_kpi_dashboard.html
"""

import pandas as pd
import numpy as np
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots
import os
import re
import json
import warnings
from datetime import datetime

warnings.filterwarnings("ignore")

# ─── Configuration ───────────────────────────────────────────────────────────

RAW_DATA_DIR = "Bosch Milestone raw data"
OUTPUT_FILE = "bosch_kpi_dashboard.html"

# Drill-down data sources (shipment-level detail from new raw data)
DRILLDOWN_DATA_DIR = "new raw data"
SC4_DRILLDOWN_FILE = "Maersk SC4_ form 2025.12. - 2026.02.xlsx"
SC3_DRILLDOWN_FILE = "Maersk NGTM SC3_from 2025.12.- 2026.02.23.xlsx"

# Targets
TARGET_COMPLETENESS = 0.95
TARGET_TIMELINESS = 0.70

# Key Bosch milestones (S00 is SC4-specific)
KEY_MILESTONES_ALL = ["S02", "S04", "S07", "S31"]
KEY_MILESTONES_SC4_ONLY = ["S00"]

# ─── Bosch-to-Internal Milestone Mapping ─────────────────────────────────────
# Maps each Bosch S-code to the corresponding Maersk internal milestone stage.
BOSCH_TO_INTERNAL_MAPPING = {
    "S00": {"internal_code": "BKG", "internal_name": "Shipment created", "scenario": "SC4", "notes": "Actual"},
    "S02": {"internal_code": "PUP", "internal_name": "Collected", "scenario": "Both", "est_code": "PUP_EST", "notes": "Actual/Estimated"},
    "S04": {"internal_code": "DEP", "internal_name": "Vessel/ flight departed", "scenario": "Both", "est_code": "ETD", "notes": "Actual/Estimated"},
    "S05": {"internal_code": "GOU", "internal_name": "In delivery", "scenario": "Both", "notes": "Actual"},
    "S07": {"internal_code": "ARR", "internal_name": "Vessel/ flight arrived", "scenario": "Both", "est_code": "ETA", "notes": "Actual/Estimated"},
    "S10": {"internal_code": "REC", "internal_name": "On hand at origin SVC", "scenario": "Both", "notes": "Actual"},
    "S11": {"internal_code": "S11", "internal_name": "On hand at origin Hub/ CC", "scenario": "SC4", "notes": "Actual"},
    "S12": {"internal_code": "CAV", "internal_name": "On hand at destination Hub/ CC", "scenario": "SC4", "notes": "Actual"},
    "S13": {"internal_code": "S13", "internal_name": "On hand at destination SVC", "scenario": "Both", "notes": "Actual"},
    "S16": {"internal_code": "BCF", "internal_name": "Shipment booked with carrier", "scenario": "SC4", "notes": "Actual"},
    "S17": {"internal_code": "GIN", "internal_name": "Tendered carrier", "scenario": "SC4", "notes": "Actual"},
    "S18": {"internal_code": "S18", "internal_name": "Recovered from carrier", "scenario": "SC4", "notes": "Actual"},
    "S31": {"internal_code": "POD", "internal_name": "Delivered", "scenario": "Both", "est_code": "POD_EST", "notes": "Actual/Estimated"},
    "S45": {"internal_code": "DDI", "internal_name": "Handover to broker", "scenario": "Both", "est_code": "DDE", "notes": "Actual/Estimated"},
    "S46": {"internal_code": "AED", "internal_name": "Documents rcvd from shipper", "scenario": "SC4", "notes": "Actual"},
    "S50": {"internal_code": "GIN", "internal_name": "Received origin CFS", "scenario": "Both", "notes": "Actual"},
    "S51": {"internal_code": "FUN", "internal_name": "Arrived destination CFS", "scenario": "Both", "notes": "Actual"},
    "S52": {"internal_code": "EGO", "internal_name": "Empty Container picked up", "scenario": "SC3", "notes": "Actual"},
    "S53": {"internal_code": "FLO", "internal_name": "Full Container loaded on vessel", "scenario": "SC3", "notes": "Actual"},
    "S54": {"internal_code": "FUL", "internal_name": "Full Container discharge from vessel", "scenario": "SC3", "notes": "Actual"},
    "S55": {"internal_code": "EGI", "internal_name": "Empty Container returned", "scenario": "SC3", "notes": "Actual"},
    "S60": {"internal_code": "BCF", "internal_name": "Pre-Booking confirmed", "scenario": "SC3", "notes": "Actual"},
}

# ─── Internal-to-Bosch Structured Mapping ────────────────────────────────────
# Groups Bosch S-codes under Maersk internal milestone codes (from Milestone Mapping.xlsx).
INTERNAL_TO_BOSCH_MAPPING = {
    "BKG": {
        "label": "Shipment created",
        "bosch_codes": ["S00"],
        "description": "Shipment creation (SC4 only)",
    },
    "BCF": {
        "label": "Booking Confirmation",
        "bosch_codes": ["S16", "S60"],
        "description": "Shipment booked with carrier (SC4: S16) / Pre-Booking confirmed (SC3: S60)",
    },
    "PUP": {
        "label": "Collected",
        "bosch_codes": ["S02"],
        "description": "Goods collected (Actual); PUP_EST for Estimated",
    },
    "REC": {
        "label": "On hand at origin SVC",
        "bosch_codes": ["S10"],
        "description": "Received at origin service center",
    },
    "S11": {
        "label": "On hand at origin Hub/CC",
        "bosch_codes": ["S11"],
        "description": "On hand at origin Hub/CC (SC4 only)",
    },
    "GIN": {
        "label": "Tendered / Received origin CFS",
        "bosch_codes": ["S17", "S50"],
        "description": "Tendered carrier (SC4: S17) / Received origin CFS (Both: S50)",
    },
    "AED": {
        "label": "Documents rcvd from shipper",
        "bosch_codes": ["S46"],
        "description": "Documents received from shipper (SC4 only)",
    },
    "EGO": {
        "label": "Empty Container picked up",
        "bosch_codes": ["S52"],
        "description": "Empty container picked up (SC3 only)",
    },
    "FLO": {
        "label": "Full Container loaded on vessel",
        "bosch_codes": ["S53"],
        "description": "Full container loaded on vessel (SC3 only)",
    },
    "DEP": {
        "label": "Vessel/flight departed",
        "bosch_codes": ["S04"],
        "description": "Vessel/flight departed (Actual); ETD for Estimated",
    },
    "ARR": {
        "label": "Vessel/flight arrived",
        "bosch_codes": ["S07"],
        "description": "Vessel/flight arrived (Actual); ETA for Estimated",
    },
    "FUL": {
        "label": "Full Container discharge from vessel",
        "bosch_codes": ["S54"],
        "description": "Full container discharged from vessel (SC3 only)",
    },
    "FUN": {
        "label": "Arrived destination CFS",
        "bosch_codes": ["S51"],
        "description": "Arrived at destination CFS",
    },
    "S18": {
        "label": "Recovered from carrier",
        "bosch_codes": ["S18"],
        "description": "Recovered from carrier (SC4 only)",
    },
    "CAV": {
        "label": "On hand at destination Hub/CC",
        "bosch_codes": ["S12"],
        "description": "On hand at destination Hub/CC (SC4 only)",
    },
    "S13": {
        "label": "On hand at destination SVC",
        "bosch_codes": ["S13"],
        "description": "On hand at destination service center",
    },
    "GOU": {
        "label": "In delivery",
        "bosch_codes": ["S05"],
        "description": "Shipment in delivery",
    },
    "DDI": {
        "label": "Handover to broker",
        "bosch_codes": ["S45"],
        "description": "Handover to broker (Actual); DDE for Estimated",
    },
    "POD": {
        "label": "Delivered",
        "bosch_codes": ["S31"],
        "description": "Proof of delivery (Actual); POD_EST for Estimated",
    },
    "EGI": {
        "label": "Empty Container returned",
        "bosch_codes": ["S55"],
        "description": "Empty container returned (SC3 only)",
    },
}


# ─── Data Loading ────────────────────────────────────────────────────────────

def discover_files(data_dir):
    """Auto-discover SC3 and SC4 files, extract week numbers."""
    files = {"SC3": [], "SC4": []}
    for f in sorted(os.listdir(data_dir)):
        if not f.endswith(".xlsx") or f.startswith("~"):
            continue
        path = os.path.join(data_dir, f)
        # Extract week number
        cw_match = re.search(r"CW(\d+)", f, re.IGNORECASE)
        if not cw_match:
            continue
        week = int(cw_match.group(1))
        if "SC3" in f or "NGTM" in f:
            files["SC3"].append({"path": path, "week": week, "filename": f})
        elif "SC4" in f:
            files["SC4"].append({"path": path, "week": week, "filename": f})
    return files


def find_total_sheet(wb):
    """Find the TOTAL/ALL summary sheet regardless of naming convention."""
    for name in wb.sheet_names:
        stripped = name.strip().upper()
        if stripped.startswith("TOTAL") or stripped == "ALL":
            return name
    return None


def find_shipments_sheet(wb):
    """Find the shipments sheet regardless of naming convention."""
    for name in wb.sheet_names:
        if name.strip().lower() == "shipments":
            return name
    return None


def parse_total_sheet(file_path, scenario):
    """Parse the TOTAL summary sheet to get KPIs per milestone."""
    xl = pd.ExcelFile(file_path)
    sheet_name = find_total_sheet(xl)
    if sheet_name is None:
        print(f"  WARNING: No TOTAL sheet found in {file_path}")
        return pd.DataFrame()

    df = pd.read_excel(file_path, sheet_name=sheet_name, header=None)

    # Find header row (contains 'Required status')
    header_row = None
    for i in range(min(10, len(df))):
        row_vals = [str(v).strip() for v in df.iloc[i].values if pd.notna(v)]
        if any("Required status" in v for v in row_vals):
            header_row = i
            break

    if header_row is None:
        # For SC4 CW02v2 'ALL' sheet which has detail data, compute totals
        if scenario == "SC4":
            return compute_total_from_detail(file_path)
        print(f"  WARNING: Cannot find header in TOTAL sheet of {file_path}")
        return pd.DataFrame()

    df.columns = df.iloc[header_row].values
    df = df.iloc[header_row + 1:].reset_index(drop=True)

    # Standardize column names
    col_map = {}
    for c in df.columns:
        cs = str(c).strip().lower() if pd.notna(c) else ""
        if "required status" in cs:
            col_map[c] = "milestone"
        elif "status" in cs and "type" in cs:
            col_map[c] = "status_type"
        elif "service" in cs or "lsp" in cs or "provider" in cs or "query" in cs.lower():
            col_map[c] = "provider"
        elif "codes required" in cs or "required" in cs:
            col_map[c] = "required"
        elif "codes available" in cs and "completeness" not in cs:
            col_map[c] = "available"
        elif "codes in time" in cs and "timeliness" not in cs:
            col_map[c] = "in_time"
        elif "completeness" in cs:
            col_map[c] = "completeness"
        elif "timeliness" in cs:
            col_map[c] = "timeliness"

    df = df.rename(columns=col_map)

    # Keep only rows with valid milestone data
    df = df[df["milestone"].notna()].copy()
    df = df[df["milestone"].astype(str).str.startswith("S")].copy()

    # Extract milestone code (e.g., "S02" from "S02 - Collected")
    df["milestone_code"] = df["milestone"].apply(
        lambda x: str(x).split(" ")[0].strip() if pd.notna(x) else ""
    )
    df["milestone_name"] = df["milestone"].apply(
        lambda x: str(x).split(" - ", 1)[1].strip() if " - " in str(x) else str(x)
    )

    # Convert numeric columns
    for col in ["required", "available", "in_time", "completeness", "timeliness"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    return df


def compute_total_from_detail(file_path):
    """For files without a TOTAL summary (like SC4 CW02v2), compute from detail sheets."""
    xl = pd.ExcelFile(file_path)
    all_detail = []
    for sheet_name in xl.sheet_names:
        stripped = sheet_name.strip().lower()
        if stripped in ["shipments", "all"] or "ref" in stripped:
            # 'ALL' in CW02v2 is actually detail data
            if stripped == "all":
                pass  # We'll read it below
            else:
                continue

        df = pd.read_excel(file_path, sheet_name=sheet_name, header=None)
        # Find header row
        header_row = None
        for i in range(min(10, len(df))):
            row_vals = [str(v).strip() for v in df.iloc[i].values if pd.notna(v)]
            if any("STATUS_CODE_REQUIRED" in v or "Status Code" in v for v in row_vals):
                header_row = i
                break
            if any("CONSIGNMENT" in v for v in row_vals):
                header_row = i
                break

        if header_row is None:
            continue

        df.columns = df.iloc[header_row].values
        df = df.iloc[header_row + 1:].reset_index(drop=True)
        all_detail.append(df)

    if not all_detail:
        return pd.DataFrame()

    combined = pd.concat(all_detail, ignore_index=True)

    # Standardize columns
    col_map = {}
    for c in combined.columns:
        cs = str(c).strip().lower() if pd.notna(c) else ""
        if "status_code_required" in cs or "status code" in cs:
            col_map[c] = "milestone_code"
        elif "status_type" in cs:
            col_map[c] = "status_type"
        elif "status_code_available" in cs:
            col_map[c] = "available"

    combined = combined.rename(columns=col_map)

    if "milestone_code" not in combined.columns:
        return pd.DataFrame()

    combined["available"] = pd.to_numeric(combined["available"], errors="coerce")

    # Group and compute
    grouped = combined.groupby(["milestone_code", "status_type"]).agg(
        required=("available", "count"),
        available=("available", "sum"),
    ).reset_index()

    grouped["completeness"] = grouped["available"] / grouped["required"]
    grouped["in_time"] = np.nan
    grouped["timeliness"] = np.nan

    # Create milestone names
    milestone_names = {
        "S00": "Shipment created", "S02": "Collected", "S04": "Vessel/ flight departed",
        "S07": "Vessel/ flight arrived", "S10": "On hand at origin SVC",
        "S11": "On hand at origin Hub/ CC", "S12": "On hand at destination Hub/ CC",
        "S13": "On hand at destination SVC", "S16": "Shipment booked with carrier",
        "S17": "Tendered carrier", "S18": "Recovered from carrier",
        "S31": "Delivered", "S45": "Handover to broker", "S46": "Documents rcvd from shipper",
        "S50": "Received origin CFS", "S51": "Arrived destination CFS",
        "S05": "In delivery",
    }
    grouped["milestone_name"] = grouped["milestone_code"].map(
        lambda x: milestone_names.get(x, x)
    )
    grouped["milestone"] = grouped.apply(
        lambda r: f"{r['milestone_code']} - {r['milestone_name']}", axis=1
    )

    return grouped


def parse_shipments_sc3(file_path):
    """Parse SC3 shipments sheet for region/country data."""
    xl = pd.ExcelFile(file_path)
    sheet_name = find_shipments_sheet(xl)
    if sheet_name is None:
        return pd.DataFrame()

    df = pd.read_excel(file_path, sheet_name=sheet_name, header=None)

    # Find header row
    header_row = None
    for i in range(min(10, len(df))):
        row_vals = [str(v).strip() for v in df.iloc[i].values if pd.notna(v)]
        if any("LOAD_ID" in v for v in row_vals):
            header_row = i
            break

    if header_row is None:
        return pd.DataFrame()

    df.columns = df.iloc[header_row].values
    df = df.iloc[header_row + 1:].reset_index(drop=True)

    # Keep key columns
    keep_cols = []
    for c in df.columns:
        cs = str(c).strip() if pd.notna(c) else ""
        if cs in ["LOAD_TO", "Leg_Pick_up_Country", "Leg_Delivery_Country",
                   "Service_Load", "Plant_Code", "Steering_Partner_Country",
                   "Steering_Partner_Name",
                   "Status_Codes_available_Collected összege",
                   "Status_Codes_available_Delivered összege",
                   "Status_Codes_in_time_Collected összege",
                   "Status_Codes_in_time_Delivered összege"]:
            keep_cols.append(c)

    if not keep_cols:
        return pd.DataFrame()

    return df[keep_cols].copy()


def parse_shipments_sc4(file_path):
    """Parse SC4 shipments sheet for region/country data."""
    xl = pd.ExcelFile(file_path)
    sheet_name = find_shipments_sheet(xl)
    if sheet_name is None:
        return pd.DataFrame()

    df = pd.read_excel(file_path, sheet_name=sheet_name, header=None)

    # Find header row
    header_row = None
    for i in range(min(10, len(df))):
        row_vals = [str(v).strip() for v in df.iloc[i].values if pd.notna(v)]
        if any("UNIQUE_SHIPMENT_ID" in v for v in row_vals):
            header_row = i
            break

    if header_row is None:
        return pd.DataFrame()

    df.columns = df.iloc[header_row].values
    df = df.iloc[header_row + 1:].reset_index(drop=True)

    # Keep key columns
    keep_cols = []
    col_name_map = {}
    for c in df.columns:
        cs = str(c).strip() if pd.notna(c) else ""
        if cs in ["UNIQUE_SHIPMENT_ID", "CONSIGNOR_ADDRESS_COUNTRY",
                   "CONSIGNEE_ADDRESS_COUNTRY", "PICKUP_ADDRESS_COUNTRY",
                   "DELIVERY_ADDRESS_COUNTRY", "TRANSPORT_SERVICE_PRIORITY",
                   "CONSIGNOR_ADDRESS_NAME1", "CONSIGNEE_ADDRESS_NAME1",
                   "NetworkPart", "GB"]:
            keep_cols.append(c)
            col_name_map[c] = cs

    if not keep_cols:
        return pd.DataFrame()

    result = df[keep_cols].copy()
    result = result.rename(columns=col_name_map)
    return result


def parse_detail_sheets(file_path, scenario):
    """Parse FCL/LCL/BCO detail sheets for per-shipment milestone availability."""
    xl = pd.ExcelFile(file_path)
    all_detail = []

    for sheet_name in xl.sheet_names:
        stripped = sheet_name.strip().upper()
        # Identify FCL, LCL, BCO sheets (not REF sheets, not TOTAL, not shipments)
        if stripped in ["FCL", "LCL", "BCO"]:
            service_type = stripped
        elif stripped == "ALL":
            # CW02v2 ALL sheet contains all detail data
            service_type = "ALL"
        else:
            continue

        df = pd.read_excel(file_path, sheet_name=sheet_name, header=None)

        # Find header row
        header_row = None
        for i in range(min(10, len(df))):
            row_vals = [str(v).strip() for v in df.iloc[i].values if pd.notna(v)]
            if any("LOAD_TO" in v or "CONSIGNMENT" in v for v in row_vals):
                header_row = i
                break

        if header_row is None:
            continue

        df.columns = df.iloc[header_row].values
        df = df.iloc[header_row + 1:].reset_index(drop=True)

        # Standardize column names
        col_map = {}
        id_col = None
        for c in df.columns:
            cs = str(c).strip() if pd.notna(c) else ""
            if cs == "LOAD_TO":
                col_map[c] = "shipment_id"
                id_col = c
            elif cs == "CONSIGNMENT":
                col_map[c] = "shipment_id"
                id_col = c
            elif cs in ["Status Code", "STATUS_CODE_REQUIRED"]:
                col_map[c] = "milestone_code"
            elif cs == "STATUS_TYPE":
                col_map[c] = "status_type"
            elif "STATUS_CODE_AVAILABLE" in cs:
                col_map[c] = "available"

        df = df.rename(columns=col_map)

        if "milestone_code" not in df.columns:
            continue

        df["service_type"] = service_type
        df["available"] = pd.to_numeric(df.get("available", 0), errors="coerce").fillna(0)

        all_detail.append(df[["shipment_id", "milestone_code", "status_type", "available", "service_type"]].copy())

    if not all_detail:
        return pd.DataFrame()
    return pd.concat(all_detail, ignore_index=True)


# ─── Analysis Functions ──────────────────────────────────────────────────────

def build_kpi_table(files_dict):
    """Build master KPI table from all files."""
    all_kpis = []

    for scenario, file_list in files_dict.items():
        for file_info in file_list:
            week = file_info["week"]
            path = file_info["path"]
            print(f"Processing {scenario} CW{week:02d}: {file_info['filename']}")

            # Parse TOTAL sheet
            total_df = parse_total_sheet(path, scenario)
            if total_df.empty:
                print(f"  Skipping - no TOTAL data")
                continue

            total_df["scenario"] = scenario
            total_df["week"] = week
            all_kpis.append(total_df)

    if not all_kpis:
        return pd.DataFrame()

    master = pd.concat(all_kpis, ignore_index=True)
    return master


def build_region_table(files_dict):
    """Build region analysis from shipments data."""
    all_regions = []

    for scenario, file_list in files_dict.items():
        for file_info in file_list:
            week = file_info["week"]
            path = file_info["path"]

            if scenario == "SC3":
                shipments = parse_shipments_sc3(path)
                if shipments.empty:
                    continue
                # Standardize column names
                rename = {}
                for c in shipments.columns:
                    cs = str(c).strip()
                    if cs == "Leg_Pick_up_Country":
                        rename[c] = "origin_country"
                    elif cs == "Leg_Delivery_Country":
                        rename[c] = "dest_country"
                    elif cs == "Service_Load":
                        rename[c] = "service_type"
                    elif cs == "Steering_Partner_Country":
                        rename[c] = "steering_country"
                    elif cs == "Steering_Partner_Name":
                        rename[c] = "steering_partner"
                    elif "Collected" in cs and "available" in cs.lower():
                        rename[c] = "collected_available"
                    elif "Delivered" in cs and "available" in cs.lower():
                        rename[c] = "delivered_available"
                    elif "Collected" in cs and "time" in cs.lower():
                        rename[c] = "collected_in_time"
                    elif "Delivered" in cs and "time" in cs.lower():
                        rename[c] = "delivered_in_time"
                shipments = shipments.rename(columns=rename)

            else:
                shipments = parse_shipments_sc4(path)
                if shipments.empty:
                    continue
                # Map columns
                if "PICKUP_ADDRESS_COUNTRY" in shipments.columns:
                    shipments = shipments.rename(columns={
                        "PICKUP_ADDRESS_COUNTRY": "origin_country",
                        "DELIVERY_ADDRESS_COUNTRY": "dest_country",
                        "TRANSPORT_SERVICE_PRIORITY": "service_type",
                        "CONSIGNOR_ADDRESS_COUNTRY": "consignor_country",
                        "CONSIGNEE_ADDRESS_COUNTRY": "consignee_country",
                    })

            shipments["scenario"] = scenario
            shipments["week"] = week
            all_regions.append(shipments)

    if not all_regions:
        return pd.DataFrame()
    return pd.concat(all_regions, ignore_index=True)


def build_detail_table(files_dict):
    """Build detail-level milestone data per shipment."""
    all_detail = []

    for scenario, file_list in files_dict.items():
        for file_info in file_list:
            week = file_info["week"]
            path = file_info["path"]

            detail = parse_detail_sheets(path, scenario)
            if detail.empty:
                continue

            detail["scenario"] = scenario
            detail["week"] = week
            all_detail.append(detail)

    if not all_detail:
        return pd.DataFrame()
    return pd.concat(all_detail, ignore_index=True)


# ─── Drill-Down Data Loading ────────────────────────────────────────────────

def load_sc4_drilldown_data():
    """Load SC4 per-shipment completeness data; return only missing rows."""
    path = os.path.join(DRILLDOWN_DATA_DIR, SC4_DRILLDOWN_FILE)
    if not os.path.exists(path):
        print(f"  WARNING: SC4 drill-down file not found: {path}")
        return pd.DataFrame()

    df = pd.read_excel(path, sheet_name="2026 Febr ", header=2)

    # Normalize column names
    col_map = {}
    for c in df.columns:
        cs = str(c).strip()
        if cs == "CONSIGNMENT":
            col_map[c] = "shipment_id"
        elif cs == "HBL":
            col_map[c] = "hbl"
        elif cs == "MBL":
            col_map[c] = "mbl"
        elif cs == "STATUS_CODE_REQUIRED":
            col_map[c] = "status_code"
        elif cs == "STATUS_TYPE":
            col_map[c] = "status_type"
        elif "STATUS_CODE_AVAILABLE" in cs:
            col_map[c] = "available"
    df = df.rename(columns=col_map)
    df["available"] = pd.to_numeric(df["available"], errors="coerce").fillna(0).astype(int)
    df["scenario"] = "SC4"
    df["load_to"] = ""

    missing = df[df["available"] == 0].copy()
    missing["status_type"] = missing["status_type"].astype(str).str.strip().str.lower()

    keep = ["scenario", "status_code", "status_type", "hbl", "mbl", "shipment_id", "load_to"]
    for col in keep:
        if col not in missing.columns:
            missing[col] = ""
    return missing[keep]


def load_sc3_drilldown_data():
    """Load SC3 per-shipment completeness data; join with shipments for HBL."""
    path = os.path.join(DRILLDOWN_DATA_DIR, SC3_DRILLDOWN_FILE)
    if not os.path.exists(path):
        print(f"  WARNING: SC3 drill-down file not found: {path}")
        return pd.DataFrame()

    # Read completeness sheet
    comp_df = pd.read_excel(path, sheet_name="completeness febr", header=2)
    comp_col_map = {}
    for c in comp_df.columns:
        cs = str(c).strip()
        if cs == "LOAD_TO":
            comp_col_map[c] = "load_to"
        elif cs == "Status Code":
            comp_col_map[c] = "status_code"
        elif cs == "STATUS_TYPE":
            comp_col_map[c] = "status_type"
        elif "STATUS_CODE_AVAILABLE" in cs:
            comp_col_map[c] = "available"
    comp_df = comp_df.rename(columns=comp_col_map)
    comp_df["available"] = pd.to_numeric(comp_df["available"], errors="coerce").fillna(0).astype(int)

    missing = comp_df[comp_df["available"] == 0].copy()

    # Read shipments sheet (NOTE: trailing space in sheet name)
    try:
        ship_df = pd.read_excel(path, sheet_name="shipments ", header=0)
    except Exception:
        try:
            ship_df = pd.read_excel(path, sheet_name="shipments", header=0)
        except Exception:
            print("  WARNING: Could not read SC3 shipments sheet")
            ship_df = pd.DataFrame()

    if not ship_df.empty:
        ship_col_map = {}
        for c in ship_df.columns:
            cs = str(c).strip()
            if cs == "LOAD_TO":
                ship_col_map[c] = "load_to"
            elif cs == "House_Airway_Bill_or_House_Bill_of_Lading":
                ship_col_map[c] = "hbl"
            elif cs == "Airway_Bill_or_Bill_of_lading":
                ship_col_map[c] = "mbl"
            elif cs == "Shipment_number":
                ship_col_map[c] = "shipment_id"
        ship_df = ship_df.rename(columns=ship_col_map)

        ship_keep = [c for c in ["load_to", "hbl", "mbl", "shipment_id"] if c in ship_df.columns]
        ship_slim = ship_df[ship_keep].drop_duplicates(subset=["load_to"])

        missing = missing.merge(ship_slim, on="load_to", how="left")

    missing["scenario"] = "SC3"
    missing["status_type"] = missing["status_type"].astype(str).str.strip().str.lower()

    keep = ["scenario", "status_code", "status_type", "hbl", "mbl", "shipment_id", "load_to"]
    for col in keep:
        if col not in missing.columns:
            missing[col] = ""
    return missing[keep]


def build_drilldown_json(sc3_dd, sc4_dd):
    """Build drill-down data dict keyed by 'scenario|status_code|status_type'."""
    combined = pd.concat([sc3_dd, sc4_dd], ignore_index=True)
    if combined.empty:
        return {}

    drilldown = {}
    for (scenario, status_code, status_type), group in combined.groupby(
        ["scenario", "status_code", "status_type"]
    ):
        key = f"{scenario.lower()}|{status_code}|{status_type}"
        records = []
        for _, row in group.iterrows():
            rec = {}
            hbl = str(row.get("hbl", "")).strip()
            mbl = str(row.get("mbl", "")).strip()
            sid = str(row.get("shipment_id", "")).strip()
            lt = str(row.get("load_to", "")).strip()

            if hbl and hbl != "nan":
                rec["h"] = hbl
            if mbl and mbl != "nan":
                rec["m"] = mbl
            if sid and sid != "nan":
                rec["s"] = sid
            if lt and lt != "nan":
                rec["l"] = lt

            if rec:
                records.append(rec)

        if records:
            drilldown[key] = records

    return drilldown


# ─── Report Generation ──────────────────────────────────────────────────────

def generate_html_report(kpi_df, region_df, detail_df, drilldown_data=None):
    """Generate comprehensive HTML dashboard."""

    # Color scheme
    COLORS = {
        "primary": "#1a237e",
        "success": "#2e7d32",
        "warning": "#f57f17",
        "danger": "#c62828",
        "sc3": "#1565c0",
        "sc4": "#6a1b9a",
        "bg": "#f5f5f5",
        "card_bg": "#ffffff",
    }

    def pct(val):
        if pd.isna(val):
            return "N/A"
        return f"{val*100:.1f}%"

    def color_for_val(val, target):
        if pd.isna(val):
            return COLORS["warning"]
        if val >= target:
            return COLORS["success"]
        elif val >= target * 0.85:
            return COLORS["warning"]
        else:
            return COLORS["danger"]

    # ── Prepare data ──
    latest_week = kpi_df["week"].max()
    weeks = sorted(kpi_df["week"].unique())

    # Filter to Actual status type for primary KPIs (Estimated is secondary)
    actual_df = kpi_df[kpi_df["status_type"].str.strip().str.lower() == "actual"].copy()
    estimated_df = kpi_df[kpi_df["status_type"].str.strip().str.lower() == "estimated"].copy()

    # Key milestones filter
    key_ms = KEY_MILESTONES_ALL + KEY_MILESTONES_SC4_ONLY
    key_actual = actual_df[actual_df["milestone_code"].isin(key_ms)].copy()
    key_estimated = estimated_df[estimated_df["milestone_code"].isin(key_ms)].copy()

    # ── Build sections ──
    sections = []

    # ────────────────── Section 1: Executive Summary ──────────────────
    latest_actual = actual_df[actual_df["week"] == latest_week]
    latest_key = latest_actual[latest_actual["milestone_code"].isin(key_ms)]

    latest_estimated = estimated_df[estimated_df["week"] == latest_week]
    latest_key_estimated = latest_estimated[latest_estimated["milestone_code"].isin(key_ms)]

    # Calculate weighted averages for latest week
    def weighted_avg(df, col):
        valid = df[df[col].notna() & df["required"].notna()]
        if valid.empty or valid["required"].sum() == 0:
            return np.nan
        return (valid[col] * valid["required"]).sum() / valid["required"].sum()

    # Actual executive cards
    exec_cards = []
    for sc in ["SC3", "SC4"]:
        sc_data = latest_key[latest_key["scenario"] == sc]
        if sc_data.empty:
            continue
        comp = weighted_avg(sc_data, "completeness")
        time = weighted_avg(sc_data, "timeliness")
        exec_cards.append({
            "scenario": sc,
            "completeness": comp,
            "timeliness": time,
            "shipments": int(sc_data["required"].max()) if not sc_data.empty else 0,
        })

    # Estimated executive cards
    exec_cards_estimated = []
    for sc in ["SC3", "SC4"]:
        sc_data_est = latest_key_estimated[latest_key_estimated["scenario"] == sc]
        if sc_data_est.empty:
            continue
        comp_est = weighted_avg(sc_data_est, "completeness")
        time_est = weighted_avg(sc_data_est, "timeliness")
        exec_cards_estimated.append({
            "scenario": sc,
            "completeness": comp_est,
            "timeliness": time_est,
            "shipments": int(sc_data_est["required"].max()) if not sc_data_est.empty else 0,
        })

    # Overall weighted avg across both (Actual)
    overall_comp = weighted_avg(latest_key, "completeness")
    overall_time = weighted_avg(latest_key, "timeliness")

    # Overall weighted avg across both (Estimated)
    overall_comp_est = weighted_avg(latest_key_estimated, "completeness")
    overall_time_est = weighted_avg(latest_key_estimated, "timeliness")

    # Compute gap to target
    comp_gap = TARGET_COMPLETENESS - overall_comp if not np.isnan(overall_comp) else np.nan
    time_gap = TARGET_TIMELINESS - overall_time if not np.isnan(overall_time) else np.nan
    comp_gap_est = TARGET_COMPLETENESS - overall_comp_est if not np.isnan(overall_comp_est) else np.nan
    time_gap_est = TARGET_TIMELINESS - overall_time_est if not np.isnan(overall_time_est) else np.nan

    # ────────────────── Section 2: Weekly Trend Data ──────────────────
    trend_data = {}
    trend_data_estimated = {}
    for sc in ["SC3", "SC4"]:
        # Actual trends
        sc_actual = actual_df[actual_df["scenario"] == sc]
        sc_key = sc_actual[sc_actual["milestone_code"].isin(key_ms)]
        weekly = []
        for w in weeks:
            w_data = sc_key[sc_key["week"] == w]
            if w_data.empty:
                continue
            weekly.append({
                "week": f"CW{w:02d}",
                "completeness": weighted_avg(w_data, "completeness"),
                "timeliness": weighted_avg(w_data, "timeliness"),
                "total_required": w_data["required"].sum(),
            })
        trend_data[sc] = pd.DataFrame(weekly)

        # Estimated trends
        sc_estimated = estimated_df[estimated_df["scenario"] == sc]
        sc_key_est = sc_estimated[sc_estimated["milestone_code"].isin(key_ms)]
        weekly_est = []
        for w in weeks:
            w_data_est = sc_key_est[sc_key_est["week"] == w]
            if w_data_est.empty:
                continue
            weekly_est.append({
                "week": f"CW{w:02d}",
                "completeness": weighted_avg(w_data_est, "completeness"),
                "timeliness": weighted_avg(w_data_est, "timeliness"),
                "total_required": w_data_est["required"].sum(),
            })
        trend_data_estimated[sc] = pd.DataFrame(weekly_est)

    # ────────────────── Section 3: Per-Milestone Breakdown ────────────
    # Latest week, all milestones, by scenario
    milestone_breakdown = {}
    milestone_breakdown_estimated = {}
    for sc in ["SC3", "SC4"]:
        # Actual breakdown
        sc_actual = actual_df[(actual_df["scenario"] == sc) & (actual_df["week"] == latest_week)]
        if not sc_actual.empty:
            rows = []
            for _, r in sc_actual.iterrows():
                ms_code = r["milestone_code"]
                is_key = ms_code in key_ms
                rows.append({
                    "milestone": r["milestone"],
                    "milestone_code": ms_code,
                    "is_key": is_key,
                    "required": int(r["required"]) if pd.notna(r["required"]) else 0,
                    "available": int(r["available"]) if pd.notna(r["available"]) else 0,
                    "in_time": int(r["in_time"]) if pd.notna(r["in_time"]) else 0,
                    "completeness": r["completeness"],
                    "timeliness": r["timeliness"],
                    "comp_gap": TARGET_COMPLETENESS - r["completeness"] if pd.notna(r["completeness"]) else np.nan,
                    "time_gap": TARGET_TIMELINESS - r["timeliness"] if pd.notna(r["timeliness"]) else np.nan,
                })
            milestone_breakdown[sc] = pd.DataFrame(rows)

        # Estimated breakdown
        sc_est = estimated_df[(estimated_df["scenario"] == sc) & (estimated_df["week"] == latest_week)]
        if not sc_est.empty:
            rows_est = []
            for _, r in sc_est.iterrows():
                ms_code = r["milestone_code"]
                is_key = ms_code in key_ms
                rows_est.append({
                    "milestone": r["milestone"],
                    "milestone_code": ms_code,
                    "is_key": is_key,
                    "required": int(r["required"]) if pd.notna(r["required"]) else 0,
                    "available": int(r["available"]) if pd.notna(r["available"]) else 0,
                    "in_time": int(r["in_time"]) if pd.notna(r["in_time"]) else 0,
                    "completeness": r["completeness"],
                    "timeliness": r["timeliness"],
                    "comp_gap": TARGET_COMPLETENESS - r["completeness"] if pd.notna(r["completeness"]) else np.nan,
                    "time_gap": TARGET_TIMELINESS - r["timeliness"] if pd.notna(r["timeliness"]) else np.nan,
                })
            milestone_breakdown_estimated[sc] = pd.DataFrame(rows_est)

    # ────────────────── Section 4: Region Analysis ────────────────────
    region_analysis = {}
    if not region_df.empty:
        for sc in ["SC3", "SC4"]:
            sc_regions = region_df[(region_df["scenario"] == sc) & (region_df["week"] == latest_week)]
            if sc_regions.empty:
                continue

            if sc == "SC3":
                if "origin_country" in sc_regions.columns:
                    origin_counts = sc_regions["origin_country"].value_counts().head(15)
                    dest_counts = sc_regions["dest_country"].value_counts().head(15)
                    region_analysis[f"{sc}_origins"] = origin_counts
                    region_analysis[f"{sc}_destinations"] = dest_counts
            else:
                if "origin_country" in sc_regions.columns:
                    origin_counts = sc_regions["origin_country"].value_counts().head(15)
                    dest_counts = sc_regions["dest_country"].value_counts().head(15)
                    region_analysis[f"{sc}_origins"] = origin_counts
                    region_analysis[f"{sc}_destinations"] = dest_counts

    # ────────────────── Section 5: Service Type Analysis ──────────────
    service_analysis = {}
    if not detail_df.empty:
        for sc in ["SC3", "SC4"]:
            sc_detail = detail_df[
                (detail_df["scenario"] == sc) &
                (detail_df["week"] == latest_week) &
                (detail_df["milestone_code"].isin(key_ms))
            ]
            if sc_detail.empty:
                continue

            svc_summary = sc_detail.groupby(["service_type", "milestone_code"]).agg(
                total=("available", "count"),
                available_sum=("available", "sum"),
            ).reset_index()
            svc_summary["completeness"] = svc_summary["available_sum"] / svc_summary["total"]
            service_analysis[sc] = svc_summary

    # ────────────────── Section 6: Root Cause & Key Enablers ─────────
    # Find the milestones with largest absolute gap (required * gap) - Actual
    root_cause_data = []
    for sc in ["SC3", "SC4"]:
        if sc not in milestone_breakdown:
            continue
        mb = milestone_breakdown[sc]
        for _, r in mb.iterrows():
            if pd.notna(r["comp_gap"]) and r["comp_gap"] > 0:
                missing_count = r["required"] - r["available"]
                root_cause_data.append({
                    "scenario": sc,
                    "milestone": r["milestone"],
                    "milestone_code": r["milestone_code"],
                    "is_key": r["is_key"],
                    "required": r["required"],
                    "available_count": r["available"],
                    "in_time_count": r["in_time"],
                    "missing": missing_count,
                    "completeness": r["completeness"],
                    "comp_gap": r["comp_gap"],
                    "timeliness": r["timeliness"],
                    "time_gap": r["time_gap"],
                    "impact_score": missing_count,  # absolute number of missing statuses
                })

    root_cause_df = pd.DataFrame(root_cause_data)
    if not root_cause_df.empty:
        root_cause_df = root_cause_df.sort_values("impact_score", ascending=False)

    # Estimated root cause data
    root_cause_data_est = []
    for sc in ["SC3", "SC4"]:
        if sc not in milestone_breakdown_estimated:
            continue
        mb_est = milestone_breakdown_estimated[sc]
        for _, r in mb_est.iterrows():
            if pd.notna(r["comp_gap"]) and r["comp_gap"] > 0:
                missing_count = r["required"] - r["available"]
                root_cause_data_est.append({
                    "scenario": sc,
                    "milestone": r["milestone"],
                    "milestone_code": r["milestone_code"],
                    "is_key": r["is_key"],
                    "required": r["required"],
                    "available_count": r["available"],
                    "in_time_count": r["in_time"],
                    "missing": missing_count,
                    "completeness": r["completeness"],
                    "comp_gap": r["comp_gap"],
                    "timeliness": r["timeliness"],
                    "time_gap": r["time_gap"],
                    "impact_score": missing_count,
                })

    root_cause_df_est = pd.DataFrame(root_cause_data_est)
    if not root_cause_df_est.empty:
        root_cause_df_est = root_cause_df_est.sort_values("impact_score", ascending=False)

    # ────────────────── Section 7: Key Milestone Trends ───────────────
    key_milestone_trends = {}
    key_milestone_trends_est = {}
    for ms_code in key_ms:
        # Actual trends
        ms_trends = []
        for sc in ["SC3", "SC4"]:
            sc_actual = actual_df[
                (actual_df["scenario"] == sc) &
                (actual_df["milestone_code"] == ms_code)
            ]
            for w in weeks:
                w_data = sc_actual[sc_actual["week"] == w]
                if w_data.empty:
                    continue
                ms_trends.append({
                    "week": f"CW{w:02d}",
                    "scenario": sc,
                    "completeness": w_data["completeness"].values[0] if not w_data.empty else np.nan,
                    "timeliness": w_data["timeliness"].values[0] if not w_data.empty else np.nan,
                })
        if ms_trends:
            key_milestone_trends[ms_code] = pd.DataFrame(ms_trends)

        # Estimated trends
        ms_trends_est = []
        for sc in ["SC3", "SC4"]:
            sc_est = estimated_df[
                (estimated_df["scenario"] == sc) &
                (estimated_df["milestone_code"] == ms_code)
            ]
            for w in weeks:
                w_data_est = sc_est[sc_est["week"] == w]
                if w_data_est.empty:
                    continue
                ms_trends_est.append({
                    "week": f"CW{w:02d}",
                    "scenario": sc,
                    "completeness": w_data_est["completeness"].values[0] if not w_data_est.empty else np.nan,
                    "timeliness": w_data_est["timeliness"].values[0] if not w_data_est.empty else np.nan,
                })
        if ms_trends_est:
            key_milestone_trends_est[ms_code] = pd.DataFrame(ms_trends_est)

    # ────────────────── Build HTML ────────────────────────────────────

    html_parts = []

    # -- CSS --
    html_parts.append(f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Bosch Milestone KPI Dashboard</title>
<style>
    * {{ margin: 0; padding: 0; box-sizing: border-box; }}
    body {{
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: {COLORS['bg']};
        color: #333;
        line-height: 1.6;
    }}
    .header {{
        background: linear-gradient(135deg, {COLORS['primary']}, #283593);
        color: white;
        padding: 24px 40px;
    }}
    .header h1 {{ font-size: 28px; font-weight: 700; }}
    .header .subtitle {{ opacity: 0.85; font-size: 14px; margin-top: 4px; }}
    .container {{ max-width: 1400px; margin: 0 auto; padding: 24px 40px; }}
    .section {{ margin-bottom: 32px; }}
    .section-title {{
        font-size: 20px; font-weight: 700; color: {COLORS['primary']};
        margin-bottom: 16px; padding-bottom: 8px;
        border-bottom: 2px solid {COLORS['primary']};
    }}
    .cards {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }}
    .card {{
        background: {COLORS['card_bg']}; border-radius: 12px;
        padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }}
    .card-title {{ font-size: 13px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }}
    .card-value {{ font-size: 36px; font-weight: 700; margin: 8px 0; }}
    .card-detail {{ font-size: 13px; color: #888; }}
    .tag {{
        display: inline-block; padding: 2px 8px; border-radius: 4px;
        font-size: 11px; font-weight: 600; color: white; margin-left: 6px;
    }}
    .tag-key {{ background: {COLORS['primary']}; }}
    .tag-sc3 {{ background: {COLORS['sc3']}; }}
    .tag-sc4 {{ background: {COLORS['sc4']}; }}
    .tag-gap {{ background: {COLORS['danger']}; }}
    .tag-estimated {{ background: #ef6c00; }}
    .tag-actual {{ background: #2e7d32; }}
    .data-type-label {{
        display: inline-block; padding: 4px 14px; border-radius: 6px 6px 0 0;
        font-weight: 700; font-size: 13px; color: white; margin-right: 4px;
    }}
    table {{
        width: 100%; border-collapse: collapse; background: white;
        border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.06);
    }}
    th {{
        background: {COLORS['primary']}; color: white; padding: 10px 12px;
        text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;
    }}
    td {{ padding: 10px 12px; border-bottom: 1px solid #eee; font-size: 13px; }}
    tr:hover td {{ background: #f8f9ff; }}
    tr.key-row td {{ font-weight: 600; background: #fffde7; }}
    tr.key-row:hover td {{ background: #fff9c4; }}
    .bar-container {{ width: 100%; background: #e0e0e0; border-radius: 4px; height: 8px; position: relative; }}
    .bar {{ height: 8px; border-radius: 4px; transition: width 0.3s; }}
    .target-line {{
        position: absolute; top: -2px; height: 12px; width: 2px; background: #333;
    }}
    .sc-badge {{
        display: inline-block; padding: 4px 12px; border-radius: 6px;
        font-weight: 600; font-size: 13px; color: white; margin-right: 8px;
    }}
    .flex-row {{ display: flex; gap: 24px; flex-wrap: wrap; }}
    .flex-half {{ flex: 1; min-width: 400px; }}
    .focus-box {{
        background: #fff3e0; border-left: 4px solid {COLORS['warning']};
        padding: 16px 20px; border-radius: 0 8px 8px 0; margin-bottom: 16px;
    }}
    .action-box {{
        background: #e8f5e9; border-left: 4px solid {COLORS['success']};
        padding: 16px 20px; border-radius: 0 8px 8px 0; margin-bottom: 16px;
    }}
    .danger-box {{
        background: #ffebee; border-left: 4px solid {COLORS['danger']};
        padding: 16px 20px; border-radius: 0 8px 8px 0; margin-bottom: 16px;
    }}
    .mapping-placeholder {{
        background: #e3f2fd; border: 2px dashed {COLORS['sc3']};
        padding: 20px; border-radius: 8px; text-align: center; color: #555;
    }}
    .chart {{ width: 100%; }}
    .metric-inline {{
        display: inline-flex; align-items: center; gap: 4px;
    }}
    .dot {{ width: 8px; height: 8px; border-radius: 50%; display: inline-block; }}
    .footer {{
        text-align: center; padding: 20px; color: #999; font-size: 12px;
        border-top: 1px solid #e0e0e0; margin-top: 40px;
    }}
    .tag-internal {{
        display: inline-block; padding: 2px 8px; border-radius: 4px;
        font-size: 11px; font-weight: 600; color: white; background: #5c6bc0;
    }}
    table.sortable th {{
        cursor: pointer; user-select: none; position: relative;
        padding-right: 20px;
    }}
    table.sortable th::after {{
        content: '\\2195'; position: absolute; right: 4px; opacity: 0.4;
        font-size: 12px;
    }}
    table.sortable th.sort-asc::after {{
        content: '\\25B2'; opacity: 0.9;
    }}
    table.sortable th.sort-desc::after {{
        content: '\\25BC'; opacity: 0.9;
    }}
    .cv-filter-btn, .cv-view-btn {{
        padding: 6px 14px; border-radius: 6px; border: 1.5px solid #ccc;
        background: white; color: #555; font-size: 12px; font-weight: 600;
        cursor: pointer; transition: all 0.2s;
    }}
    .cv-filter-btn:hover, .cv-view-btn:hover {{ border-color: {COLORS['primary']}; color: {COLORS['primary']}; }}
    .cv-filter-btn.cv-active {{ background: {COLORS['primary']}; color: white; border-color: {COLORS['primary']}; }}
    .cv-view-btn.cv-active {{ background: {COLORS['primary']}; color: white; border-color: {COLORS['primary']}; }}
    #combined-view-table th {{
        vertical-align: bottom;
    }}
    #combined-view-table td {{
        padding: 8px 10px; font-size: 12px;
    }}
    .cv-hidden {{ display: none !important; }}
    .severity-badge {{
        display: inline-block; padding: 3px 10px; border-radius: 12px;
        font-size: 11px; font-weight: 700; color: white; text-transform: uppercase;
        letter-spacing: 0.3px;
    }}
    .severity-critical {{ background: {COLORS['danger']}; }}
    .severity-warning {{ background: {COLORS['warning']}; }}
    .severity-ok {{ background: {COLORS['success']}; }}
    .comp-pair {{
        display: flex; align-items: center; gap: 4px; font-size: 12px;
    }}
    .comp-pair .act {{ font-weight: 600; }}
    .comp-pair .arrow {{ color: #999; font-size: 10px; }}
    .comp-pair .est {{ color: #888; font-size: 11px; }}
    .summary-strip {{
        display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 16px;
    }}
    .summary-chip {{
        display: flex; align-items: center; gap: 8px; padding: 10px 18px;
        border-radius: 8px; background: white; box-shadow: 0 1px 4px rgba(0,0,0,0.08);
        font-size: 13px; font-weight: 600;
    }}
    .summary-chip .chip-count {{
        font-size: 22px; font-weight: 700;
    }}
    .priority-rank {{
        display: inline-flex; align-items: center; justify-content: center;
        width: 24px; height: 24px; border-radius: 50%; font-size: 11px;
        font-weight: 700; color: white;
    }}
    tr.severity-row-critical {{ border-left: 4px solid {COLORS['danger']}; }}
    tr.severity-row-warning {{ border-left: 4px solid {COLORS['warning']}; }}
    tr.severity-row-ok {{ border-left: 4px solid {COLORS['success']}; }}

    /* Drill-down panel styles */
    .cv-drilldown-row:hover td {{ background: #e8eaf6 !important; }}
    .cv-drilldown-row.dd-active td {{ background: #c5cae9 !important; border-bottom: none; }}
    .dd-row td {{ padding: 0 !important; border-bottom: 2px solid {COLORS['primary']}; background: #f5f5f5 !important; }}
    .dd-panel {{ padding: 16px 20px; background: #fafafa; border-left: 4px solid {COLORS['primary']}; margin: 0; }}
    .dd-header {{ display: flex; align-items: center; gap: 16px; margin-bottom: 12px; }}
    .dd-title {{ font-weight: 700; font-size: 14px; color: {COLORS['primary']}; }}
    .dd-count {{ font-size: 13px; color: {COLORS['danger']}; font-weight: 600; background: #ffebee; padding: 2px 10px; border-radius: 12px; }}
    .dd-close {{ margin-left: auto; padding: 4px 12px; border: 1px solid #ccc; border-radius: 4px; background: white; cursor: pointer; font-size: 13px; color: #666; }}
    .dd-close:hover {{ background: #ffebee; color: {COLORS['danger']}; border-color: {COLORS['danger']}; }}
    .dd-search-row {{ display: flex; gap: 8px; margin-bottom: 10px; align-items: center; }}
    .dd-search {{ flex: 1; max-width: 350px; padding: 6px 12px; border: 1.5px solid #ccc; border-radius: 6px; font-size: 12px; outline: none; }}
    .dd-search:focus {{ border-color: {COLORS['primary']}; box-shadow: 0 0 0 2px rgba(26,35,126,0.1); }}
    .dd-export-btn {{ padding: 6px 14px; border: 1.5px solid {COLORS['success']}; border-radius: 6px; background: white; color: {COLORS['success']}; font-size: 12px; font-weight: 600; cursor: pointer; }}
    .dd-export-btn:hover {{ background: #e8f5e9; }}
    .dd-table-wrap {{ max-height: 400px; overflow-y: auto; border: 1px solid #e0e0e0; border-radius: 6px; }}
    .dd-table {{ width: 100%; border-collapse: collapse; font-size: 12px; }}
    .dd-table th {{ background: #5c6bc0; color: white; padding: 8px 10px; font-size: 11px; text-transform: uppercase; position: sticky; top: 0; z-index: 1; }}
    .dd-table td {{ padding: 5px 10px; border-bottom: 1px solid #eee; font-size: 12px; }}
    .dd-table tbody tr:hover td {{ background: #e8eaf6; }}
    .dd-mono {{ font-family: 'SF Mono', 'Fira Code', monospace; font-size: 11px; letter-spacing: -0.2px; }}
    .dd-show-all {{ text-align: center; padding: 8px; font-size: 12px; color: #666; background: #fff; border-top: 1px solid #e0e0e0; }}
    .dd-show-all-btn {{ padding: 4px 14px; border: 1.5px solid {COLORS['primary']}; border-radius: 4px; background: white; color: {COLORS['primary']}; font-weight: 600; font-size: 12px; cursor: pointer; margin-left: 8px; }}
    .dd-show-all-btn:hover {{ background: #e8eaf6; }}
    .dd-no-data {{ text-align: center; padding: 20px; color: #999; font-size: 13px; font-style: italic; }}
</style>
</head>
<body>
""")

    # -- Header --
    html_parts.append(f"""
<div class="header">
    <h1>Bosch Milestone KPI Dashboard</h1>
    <div class="subtitle">
        Latest Week: CW{latest_week:02d} &nbsp;|&nbsp;
        Weeks Analyzed: {', '.join(f'CW{w:02d}' for w in weeks)} &nbsp;|&nbsp;
        Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')} &nbsp;|&nbsp;
        Targets: Completeness {pct(TARGET_COMPLETENESS)} &nbsp;/&nbsp; Timeliness {pct(TARGET_TIMELINESS)}
    </div>
</div>
<div class="container">
""")

    # ── Executive Summary ──
    html_parts.append(f"""
<div class="section">
    <div class="section-title">Executive Summary — CW{latest_week:02d} (Key Milestones: S02, S04, S07, S31{', S00' if any(c['scenario']=='SC4' for c in exec_cards) else ''})</div>

    <h3 style="margin:0 0 12px 0;font-size:15px;color:{COLORS['primary']}"><span class="data-type-label tag-actual">ACTUAL</span></h3>
    <div class="cards">
        <div class="card">
            <div class="card-title">Overall Completeness (Weighted Avg) <span class="tag tag-actual">Actual</span></div>
            <div class="card-value" style="color: {color_for_val(overall_comp, TARGET_COMPLETENESS)}">{pct(overall_comp)}</div>
            <div class="card-detail">Target: {pct(TARGET_COMPLETENESS)} &nbsp;|&nbsp; Gap: {pct(comp_gap) if not np.isnan(comp_gap) else 'N/A'}</div>
        </div>
        <div class="card">
            <div class="card-title">Overall Timeliness (Weighted Avg) <span class="tag tag-actual">Actual</span></div>
            <div class="card-value" style="color: {color_for_val(overall_time, TARGET_TIMELINESS)}">{pct(overall_time)}</div>
            <div class="card-detail">Target: {pct(TARGET_TIMELINESS)} &nbsp;|&nbsp; Gap: {pct(time_gap) if not np.isnan(time_gap) else 'N/A'}</div>
        </div>
""")
    for card in exec_cards:
        html_parts.append(f"""
        <div class="card">
            <div class="card-title"><span class="sc-badge" style="background:{'#1565c0' if card['scenario']=='SC3' else '#6a1b9a'}">{card['scenario']}</span> Key Milestones <span class="tag tag-actual">Actual</span></div>
            <div class="card-value">
                <span style="color:{color_for_val(card['completeness'], TARGET_COMPLETENESS)}">{pct(card['completeness'])}</span>
                <span style="font-size:16px;color:#999">/</span>
                <span style="color:{color_for_val(card['timeliness'], TARGET_TIMELINESS)};font-size:28px">{pct(card['timeliness'])}</span>
            </div>
            <div class="card-detail">Completeness / Timeliness</div>
        </div>
""")
    html_parts.append("    </div>\n")

    # Estimated executive cards
    html_parts.append(f"""
    <h3 style="margin:24px 0 12px 0;font-size:15px;color:#ef6c00"><span class="data-type-label tag-estimated">ESTIMATED</span></h3>
    <div class="cards">
        <div class="card" style="border-left:4px solid #ef6c00">
            <div class="card-title">Overall Completeness (Weighted Avg) <span class="tag tag-estimated">Estimated</span></div>
            <div class="card-value" style="color: {color_for_val(overall_comp_est, TARGET_COMPLETENESS)}">{pct(overall_comp_est)}</div>
            <div class="card-detail">Target: {pct(TARGET_COMPLETENESS)} &nbsp;|&nbsp; Gap: {pct(comp_gap_est) if not np.isnan(comp_gap_est) else 'N/A'}</div>
        </div>
        <div class="card" style="border-left:4px solid #ef6c00">
            <div class="card-title">Overall Timeliness (Weighted Avg) <span class="tag tag-estimated">Estimated</span></div>
            <div class="card-value" style="color: {color_for_val(overall_time_est, TARGET_TIMELINESS)}">{pct(overall_time_est)}</div>
            <div class="card-detail">Target: {pct(TARGET_TIMELINESS)} &nbsp;|&nbsp; Gap: {pct(time_gap_est) if not np.isnan(time_gap_est) else 'N/A'}</div>
        </div>
""")
    for card_est in exec_cards_estimated:
        html_parts.append(f"""
        <div class="card" style="border-left:4px solid #ef6c00">
            <div class="card-title"><span class="sc-badge" style="background:{'#1565c0' if card_est['scenario']=='SC3' else '#6a1b9a'}">{card_est['scenario']}</span> Key Milestones <span class="tag tag-estimated">Estimated</span></div>
            <div class="card-value">
                <span style="color:{color_for_val(card_est['completeness'], TARGET_COMPLETENESS)}">{pct(card_est['completeness'])}</span>
                <span style="font-size:16px;color:#999">/</span>
                <span style="color:{color_for_val(card_est['timeliness'], TARGET_TIMELINESS)};font-size:28px">{pct(card_est['timeliness'])}</span>
            </div>
            <div class="card-detail">Completeness / Timeliness</div>
        </div>
""")
    html_parts.append("    </div>\n</div>\n")

    # ── Weekly Trends Chart (Plotly) ──
    fig_trend = make_subplots(
        rows=1, cols=2,
        subplot_titles=("Completeness Trend (Key Milestones)", "Timeliness Trend (Key Milestones)"),
        horizontal_spacing=0.08,
    )
    # Actual traces (solid lines)
    for sc, color in [("SC3", COLORS["sc3"]), ("SC4", COLORS["sc4"])]:
        if sc not in trend_data or trend_data[sc].empty:
            continue
        td = trend_data[sc]
        fig_trend.add_trace(
            go.Scatter(x=td["week"], y=td["completeness"], name=f"{sc} Actual",
                       mode="lines+markers", line=dict(color=color, width=2),
                       marker=dict(size=8), legendgroup=f"{sc}_actual"),
            row=1, col=1,
        )
        fig_trend.add_trace(
            go.Scatter(x=td["week"], y=td["timeliness"], name=f"{sc} Actual",
                       mode="lines+markers", line=dict(color=color, width=2),
                       marker=dict(size=8, symbol="square"),
                       legendgroup=f"{sc}_actual", showlegend=False),
            row=1, col=2,
        )
    # Estimated traces (dashed lines, lighter)
    for sc, color in [("SC3", COLORS["sc3"]), ("SC4", COLORS["sc4"])]:
        if sc not in trend_data_estimated or trend_data_estimated[sc].empty:
            continue
        td_est = trend_data_estimated[sc]
        # Use lighter opacity for estimated
        est_color = color
        fig_trend.add_trace(
            go.Scatter(x=td_est["week"], y=td_est["completeness"], name=f"{sc} Estimated",
                       mode="lines+markers", line=dict(color=est_color, width=2, dash="dash"),
                       marker=dict(size=6, symbol="diamond"), opacity=0.6,
                       legendgroup=f"{sc}_est"),
            row=1, col=1,
        )
        fig_trend.add_trace(
            go.Scatter(x=td_est["week"], y=td_est["timeliness"], name=f"{sc} Estimated",
                       mode="lines+markers", line=dict(color=est_color, width=2, dash="dash"),
                       marker=dict(size=6, symbol="diamond"), opacity=0.6,
                       legendgroup=f"{sc}_est", showlegend=False),
            row=1, col=2,
        )
    # Target lines
    fig_trend.add_hline(y=TARGET_COMPLETENESS, line_dash="dash", line_color="red",
                        annotation_text=f"Target {pct(TARGET_COMPLETENESS)}",
                        annotation_position="top left", row=1, col=1)
    fig_trend.add_hline(y=TARGET_TIMELINESS, line_dash="dash", line_color="red",
                        annotation_text=f"Target {pct(TARGET_TIMELINESS)}",
                        annotation_position="top left", row=1, col=2)
    fig_trend.update_yaxes(range=[0, 1.05], tickformat=".0%", row=1, col=1)
    fig_trend.update_yaxes(range=[0, 1.05], tickformat=".0%", row=1, col=2)
    fig_trend.update_layout(height=400, template="plotly_white",
                            margin=dict(t=60, b=40, l=60, r=30),
                            legend=dict(orientation="h", yanchor="bottom", y=-0.25))
    trend_html = fig_trend.to_html(full_html=False, include_plotlyjs="cdn")

    html_parts.append(f"""
<div class="section">
    <div class="section-title">Weekly Trends — Key Milestones (Actual &amp; Estimated)</div>
    <div class="card-detail" style="margin-bottom:12px;font-size:12px;color:#666">
        Solid lines = Actual &nbsp;|&nbsp; Dashed lines = Estimated
    </div>
    {trend_html}
</div>
""")

    # ── Key Milestone Detail Trends ──
    fig_ms = make_subplots(
        rows=2, cols=2,
        subplot_titles=[f"{ms} — Completeness & Timeliness" for ms in KEY_MILESTONES_ALL],
        horizontal_spacing=0.08, vertical_spacing=0.12,
    )
    for idx, ms_code in enumerate(KEY_MILESTONES_ALL):
        row = idx // 2 + 1
        col = idx % 2 + 1
        # Actual traces (solid)
        if ms_code in key_milestone_trends:
            mt = key_milestone_trends[ms_code]
            for sc, color in [("SC3", COLORS["sc3"]), ("SC4", COLORS["sc4"])]:
                sc_mt = mt[mt["scenario"] == sc]
                if sc_mt.empty:
                    continue
                fig_ms.add_trace(
                    go.Scatter(x=sc_mt["week"], y=sc_mt["completeness"],
                               name=f"{sc} Comp Actual", mode="lines+markers",
                               line=dict(color=color, width=2), marker=dict(size=6),
                               legendgroup=f"{sc}_actual",
                               showlegend=(idx == 0)),
                    row=row, col=col,
                )
                fig_ms.add_trace(
                    go.Scatter(x=sc_mt["week"], y=sc_mt["timeliness"],
                               name=f"{sc} Time Actual", mode="lines+markers",
                               line=dict(color=color, width=2, dash="dot"),
                               marker=dict(size=6, symbol="square"),
                               legendgroup=f"{sc}_actual_t",
                               showlegend=(idx == 0)),
                    row=row, col=col,
                )
        # Estimated traces (dashed, lighter)
        if ms_code in key_milestone_trends_est:
            mt_est = key_milestone_trends_est[ms_code]
            for sc, color in [("SC3", COLORS["sc3"]), ("SC4", COLORS["sc4"])]:
                sc_mt_est = mt_est[mt_est["scenario"] == sc]
                if sc_mt_est.empty:
                    continue
                fig_ms.add_trace(
                    go.Scatter(x=sc_mt_est["week"], y=sc_mt_est["completeness"],
                               name=f"{sc} Comp Est", mode="lines+markers",
                               line=dict(color=color, width=1.5, dash="dash"),
                               marker=dict(size=5, symbol="diamond"), opacity=0.55,
                               legendgroup=f"{sc}_est",
                               showlegend=(idx == 0)),
                    row=row, col=col,
                )
                fig_ms.add_trace(
                    go.Scatter(x=sc_mt_est["week"], y=sc_mt_est["timeliness"],
                               name=f"{sc} Time Est", mode="lines+markers",
                               line=dict(color=color, width=1.5, dash="dashdot"),
                               marker=dict(size=5, symbol="diamond"), opacity=0.55,
                               legendgroup=f"{sc}_est_t",
                               showlegend=(idx == 0)),
                    row=row, col=col,
                )
        fig_ms.update_yaxes(range=[0, 1.05], tickformat=".0%", row=row, col=col)

    fig_ms.update_layout(height=600, template="plotly_white",
                         margin=dict(t=60, b=40, l=60, r=30),
                         legend=dict(orientation="h", yanchor="bottom", y=-0.15))
    ms_html = fig_ms.to_html(full_html=False, include_plotlyjs=False)

    # S00 chart for SC4
    s00_html = ""
    if "S00" in key_milestone_trends:
        fig_s00 = go.Figure()
        mt = key_milestone_trends["S00"]
        sc4_mt = mt[mt["scenario"] == "SC4"]
        if not sc4_mt.empty:
            fig_s00.add_trace(go.Scatter(x=sc4_mt["week"], y=sc4_mt["completeness"],
                                         name="Completeness Actual", mode="lines+markers",
                                         line=dict(color=COLORS["sc4"], width=2)))
            fig_s00.add_trace(go.Scatter(x=sc4_mt["week"], y=sc4_mt["timeliness"],
                                         name="Timeliness Actual", mode="lines+markers",
                                         line=dict(color=COLORS["sc4"], width=2, dash="dot")))
        # Estimated S00
        if "S00" in key_milestone_trends_est:
            mt_est_s00 = key_milestone_trends_est["S00"]
            sc4_mt_est = mt_est_s00[mt_est_s00["scenario"] == "SC4"]
            if not sc4_mt_est.empty:
                fig_s00.add_trace(go.Scatter(x=sc4_mt_est["week"], y=sc4_mt_est["completeness"],
                                             name="Completeness Est", mode="lines+markers",
                                             line=dict(color=COLORS["sc4"], width=1.5, dash="dash"),
                                             marker=dict(symbol="diamond"), opacity=0.55))
                fig_s00.add_trace(go.Scatter(x=sc4_mt_est["week"], y=sc4_mt_est["timeliness"],
                                             name="Timeliness Est", mode="lines+markers",
                                             line=dict(color=COLORS["sc4"], width=1.5, dash="dashdot"),
                                             marker=dict(symbol="diamond"), opacity=0.55))
        if not sc4_mt.empty or ("S00" in key_milestone_trends_est and not sc4_mt_est.empty):
            fig_s00.add_hline(y=TARGET_COMPLETENESS, line_dash="dash", line_color="red")
            fig_s00.add_hline(y=TARGET_TIMELINESS, line_dash="dash", line_color="orange")
            fig_s00.update_yaxes(range=[0, 1.05], tickformat=".0%")
            fig_s00.update_layout(height=300, template="plotly_white", title="S00 — Shipment Created (SC4 Only)",
                                  margin=dict(t=60, b=40, l=60, r=30))
            s00_html = fig_s00.to_html(full_html=False, include_plotlyjs=False)

    html_parts.append(f"""
<div class="section">
    <div class="section-title">Key Milestone Trends — S02, S04, S07, S31 (Actual &amp; Estimated)</div>
    <div class="card-detail" style="margin-bottom:12px;font-size:12px;color:#666">
        Solid lines = Actual &nbsp;|&nbsp; Dashed lines = Estimated
    </div>
    {ms_html}
    {f'<div style="margin-top:16px">{s00_html}</div>' if s00_html else ''}
</div>
""")

    # ── Priority Issues View: Unified, sorted by severity ──
    def _get_internal_code_combined(ms_code, status_type="actual"):
        """Look up the Maersk internal milestone code for a Bosch S-code.
        Returns est_code (e.g. POD_EST, ETD, ETA) for Estimated status type."""
        mapping = BOSCH_TO_INTERNAL_MAPPING.get(ms_code)
        if not mapping:
            return ""
        if status_type == "estimated" and "est_code" in mapping:
            return mapping["est_code"]
        return mapping["internal_code"]

    # Build a unified dataset: milestone_code -> {sc3_actual, sc3_est, sc4_actual, sc4_est}
    combined_milestones = {}
    all_milestone_codes_ordered = []

    for sc in ["SC3", "SC4"]:
        for dtype_label, source_dict in [("actual", milestone_breakdown), ("estimated", milestone_breakdown_estimated)]:
            if sc not in source_dict or source_dict[sc].empty:
                continue
            for _, r in source_dict[sc].iterrows():
                ms_code = r["milestone_code"]
                if ms_code not in combined_milestones:
                    combined_milestones[ms_code] = {
                        "milestone_name": r["milestone"],
                        "milestone_code": ms_code,
                        "internal_code": _get_internal_code_combined(ms_code, "actual"),
                        "internal_code_est": _get_internal_code_combined(ms_code, "estimated"),
                        "is_key": r["is_key"],
                    }
                    all_milestone_codes_ordered.append(ms_code)
                key_prefix = f"{sc.lower()}_{dtype_label}"
                combined_milestones[ms_code][f"{key_prefix}_required"] = r["required"]
                combined_milestones[ms_code][f"{key_prefix}_available"] = r["available"]
                combined_milestones[ms_code][f"{key_prefix}_in_time"] = r["in_time"]
                combined_milestones[ms_code][f"{key_prefix}_completeness"] = r["completeness"]
                combined_milestones[ms_code][f"{key_prefix}_timeliness"] = r["timeliness"]
                combined_milestones[ms_code][f"{key_prefix}_comp_gap"] = r["comp_gap"]

    # Deduplicate ordered list while preserving order
    seen = set()
    unique_ordered = []
    for mc in all_milestone_codes_ordered:
        if mc not in seen:
            seen.add(mc)
            unique_ordered.append(mc)
    all_milestone_codes_ordered = unique_ordered

    # Build flat priority issue list: one row per milestone+scenario+data_type
    priority_issues = []
    for ms_code in all_milestone_codes_ordered:
        ms = combined_milestones[ms_code]
        for sc in ["SC3", "SC4"]:
            sc_lower = sc.lower()
            for dtype in ["actual", "estimated"]:
                comp = ms.get(f"{sc_lower}_{dtype}_completeness")
                time_val = ms.get(f"{sc_lower}_{dtype}_timeliness")
                req = ms.get(f"{sc_lower}_{dtype}_required")
                avail = ms.get(f"{sc_lower}_{dtype}_available")

                # Skip if no data for this scenario+type
                if comp is None or (isinstance(comp, float) and np.isnan(comp)):
                    continue

                # Calculate metrics
                comp_gap_val = TARGET_COMPLETENESS - comp if pd.notna(comp) else 0
                time_gap_val = TARGET_TIMELINESS - time_val if pd.notna(time_val) else 0
                missing = int(req - avail) if pd.notna(req) and pd.notna(avail) else 0

                # Priority score: weighted by gap, missing count, and key status
                key_weight = 2.0 if ms["is_key"] else 1.0
                # Actual data is more important than estimated
                type_weight = 1.0 if dtype == "actual" else 0.7
                priority_score = ((max(comp_gap_val, 0) * 100 + max(time_gap_val, 0) * 50) * key_weight + missing * 0.1) * type_weight

                # Severity
                if comp_gap_val > 0.30 or time_gap_val > 0.30:
                    severity = "critical"
                elif comp_gap_val > 0.05 or time_gap_val > 0:
                    severity = "warning"
                else:
                    severity = "ok"

                # Get correct internal code for data type
                internal_code = _get_internal_code_combined(ms_code, dtype)

                priority_issues.append({
                    "ms_code": ms_code,
                    "milestone_name": ms["milestone_name"],
                    "internal_code": internal_code,
                    "is_key": ms["is_key"],
                    "scenario": sc,
                    "data_type": dtype,
                    "required": int(req) if pd.notna(req) else 0,
                    "comp": comp,
                    "time": time_val,
                    "comp_gap": comp_gap_val,
                    "time_gap": time_gap_val,
                    "missing": missing,
                    "priority_score": priority_score,
                    "severity": severity,
                })

    # Sort by priority score descending (worst issues first)
    priority_issues.sort(key=lambda x: x["priority_score"], reverse=True)

    # Count severities for summary strip
    n_critical = sum(1 for p in priority_issues if p["severity"] == "critical")
    n_warning = sum(1 for p in priority_issues if p["severity"] == "warning")
    n_ok = sum(1 for p in priority_issues if p["severity"] == "ok")
    total_missing = sum(p["missing"] for p in priority_issues if p["missing"] > 0)

    # Build table rows
    combined_rows_html = ""
    for rank, issue in enumerate(priority_issues, 1):
        key_class = "key-row" if issue["is_key"] else ""
        key_tag = '<span class="tag tag-key">KEY</span>' if issue["is_key"] else ""
        sc_tag_class = "tag-sc3" if issue["scenario"] == "SC3" else "tag-sc4"
        severity_class = f"severity-row-{issue['severity']}"
        dtype_tag_class = "tag-actual" if issue["data_type"] == "actual" else "tag-estimated"
        dtype_label = "Actual" if issue["data_type"] == "actual" else "Est."

        # Severity badge
        sev_label = issue["severity"].upper()
        sev_badge = f'<span class="severity-badge severity-{issue["severity"]}">{sev_label}</span>'

        # Completeness cell
        comp_clr = color_for_val(issue["comp"], TARGET_COMPLETENESS)
        comp_html = f'<span style="color:{comp_clr}">{pct(issue["comp"])}</span>'

        # Timeliness cell
        time_clr = color_for_val(issue["time"], TARGET_TIMELINESS)
        time_html = f'<span style="color:{time_clr}">{pct(issue["time"])}</span>'

        # Completeness bar
        comp_bar_w = issue["comp"] * 100 if pd.notna(issue["comp"]) else 0
        comp_bar_html = f'''<div class="bar-container" style="height:5px;margin-top:3px">
            <div class="bar" style="width:{comp_bar_w}%;background:{comp_clr};height:5px"></div>
            <div class="target-line" style="left:{TARGET_COMPLETENESS*100}%;height:9px;top:-2px"></div>
        </div>'''

        # Timeliness bar
        time_bar_w = issue["time"] * 100 if pd.notna(issue["time"]) else 0
        time_bar_html = f'''<div class="bar-container" style="height:5px;margin-top:3px">
            <div class="bar" style="width:{time_bar_w}%;background:{time_clr};height:5px"></div>
            <div class="target-line" style="left:{TARGET_TIMELINESS*100}%;height:9px;top:-2px"></div>
        </div>'''

        # Gap display
        comp_gap_display = pct(issue["comp_gap"]) if issue["comp_gap"] > 0 else "On target"
        comp_gap_clr = COLORS['danger'] if issue["comp_gap"] > 0.05 else (COLORS['warning'] if issue["comp_gap"] > 0 else COLORS['success'])
        time_gap_display = pct(issue["time_gap"]) if issue["time_gap"] > 0 else "On target"
        time_gap_clr = COLORS['danger'] if issue["time_gap"] > 0.05 else (COLORS['warning'] if issue["time_gap"] > 0 else COLORS['success'])

        # Missing count
        missing_display = f'<strong style="color:{COLORS["danger"]}">{issue["missing"]}</strong>' if issue["missing"] > 0 else '<span style="color:#aaa">0</span>'

        combined_rows_html += f'''
            <tr class="{key_class} {severity_class} cv-drilldown-row" data-severity="{issue['severity']}" data-sc="{issue['scenario'].lower()}" data-key="{str(issue['is_key']).lower()}" data-dtype="{issue['data_type']}" data-ms="{issue['ms_code']}" style="cursor:pointer">
                <td style="text-align:center">{rank}</td>
                <td style="white-space:nowrap">{issue["milestone_name"]} {key_tag}</td>
                <td><span class="tag-internal">{issue["internal_code"]}</span></td>
                <td style="text-align:center"><span class="tag {sc_tag_class}">{issue["scenario"]}</span></td>
                <td style="text-align:center"><span class="tag {dtype_tag_class}">{dtype_label}</span></td>
                <td style="text-align:right">{issue["required"]}</td>
                <td><div class="comp-pair">{comp_html}</div>{comp_bar_html}</td>
                <td><div class="comp-pair">{time_html}</div>{time_bar_html}</td>
                <td style="text-align:right;color:{comp_gap_clr};font-weight:600">{comp_gap_display}</td>
                <td style="text-align:right;color:{time_gap_clr};font-weight:600">{time_gap_display}</td>
                <td style="text-align:right">{missing_display}</td>
                <td style="text-align:center">{sev_badge}</td>
            </tr>
'''

    # Build gap-to-target chart: horizontal bar chart sorted by severity
    combined_chart_html = ""
    if priority_issues:
        # Show top 20 issues (or all if fewer)
        chart_issues = [p for p in priority_issues if p["comp_gap"] > 0 or p["time_gap"] > 0][:20]
        if chart_issues:
            chart_labels = [f'{p["ms_code"]} ({p["scenario"]})' for p in chart_issues]
            chart_comp_gaps = [p["comp_gap"] * 100 for p in chart_issues]
            chart_time_gaps = [p["time_gap"] * 100 for p in chart_issues]
            chart_colors_comp = [COLORS['danger'] if g > 30 else (COLORS['warning'] if g > 5 else COLORS['success']) for g in chart_comp_gaps]
            chart_colors_time = [COLORS['danger'] if g > 30 else (COLORS['warning'] if g > 5 else COLORS['success']) for g in chart_time_gaps]

            fig_combined = make_subplots(
                rows=1, cols=2,
                subplot_titles=("Completeness Gap to 95% Target", "Timeliness Gap to 70% Target"),
                horizontal_spacing=0.12,
            )

            fig_combined.add_trace(
                go.Bar(
                    y=chart_labels, x=chart_comp_gaps, orientation='h',
                    marker=dict(color=chart_colors_comp),
                    text=[f"{g:.1f}pp" for g in chart_comp_gaps],
                    textposition="auto", textfont=dict(size=10),
                    name="Completeness Gap",
                ),
                row=1, col=1,
            )
            fig_combined.add_trace(
                go.Bar(
                    y=chart_labels, x=chart_time_gaps, orientation='h',
                    marker=dict(color=chart_colors_time),
                    text=[f"{g:.1f}pp" for g in chart_time_gaps],
                    textposition="auto", textfont=dict(size=10),
                    name="Timeliness Gap", showlegend=False,
                ),
                row=1, col=2,
            )

            chart_height = max(350, len(chart_issues) * 28 + 80)
            fig_combined.update_layout(
                height=chart_height, template="plotly_white",
                margin=dict(t=50, b=30, l=140, r=30),
                showlegend=False,
            )
            fig_combined.update_xaxes(title_text="Gap (pp)", row=1, col=1)
            fig_combined.update_xaxes(title_text="Gap (pp)", row=1, col=2)
            fig_combined.update_yaxes(autorange="reversed", row=1, col=1)
            fig_combined.update_yaxes(autorange="reversed", row=1, col=2)
            combined_chart_html = fig_combined.to_html(full_html=False, include_plotlyjs=False)

    # Drill-down hint
    drilldown_hint = ""
    if drilldown_data:
        dd_count = sum(len(v) for v in drilldown_data.values())
        drilldown_hint = f'<div style="margin-bottom:8px;font-size:11px;color:#999;font-style:italic">Click any row to drill down to individual missing shipments ({dd_count:,} missing records loaded)</div>'

    html_parts.append(f"""
<div class="section">
    <div class="section-title">Priority Issues — All Milestones &amp; Scenarios (CW{latest_week:02d})</div>
    <div class="card-detail" style="margin-bottom:16px;font-size:12px;color:#666">
        Sorted by severity &nbsp;|&nbsp;
        Actual and Estimated shown as <strong>separate rows</strong> with correct internal codes &nbsp;|&nbsp;
        Gap = distance to target (Comp 95% / Time 70%)
    </div>

    <div class="summary-strip">
        <div class="summary-chip" style="border-left:4px solid {COLORS['danger']}">
            <span class="chip-count" style="color:{COLORS['danger']}">{n_critical}</span>
            <span>Critical</span>
        </div>
        <div class="summary-chip" style="border-left:4px solid {COLORS['warning']}">
            <span class="chip-count" style="color:{COLORS['warning']}">{n_warning}</span>
            <span>Warning</span>
        </div>
        <div class="summary-chip" style="border-left:4px solid {COLORS['success']}">
            <span class="chip-count" style="color:{COLORS['success']}">{n_ok}</span>
            <span>On Target</span>
        </div>
        <div class="summary-chip" style="border-left:4px solid #555">
            <span class="chip-count" style="color:#333">{total_missing:,}</span>
            <span>Total Missing Statuses</span>
        </div>
    </div>

    <div style="margin-bottom:16px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <span style="font-weight:600;font-size:13px;color:#555">Filter:</span>
        <button class="cv-filter-btn cv-active" data-filter="all" onclick="cvFilter('all',this)">All Milestones</button>
        <button class="cv-filter-btn" data-filter="key" onclick="cvFilter('key',this)">Key Only</button>
        <span style="margin-left:12px;font-weight:600;font-size:13px;color:#555">Severity:</span>
        <button class="cv-filter-btn cv-active" data-filter="all-sev" onclick="cvFilterSeverity('all',this)">All</button>
        <button class="cv-filter-btn" data-filter="critical" onclick="cvFilterSeverity('critical',this)">Critical</button>
        <button class="cv-filter-btn" data-filter="warning" onclick="cvFilterSeverity('warning',this)">Warning</button>
        <span style="margin-left:12px;font-weight:600;font-size:13px;color:#555">Scenario:</span>
        <button class="cv-filter-btn cv-active" data-filter="all-sc" onclick="cvFilterScenario('all',this)">All</button>
        <button class="cv-filter-btn" data-filter="sc3" onclick="cvFilterScenario('sc3',this)">SC3</button>
        <button class="cv-filter-btn" data-filter="sc4" onclick="cvFilterScenario('sc4',this)">SC4</button>
        <span style="margin-left:12px;font-weight:600;font-size:13px;color:#555">Type:</span>
        <button class="cv-filter-btn cv-active" data-filter="all-dtype" onclick="cvFilterType('all',this)">All</button>
        <button class="cv-filter-btn" data-filter="actual" onclick="cvFilterType('actual',this)">Actual</button>
        <button class="cv-filter-btn" data-filter="estimated" onclick="cvFilterType('estimated',this)">Estimated</button>
    </div>

    {combined_chart_html}

    {drilldown_hint}

    <div style="overflow-x:auto;margin-top:20px">
    <table class="sortable" id="combined-view-table">
        <thead>
            <tr>
                <th style="text-align:center;width:40px">#</th>
                <th>Milestone</th>
                <th>Code</th>
                <th style="text-align:center">Scenario</th>
                <th style="text-align:center">Type</th>
                <th style="text-align:right">Req</th>
                <th style="min-width:140px">Completeness</th>
                <th style="min-width:140px">Timeliness</th>
                <th style="text-align:right">Comp Gap</th>
                <th style="text-align:right">Time Gap</th>
                <th style="text-align:right">Missing</th>
                <th style="text-align:center">Severity</th>
            </tr>
        </thead>
        <tbody>
            {combined_rows_html}
        </tbody>
    </table>
    </div>
</div>
""")

    # ── Milestone Breakdown Tables (Actual + Estimated) ──
    def _get_internal_code(ms_code, status_type="actual"):
        """Look up the Maersk internal milestone code for a Bosch S-code.
        Returns est_code (e.g. POD_EST, ETD, ETA) for Estimated status type."""
        mapping = BOSCH_TO_INTERNAL_MAPPING.get(ms_code)
        if not mapping:
            return ""
        if status_type == "estimated" and "est_code" in mapping:
            return mapping["est_code"]
        return mapping["internal_code"]

    def _build_milestone_table_rows(mb_df, status_type="actual"):
        """Helper to build HTML table rows from a milestone breakdown dataframe."""
        rows_html = ""
        for _, r in mb_df.iterrows():
            key_class = 'class="key-row"' if r["is_key"] else ""
            key_tag = f'<span class="tag tag-key">KEY</span>' if r["is_key"] else ""
            internal_code = _get_internal_code(r["milestone_code"], status_type)
            comp_color = color_for_val(r["completeness"], TARGET_COMPLETENESS)
            time_color = color_for_val(r["timeliness"], TARGET_TIMELINESS)
            comp_bar_w = r["completeness"] * 100 if pd.notna(r["completeness"]) else 0
            time_bar_w = r["timeliness"] * 100 if pd.notna(r["timeliness"]) else 0

            rows_html += f"""
            <tr {key_class}>
                <td>{r['milestone']} {key_tag}</td>
                <td><span class="tag-internal">{internal_code}</span></td>
                <td style="text-align:right">{r['required']}</td>
                <td style="text-align:right">{r['available']}</td>
                <td style="text-align:right">{r['in_time']}</td>
                <td>
                    <div style="display:flex;align-items:center;gap:8px">
                        <span style="color:{comp_color};font-weight:600;min-width:50px">{pct(r['completeness'])}</span>
                        <div class="bar-container" style="flex:1">
                            <div class="bar" style="width:{comp_bar_w}%;background:{comp_color}"></div>
                            <div class="target-line" style="left:{TARGET_COMPLETENESS*100}%"></div>
                        </div>
                    </div>
                </td>
                <td>
                    <div style="display:flex;align-items:center;gap:8px">
                        <span style="color:{time_color};font-weight:600;min-width:50px">{pct(r['timeliness'])}</span>
                        <div class="bar-container" style="flex:1">
                            <div class="bar" style="width:{time_bar_w}%;background:{time_color}"></div>
                            <div class="target-line" style="left:{TARGET_TIMELINESS*100}%"></div>
                        </div>
                    </div>
                </td>
                <td style="text-align:right;color:{COLORS['danger'] if pd.notna(r['comp_gap']) and r['comp_gap']>0 else COLORS['success']}">
                    {pct(r['comp_gap']) if pd.notna(r['comp_gap']) else '-'}
                </td>
            </tr>
"""
        return rows_html

    def _milestone_table_html(table_rows_html):
        """Wrap table rows in a standard milestone table."""
        return f"""
    <table class="sortable">
        <thead>
            <tr>
                <th>Milestone</th>
                <th>Internal Code</th>
                <th style="text-align:right">Required</th>
                <th style="text-align:right">Available</th>
                <th style="text-align:right">In Time</th>
                <th style="width:200px">Completeness</th>
                <th style="width:200px">Timeliness</th>
                <th style="text-align:right">Gap to 95%</th>
            </tr>
        </thead>
        <tbody>
            {table_rows_html}
        </tbody>
    </table>
"""

    for sc in ["SC3", "SC4"]:
        sc_label = "SC3 (EDI Booking)" if sc == "SC3" else "SC4 (Email Booking)"
        sc_color = COLORS["sc3"] if sc == "SC3" else COLORS["sc4"]

        has_actual = sc in milestone_breakdown and not milestone_breakdown[sc].empty
        has_estimated = sc in milestone_breakdown_estimated and not milestone_breakdown_estimated[sc].empty

        if not has_actual and not has_estimated:
            continue

        html_parts.append(f"""
<div class="section">
    <div class="section-title">
        <span class="sc-badge" style="background:{sc_color}">{sc}</span>
        {sc_label} — All Milestones (CW{latest_week:02d})
    </div>
""")

        # Actual table
        if has_actual:
            actual_rows = _build_milestone_table_rows(milestone_breakdown[sc])
            html_parts.append(f"""
    <h3 style="margin:0 0 8px 0;font-size:15px;color:{COLORS['primary']}">
        <span class="data-type-label tag-actual">ACTUAL</span>
    </h3>
    {_milestone_table_html(actual_rows)}
""")
        else:
            html_parts.append("""
    <div class="focus-box"><strong>Actual</strong> — No actual data available for this scenario/week.</div>
""")

        # Estimated table
        if has_estimated:
            est_rows = _build_milestone_table_rows(milestone_breakdown_estimated[sc], status_type="estimated")
            html_parts.append(f"""
    <h3 style="margin:24px 0 8px 0;font-size:15px;color:#ef6c00">
        <span class="data-type-label tag-estimated">ESTIMATED</span>
    </h3>
    {_milestone_table_html(est_rows)}
""")
        else:
            html_parts.append("""
    <div class="focus-box" style="margin-top:16px"><strong>Estimated</strong> — No estimated data available for this scenario/week.</div>
""")

        html_parts.append("</div>\n")

    # ── Root Cause Analysis & Focus Areas ──
    def _build_root_cause_section(rc_df, label, label_color, tag_class, status_type="actual"):
        """Build root cause HTML for either actual or estimated data."""
        if rc_df.empty:
            return f'<div class="focus-box"><strong>{label}</strong> — No gaps to target found.</div>'

        top_issues_inner = rc_df.head(10)

        focus_inner = ""
        for sc in ["SC3", "SC4"]:
            sc_issues_inner = rc_df[rc_df["scenario"] == sc]
            key_issues_inner = sc_issues_inner[sc_issues_inner["is_key"]].head(5)
            if key_issues_inner.empty:
                continue
            worst_inner = key_issues_inner.iloc[0]
            focus_inner += f"""
            <div class="danger-box">
                <strong>{sc} — Biggest Gap (Key Milestones, {label}):</strong> {worst_inner['milestone']}<br>
                Completeness: {pct(worst_inner['completeness'])} (gap: {pct(worst_inner['comp_gap'])}) &nbsp;|&nbsp;
                Missing: {int(worst_inner['missing'])} out of {int(worst_inner['required'])} status codes<br>
                Timeliness: {pct(worst_inner['timeliness'])} (gap: {pct(worst_inner['time_gap'])})
            </div>
"""

        enabler_inner = f"<div class='action-box'><strong>Key Enablers to Reach Targets ({label}):</strong><ul style='margin-top:8px'>"
        for sc in ["SC3", "SC4"]:
            sc_issues_inner = rc_df[(rc_df["scenario"] == sc) & (rc_df["is_key"])]
            if sc_issues_inner.empty:
                continue
            for _, issue in sc_issues_inner.iterrows():
                if issue["comp_gap"] > 0.05:
                    enabler_inner += f"<li><strong>{sc}/{issue['milestone_code']}</strong>: Need {int(issue['missing'])} more status codes ({pct(issue['comp_gap'])} gap to target)</li>"
                if pd.notna(issue.get("time_gap")) and issue["time_gap"] > 0.05:
                    in_time_val = issue.get("in_time_count", np.nan)
                    late_count = int(issue["available_count"] - in_time_val) if pd.notna(in_time_val) else 0
                    enabler_inner += f"<li><strong>{sc}/{issue['milestone_code']}</strong>: {late_count} status codes sent late ({pct(issue['time_gap'])} timeliness gap)</li>"
        enabler_inner += "</ul></div>"

        rc_rows_inner = ""
        for _, r in top_issues_inner.iterrows():
            key_tag = f'<span class="tag tag-key">KEY</span>' if r["is_key"] else ""
            sc_tag_inner = f'<span class="tag tag-{"sc3" if r["scenario"]=="SC3" else "sc4"}">{r["scenario"]}</span>'
            internal_code = _get_internal_code(r["milestone_code"], status_type)
            rc_rows_inner += f"""
            <tr {'class="key-row"' if r['is_key'] else ''}>
                <td>{sc_tag_inner} {r['milestone']} {key_tag}</td>
                <td><span class="tag-internal">{internal_code}</span></td>
                <td style="text-align:right">{int(r['missing'])}</td>
                <td style="text-align:right">{int(r['required'])}</td>
                <td style="text-align:right;color:{COLORS['danger']}">{pct(r['comp_gap'])}</td>
                <td style="text-align:right;color:{color_for_val(r['completeness'], TARGET_COMPLETENESS)}">{pct(r['completeness'])}</td>
                <td style="text-align:right;color:{color_for_val(r['timeliness'], TARGET_TIMELINESS)}">{pct(r['timeliness'])}</td>
            </tr>
"""

        return f"""
    {focus_inner}
    {enabler_inner}
    <h3 style="margin: 16px 0 8px; font-size: 15px; color: {label_color}">
        <span class="data-type-label {tag_class}">{label.upper()}</span> Top Gaps by Missing Status Codes
    </h3>
    <table class="sortable">
        <thead>
            <tr>
                <th>Milestone</th>
                <th>Internal Code</th>
                <th style="text-align:right">Missing Codes</th>
                <th style="text-align:right">Total Required</th>
                <th style="text-align:right">Gap to 95%</th>
                <th style="text-align:right">Completeness</th>
                <th style="text-align:right">Timeliness</th>
            </tr>
        </thead>
        <tbody>
            {rc_rows_inner}
        </tbody>
    </table>
"""

    if not root_cause_df.empty or not root_cause_df_est.empty:
        actual_rc_html = _build_root_cause_section(root_cause_df, "Actual", COLORS['primary'], "tag-actual", status_type="actual")
        est_rc_html = _build_root_cause_section(root_cause_df_est, "Estimated", "#ef6c00", "tag-estimated", status_type="estimated")

        html_parts.append(f"""
<div class="section">
    <div class="section-title">Root Cause Analysis & Key Enablers (CW{latest_week:02d})</div>
    {actual_rc_html}
    <div style="margin-top:32px;padding-top:16px;border-top:2px dashed #ef6c00"></div>
    {est_rc_html}
</div>
""")

    # ── Region Analysis ──
    if region_analysis:
        # Build region charts
        fig_regions = make_subplots(
            rows=2, cols=2,
            subplot_titles=["SC3 — Origin Countries", "SC3 — Destination Countries",
                            "SC4 — Origin Countries", "SC4 — Destination Countries"],
            horizontal_spacing=0.12, vertical_spacing=0.15,
        )
        positions = {
            "SC3_origins": (1, 1), "SC3_destinations": (1, 2),
            "SC4_origins": (2, 1), "SC4_destinations": (2, 2),
        }
        for key, (row, col) in positions.items():
            if key in region_analysis:
                data = region_analysis[key]
                sc = "SC3" if "SC3" in key else "SC4"
                fig_regions.add_trace(
                    go.Bar(x=data.index, y=data.values,
                           marker_color=COLORS["sc3"] if sc == "SC3" else COLORS["sc4"],
                           showlegend=False),
                    row=row, col=col,
                )

        fig_regions.update_layout(height=600, template="plotly_white",
                                  margin=dict(t=60, b=40, l=60, r=30))
        region_chart_html = fig_regions.to_html(full_html=False, include_plotlyjs=False)

        html_parts.append(f"""
<div class="section">
    <div class="section-title">Region Analysis — Shipment Distribution (CW{latest_week:02d})</div>
    <div class="focus-box">
        <strong>Focus Areas by Region:</strong> Countries with high shipment volume and low milestone completeness
        need the most attention. Use the milestone breakdown tables above to identify which milestones
        are underperforming, then cross-reference with these regional distributions to target improvement efforts.
    </div>
    {region_chart_html}
</div>
""")

    # ── Service Type Breakdown ──
    if service_analysis:
        for sc, svc_df in service_analysis.items():
            sc_color = COLORS["sc3"] if sc == "SC3" else COLORS["sc4"]
            fig_svc = go.Figure()
            for ms_code in key_ms:
                ms_data = svc_df[svc_df["milestone_code"] == ms_code]
                if ms_data.empty:
                    continue
                fig_svc.add_trace(go.Bar(
                    x=ms_data["service_type"], y=ms_data["completeness"],
                    name=ms_code,
                    text=ms_data["completeness"].apply(lambda v: f"{v*100:.0f}%"),
                    textposition="auto",
                ))
            fig_svc.add_hline(y=TARGET_COMPLETENESS, line_dash="dash", line_color="red",
                              annotation_text=f"Target {pct(TARGET_COMPLETENESS)}")
            fig_svc.update_yaxes(range=[0, 1.1], tickformat=".0%")
            fig_svc.update_layout(
                barmode="group", height=350, template="plotly_white",
                title=f"{sc} — Key Milestone Completeness by Service Type",
                margin=dict(t=60, b=40, l=60, r=30),
                legend=dict(orientation="h", yanchor="bottom", y=-0.2),
            )
            svc_html = fig_svc.to_html(full_html=False, include_plotlyjs=False)
            html_parts.append(f"""
<div class="section">
    <div class="section-title"><span class="sc-badge" style="background:{sc_color}">{sc}</span> Service Type Analysis (CW{latest_week:02d})</div>
    {svc_html}
</div>
""")

    # ── Week-over-Week Delta Tables (Actual + Estimated) ──
    if len(weeks) >= 2:
        prev_week = weeks[-2]

        def arrow(val):
            if pd.isna(val):
                return "-"
            if val > 0.005:
                return f'<span style="color:{COLORS["success"]}">&#9650; +{val*100:.1f}pp</span>'
            elif val < -0.005:
                return f'<span style="color:{COLORS["danger"]}">&#9660; {val*100:.1f}pp</span>'
            return f'<span style="color:#888">&#9644; 0.0pp</span>'

        def _build_wow_rows(source_df, status_type="actual"):
            """Build WoW delta rows from a given dataframe (actual or estimated)."""
            rows_out = ""
            for sc in ["SC3", "SC4"]:
                for ms_code in key_ms:
                    curr = source_df[
                        (source_df["scenario"] == sc) &
                        (source_df["milestone_code"] == ms_code) &
                        (source_df["week"] == latest_week)
                    ]
                    prev = source_df[
                        (source_df["scenario"] == sc) &
                        (source_df["milestone_code"] == ms_code) &
                        (source_df["week"] == prev_week)
                    ]
                    if curr.empty:
                        continue

                    curr_comp = curr["completeness"].values[0] if not curr.empty else np.nan
                    curr_time = curr["timeliness"].values[0] if not curr.empty else np.nan
                    prev_comp = prev["completeness"].values[0] if not prev.empty else np.nan
                    prev_time = prev["timeliness"].values[0] if not prev.empty else np.nan

                    delta_comp = curr_comp - prev_comp if pd.notna(curr_comp) and pd.notna(prev_comp) else np.nan
                    delta_time = curr_time - prev_time if pd.notna(curr_time) and pd.notna(prev_time) else np.nan

                    sc_tag = f'<span class="tag tag-{"sc3" if sc=="SC3" else "sc4"}">{sc}</span>'
                    internal_code = _get_internal_code(ms_code, status_type)
                    rows_out += f"""
                <tr>
                    <td>{sc_tag} {ms_code}</td>
                    <td><span class="tag-internal">{internal_code}</span></td>
                    <td style="text-align:right">{pct(prev_comp)}</td>
                    <td style="text-align:right;font-weight:600">{pct(curr_comp)}</td>
                    <td style="text-align:right">{arrow(delta_comp)}</td>
                    <td style="text-align:right">{pct(prev_time)}</td>
                    <td style="text-align:right;font-weight:600">{pct(curr_time)}</td>
                    <td style="text-align:right">{arrow(delta_time)}</td>
                </tr>
"""
            return rows_out

        wow_table_template = """
    <table class="sortable">
        <thead>
            <tr>
                <th>Milestone</th>
                <th>Internal Code</th>
                <th style="text-align:right">Prev Comp.</th>
                <th style="text-align:right">Curr Comp.</th>
                <th style="text-align:right">Delta Comp.</th>
                <th style="text-align:right">Prev Time.</th>
                <th style="text-align:right">Curr Time.</th>
                <th style="text-align:right">Delta Time.</th>
            </tr>
        </thead>
        <tbody>
            {rows}
        </tbody>
    </table>
"""

        actual_wow_rows = _build_wow_rows(actual_df, status_type="actual")
        estimated_wow_rows = _build_wow_rows(estimated_df, status_type="estimated")

        html_parts.append(f"""
<div class="section">
    <div class="section-title">Week-over-Week Change — Key Milestones (CW{prev_week:02d} -> CW{latest_week:02d})</div>

    <h3 style="margin:0 0 8px 0;font-size:15px;color:{COLORS['primary']}">
        <span class="data-type-label tag-actual">ACTUAL</span>
    </h3>
    {wow_table_template.format(rows=actual_wow_rows) if actual_wow_rows.strip() else '<div class="focus-box">No actual WoW data available.</div>'}

    <h3 style="margin:24px 0 8px 0;font-size:15px;color:#ef6c00">
        <span class="data-type-label tag-estimated">ESTIMATED</span>
    </h3>
    {wow_table_template.format(rows=estimated_wow_rows) if estimated_wow_rows.strip() else '<div class="focus-box">No estimated WoW data available.</div>'}
</div>
""")

    # ── Bosch-to-Internal Milestone Mapping ──
    mapping_rows = ""
    for bosch_code, info in BOSCH_TO_INTERNAL_MAPPING.items():
        is_key = bosch_code in key_ms
        key_tag = f'<span class="tag tag-key">KEY</span>' if is_key else ""
        est_code = info.get('est_code', '')
        scenario = info.get('scenario', '')
        # Actual row
        mapping_rows += f"""
        <tr {'class="key-row"' if is_key else ''}>
            <td>{bosch_code} {key_tag}</td>
            <td>Actual</td>
            <td>{info['internal_code']}</td>
            <td>{info['internal_name']}</td>
            <td>{scenario}</td>
        </tr>
"""
        # Estimated row (if applicable)
        if est_code:
            mapping_rows += f"""
        <tr {'class="key-row"' if is_key else ''} style="background:#fff8e1">
            <td>{bosch_code} {key_tag}</td>
            <td>Estimated</td>
            <td>{est_code}</td>
            <td>{info['internal_name']}</td>
            <td>{scenario}</td>
        </tr>
"""

    # Internal-to-Bosch grouped mapping table
    internal_mapping_rows = ""
    for int_code, int_info in INTERNAL_TO_BOSCH_MAPPING.items():
        codes_list = ", ".join(int_info["bosch_codes"])
        internal_mapping_rows += f"""
        <tr>
            <td style="font-weight:700">{int_code}</td>
            <td>{int_info['label']}</td>
            <td>{codes_list}</td>
            <td>{int_info['description']}</td>
        </tr>
"""

    html_parts.append(f"""
<div class="section">
    <div class="section-title">Bosch-to-Internal Milestone Mapping</div>

    <h3 style="margin:0 0 8px 0;font-size:15px;color:{COLORS['primary']}">Bosch S-Code to Maersk Internal Stage</h3>
    <table class="sortable">
        <thead>
            <tr>
                <th>Bosch Code</th>
                <th>Status Type</th>
                <th>Internal Code</th>
                <th>Internal Name</th>
                <th>Scenario</th>
            </tr>
        </thead>
        <tbody>
            {mapping_rows}
        </tbody>
    </table>

    <h3 style="margin:24px 0 8px 0;font-size:15px;color:{COLORS['primary']}">Maersk Internal Stage to Bosch S-Codes (Grouped View)</h3>
    <table class="sortable">
        <thead>
            <tr>
                <th>Internal Code</th>
                <th>Stage Name</th>
                <th>Bosch S-Codes</th>
                <th>Description</th>
            </tr>
        </thead>
        <tbody>
            {internal_mapping_rows}
        </tbody>
    </table>
</div>
""")

    # ── Pareto Priority Action Plan ──
    # Build dynamic Pareto analysis from the priority_issues data
    pareto_html = ""

    # Get top issues by missing codes (actual only — estimated is secondary)
    top_by_missing = sorted(
        [p for p in priority_issues if p["missing"] > 0 and p["data_type"] == "actual"],
        key=lambda x: x["missing"],
        reverse=True,
    )

    # Get worst key milestones (actual only)
    key_issues = [p for p in priority_issues if p["is_key"] and p["data_type"] == "actual" and p["comp_gap"] > 0.05]
    key_issues.sort(key=lambda x: x["comp_gap"], reverse=True)

    # Build the action items dynamically
    pareto_actions = []

    # Action 1 & 2: Focus on the top 5 milestones by missing codes
    if top_by_missing:
        top5_missing = top_by_missing[:5]
        total_missing_top5 = sum(p["missing"] for p in top5_missing)
        total_missing_all = sum(p["missing"] for p in priority_issues if p["missing"] > 0)
        pct_covered = total_missing_top5 / total_missing_all * 100 if total_missing_all else 0

        details_html = ""
        for p in top5_missing:
            ic = _get_internal_code_combined(p["ms_code"], "actual")
            details_html += f"<li><strong>{p['scenario']}/{p['ms_code']}</strong> ({ic}): {p['missing']} missing codes, {pct(p['comp_gap'])} gap, completeness {pct(p['comp'])}</li>"

        pareto_actions.append({
            "title": f"Close Top 5 Completeness Gaps ({total_missing_top5} missing codes, {pct_covered:.0f}% of total)",
            "color": "#c62828",
            "details": f"<ul style='margin:6px 0 0 16px;font-size:12px'>{details_html}</ul>",
            "metric": f"Recovering these {total_missing_top5} status codes would move the largest completeness needles.",
        })

    # Action 2: Worst key milestones by timeliness
    worst_timeliness = sorted(
        [p for p in priority_issues if p["is_key"] and p["data_type"] == "actual" and pd.notna(p["time"]) and p["time"] < TARGET_TIMELINESS],
        key=lambda x: x["time"],
    )[:5]
    if worst_timeliness:
        time_details = ""
        for p in worst_timeliness:
            ic = _get_internal_code_combined(p["ms_code"], "actual")
            time_details += f"<li><strong>{p['scenario']}/{p['ms_code']}</strong> ({ic}): Timeliness {pct(p['time'])} (gap {pct(p['time_gap'])})</li>"

        pareto_actions.append({
            "title": "Fix Timeliness on Worst Key Milestones",
            "color": "#e65100",
            "details": f"<ul style='margin:6px 0 0 16px;font-size:12px'>{time_details}</ul>",
            "metric": "Status codes exist but arrive too late. Investigate event-to-publish pipeline delays.",
        })

    # Action 3: Monitor and prevent regression
    pareto_actions.append({
        "title": "Establish Automated Monitoring & Regression Alerts",
        "color": "#2e7d32",
        "details": "<ul style='margin:6px 0 0 16px;font-size:12px'><li>Alert when any key milestone drops below 80% completeness</li><li>Alert on week-over-week regression exceeding 3pp</li><li>Track IFTSTA error rate weekly (from milestone report)</li></ul>",
        "metric": "Prevents erosion of gains. Lock in improvements from actions above.",
    })

    # Render Pareto section
    action_cards_html = ""
    for i, action in enumerate(pareto_actions, 1):
        action_cards_html += f"""
    <div style="background:white; border:2px solid {action['color']}; border-radius:8px; padding:16px; margin-bottom:14px;">
        <div style="display:flex; align-items:center; margin-bottom:8px;">
            <span style="background:{action['color']}; color:white; font-weight:700; font-size:18px; width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; margin-right:10px;">{i}</span>
            <span style="font-size:15px; font-weight:700; color:{action['color']};">{action['title']}</span>
        </div>
        {action['details']}
        <div style="margin-top:8px; font-size:12px; color:#555; border-top:1px solid #eee; padding-top:6px;">
            <strong>Target:</strong> {action['metric']}
        </div>
    </div>
"""

    html_parts.append(f"""
<div class="section">
    <div class="section-title" style="background: linear-gradient(135deg, #1a237e 0%, #c62828 100%); color: white; padding: 14px 20px;">
        Pareto Priority Action Plan &mdash; 20% Actions for 80% Impact
    </div>
    <div style="background:#fff3e0; border-left:4px solid #ef6c00; padding:12px 16px; margin-bottom:16px; font-size:13px; border-radius:0 4px 4px 0;">
        <strong>Pareto Principle Applied:</strong> Focus on the vital few issues that drive the majority of completeness
        and timeliness gaps. The actions below are ranked by data impact — fixing these first yields disproportionate improvement.
    </div>
    {action_cards_html}
</div>
""")

    # ── Data Quality Notes ──
    html_parts.append(f"""
<div class="section">
    <div class="section-title">Data Quality & Methodology Notes</div>
    <div class="card">
        <ul style="padding-left: 20px; font-size: 13px;">
            <li><strong>Completeness</strong> = Status codes available / Status codes required</li>
            <li><strong>Timeliness</strong> = Status codes in time / Status codes required</li>
            <li><strong>Key Milestones</strong>: S02 (Collected), S04 (Departed), S07 (Arrived), S31 (Delivered), S00 (Shipment Created - SC4 only)</li>
            <li><strong>SC3</strong> = EDI Booking (supply concept 3)</li>
            <li><strong>SC4</strong> = Email Booking (supply concept 4)</li>
            <li><strong>Actual vs Estimated</strong>: Primary KPIs use "Actual" status type. Estimated values shown for reference.</li>
            <li><strong>Weighted Average</strong>: Executive summary uses volume-weighted averages across milestones.</li>
            <li><strong>Data Source</strong>: Files from <code>{RAW_DATA_DIR}/</code>, weeks: {', '.join(f'CW{w:02d}' for w in weeks)}</li>
        </ul>
    </div>
</div>
""")

    # ── Prepare drill-down JSON for embedding ──
    drilldown_json_str = json.dumps(drilldown_data if drilldown_data else {}, separators=(',', ':'))

    # ── Footer ──
    html_parts.append(f"""
</div>
<div class="footer">
    Bosch Milestone KPI Dashboard &nbsp;|&nbsp; Auto-generated {datetime.now().strftime('%Y-%m-%d %H:%M')}
    &nbsp;|&nbsp; Add new weekly files to <code>{RAW_DATA_DIR}/</code> and re-run this script
</div>
<script>var DRILLDOWN_DATA={drilldown_json_str};</script>
<script>
document.addEventListener('DOMContentLoaded', function() {{
    document.querySelectorAll('table.sortable').forEach(function(table) {{
        var headers = table.querySelectorAll('thead th');
        headers.forEach(function(th, colIdx) {{
            th.addEventListener('click', function() {{
                if (typeof closeDrilldown === 'function') closeDrilldown();
                var tbody = table.querySelector('tbody');
                var rows = Array.from(tbody.querySelectorAll('tr:not(.dd-row)'));
                var isAsc = th.classList.contains('sort-asc');

                // Clear sort indicators on sibling headers
                headers.forEach(function(h) {{ h.classList.remove('sort-asc', 'sort-desc'); }});
                th.classList.add(isAsc ? 'sort-desc' : 'sort-asc');

                rows.sort(function(a, b) {{
                    var aCell = a.cells[colIdx];
                    var bCell = b.cells[colIdx];
                    if (!aCell || !bCell) return 0;
                    var aText = aCell.textContent.trim();
                    var bText = bCell.textContent.trim();

                    // Try numeric comparison (handles percentages and numbers)
                    var aNum = parseFloat(aText.replace(/[%,pp]/g, ''));
                    var bNum = parseFloat(bText.replace(/[%,pp]/g, ''));
                    if (!isNaN(aNum) && !isNaN(bNum)) {{
                        return isAsc ? bNum - aNum : aNum - bNum;
                    }}
                    // Fallback to string comparison
                    return isAsc ? bText.localeCompare(aText) : aText.localeCompare(bText);
                }});

                rows.forEach(function(row) {{ tbody.appendChild(row); }});
            }});
        }});
    }});

    // Combined View filter functions
    var cvActiveFilters = {{ milestone: 'all', severity: 'all', scenario: 'all', dtype: 'all' }};

    function applyFilters() {{
        var table = document.getElementById('combined-view-table');
        if (!table) return;
        var rows = table.querySelectorAll('tbody tr');
        rows.forEach(function(row) {{
            var showKey = true;
            var showSev = true;
            var showSc = true;
            var showType = true;

            // Key milestone filter
            if (cvActiveFilters.milestone === 'key') {{
                showKey = row.getAttribute('data-key') === 'true';
            }}

            // Severity filter
            if (cvActiveFilters.severity !== 'all') {{
                showSev = row.getAttribute('data-severity') === cvActiveFilters.severity;
            }}

            // Scenario filter
            if (cvActiveFilters.scenario !== 'all') {{
                showSc = row.getAttribute('data-sc') === cvActiveFilters.scenario;
            }}

            // Data type filter
            if (cvActiveFilters.dtype !== 'all') {{
                showType = row.getAttribute('data-dtype') === cvActiveFilters.dtype;
            }}

            if (showKey && showSev && showSc && showType) {{
                row.classList.remove('cv-hidden');
            }} else {{
                row.classList.add('cv-hidden');
            }}
        }});
    }}

    window.cvFilter = function(mode, btn) {{
        document.querySelectorAll('.cv-filter-btn[data-filter="all"], .cv-filter-btn[data-filter="key"]').forEach(function(b) {{ b.classList.remove('cv-active'); }});
        btn.classList.add('cv-active');
        cvActiveFilters.milestone = mode;
        applyFilters();
    }};

    window.cvFilterSeverity = function(mode, btn) {{
        document.querySelectorAll('.cv-filter-btn[data-filter="all-sev"], .cv-filter-btn[data-filter="critical"], .cv-filter-btn[data-filter="warning"]').forEach(function(b) {{ b.classList.remove('cv-active'); }});
        btn.classList.add('cv-active');
        cvActiveFilters.severity = mode;
        applyFilters();
    }};

    window.cvFilterScenario = function(mode, btn) {{
        document.querySelectorAll('.cv-filter-btn[data-filter="all-sc"], .cv-filter-btn[data-filter="sc3"], .cv-filter-btn[data-filter="sc4"]').forEach(function(b) {{ b.classList.remove('cv-active'); }});
        btn.classList.add('cv-active');
        cvActiveFilters.scenario = mode;
        applyFilters();
    }};

    window.cvFilterType = function(mode, btn) {{
        document.querySelectorAll('.cv-filter-btn[data-filter="all-dtype"], .cv-filter-btn[data-filter="actual"], .cv-filter-btn[data-filter="estimated"]').forEach(function(b) {{ b.classList.remove('cv-active'); }});
        btn.classList.add('cv-active');
        cvActiveFilters.dtype = mode;
        applyFilters();
    }};

    // === Drill-Down Logic ===
    var activeDrilldown = null;
    var ddAllRecords = [];
    var ddScenario = '';
    var ddMsCode = '';
    var ddDtype = '';

    window.closeDrilldown = function() {{
        if (activeDrilldown) {{
            activeDrilldown.remove();
            activeDrilldown = null;
        }}
        document.querySelectorAll('.cv-drilldown-row.dd-active').forEach(function(r) {{
            r.classList.remove('dd-active');
        }});
    }};

    function renderDrilldown(records, scenario, msCode, dtype) {{
        var isSC3 = scenario === 'sc3';
        var total = records.length;
        var PAGE_SIZE = 100;
        var showAll = total <= PAGE_SIZE;
        var visibleRecords = showAll ? records : records.slice(0, PAGE_SIZE);

        var html = '<div class="dd-panel">';
        html += '<div class="dd-header">';
        html += '<span class="dd-title">Missing Shipments: ' + msCode + ' (' + scenario.toUpperCase() + ', ' + dtype + ')</span>';
        html += '<span class="dd-count">' + total + ' shipment' + (total !== 1 ? 's' : '') + ' missing</span>';
        html += '<button class="dd-close" onclick="closeDrilldown()">&times; Close</button>';
        html += '</div>';

        html += '<div class="dd-search-row">';
        html += '<input type="text" class="dd-search" id="dd-search-input" placeholder="Search HBL, MBL, Shipment ID..." oninput="filterDrilldownTable(this.value)">';
        html += '<button class="dd-export-btn" onclick="exportDrilldownCSV()">Export CSV</button>';
        html += '</div>';

        html += '<div class="dd-table-wrap" id="dd-table-wrap">';
        html += '<table class="dd-table" id="dd-table">';
        html += '<thead><tr><th>#</th>';
        if (isSC3) html += '<th>LOAD_TO</th>';
        html += '<th>HBL</th><th>MBL</th><th>Shipment ID</th>';
        html += '</tr></thead><tbody id="dd-tbody">';

        for (var i = 0; i < visibleRecords.length; i++) {{
            var r = visibleRecords[i];
            html += '<tr><td>' + (i + 1) + '</td>';
            if (isSC3) html += '<td class="dd-mono">' + (r.l || '') + '</td>';
            html += '<td class="dd-mono">' + (r.h || '') + '</td>';
            html += '<td class="dd-mono">' + (r.m || '') + '</td>';
            html += '<td class="dd-mono">' + (r.s || '') + '</td>';
            html += '</tr>';
        }}
        html += '</tbody></table></div>';

        if (!showAll) {{
            html += '<div class="dd-show-all" id="dd-show-all">';
            html += 'Showing ' + PAGE_SIZE + ' of ' + total + ' records. ';
            html += '<button class="dd-show-all-btn" onclick="showAllDrilldown()">Show All ' + total + '</button>';
            html += '</div>';
        }}
        html += '</div>';
        return html;
    }}

    window.showAllDrilldown = function() {{
        var isSC3 = ddScenario === 'sc3';
        var tbody = document.getElementById('dd-tbody');
        if (!tbody) return;
        var html = '';
        for (var i = 0; i < ddAllRecords.length; i++) {{
            var r = ddAllRecords[i];
            html += '<tr><td>' + (i + 1) + '</td>';
            if (isSC3) html += '<td class="dd-mono">' + (r.l || '') + '</td>';
            html += '<td class="dd-mono">' + (r.h || '') + '</td>';
            html += '<td class="dd-mono">' + (r.m || '') + '</td>';
            html += '<td class="dd-mono">' + (r.s || '') + '</td>';
            html += '</tr>';
        }}
        tbody.innerHTML = html;
        var showAllDiv = document.getElementById('dd-show-all');
        if (showAllDiv) showAllDiv.style.display = 'none';
    }};

    window.filterDrilldownTable = function(query) {{
        query = query.toLowerCase().trim();
        var tbody = document.getElementById('dd-tbody');
        if (!tbody) return;
        tbody.querySelectorAll('tr').forEach(function(row) {{
            row.style.display = row.textContent.toLowerCase().indexOf(query) >= 0 ? '' : 'none';
        }});
    }};

    window.exportDrilldownCSV = function() {{
        if (!ddAllRecords.length) return;
        var isSC3 = ddScenario === 'sc3';
        var headers = ['#'];
        if (isSC3) headers.push('LOAD_TO');
        headers.push('HBL', 'MBL', 'Shipment_ID');
        var csvRows = [headers.join(',')];
        for (var i = 0; i < ddAllRecords.length; i++) {{
            var r = ddAllRecords[i];
            var row = [i + 1];
            if (isSC3) row.push('"' + (r.l || '') + '"');
            row.push('"' + (r.h || '') + '"', '"' + (r.m || '') + '"', '"' + (r.s || '') + '"');
            csvRows.push(row.join(','));
        }}
        var blob = new Blob([csvRows.join('\\n')], {{ type: 'text/csv' }});
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'missing_' + ddMsCode + '_' + ddScenario + '_' + ddDtype + '.csv';
        a.click();
        URL.revokeObjectURL(url);
    }};

    // Attach click handlers to drill-down rows
    document.querySelectorAll('#combined-view-table tbody tr.cv-drilldown-row').forEach(function(row) {{
        row.addEventListener('click', function(e) {{
            if (e.target.tagName === 'TH') return;

            var sc = row.getAttribute('data-sc');
            var ms = row.getAttribute('data-ms');
            var dtype = row.getAttribute('data-dtype');
            var lookupKey = sc + '|' + ms + '|' + dtype;

            if (row.classList.contains('dd-active')) {{
                closeDrilldown();
                return;
            }}

            closeDrilldown();

            var records = DRILLDOWN_DATA[lookupKey];
            if (!records || records.length === 0) {{
                row.classList.add('dd-active');
                var noDataTr = document.createElement('tr');
                noDataTr.className = 'dd-row';
                noDataTr.innerHTML = '<td colspan="12"><div class="dd-panel dd-no-data">No shipment-level drill-down data available for this combination.</div></td>';
                row.parentNode.insertBefore(noDataTr, row.nextSibling);
                activeDrilldown = noDataTr;
                return;
            }}

            ddAllRecords = records;
            ddScenario = sc;
            ddMsCode = ms;
            ddDtype = dtype;

            row.classList.add('dd-active');
            var ddTr = document.createElement('tr');
            ddTr.className = 'dd-row';
            ddTr.innerHTML = '<td colspan="12">' + renderDrilldown(records, sc, ms, dtype) + '</td>';
            row.parentNode.insertBefore(ddTr, row.nextSibling);
            activeDrilldown = ddTr;
            ddTr.scrollIntoView({{ behavior: 'smooth', block: 'nearest' }});
        }});
    }});

    // Close drilldown when filters change
    var _origApplyFilters = applyFilters;
    applyFilters = function() {{
        closeDrilldown();
        _origApplyFilters();
    }};
}});
</script>
</body>
</html>
""")

    return "\n".join(html_parts)


# ─── Main ────────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("Bosch Milestone KPI Analysis")
    print("=" * 60)

    # Discover files
    files = discover_files(RAW_DATA_DIR)
    for sc, fl in files.items():
        print(f"\n{sc} files found: {len(fl)}")
        for f in fl:
            print(f"  CW{f['week']:02d}: {f['filename']}")

    # Build KPI table
    print("\n--- Building KPI Table ---")
    kpi_df = build_kpi_table(files)
    print(f"KPI records: {len(kpi_df)}")

    # Build region table
    print("\n--- Building Region Table ---")
    region_df = build_region_table(files)
    print(f"Region records: {len(region_df)}")

    # Build detail table
    print("\n--- Building Detail Table ---")
    detail_df = build_detail_table(files)
    print(f"Detail records: {len(detail_df)}")

    # Load drill-down data from new raw data files
    print("\n--- Loading Drill-Down Data ---")
    sc4_dd = load_sc4_drilldown_data()
    print(f"SC4 drill-down records (missing): {len(sc4_dd)}")
    sc3_dd = load_sc3_drilldown_data()
    print(f"SC3 drill-down records (missing): {len(sc3_dd)}")
    drilldown_data = build_drilldown_json(sc3_dd, sc4_dd)
    print(f"Drill-down keys: {len(drilldown_data)}")

    # Generate report
    print("\n--- Generating HTML Report ---")
    html = generate_html_report(kpi_df, region_df, detail_df, drilldown_data)

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"\nReport saved to: {OUTPUT_FILE}")

    # Print summary to console
    print("\n" + "=" * 60)
    print("QUICK SUMMARY")
    print("=" * 60)
    latest_week = kpi_df["week"].max()
    actual_df = kpi_df[kpi_df["status_type"].str.strip().str.lower() == "actual"]
    key_ms = KEY_MILESTONES_ALL + KEY_MILESTONES_SC4_ONLY

    for sc in ["SC3", "SC4"]:
        sc_data = actual_df[
            (actual_df["scenario"] == sc) &
            (actual_df["week"] == latest_week) &
            (actual_df["milestone_code"].isin(key_ms))
        ]
        if sc_data.empty:
            continue
        print(f"\n{sc} (CW{latest_week:02d}) — Key Milestones:")
        for _, r in sc_data.iterrows():
            comp = f"{r['completeness']*100:.1f}%" if pd.notna(r["completeness"]) else "N/A"
            time = f"{r['timeliness']*100:.1f}%" if pd.notna(r["timeliness"]) else "N/A"
            comp_gap = TARGET_COMPLETENESS - r["completeness"] if pd.notna(r["completeness"]) else np.nan
            gap_str = f"(gap: {comp_gap*100:.1f}pp)" if not np.isnan(comp_gap) and comp_gap > 0 else "(at/above target)"
            print(f"  {r['milestone_code']}: Comp={comp} {gap_str} | Time={time}")


if __name__ == "__main__":
    main()
