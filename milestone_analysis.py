#!/usr/bin/env python3
"""
Bosch Milestone Analysis - KPI Dashboard
Generates an HTML report with dual views:
  - Internal (CW1): Raw milestone data as recorded in CW1
  - Customer-Facing: Adjusted for IFTSTA errors (milestones Bosch never received)
"""

import pandas as pd
import numpy as np
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots
from datetime import datetime
import os

# ─── Configuration ───────────────────────────────────────────────────────────

EXCEL_FILE = "cw1_milestone_analysis___lcl___relative_completeness_per_week_2026-02-23T14_06_48.296604862Z.xlsx"
IFTSTA_FILE = "Bosch PROD SB IFTSTA Error Report 23 feb.xlsx"
OUTPUT_FILE = "bosch_milestone_report.html"

MILESTONE_ORDER = ["BCF", "PUP", "DEP", "ARR", "POD"]
MILESTONE_LABELS = {
    "BCF": "Booking Confirmation",
    "PUP": "Pick-up",
    "DEP": "Departure",
    "ARR": "Arrival",
    "POD": "Proof of Delivery",
}

HAS_COLS = {ms: f"Has_{ms}" for ms in MILESTONE_ORDER}
CUST_HAS_COLS = {ms: f"Cust_Has_{ms}" for ms in MILESTONE_ORDER}
ACTUAL_DATE_COLS = {ms: f"{ms}_Date" for ms in MILESTONE_ORDER}
EDIT_COLS = {
    "BCF": "BCF_LastEditUtc",
    "PUP": "PUP_LastEditUtc",
    "DEP": "DEP_LastEditUtc",
    "ARR": "ARR_LastEditUtc",
    "POD": "POD_LastEditUtc",
}

ETA_PAIRS = [
    ("ETD_Date", "DEP_Date", "ETD vs Actual Departure"),
    ("ETA_Date", "ARR_Date", "ETA vs Actual Arrival"),
    ("PUP__Date", "PUP_Date", "Planned vs Actual Pick-up"),
    ("POD__Date", "POD_Date", "Planned vs Actual POD"),
]

# Map IFTSTA event codes to milestone codes
# Every event code in the IFTSTA file maps to a milestone stage it represents.
# Based on Milestone Mapping.xlsx internal codes.
IFTSTA_EVENT_TO_MS = {
    # Booking/Creation stage -> BCF
    "S00/BKG": "BCF",
    "S00/BKG ": "BCF",       # trailing space variant in data
    "S16/BCF": "BCF",

    # Collection/Origin handling stage -> PUP
    "S02/PUP": "PUP",
    "S10/REC": "PUP",        # On hand at origin SVC (REC)
    "S11/S11": "PUP",        # On hand at origin Hub/CC
    "S17/S17": "PUP",        # Tendered carrier (GIN)
    "S46/AED": "PUP",        # Documents rcvd from shipper (AED)
    "S50/GIN_BOSCH": "PUP",  # Received origin CFS (GIN)
    "S50/S50": "PUP",        # Received origin CFS
    "/GIN_BOSCH": "PUP",
    "/S17": "PUP",
    "/S50": "PUP",

    # Departure stage -> DEP
    "S04/ETD": "DEP",        # Estimated departure (ETD)
    "S04/DEP": "DEP",        # Actual departure (DEP)
    "S04/VD": "DEP",         # Vessel departed
    "S53/FLO": "DEP",        # Full container loaded on vessel (FLO, SC3)

    # Arrival stage -> ARR
    "S07/ETA": "ARR",        # Estimated arrival (ETA)
    "S07/ARR": "ARR",        # Actual arrival (ARR)
    "S07/VA": "ARR",         # Vessel arrived
    "S18/S18": "ARR",        # Recovered from carrier (S18)
    "S51/FUN": "ARR",        # Arrived destination CFS (FUN)
    "S51/S51": "ARR",        # Arrived destination CFS
    "S54/FUL": "ARR",        # Full container discharge (FUL, SC3)
    "/FUN": "ARR",

    # Delivery stage -> POD
    "S05/GOU": "POD",        # In delivery (GOU)
    "S05/OOD": "POD",        # Out for delivery
    "S05/S05": "POD",        # In delivery
    "S12/CAV": "POD",        # On hand at destination Hub/CC (CAV)
    "S13/CAV": "POD",        # On hand at destination SVC (data variant)
    "S13/S13": "POD",        # On hand at destination SVC (S13)
    "S31/POD": "POD",        # Delivered - actual (POD)
    "S31/POD_EST": "POD",    # Delivered - estimated (POD_EST)
    "S45/DDE": "POD",        # Handover to broker - estimated (DDE)
    "S45/DDI": "POD",        # Handover to broker - actual (DDI)
    "S55/EGI": "POD",        # Empty container returned (EGI, SC3)
    "/GOU": "POD",

    # Other/Unknown -> Other
    "S00/S00": "Other",      # Generic status
    "S26/ECC": "Other",      # Not in standard mapping
    "S27/EBI": "Other",      # Not in standard mapping
    "S30/ICC": "Other",      # Not in standard mapping
    "DESMN/CNSHG": "Other",
    "HATVAN": "Other",
    "RO": "Other",
}

COLORS = {
    "primary": "#1a73e8",
    "success": "#34a853",
    "warning": "#fbbc04",
    "danger": "#ea4335",
    "info": "#4285f4",
    "dark": "#202124",
    "gray": "#5f6368",
    "light": "#f8f9fa",
    "bg": "#ffffff",
}

CHART_COLORS = ["#1a73e8", "#34a853", "#fbbc04", "#ea4335", "#9c27b0",
                "#00bcd4", "#ff9800", "#795548", "#607d8b", "#e91e63"]


# ─── Data Loading ────────────────────────────────────────────────────────────

def load_data(filepath):
    df = pd.read_excel(filepath, sheet_name="Query result")
    date_cols = [c for c in df.columns if "Date" in c or "Utc" in c]
    for col in date_cols:
        df[col] = pd.to_datetime(df[col], errors="coerce")
    return df


def load_iftsta_errors(filepath):
    df = pd.read_excel(filepath, sheet_name="Sheet1")
    df["Received Time"] = pd.to_datetime(df["Received Time"], errors="coerce")
    if "POR/POD" in df.columns:
        split = df["POR/POD"].str.split("/", n=1, expand=True)
        df["error_origin"] = split[0] if 0 in split.columns else None
        df["error_dest"] = split[1] if 1 in split.columns else None
    df["milestone_category"] = df["Event"].map(IFTSTA_EVENT_TO_MS).fillna("Other")
    return df


def apply_iftsta_mask(df, err_df):
    """
    Create customer-facing Has_X columns.
    If a HBL has ANY IFTSTA error for a milestone's event code,
    that milestone is marked as NOT received by customer (Cust_Has_X = 0).
    """
    # Build a set of (HBL, milestone) pairs that have IFTSTA errors
    error_pairs = set()
    for _, row in err_df.iterrows():
        hbl = row["HBL Number"]
        ms = row.get("milestone_category", "Other")
        if pd.notna(hbl) and ms in MILESTONE_ORDER:
            error_pairs.add((hbl, ms))

    # Also: any HBL with an "Other" category error affects ALL milestones
    # because generic errors (missing ports, parties) block all messages for that HBL
    other_error_hbls = set()
    for _, row in err_df.iterrows():
        hbl = row["HBL Number"]
        ms = row.get("milestone_category", "Other")
        if pd.notna(hbl) and ms == "Other":
            other_error_hbls.add(hbl)

    print(f"  IFTSTA error pairs (HBL+milestone): {len(error_pairs):,}")
    print(f"  HBLs with 'Other' category errors (affects all milestones): {len(other_error_hbls):,}")

    # Create customer-facing columns
    for ms in MILESTONE_ORDER:
        col = HAS_COLS[ms]
        cust_col = CUST_HAS_COLS[ms]
        # Start with internal values
        df[cust_col] = df[col].copy()

        # Zero out where IFTSTA error exists for this specific milestone
        mask_specific = df["HouseBill"].apply(lambda hbl: (hbl, ms) in error_pairs)
        # Zero out where HBL has generic "Other" errors
        mask_other = df["HouseBill"].isin(other_error_hbls)
        mask = mask_specific | mask_other

        zeroed = (df.loc[mask, cust_col] == 1).sum()
        df.loc[mask, cust_col] = 0
        print(f"  {ms}: {mask.sum():,} HBLs with errors, {zeroed:,} milestones downgraded (had Has_{ms}=1)")

    return df


# ─── KPI Computation (parameterized by column prefix) ───────────────────────

def compute_completeness(df, has_cols_map, label=""):
    """Compute completeness using given Has columns (internal or customer-facing)."""
    results = {}
    total = len(df)

    per_ms = {}
    for ms in MILESTONE_ORDER:
        col = has_cols_map[ms]
        count = df[col].sum()
        per_ms[ms] = {"count": int(count), "total": total, "pct": round(count / total * 100, 1)}
    results["per_milestone"] = per_ms

    cols = [has_cols_map[ms] for ms in MILESTONE_ORDER]
    score = df[cols].mean(axis=1)
    results["avg_score"] = round(score.mean() * 100, 1)

    ms_count = df[cols].sum(axis=1)
    dist = ms_count.value_counts().sort_index().to_dict()
    results["distribution"] = {int(k): int(v) for k, v in dist.items()}

    by_pack = df.groupby("HBLContainerPackModeOverride")[cols].mean().round(3) * 100
    results["by_pack_mode"] = by_pack.to_dict()

    top_origins = df["NKOrigin"].value_counts().head(15).index
    by_origin = df[df["NKOrigin"].isin(top_origins)].groupby("NKOrigin")[cols].mean().round(3) * 100
    results["by_origin"] = by_origin

    return results


def compute_timeliness(df, has_cols_map):
    """Compute timeliness only for milestones that exist in the given view."""
    results = {}
    for ms in MILESTONE_ORDER:
        actual_col = ACTUAL_DATE_COLS[ms]
        edit_col = EDIT_COLS.get(ms)
        has_col = has_cols_map[ms]
        if edit_col and edit_col in df.columns and actual_col in df.columns:
            # Only include rows where the milestone IS present in this view
            mask = df[actual_col].notna() & df[edit_col].notna() & (df[has_col] == 1)
            lag = (df.loc[mask, edit_col] - df.loc[mask, actual_col]).dt.total_seconds() / 3600
            lag_clean = lag[(lag > -720) & (lag < 720 * 3)]
            results[ms] = {
                "count": int(mask.sum()),
                "mean_hours": round(lag_clean.mean(), 1) if len(lag_clean) > 0 else None,
                "median_hours": round(lag_clean.median(), 1) if len(lag_clean) > 0 else None,
                "p90_hours": round(lag_clean.quantile(0.9), 1) if len(lag_clean) > 0 else None,
                "within_24h_pct": round((lag_clean.between(0, 24).sum() / len(lag_clean) * 100), 1) if len(lag_clean) > 0 else None,
                "within_48h_pct": round((lag_clean.between(0, 48).sum() / len(lag_clean) * 100), 1) if len(lag_clean) > 0 else None,
                "series": lag_clean,
            }
    return results


def compute_eta_accuracy(df, has_cols_map):
    """Compute ETA accuracy only for milestones present in the given view."""
    # Map ETA pairs to their milestone for filtering
    eta_ms_map = {
        "ETD vs Actual Departure": "DEP",
        "ETA vs Actual Arrival": "ARR",
        "Planned vs Actual Pick-up": "PUP",
        "Planned vs Actual POD": "POD",
    }
    results = {}
    for est_col, act_col, label in ETA_PAIRS:
        if est_col in df.columns and act_col in df.columns:
            ms = eta_ms_map.get(label)
            has_col = has_cols_map.get(ms) if ms else None
            base_mask = df[est_col].notna() & df[act_col].notna()
            if has_col:
                base_mask = base_mask & (df[has_col] == 1)
            delta = (df.loc[base_mask, act_col] - df.loc[base_mask, est_col]).dt.total_seconds() / 86400
            delta_clean = delta[(delta > -60) & (delta < 60)]
            results[label] = {
                "count": int(base_mask.sum()),
                "clean_count": len(delta_clean),
                "mean_days": round(delta_clean.mean(), 2) if len(delta_clean) > 0 else None,
                "median_days": round(delta_clean.median(), 2) if len(delta_clean) > 0 else None,
                "std_days": round(delta_clean.std(), 2) if len(delta_clean) > 0 else None,
                "within_1d_pct": round((delta_clean.abs() <= 1).sum() / len(delta_clean) * 100, 1) if len(delta_clean) > 0 else None,
                "within_3d_pct": round((delta_clean.abs() <= 3).sum() / len(delta_clean) * 100, 1) if len(delta_clean) > 0 else None,
                "within_7d_pct": round((delta_clean.abs() <= 7).sum() / len(delta_clean) * 100, 1) if len(delta_clean) > 0 else None,
                "early_pct": round((delta_clean < 0).sum() / len(delta_clean) * 100, 1) if len(delta_clean) > 0 else None,
                "on_time_pct": round((delta_clean == 0).sum() / len(delta_clean) * 100, 1) if len(delta_clean) > 0 else None,
                "late_pct": round((delta_clean > 0).sum() / len(delta_clean) * 100, 1) if len(delta_clean) > 0 else None,
                "series": delta_clean,
            }
    return results


def compute_plausibility(df, has_cols_map):
    results = {}
    total = len(df)

    valid_count = df["Valid_Sequence"].sum()
    results["valid_pct"] = round(valid_count / total * 100, 1)
    results["invalid_pct"] = round((total - valid_count) / total * 100, 1)
    results["valid_count"] = int(valid_count)
    results["invalid_count"] = int(total - valid_count)

    violations = {}
    pairs = [
        ("BCF_Date", "PUP_Date", "BCF before PUP", "BCF", "PUP"),
        ("PUP_Date", "DEP_Date", "PUP before DEP", "PUP", "DEP"),
        ("DEP_Date", "ARR_Date", "DEP before ARR", "DEP", "ARR"),
        ("ARR_Date", "POD_Date", "ARR before POD", "ARR", "POD"),
    ]
    for col_a, col_b, label, ms_a, ms_b in pairs:
        has_a = has_cols_map[ms_a]
        has_b = has_cols_map[ms_b]
        mask = df[col_a].notna() & df[col_b].notna() & (df[has_a] == 1) & (df[has_b] == 1)
        both = mask.sum()
        if both > 0:
            correct = (df.loc[mask, col_a] <= df.loc[mask, col_b]).sum()
            violations[label] = {
                "pairs_available": int(both),
                "correct": int(correct),
                "violated": int(both - correct),
                "correct_pct": round(correct / both * 100, 1),
            }
    results["sequence_pairs"] = violations

    by_pack = df.groupby("HBLContainerPackModeOverride")["Valid_Sequence"].agg(["mean", "count"])
    by_pack["mean"] = (by_pack["mean"] * 100).round(1)
    results["by_pack_mode"] = by_pack.to_dict()

    cutoff = pd.Timestamp("2026-03-01")
    anomalies = {}
    for ms in MILESTONE_ORDER:
        col = ACTUAL_DATE_COLS[ms]
        future = (df[col] > cutoff).sum()
        anomalies[ms] = int(future)
    results["future_date_anomalies"] = anomalies

    return results


# ─── IFTSTA Error Analysis ───────────────────────────────────────────────────

def compute_iftsta_analysis(df, err_df):
    results = {}
    total_errors = len(err_df)
    results["total_errors"] = total_errors
    results["unique_error_hbls"] = err_df["HBL Number"].nunique()
    results["errors_per_day"] = round(total_errors / max((err_df["Received Time"].max() - err_df["Received Time"].min()).days, 1), 1)

    error_hbls = set(err_df["HBL Number"].dropna().unique())
    milestone_hbls = set(df["HouseBill"].dropna().unique())
    overlap = error_hbls & milestone_hbls
    results["overlap_hbls"] = len(overlap)
    results["error_only_hbls"] = len(error_hbls - milestone_hbls)
    results["milestone_only_hbls"] = len(milestone_hbls - error_hbls)
    results["overlap_pct_of_milestone"] = round(len(overlap) / len(milestone_hbls) * 100, 1) if milestone_hbls else 0
    results["overlap_pct_of_errors"] = round(len(overlap) / len(error_hbls) * 100, 1) if error_hbls else 0

    # Downgrade counts per milestone
    downgrade = {}
    for ms in MILESTONE_ORDER:
        internal = df[HAS_COLS[ms]].sum()
        customer = df[CUST_HAS_COLS[ms]].sum()
        downgrade[ms] = {
            "internal": int(internal),
            "customer": int(customer),
            "lost": int(internal - customer),
            "internal_pct": round(internal / len(df) * 100, 1),
            "customer_pct": round(customer / len(df) * 100, 1),
            "drop_pp": round((internal - customer) / len(df) * 100, 2),
        }
    results["downgrade_by_milestone"] = downgrade

    # Error breakdown
    error_counts = err_df["Error(s)"].value_counts().head(10)
    results["top_errors"] = {str(k): int(v) for k, v in error_counts.items()}

    event_counts = err_df["Event"].value_counts().head(15)
    results["top_events"] = {str(k): int(v) for k, v in event_counts.items()}

    ms_cat_counts = err_df["milestone_category"].value_counts()
    results["errors_by_milestone"] = {str(k): int(v) for k, v in ms_cat_counts.items()}

    scenario_counts = err_df["Scenario"].value_counts()
    results["by_scenario"] = {str(k): int(v) for k, v in scenario_counts.items()}

    err_df["error_week"] = err_df["Received Time"].dt.to_period("W").apply(lambda x: x.start_time)
    weekly = err_df.groupby("error_week").size()
    results["weekly_trend"] = {str(k.date()): int(v) for k, v in weekly.items()}

    if "POR/POD" in err_df.columns:
        top_routes = err_df["POR/POD"].value_counts().head(15)
        results["top_error_routes"] = {str(k): int(v) for k, v in top_routes.items()}

    errors_per_hbl = err_df.groupby("HBL Number").size()
    results["errors_per_hbl_stats"] = {
        "mean": round(errors_per_hbl.mean(), 1),
        "median": int(errors_per_hbl.median()),
        "max": int(errors_per_hbl.max()),
        "p90": int(errors_per_hbl.quantile(0.9)),
    }
    buckets = pd.cut(errors_per_hbl, bins=[0, 1, 3, 5, 10, 50, 1000],
                     labels=["1", "2-3", "4-5", "6-10", "11-50", "50+"])
    results["errors_per_hbl_dist"] = {str(k): int(v) for k, v in buckets.value_counts().sort_index().items()}

    def categorize_error(err):
        err_lower = str(err).lower()
        if "port" in err_lower or "discharge" in err_lower or "load port" in err_lower:
            return "Missing Port Data"
        elif "party" in err_lower or "deliver to" in err_lower or "pick-up from" in err_lower:
            return "Missing Party Data"
        elif "dtm" in err_lower or "date" in err_lower:
            return "Missing Date/Time"
        elif "too long" in err_lower or "too short" in err_lower:
            return "Data Quality (Length)"
        elif "missing" in err_lower:
            return "Missing Attributes"
        else:
            return "Other"

    err_df["error_category"] = err_df["Error(s)"].apply(categorize_error)
    cat_counts = err_df["error_category"].value_counts()
    results["error_categories"] = {str(k): int(v) for k, v in cat_counts.items()}

    return results


# ─── Chart Generation ────────────────────────────────────────────────────────

def chart_dual_completeness(internal, customer):
    """Side-by-side bar chart: Internal vs Customer-Facing completeness."""
    milestones = [MILESTONE_LABELS[ms] for ms in MILESTONE_ORDER]
    int_pcts = [internal["per_milestone"][ms]["pct"] for ms in MILESTONE_ORDER]
    cust_pcts = [customer["per_milestone"][ms]["pct"] for ms in MILESTONE_ORDER]

    fig = go.Figure()
    fig.add_trace(go.Bar(
        name="Internal (CW1)", x=milestones, y=int_pcts,
        marker_color=COLORS["info"], text=[f"{p}%" for p in int_pcts], textposition="outside",
    ))
    fig.add_trace(go.Bar(
        name="Customer-Facing (excl. IFTSTA errors)", x=milestones, y=cust_pcts,
        marker_color=COLORS["danger"], text=[f"{p}%" for p in cust_pcts], textposition="outside",
    ))
    fig.update_layout(
        title="Milestone Completeness: Internal vs Customer-Facing",
        barmode="group", yaxis_title="Completeness (%)", yaxis_range=[0, 105],
        template="plotly_white", height=450, margin=dict(t=50, b=50),
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
    )
    return fig.to_html(full_html=False, include_plotlyjs=False)


def chart_uplift_waterfall(iftsta_analysis):
    """Waterfall showing milestones lost due to IFTSTA and potential uplift from fixing."""
    dg = iftsta_analysis["downgrade_by_milestone"]
    milestones = [MILESTONE_LABELS[ms] for ms in MILESTONE_ORDER]
    lost = [dg[ms]["lost"] for ms in MILESTONE_ORDER]
    drop_pp = [dg[ms]["drop_pp"] for ms in MILESTONE_ORDER]

    fig = go.Figure()
    fig.add_trace(go.Bar(
        x=milestones, y=lost,
        marker_color=COLORS["danger"],
        text=[f"-{l:,} ({d:+.2f}pp)" for l, d in zip(lost, drop_pp)],
        textposition="outside",
    ))
    fig.update_layout(
        title="Milestones Lost Due to IFTSTA Errors (Potential Uplift if Fixed)",
        yaxis_title="Shipments Lost", template="plotly_white",
        height=400, margin=dict(t=50, b=50),
    )
    return fig.to_html(full_html=False, include_plotlyjs=False)


def chart_completeness_bar(completeness, title_suffix=""):
    per_ms = completeness["per_milestone"]
    milestones = [MILESTONE_LABELS[ms] for ms in MILESTONE_ORDER]
    pcts = [per_ms[ms]["pct"] for ms in MILESTONE_ORDER]
    colors = [COLORS["success"] if p >= 90 else COLORS["warning"] if p >= 80 else COLORS["danger"] for p in pcts]

    fig = go.Figure(go.Bar(
        x=milestones, y=pcts, marker_color=colors,
        text=[f"{p}%" for p in pcts], textposition="outside",
    ))
    fig.update_layout(
        title=f"Milestone Completeness Rate{title_suffix}",
        yaxis_title="Completeness (%)", yaxis_range=[0, 105],
        template="plotly_white", height=400, margin=dict(t=50, b=50),
    )
    return fig.to_html(full_html=False, include_plotlyjs=False)


def chart_completeness_distribution(completeness, title_suffix=""):
    dist = completeness["distribution"]
    fig = go.Figure(go.Bar(
        x=list(dist.keys()), y=list(dist.values()),
        marker_color=COLORS["primary"], text=list(dist.values()), textposition="outside",
    ))
    fig.update_layout(
        title=f"Distribution: Milestones per Shipment{title_suffix}",
        xaxis_title="Number of Milestones Present (out of 5)",
        yaxis_title="Number of Shipments",
        template="plotly_white", height=400, margin=dict(t=50, b=50),
    )
    return fig.to_html(full_html=False, include_plotlyjs=False)


def chart_completeness_by_packmode(completeness, has_cols_map):
    data = completeness["by_pack_mode"]
    pack_modes = sorted(data[list(data.keys())[0]].keys())
    fig = go.Figure()
    for i, ms in enumerate(MILESTONE_ORDER):
        col = has_cols_map[ms]
        vals = [data[col].get(pm, 0) for pm in pack_modes]
        fig.add_trace(go.Bar(name=MILESTONE_LABELS[ms], x=pack_modes, y=vals, marker_color=CHART_COLORS[i]))
    fig.update_layout(
        title="Milestone Completeness by Pack Mode",
        barmode="group", yaxis_title="Completeness (%)", yaxis_range=[0, 105],
        template="plotly_white", height=450, margin=dict(t=50, b=80),
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
    )
    return fig.to_html(full_html=False, include_plotlyjs=False)


def chart_completeness_by_origin(completeness, has_cols_map):
    by_origin = completeness["by_origin"]
    origins = by_origin.index.tolist()
    fig = go.Figure()
    for i, ms in enumerate(MILESTONE_ORDER):
        col = has_cols_map[ms]
        fig.add_trace(go.Bar(name=MILESTONE_LABELS[ms], x=origins, y=by_origin[col].values, marker_color=CHART_COLORS[i]))
    fig.update_layout(
        title="Milestone Completeness by Top 15 Origins",
        barmode="group", yaxis_title="Completeness (%)", yaxis_range=[0, 105],
        template="plotly_white", height=450, margin=dict(t=50, b=80),
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
    )
    return fig.to_html(full_html=False, include_plotlyjs=False)


def chart_timeliness_box(timeliness):
    fig = go.Figure()
    for i, ms in enumerate(MILESTONE_ORDER):
        if ms in timeliness and timeliness[ms]["series"] is not None:
            capped = timeliness[ms]["series"].clip(-48, 240)
            fig.add_trace(go.Box(y=capped, name=MILESTONE_LABELS[ms], marker_color=CHART_COLORS[i], boxmean=True))
    fig.update_layout(
        title="Milestone Reporting Lag (hours after event)",
        yaxis_title="Hours (edit timestamp - event date)",
        template="plotly_white", height=450, margin=dict(t=50, b=50),
    )
    return fig.to_html(full_html=False, include_plotlyjs=False)


def chart_eta_histograms(eta_accuracy):
    fig = make_subplots(rows=2, cols=2, subplot_titles=list(eta_accuracy.keys()),
                        vertical_spacing=0.12, horizontal_spacing=0.1)
    positions = [(1, 1), (1, 2), (2, 1), (2, 2)]
    for idx, (label, data) in enumerate(eta_accuracy.items()):
        if idx >= 4:
            break
        r, c = positions[idx]
        fig.add_trace(go.Histogram(x=data["series"], nbinsx=60, marker_color=CHART_COLORS[idx],
                                   opacity=0.8, name=label, showlegend=False), row=r, col=c)
        fig.add_vline(x=0, line_dash="dash", line_color="red", row=r, col=c)
    fig.update_layout(title="ETA Accuracy Distribution (Actual - Estimated, in days)",
                      template="plotly_white", height=600, margin=dict(t=80, b=50))
    fig.update_xaxes(title_text="Days (negative=early, positive=late)")
    fig.update_yaxes(title_text="Shipments")
    return fig.to_html(full_html=False, include_plotlyjs=False)


def chart_eta_accuracy_bars(eta_accuracy):
    labels = list(eta_accuracy.keys())
    within_1d = [eta_accuracy[l]["within_1d_pct"] or 0 for l in labels]
    within_3d = [eta_accuracy[l]["within_3d_pct"] or 0 for l in labels]
    within_7d = [eta_accuracy[l]["within_7d_pct"] or 0 for l in labels]

    fig = go.Figure()
    fig.add_trace(go.Bar(name="Within 1 day", x=labels, y=within_1d, marker_color=COLORS["success"]))
    fig.add_trace(go.Bar(name="Within 3 days", x=labels, y=within_3d, marker_color=COLORS["warning"]))
    fig.add_trace(go.Bar(name="Within 7 days", x=labels, y=within_7d, marker_color=COLORS["info"]))
    fig.update_layout(title="ETA Accuracy: % of Shipments Within Tolerance", barmode="group",
                      yaxis_title="% of Shipments", yaxis_range=[0, 105],
                      template="plotly_white", height=400, margin=dict(t=50, b=80),
                      legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1))
    return fig.to_html(full_html=False, include_plotlyjs=False)


def chart_plausibility_pie(plausibility):
    fig = go.Figure(go.Pie(
        labels=["Valid Sequence", "Invalid Sequence"],
        values=[plausibility["valid_count"], plausibility["invalid_count"]],
        marker_colors=[COLORS["success"], COLORS["danger"]], hole=0.4, textinfo="label+percent",
    ))
    fig.update_layout(title="Milestone Sequence Plausibility", template="plotly_white",
                      height=400, margin=dict(t=50, b=50))
    return fig.to_html(full_html=False, include_plotlyjs=False)


def chart_sequence_violations(plausibility):
    pairs = plausibility["sequence_pairs"]
    labels = list(pairs.keys())
    correct_pcts = [pairs[l]["correct_pct"] for l in labels]
    violated_pcts = [100 - p for p in correct_pcts]

    fig = go.Figure()
    fig.add_trace(go.Bar(name="Correct Order", x=labels, y=correct_pcts, marker_color=COLORS["success"]))
    fig.add_trace(go.Bar(name="Violated", x=labels, y=violated_pcts, marker_color=COLORS["danger"]))
    fig.update_layout(title="Sequence Pair Compliance", barmode="stack",
                      yaxis_title="% of Shipments (where both dates exist)", yaxis_range=[0, 105],
                      template="plotly_white", height=400, margin=dict(t=50, b=80),
                      legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1))
    return fig.to_html(full_html=False, include_plotlyjs=False)


def chart_iftsta_error_categories(iftsta):
    cats = iftsta["error_categories"]
    fig = go.Figure(go.Pie(labels=list(cats.keys()), values=list(cats.values()),
                           marker_colors=CHART_COLORS[:len(cats)], hole=0.35, textinfo="label+percent"))
    fig.update_layout(title="IFTSTA Error Root Cause Categories", template="plotly_white",
                      height=420, margin=dict(t=50, b=50))
    return fig.to_html(full_html=False, include_plotlyjs=False)


def chart_iftsta_by_milestone(iftsta):
    data = iftsta["errors_by_milestone"]
    ms_order = ["BCF", "PUP", "DEP", "ARR", "POD", "Other"]
    labels = [MILESTONE_LABELS.get(m, m) for m in ms_order if m in data]
    values = [data[m] for m in ms_order if m in data]
    colors_map = [CHART_COLORS[ms_order.index(m) % len(CHART_COLORS)] for m in ms_order if m in data]

    fig = go.Figure(go.Bar(x=labels, y=values, marker_color=colors_map, text=values, textposition="outside"))
    fig.update_layout(title="IFTSTA Errors by Milestone Category",
                      yaxis_title="Number of Failed Messages", template="plotly_white",
                      height=400, margin=dict(t=50, b=50))
    return fig.to_html(full_html=False, include_plotlyjs=False)


def chart_iftsta_weekly_trend(iftsta):
    weekly = iftsta["weekly_trend"]
    fig = go.Figure(go.Scatter(x=list(weekly.keys()), y=list(weekly.values()), mode="lines+markers",
                               line=dict(color=COLORS["danger"], width=2), marker=dict(size=6),
                               fill="tozeroy", fillcolor="rgba(234, 67, 53, 0.1)"))
    fig.update_layout(title="IFTSTA Errors: Weekly Trend", xaxis_title="Week", yaxis_title="Failed Messages",
                      template="plotly_white", height=380, margin=dict(t=50, b=50))
    return fig.to_html(full_html=False, include_plotlyjs=False)


def chart_iftsta_top_errors(iftsta):
    errors = iftsta["top_errors"]
    labels = [k[:60] + "..." if len(k) > 60 else k for k in errors.keys()]
    values = list(errors.values())
    fig = go.Figure(go.Bar(y=labels[::-1], x=values[::-1], orientation="h",
                           marker_color=COLORS["danger"], text=values[::-1], textposition="outside"))
    fig.update_layout(title="Top 10 IFTSTA Error Messages", xaxis_title="Occurrences",
                      template="plotly_white", height=450, margin=dict(t=50, b=50, l=300))
    return fig.to_html(full_html=False, include_plotlyjs=False)


def chart_iftsta_top_routes(iftsta):
    if "top_error_routes" not in iftsta:
        return ""
    routes = iftsta["top_error_routes"]
    fig = go.Figure(go.Bar(y=list(routes.keys())[::-1], x=list(routes.values())[::-1], orientation="h",
                           marker_color=COLORS["warning"], text=list(routes.values())[::-1], textposition="outside"))
    fig.update_layout(title="Top 15 Routes with IFTSTA Errors", xaxis_title="Failed Messages",
                      template="plotly_white", height=500, margin=dict(t=50, b=50, l=180))
    return fig.to_html(full_html=False, include_plotlyjs=False)


def chart_iftsta_errors_per_hbl(iftsta):
    dist = iftsta["errors_per_hbl_dist"]
    fig = go.Figure(go.Bar(x=list(dist.keys()), y=list(dist.values()),
                           marker_color=COLORS["info"], text=list(dist.values()), textposition="outside"))
    fig.update_layout(title="Distribution: Errors per HBL",
                      xaxis_title="Number of Errors per HBL", yaxis_title="Number of HBLs",
                      template="plotly_white", height=380, margin=dict(t=50, b=50))
    return fig.to_html(full_html=False, include_plotlyjs=False)


# ─── Bosch Week 5 Correlation Charts ─────────────────────────────────────────

# Bosch Week 5 SC4 data - direct 1:1 status code mapping
# BCF=S16, PUP=S02, DEP=S04, ARR=S07, POD=S31
# Table 1: Maersk carrier view (~527 shipments)
BOSCH_W5_T1 = {
    "BCF": {
        "code": "S16", "name": "Shipment booked with carrier",
        "actual":    {"required": 527, "available": 405, "in_time": 322, "completeness": 77, "timeliness": 61},
        "estimated": None,  # No estimated in T1 for S16
    },
    "PUP": {
        "code": "S02", "name": "Collected",
        "actual":    {"required": 398, "available": 354, "in_time": 131, "completeness": 89, "timeliness": 33},
        "estimated": {"required": 398, "available": 337, "in_time": 210, "completeness": 85, "timeliness": 53},
    },
    "DEP": {
        "code": "S04", "name": "Vessel/flight departed",
        "actual":    {"required": 527, "available": 471, "in_time": 259, "completeness": 89, "timeliness": 49},
        "estimated": {"required": 527, "available": 504, "in_time": 257, "completeness": 96, "timeliness": 49},
    },
    "ARR": {
        "code": "S07", "name": "Vessel/flight arrived",
        "actual":    {"required": 527, "available": 431, "in_time": 231, "completeness": 82, "timeliness": 44},
        "estimated": {"required": 527, "available": 489, "in_time": 113, "completeness": 93, "timeliness": 21},
    },
    "POD": {
        "code": "S31", "name": "Delivered",
        "actual":    {"required": 418, "available": 351, "in_time": 44, "completeness": 84, "timeliness": 11},
        "estimated": {"required": 418, "available": 400, "in_time": 288, "completeness": 96, "timeliness": 69},
    },
}
# Table 2: SC4 overall (all carriers)
BOSCH_W5_T2 = {
    "PUP": {
        "actual":    {"required": 292, "available": 221, "in_time": 100, "completeness": 75.7, "timeliness": 34.2},
        "estimated": {"required": 247, "available": 205, "in_time": 0,   "completeness": 83.0, "timeliness": 0.0},
    },
    "DEP": {
        "actual":    {"required": 330, "available": 301, "in_time": 294, "completeness": 91.2, "timeliness": 89.1},
        "estimated": {"required": 330, "available": 301, "in_time": 268, "completeness": 91.2, "timeliness": 81.2},
    },
    "ARR": {
        "actual":    {"required": 330, "available": 308, "in_time": 307, "completeness": 93.3, "timeliness": 93.0},
        "estimated": {"required": 330, "available": 309, "in_time": 294, "completeness": 93.6, "timeliness": 89.1},
    },
    "POD": {
        "actual":    {"required": 258, "available": 146, "in_time": 33,  "completeness": 56.6, "timeliness": 12.8},
        "estimated": {"required": 258, "available": 173, "in_time": 125, "completeness": 67.1, "timeliness": 48.4},
    },
}


def compute_timeliness_rca(df, err_df):
    """Comprehensive Root Cause Analysis on milestone timeliness."""
    # Build IFTSTA exclusion sets
    event_to_ms = {
        'S16/BCF': 'BCF', 'S02/PUP': 'PUP', 'S04/ETD': 'DEP', 'S46/AED': 'DEP',
        'S07/ETA': 'ARR', 'S31/POD_EST': 'POD', 'S45/DDE': 'POD',
    }
    err_df_copy = err_df.copy()
    err_df_copy['Event'] = err_df_copy['Event'].astype(str).str.strip()
    ms_exclude = {m: set() for m in MILESTONE_ORDER}
    other_hbls = set()
    for _, row in err_df_copy.iterrows():
        evt, hbl = row['Event'], str(row['HBL Number']).strip()
        if evt in event_to_ms:
            ms_exclude[event_to_ms[evt]].add(hbl)
        else:
            other_hbls.add(hbl)
    for m in ms_exclude:
        ms_exclude[m] = ms_exclude[m] | other_hbls

    milestones_cfg = {
        'BCF': {'date': 'BCF_Date', 'edit': 'BCF_LastEditUtc', 'has': 'Has_BCF'},
        'PUP': {'date': 'PUP_Date', 'edit': 'PUP_LastEditUtc', 'has': 'Has_PUP'},
        'DEP': {'date': 'DEP_Date', 'edit': 'DEP_LastEditUtc', 'has': 'Has_DEP'},
        'ARR': {'date': 'ARR_Date', 'edit': 'ARR_LastEditUtc', 'has': 'Has_ARR'},
        'POD': {'date': 'POD_Date', 'edit': 'POD_LastEditUtc', 'has': 'Has_POD'},
    }

    rca = {}
    all_rows = []

    for ms_name, cols in milestones_cfg.items():
        sub = df[['HouseBill', 'NKOrigin', 'NKDestination', 'NKLoadPort', 'NKDischargePort',
                   'HBLContainerPackModeOverride', cols['date'], cols['edit'], cols['has']]].copy()
        sub.columns = ['HouseBill', 'NKOrigin', 'NKDestination', 'NKLoadPort', 'NKDischargePort',
                        'PackMode', 'EventDate', 'EditDate', 'HasFlag']
        sub = sub[sub['HasFlag'] == 1.0].copy()
        sub = sub[~sub['HouseBill'].isin(ms_exclude[ms_name])].copy()
        sub = sub.dropna(subset=['EventDate', 'EditDate']).copy()
        sub['EventDate'] = pd.to_datetime(sub['EventDate'], errors='coerce')
        sub['EditDate'] = pd.to_datetime(sub['EditDate'], errors='coerce')
        sub = sub.dropna(subset=['EventDate', 'EditDate'])
        sub['Lag_Hours'] = (sub['EditDate'] - sub['EventDate']).dt.total_seconds() / 3600.0
        sub = sub[(sub['Lag_Hours'] <= 2160) & (sub['Lag_Hours'] >= -720)].copy()
        sub['Timely'] = ((sub['Lag_Hours'] >= 0) & (sub['Lag_Hours'] <= 24)).astype(int)
        sub['Route'] = sub['NKOrigin'].astype(str) + ' > ' + sub['NKDestination'].astype(str)
        sub['Milestone'] = ms_name

        total = len(sub)
        timely_count = int(sub['Timely'].sum())
        neg_count = int((sub['Lag_Hours'] < 0).sum())

        ms_rca = {
            'total': total,
            'timely_count': timely_count,
            'timely_pct': round(timely_count / total * 100, 1) if total > 0 else 0,
            'mean_lag': round(sub['Lag_Hours'].mean(), 1) if total > 0 else 0,
            'median_lag': round(sub['Lag_Hours'].median(), 1) if total > 0 else 0,
            'p90_lag': round(sub['Lag_Hours'].quantile(0.9), 1) if total > 0 else 0,
            'neg_pct': round(neg_count / total * 100, 1) if total > 0 else 0,
        }

        # Top 10 worst origins (min 10 vol, from top 20 by volume)
        def worst_group(sub_df, col, topn_vol=20, topn_worst=10, min_vol=10):
            g = sub_df.groupby(col).agg(
                Volume=('Timely', 'count'), Timely_Sum=('Timely', 'sum'),
                Mean_Lag=('Lag_Hours', 'mean')
            ).reset_index()
            g['Timely_Pct'] = (g['Timely_Sum'] / g['Volume'] * 100).round(1)
            g['Mean_Lag'] = g['Mean_Lag'].round(1)
            top_vol = g.nlargest(topn_vol, 'Volume')
            worst = top_vol[top_vol['Volume'] >= min_vol].nsmallest(topn_worst, 'Timely_Pct')
            return worst[[col, 'Volume', 'Timely_Pct', 'Mean_Lag']].to_dict('records')

        ms_rca['worst_origins'] = worst_group(sub, 'NKOrigin')
        ms_rca['worst_destinations'] = worst_group(sub, 'NKDestination')
        ms_rca['worst_routes'] = worst_group(sub, 'Route', topn_vol=25, min_vol=5)
        ms_rca['worst_load_ports'] = worst_group(sub, 'NKLoadPort', topn_vol=15)
        ms_rca['worst_discharge_ports'] = worst_group(sub, 'NKDischargePort', topn_vol=15)

        # Lag bucket distribution
        buckets_def = [(-np.inf, 0, '<0h (early)'), (0, 1, '0-1h'), (1, 6, '1-6h'),
                       (6, 12, '6-12h'), (12, 24, '12-24h'), (24, 48, '24-48h'),
                       (48, 168, '2d-7d'), (168, 720, '7d-30d'), (720, np.inf, '30d+')]
        bucket_data = []
        for lo, hi, lbl in buckets_def:
            if lo == -np.inf:
                c = int((sub['Lag_Hours'] < hi).sum())
            elif hi == np.inf:
                c = int((sub['Lag_Hours'] >= lo).sum())
            else:
                c = int(((sub['Lag_Hours'] >= lo) & (sub['Lag_Hours'] < hi)).sum())
            bucket_data.append({'label': lbl, 'count': c, 'pct': round(c / total * 100, 1) if total > 0 else 0})
        ms_rca['lag_buckets'] = bucket_data

        # Weekly trend (last 15 weeks)
        sub['YW'] = sub['EventDate'].dt.strftime('%Y-W%V')
        wk = sub.groupby('YW').agg(Vol=('Timely', 'count'), Tim=('Timely', 'sum')).reset_index()
        wk['Pct'] = (wk['Tim'] / wk['Vol'] * 100).round(1)
        wk = wk.sort_values('YW').tail(15)
        ms_rca['weekly_trend'] = wk[['YW', 'Vol', 'Pct']].to_dict('records')

        rca[ms_name] = ms_rca
        all_rows.append(sub)

    # Cross-milestone summary
    all_c = pd.concat(all_rows)

    def cross_worst(all_df, col, min_vol):
        g = all_df.groupby(col).agg(Vol=('Timely', 'count'), Tim=('Timely', 'sum'),
                                     Lag=('Lag_Hours', 'mean')).reset_index()
        g['Pct'] = (g['Tim'] / g['Vol'] * 100).round(1)
        g['Lag'] = g['Lag'].round(1)
        return g[g['Vol'] >= min_vol].nsmallest(10, 'Pct')[[col, 'Vol', 'Pct', 'Lag']].to_dict('records')

    rca['cross_worst_origins'] = cross_worst(all_c, 'NKOrigin', 50)
    rca['cross_worst_routes'] = cross_worst(all_c, 'Route', 20)
    rca['cross_worst_load_ports'] = cross_worst(all_c, 'NKLoadPort', 50)
    rca['cross_worst_discharge_ports'] = cross_worst(all_c, 'NKDischargePort', 50)

    # Pack mode summary
    pm = all_c.groupby('PackMode').agg(Vol=('Timely', 'count'), Tim=('Timely', 'sum'),
                                        Lag=('Lag_Hours', 'mean')).reset_index()
    pm['Pct'] = (pm['Tim'] / pm['Vol'] * 100).round(1)
    pm['Lag'] = pm['Lag'].round(1)
    rca['pack_mode_summary'] = pm.sort_values('Pct')[['PackMode', 'Vol', 'Pct', 'Lag']].to_dict('records')

    # Country-level
    all_c['CC'] = all_c['NKOrigin'].str[:2]
    cc = all_c.groupby('CC').agg(Vol=('Timely', 'count'), Tim=('Timely', 'sum'),
                                  Lag=('Lag_Hours', 'mean')).reset_index()
    cc['Pct'] = (cc['Tim'] / cc['Vol'] * 100).round(1)
    cc['Lag'] = cc['Lag'].round(1)
    rca['country_summary'] = cc[cc['Vol'] >= 100].sort_values('Pct')[['CC', 'Vol', 'Pct', 'Lag']].to_dict('records')

    return rca


def chart_rca_overview(rca):
    """Bar chart: Timeliness rate by milestone."""
    ms_names = [MILESTONE_LABELS[ms] for ms in MILESTONE_ORDER]
    rates = [rca[ms]['timely_pct'] for ms in MILESTONE_ORDER]
    colors = [COLORS["success"] if r >= 20 else COLORS["warning"] if r >= 5 else COLORS["danger"] for r in rates]

    fig = go.Figure(go.Bar(
        x=ms_names, y=rates, marker_color=colors,
        text=[f"{r}%" for r in rates], textposition="outside",
    ))
    fig.update_layout(
        title="Timeliness Rate by Milestone (% published within 24h)",
        yaxis_title="Timely %", yaxis_range=[0, max(rates) * 1.3 if rates else 100],
        template="plotly_white", height=400, margin=dict(t=50, b=50),
    )
    return fig.to_html(full_html=False, include_plotlyjs=False)


def chart_rca_lag_buckets(rca, ms):
    """Lag bucket distribution for a milestone."""
    buckets = rca[ms]['lag_buckets']
    labels = [b['label'] for b in buckets]
    pcts = [b['pct'] for b in buckets]
    counts = [b['count'] for b in buckets]
    bar_colors = [COLORS["danger"] if l == '<0h (early)' else COLORS["success"] if l in ['0-1h', '1-6h', '6-12h', '12-24h'] else COLORS["warning"] for l in labels]

    fig = go.Figure(go.Bar(
        x=labels, y=pcts, marker_color=bar_colors,
        text=[f"{p}%<br>({c:,})" for p, c in zip(pcts, counts)], textposition="outside",
    ))
    fig.update_layout(
        title=f"{MILESTONE_LABELS[ms]} - Lag Distribution",
        yaxis_title="% of shipments", template="plotly_white",
        height=350, margin=dict(t=50, b=50),
    )
    return fig.to_html(full_html=False, include_plotlyjs=False)


def chart_rca_worst_origins_cross(rca):
    """Horizontal bar: Worst origins across all milestones."""
    data = rca['cross_worst_origins']
    if not data:
        return ""
    origins = [d['NKOrigin'] for d in data][::-1]
    pcts = [d['Pct'] for d in data][::-1]
    vols = [d['Vol'] for d in data][::-1]

    fig = go.Figure(go.Bar(
        y=origins, x=pcts, orientation='h', marker_color=COLORS["danger"],
        text=[f"{p}% (n={v})" for p, v in zip(pcts, vols)], textposition="outside",
    ))
    fig.update_layout(
        title="Worst Origins by Timeliness (All Milestones, min 50 shipments)",
        xaxis_title="Timely %", template="plotly_white",
        height=400, margin=dict(t=50, b=50, l=80), xaxis_range=[0, max(pcts) * 1.5 if pcts else 100],
    )
    return fig.to_html(full_html=False, include_plotlyjs=False)


def chart_rca_worst_routes_cross(rca):
    """Horizontal bar: Worst routes across all milestones."""
    data = rca['cross_worst_routes']
    if not data:
        return ""
    routes = [d['Route'] for d in data][::-1]
    pcts = [d['Pct'] for d in data][::-1]
    vols = [d['Vol'] for d in data][::-1]

    fig = go.Figure(go.Bar(
        y=routes, x=pcts, orientation='h', marker_color=COLORS["warning"],
        text=[f"{p}% (n={v})" for p, v in zip(pcts, vols)], textposition="outside",
    ))
    fig.update_layout(
        title="Worst Routes by Timeliness (All Milestones, min 20 shipments)",
        xaxis_title="Timely %", template="plotly_white",
        height=450, margin=dict(t=50, b=50, l=160), xaxis_range=[0, max(pcts) * 1.5 if pcts else 100],
    )
    return fig.to_html(full_html=False, include_plotlyjs=False)


def chart_rca_weekly_trend(rca, ms):
    """Weekly timeliness trend for a milestone."""
    data = rca[ms]['weekly_trend']
    if not data:
        return ""
    weeks = [d['YW'] for d in data]
    pcts = [d['Pct'] for d in data]
    vols = [d['Vol'] for d in data]

    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=weeks, y=pcts, mode='lines+markers', name='Timely %',
        line=dict(color=COLORS["primary"], width=2), marker=dict(size=6),
    ))
    fig.add_trace(go.Bar(
        x=weeks, y=vols, name='Volume', marker_color='rgba(26,115,232,0.15)',
        yaxis='y2',
    ))
    fig.update_layout(
        title=f"{MILESTONE_LABELS[ms]} - Weekly Timeliness Trend",
        yaxis=dict(title="Timely %", side='left'),
        yaxis2=dict(title="Volume", side='right', overlaying='y', showgrid=False),
        template="plotly_white", height=350, margin=dict(t=50, b=50),
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
    )
    return fig.to_html(full_html=False, include_plotlyjs=False)


def chart_rca_country(rca):
    """Bar chart: Timeliness by origin country."""
    data = rca['country_summary']
    if not data:
        return ""
    countries = [d['CC'] for d in data]
    pcts = [d['Pct'] for d in data]
    vols = [d['Vol'] for d in data]

    fig = go.Figure(go.Bar(
        x=countries, y=pcts,
        marker_color=[COLORS["danger"] if p < 10 else COLORS["warning"] if p < 15 else COLORS["success"] for p in pcts],
        text=[f"{p}%" for p in pcts], textposition="outside",
    ))
    fig.update_layout(
        title="Timeliness by Origin Country (All Milestones, min 100 shipments)",
        yaxis_title="Timely %", template="plotly_white",
        height=400, margin=dict(t=50, b=50),
    )
    return fig.to_html(full_html=False, include_plotlyjs=False)


def chart_bosch_comparison(cust_comp):
    """Side-by-side: Our customer-facing vs Bosch W5 T1 Actual & Estimated."""
    milestones = [f"{MILESTONE_LABELS[ms]}\n({BOSCH_W5_T1[ms]['code']})" for ms in MILESTONE_ORDER]
    our_pcts = [cust_comp["per_milestone"][ms]["pct"] for ms in MILESTONE_ORDER]
    bosch_actual = [BOSCH_W5_T1[ms]["actual"]["completeness"] for ms in MILESTONE_ORDER]
    bosch_est = [BOSCH_W5_T1[ms]["estimated"]["completeness"] if BOSCH_W5_T1[ms]["estimated"] else None for ms in MILESTONE_ORDER]

    fig = go.Figure()
    fig.add_trace(go.Bar(name="Our Customer-Facing",
                         x=milestones, y=our_pcts, marker_color=COLORS["primary"],
                         text=[f"{p}%" for p in our_pcts], textposition="outside"))
    fig.add_trace(go.Bar(name="Bosch W5 - Actual",
                         x=milestones, y=bosch_actual, marker_color=COLORS["warning"],
                         text=[f"{p}%" for p in bosch_actual], textposition="outside"))
    fig.add_trace(go.Bar(name="Bosch W5 - Estimated",
                         x=milestones, y=[v if v else 0 for v in bosch_est],
                         marker_color=COLORS["info"],
                         text=[f"{p}%" if p else "N/A" for p in bosch_est], textposition="outside"))
    fig.update_layout(
        title="Completeness: Our Analysis vs Bosch Week 5 (1:1 Status Code Mapping)",
        barmode="group", yaxis_title="Completeness (%)", yaxis_range=[0, 110],
        template="plotly_white", height=480, margin=dict(t=50, b=80),
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
    )
    return fig.to_html(full_html=False, include_plotlyjs=False)


def chart_bosch_timeliness():
    """Bosch Week 5: Completeness vs Timeliness gap for each milestone (Actual + Estimated)."""
    labels = []
    compl_vals = []
    timel_vals = []

    for ms in MILESTONE_ORDER:
        t1 = BOSCH_W5_T1[ms]
        code = t1["code"]
        name_short = MILESTONE_LABELS[ms]
        # Actual
        labels.append(f"{code} {name_short}\n(Actual)")
        compl_vals.append(t1["actual"]["completeness"])
        timel_vals.append(t1["actual"]["timeliness"])
        # Estimated
        if t1["estimated"]:
            labels.append(f"{code} {name_short}\n(Estimated)")
            compl_vals.append(t1["estimated"]["completeness"])
            timel_vals.append(t1["estimated"]["timeliness"])

    fig = go.Figure()
    fig.add_trace(go.Bar(name="Completeness", x=labels, y=compl_vals,
                         marker_color=COLORS["info"],
                         text=[f"{c}%" for c in compl_vals], textposition="outside"))
    fig.add_trace(go.Bar(name="Timeliness", x=labels, y=timel_vals,
                         marker_color=COLORS["danger"],
                         text=[f"{t}%" for t in timel_vals], textposition="outside"))
    fig.update_layout(
        title="Bosch Week 5: Completeness vs Timeliness (Maersk, Actual & Estimated)",
        barmode="group", yaxis_title="%", yaxis_range=[0, 110],
        template="plotly_white", height=480, margin=dict(t=50, b=100),
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
    )
    return fig.to_html(full_html=False, include_plotlyjs=False)


# ─── HTML Report ─────────────────────────────────────────────────────────────

def generate_html(df, int_comp, int_time, int_eta, int_plaus,
                  cust_comp, cust_time, cust_eta, cust_plaus,
                  iftsta, rca=None):
    now = datetime.now().strftime("%Y-%m-%d %H:%M")

    # Generate charts
    charts = {
        # Dual view headline chart
        "dual_completeness": chart_dual_completeness(int_comp, cust_comp),
        "uplift_waterfall": chart_uplift_waterfall(iftsta),
        # Customer-facing (primary view)
        "cust_completeness_bar": chart_completeness_bar(cust_comp, " (Customer-Facing)"),
        "cust_completeness_dist": chart_completeness_distribution(cust_comp, " (Customer-Facing)"),
        "cust_completeness_pack": chart_completeness_by_packmode(cust_comp, CUST_HAS_COLS),
        "cust_completeness_origin": chart_completeness_by_origin(cust_comp, CUST_HAS_COLS),
        "cust_timeliness_box": chart_timeliness_box(cust_time),
        "cust_eta_hist": chart_eta_histograms(cust_eta),
        "cust_eta_bars": chart_eta_accuracy_bars(cust_eta),
        "cust_plausibility_pie": chart_plausibility_pie(cust_plaus),
        "cust_sequence_violations": chart_sequence_violations(cust_plaus),
        # IFTSTA analysis
        "iftsta_cats": chart_iftsta_error_categories(iftsta),
        "iftsta_by_ms": chart_iftsta_by_milestone(iftsta),
        "iftsta_weekly": chart_iftsta_weekly_trend(iftsta),
        "iftsta_top_errors": chart_iftsta_top_errors(iftsta),
        "iftsta_top_routes": chart_iftsta_top_routes(iftsta),
        "iftsta_per_hbl": chart_iftsta_errors_per_hbl(iftsta),
        # Bosch correlation
        "bosch_comparison": chart_bosch_comparison(cust_comp),
        "bosch_timeliness": chart_bosch_timeliness(),
    }

    # Add RCA charts if available
    if rca:
        charts["rca_overview"] = chart_rca_overview(rca)
        charts["rca_worst_origins"] = chart_rca_worst_origins_cross(rca)
        charts["rca_worst_routes"] = chart_rca_worst_routes_cross(rca)
        charts["rca_country"] = chart_rca_country(rca)
        for ms in MILESTONE_ORDER:
            charts[f"rca_buckets_{ms}"] = chart_rca_lag_buckets(rca, ms)
            charts[f"rca_weekly_{ms}"] = chart_rca_weekly_trend(rca, ms)

    def kpi_card(title, value, subtitle, color):
        return f"""
        <div class="kpi-card" style="border-left: 4px solid {color};">
            <div class="kpi-title">{title}</div>
            <div class="kpi-value" style="color: {color};">{value}</div>
            <div class="kpi-subtitle">{subtitle}</div>
        </div>"""

    # Compute drops
    int_avg = int_comp["avg_score"]
    cust_avg = cust_comp["avg_score"]
    drop = round(int_avg - cust_avg, 1)

    kpi_cards = "".join([
        kpi_card("Customer Completeness", f"{cust_avg}%",
                 f"What Bosch actually receives (Internal: {int_avg}%)",
                 COLORS["danger"] if cust_avg < 85 else COLORS["warning"] if cust_avg < 90 else COLORS["success"]),
        kpi_card("IFTSTA Impact", f"-{drop}pp",
                 f"{iftsta['total_errors']:,} failed messages, {iftsta['unique_error_hbls']:,} HBLs affected",
                 COLORS["danger"]),
        kpi_card("Valid Sequence Rate", f"{cust_plaus['valid_pct']}%",
                 f"{cust_plaus['valid_count']:,} of {len(df):,} shipments",
                 COLORS["danger"] if cust_plaus["valid_pct"] < 50 else COLORS["warning"]),
        kpi_card("DEP Completeness", f"{cust_comp['per_milestone']['DEP']['pct']}%",
                 f"Weakest milestone (Internal: {int_comp['per_milestone']['DEP']['pct']}%)",
                 COLORS["danger"]),
        kpi_card("Total Shipments", f"{len(df):,}",
                 f"{df['NKOrigin'].nunique()} origins, {df['NKDestination'].nunique()} destinations",
                 COLORS["primary"]),
        kpi_card("Uplift if IFTSTA Fixed", f"+{drop}pp",
                 f"Completeness would go from {cust_avg}% to {int_avg}%",
                 COLORS["success"]),
    ])

    # Build the dual-view completeness comparison table
    dg = iftsta["downgrade_by_milestone"]
    dual_rows = ""
    for ms in MILESTONE_ORDER:
        d = dg[ms]
        color = COLORS["danger"] if d["drop_pp"] > 1 else COLORS["warning"] if d["drop_pp"] > 0.1 else COLORS["success"]
        dual_rows += f"""
        <tr>
            <td><strong>{MILESTONE_LABELS[ms]}</strong></td>
            <td>{d['internal_pct']}%</td>
            <td style="color: {color}; font-weight: bold;">{d['customer_pct']}%</td>
            <td style="color: {COLORS['danger']};">{d['drop_pp']:+.2f}pp</td>
            <td>{d['lost']:,}</td>
        </tr>"""
    # Total row
    total_int = int_comp["avg_score"]
    total_cust = cust_comp["avg_score"]
    total_drop = round(total_int - total_cust, 2)
    total_lost = sum(dg[ms]["lost"] for ms in MILESTONE_ORDER)
    dual_rows += f"""
    <tr style="font-weight: bold; border-top: 2px solid #333;">
        <td>Overall Average</td>
        <td>{total_int}%</td>
        <td style="color: {COLORS['danger']};">{total_cust}%</td>
        <td style="color: {COLORS['danger']};">-{total_drop}pp</td>
        <td>{total_lost:,}</td>
    </tr>"""

    # Customer-facing timeliness table
    cust_timeliness_rows = ""
    for ms in MILESTONE_ORDER:
        if ms in cust_time:
            t = cust_time[ms]
            cust_timeliness_rows += f"""
            <tr>
                <td><strong>{MILESTONE_LABELS[ms]}</strong></td>
                <td>{t['count']:,}</td>
                <td>{t['mean_hours']:.1f}h</td>
                <td>{t['median_hours']:.1f}h</td>
                <td>{t['p90_hours']:.1f}h</td>
                <td>{t['within_24h_pct']:.1f}%</td>
                <td>{t['within_48h_pct']:.1f}%</td>
            </tr>"""

    # Customer-facing ETA accuracy table
    cust_eta_rows = ""
    for label, data in cust_eta.items():
        if data["mean_days"] is not None:
            bias = "Late" if data["mean_days"] > 0 else "Early" if data["mean_days"] < 0 else "On Time"
            cust_eta_rows += f"""
            <tr>
                <td><strong>{label}</strong></td>
                <td>{data['clean_count']:,}</td>
                <td>{data['mean_days']:+.2f}d</td>
                <td>{data['median_days']:+.2f}d</td>
                <td>{data['std_days']:.2f}d</td>
                <td>{data['within_1d_pct']:.1f}%</td>
                <td>{data['within_3d_pct']:.1f}%</td>
                <td>{data['within_7d_pct']:.1f}%</td>
                <td>{bias}</td>
            </tr>"""

    # Customer-facing sequence violations
    cust_seq_rows = ""
    for label, data in cust_plaus["sequence_pairs"].items():
        color = COLORS["success"] if data["correct_pct"] >= 90 else COLORS["warning"] if data["correct_pct"] >= 70 else COLORS["danger"]
        cust_seq_rows += f"""
        <tr>
            <td><strong>{label}</strong></td>
            <td>{data['pairs_available']:,}</td>
            <td style="color: {color}; font-weight: bold;">{data['correct_pct']:.1f}%</td>
            <td>{data['violated']:,}</td>
        </tr>"""

    anomaly_rows = ""
    for ms, count in cust_plaus["future_date_anomalies"].items():
        if count > 0:
            anomaly_rows += f"<tr><td>{MILESTONE_LABELS[ms]}</td><td style='color: {COLORS['danger']};'>{count}</td></tr>"

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bosch Milestone Analysis Report</title>
    <script src="https://cdn.plot.ly/plotly-2.35.2.min.js"></script>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f0f2f5; color: {COLORS['dark']}; line-height: 1.6;
        }}
        .header {{
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            color: white; padding: 2rem 3rem;
        }}
        .header h1 {{ font-size: 1.8rem; font-weight: 600; }}
        .header .subtitle {{ color: #a0aec0; margin-top: 0.3rem; font-size: 0.95rem; }}
        .container {{ max-width: 1400px; margin: 0 auto; padding: 1.5rem; }}
        .kpi-grid {{
            display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1rem; margin-bottom: 2rem;
        }}
        .kpi-card {{
            background: white; border-radius: 8px; padding: 1.2rem 1.5rem;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }}
        .kpi-title {{ font-size: 0.8rem; color: {COLORS['gray']}; text-transform: uppercase; letter-spacing: 0.05em; }}
        .kpi-value {{ font-size: 1.8rem; font-weight: 700; margin: 0.3rem 0; }}
        .kpi-subtitle {{ font-size: 0.8rem; color: {COLORS['gray']}; }}
        .section {{
            background: white; border-radius: 8px; padding: 1.5rem;
            margin-bottom: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }}
        .section h2 {{
            font-size: 1.2rem; margin-bottom: 1rem; padding-bottom: 0.5rem;
            border-bottom: 2px solid #e2e8f0;
        }}
        .section h3 {{ font-size: 1rem; margin: 1rem 0 0.5rem; color: {COLORS['gray']}; }}
        table {{ width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 0.9rem; }}
        th, td {{ padding: 0.6rem 0.8rem; text-align: left; border-bottom: 1px solid #e2e8f0; }}
        th {{ background: #f7fafc; font-weight: 600; color: {COLORS['gray']}; font-size: 0.8rem; text-transform: uppercase; }}
        tr:hover {{ background: #f7fafc; }}
        .chart-grid {{
            display: grid; grid-template-columns: repeat(auto-fit, minmax(600px, 1fr)); gap: 1.5rem;
        }}
        .chart-box {{
            background: white; border-radius: 8px; padding: 1rem;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }}
        .insight {{
            background: #fff3cd; border-left: 4px solid {COLORS['warning']};
            padding: 0.8rem 1rem; margin: 0.8rem 0; border-radius: 0 4px 4px 0; font-size: 0.9rem;
        }}
        .insight.critical {{ background: #f8d7da; border-left-color: {COLORS['danger']}; }}
        .insight.positive {{ background: #d4edda; border-left-color: {COLORS['success']}; }}
        .toc {{
            background: white; border-radius: 8px; padding: 1.2rem 1.5rem;
            margin-bottom: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }}
        .toc a {{ color: {COLORS['primary']}; text-decoration: none; }}
        .toc a:hover {{ text-decoration: underline; }}
        .toc ul {{ list-style: none; padding: 0; }}
        .toc li {{ padding: 0.3rem 0; }}
        .footer {{ text-align: center; padding: 2rem; color: {COLORS['gray']}; font-size: 0.85rem; }}
        .view-badge {{
            display: inline-block; padding: 0.2rem 0.6rem; border-radius: 4px;
            font-size: 0.75rem; font-weight: 600; text-transform: uppercase;
        }}
        .view-badge.customer {{ background: #f8d7da; color: {COLORS['danger']}; }}
        .view-badge.internal {{ background: #cce5ff; color: {COLORS['primary']}; }}
        @media (max-width: 768px) {{
            .chart-grid {{ grid-template-columns: 1fr; }}
            .header {{ padding: 1.5rem; }}
            .container {{ padding: 1rem; }}
        }}
    </style>
</head>
<body>

<div class="header">
    <h1>Bosch LCL Milestone Analysis</h1>
    <div class="subtitle">
        Customer: ROBBOSGLG (Robert Bosch Global Logistics) &mdash; Generated: {now} &mdash;
        {len(df):,} shipments analyzed &mdash;
        <strong>All KPIs reflect Customer-Facing view (IFTSTA errors excluded)</strong>
    </div>
</div>

<div class="container">

    <div class="kpi-grid">{kpi_cards}</div>

    <div class="toc">
        <strong>Contents</strong>
        <ul>
            <li><a href="#impact">1. IFTSTA Error Impact &amp; Uplift Analysis</a></li>
            <li><a href="#completeness">2. Milestone Completeness (Customer-Facing)</a></li>
            <li><a href="#timeliness">3. Milestone Timeliness (Customer-Facing)</a></li>
            <li><a href="#timeliness-rca">4. Timeliness Root Cause Analysis</a></li>
            <li><a href="#eta">5. ETA Accuracy (Customer-Facing)</a></li>
            <li><a href="#plausibility">6. Milestone Plausibility (Customer-Facing)</a></li>
            <li><a href="#iftsta-detail">7. IFTSTA Error Details</a></li>
            <li><a href="#bosch-correlation">8. Bosch Week 5 Correlation</a></li>
            <li><a href="#recommendations">9. Key Findings &amp; Recommendations</a></li>
        </ul>
    </div>

    <!-- 1. IFTSTA IMPACT & UPLIFT -->
    <div class="section" id="impact">
        <h2>1. IFTSTA Error Impact &amp; Uplift Analysis</h2>
        <p>
            <span class="view-badge customer">Customer-Facing</span> view removes milestones where IFTSTA messages
            failed to reach Bosch. The difference shows the <strong>uplift achievable by fixing IFTSTA errors</strong>.
        </p>

        <div class="insight critical">
            <strong>IFTSTA errors reduce overall completeness by {drop}pp</strong>
            (from {int_avg}% internal to {cust_avg}% customer-facing).
            Fixing all IFTSTA errors would recover {total_lost:,} milestone-shipment combinations.
        </div>

        <h3>Internal vs Customer-Facing Completeness</h3>
        <div class="chart-box">{charts['dual_completeness']}</div>

        <h3>Detailed Breakdown by Milestone</h3>
        <table>
            <thead>
                <tr>
                    <th>Milestone</th>
                    <th>Internal (CW1)</th>
                    <th>Customer-Facing</th>
                    <th>Drop</th>
                    <th>Shipments Lost</th>
                </tr>
            </thead>
            <tbody>{dual_rows}</tbody>
        </table>

        <div class="chart-box">{charts['uplift_waterfall']}</div>

        <div class="insight positive">
            <strong>Fixing IFTSTA errors is the fastest path to improve customer experience.</strong>
            These are milestones that already exist in CW1 but never reached Bosch.
            No new data capture needed &mdash; just master data fixes in ServiceBridge.
        </div>
    </div>

    <!-- 2. COMPLETENESS (Customer-Facing) -->
    <div class="section" id="completeness">
        <h2>2. Milestone Completeness <span class="view-badge customer">Customer-Facing</span></h2>
        <p>What Bosch actually sees. Milestones blocked by IFTSTA errors are excluded.</p>

        <div class="chart-grid">
            <div class="chart-box">{charts['cust_completeness_bar']}</div>
            <div class="chart-box">{charts['cust_completeness_dist']}</div>
        </div>

        <div class="insight">
            <strong>Departure (DEP) is the weakest milestone</strong> at {cust_comp['per_milestone']['DEP']['pct']}% completeness.
            {cust_comp['per_milestone']['DEP']['total'] - cust_comp['per_milestone']['DEP']['count']:,} shipments are missing departure data from Bosch&rsquo;s perspective.
        </div>

        <h3>Completeness by Pack Mode</h3>
        <div class="chart-box">{charts['cust_completeness_pack']}</div>

        <h3>Completeness by Top Origins</h3>
        <div class="chart-box">{charts['cust_completeness_origin']}</div>
    </div>

    <!-- 3. TIMELINESS (Customer-Facing) -->
    <div class="section" id="timeliness">
        <h2>3. Milestone Timeliness <span class="view-badge customer">Customer-Facing</span></h2>
        <p>Reporting lag for milestones that Bosch actually received (IFTSTA-errored excluded).</p>

        <table>
            <thead>
                <tr><th>Milestone</th><th>Pairs</th><th>Mean Lag</th><th>Median Lag</th>
                    <th>P90 Lag</th><th>Within 24h</th><th>Within 48h</th></tr>
            </thead>
            <tbody>{cust_timeliness_rows}</tbody>
        </table>
        <div class="chart-box">{charts['cust_timeliness_box']}</div>
    </div>

    <!-- 4. TIMELINESS RCA -->
    {"" if not rca else '''
    <div class="section" id="timeliness-rca">
        <h2>4. Timeliness Root Cause Analysis</h2>
        <p>Deep-dive into which origins, routes, load ports, and discharge ports drive late milestone publishing.
           Timeliness = milestone published within 24 hours of the event (Lag = LastEditUtc - EventDate).</p>

        <div class="insight critical">
            <strong>BCF and PUP have near-zero timeliness (1.0%% and 2.1%%)</strong> with mean lags of 868h and 971h respectively.
            This is a systemic issue: booking confirmations and pick-up dates are captured in CW1 weeks/months before the milestone is published to the customer.
        </div>

        <div class="insight">
            <strong>DEP and ARR show 49-64%% negative lag</strong> (edit timestamp BEFORE event date).
            This is expected behavior for vessel tracking: ETD/ETA updates are published before the vessel actually departs/arrives.
            Only 22.3%% (DEP) and 20.6%% (ARR) are published within the 0-24h window.
        </div>

        <h3>Timeliness Overview</h3>
        <div class="chart-box">''' + charts.get('rca_overview', '') + '''</div>

        <table>
            <thead><tr><th>Milestone</th><th>Valid Rows</th><th>Timely (24h)</th><th>Mean Lag</th><th>Median Lag</th><th>P90 Lag</th><th>Negative Lag</th></tr></thead>
            <tbody>''' + "".join(f'''
                <tr>
                    <td><strong>{MILESTONE_LABELS[ms]}</strong></td>
                    <td>{rca[ms]["total"]:,}</td>
                    <td style="color: {COLORS["danger"] if rca[ms]["timely_pct"] < 10 else COLORS["warning"] if rca[ms]["timely_pct"] < 25 else COLORS["success"]}; font-weight: bold;">{rca[ms]["timely_pct"]}%%</td>
                    <td>{rca[ms]["mean_lag"]}h</td>
                    <td>{rca[ms]["median_lag"]}h</td>
                    <td>{rca[ms]["p90_lag"]}h</td>
                    <td>{rca[ms]["neg_pct"]}%%</td>
                </tr>''' for ms in MILESTONE_ORDER) + '''
            </tbody>
        </table>

        <h3>Lag Distribution by Milestone</h3>
        <div class="chart-grid">''' + "".join(
            '<div class="chart-box">' + charts.get(f'rca_buckets_{ms}', '') + '</div>'
            for ms in MILESTONE_ORDER) + '''
        </div>

        <h3>Worst Origins (Cross-Milestone)</h3>
        <div class="chart-box">''' + charts.get('rca_worst_origins', '') + '''</div>

        <table>
            <thead><tr><th>Origin</th><th>Total Shipments</th><th>Timely %%</th><th>Mean Lag (h)</th></tr></thead>
            <tbody>''' + "".join(f'''
                <tr>
                    <td><strong>{d["NKOrigin"]}</strong></td>
                    <td>{d["Vol"]:,}</td>
                    <td style="color: {COLORS["danger"]}; font-weight: bold;">{d["Pct"]}%%</td>
                    <td>{d["Lag"]}h</td>
                </tr>''' for d in rca.get('cross_worst_origins', [])) + '''
            </tbody>
        </table>

        <h3>Worst Routes (Cross-Milestone)</h3>
        <div class="chart-box">''' + charts.get('rca_worst_routes', '') + '''</div>

        <table>
            <thead><tr><th>Route</th><th>Total Shipments</th><th>Timely %%</th><th>Mean Lag (h)</th></tr></thead>
            <tbody>''' + "".join(f'''
                <tr>
                    <td><strong>{d["Route"]}</strong></td>
                    <td>{d["Vol"]:,}</td>
                    <td style="color: {COLORS["danger"]}; font-weight: bold;">{d["Pct"]}%%</td>
                    <td>{d["Lag"]}h</td>
                </tr>''' for d in rca.get('cross_worst_routes', [])) + '''
            </tbody>
        </table>

        <h3>Worst Load Ports</h3>
        <table>
            <thead><tr><th>Load Port</th><th>Total Shipments</th><th>Timely %%</th><th>Mean Lag (h)</th></tr></thead>
            <tbody>''' + "".join(f'''
                <tr>
                    <td><strong>{d["NKLoadPort"]}</strong></td>
                    <td>{d["Vol"]:,}</td>
                    <td style="color: {COLORS["danger"]}; font-weight: bold;">{d["Pct"]}%%</td>
                    <td>{d["Lag"]}h</td>
                </tr>''' for d in rca.get('cross_worst_load_ports', [])) + '''
            </tbody>
        </table>

        <h3>Worst Discharge Ports</h3>
        <table>
            <thead><tr><th>Discharge Port</th><th>Total Shipments</th><th>Timely %%</th><th>Mean Lag (h)</th></tr></thead>
            <tbody>''' + "".join(f'''
                <tr>
                    <td><strong>{d["NKDischargePort"]}</strong></td>
                    <td>{d["Vol"]:,}</td>
                    <td style="color: {COLORS["danger"]}; font-weight: bold;">{d["Pct"]}%%</td>
                    <td>{d["Lag"]}h</td>
                </tr>''' for d in rca.get('cross_worst_discharge_ports', [])) + '''
            </tbody>
        </table>

        <h3>Timeliness by Origin Country</h3>
        <div class="chart-box">''' + charts.get('rca_country', '') + '''</div>

        <h3>Timeliness by Pack Mode</h3>
        <table>
            <thead><tr><th>Pack Mode</th><th>Shipments</th><th>Timely %%</th><th>Mean Lag (h)</th></tr></thead>
            <tbody>''' + "".join(f'''
                <tr>
                    <td><strong>{d["PackMode"]}</strong></td>
                    <td>{d["Vol"]:,}</td>
                    <td>{d["Pct"]}%%</td>
                    <td>{d["Lag"]}h</td>
                </tr>''' for d in rca.get('pack_mode_summary', [])) + '''
            </tbody>
        </table>

        <h3>Weekly Timeliness Trends by Milestone</h3>
        <div class="chart-grid">''' + "".join(
            '<div class="chart-box">' + charts.get(f'rca_weekly_{ms}', '') + '</div>'
            for ms in MILESTONE_ORDER) + '''
        </div>

        <h3>Per-Milestone Worst Performers</h3>''' + "".join(f'''
        <h4>{MILESTONE_LABELS[ms]} - Top 10 Worst Origins (from top 20 by volume)</h4>
        <table>
            <thead><tr><th>Origin</th><th>Volume</th><th>Timely %%</th><th>Mean Lag (h)</th></tr></thead>
            <tbody>''' + "".join(f'''
                <tr><td>{d["NKOrigin"]}</td><td>{d["Volume"]}</td>
                    <td style="color: {COLORS["danger"]};">{d["Timely_Pct"]}%%</td><td>{d["Mean_Lag"]}h</td></tr>'''
                for d in rca[ms].get('worst_origins', [])) + '''
            </tbody>
        </table>''' for ms in MILESTONE_ORDER) + '''

        <h3>Key Patterns &amp; Insights</h3>
        <div class="insight critical">
            <strong>Japan (JP) is the worst performing origin country</strong> at 4.7%% timeliness across all milestones.
            JPTYO (Tokyo) is the worst load port at 2.3%%. Routes from Japan to Germany consistently show near-zero timeliness.
        </div>
        <div class="insight">
            <strong>Thailand (TH) at 6.9%% and Taiwan (TW) at 6.8%%</strong> are also significantly below the overall average.
            THBKK (Bangkok) and THLCH (Laem Chabang) are both in the worst load/discharge ports lists.
        </div>
        <div class="insight positive">
            <strong>European origins (FR, ES, IT, NL)</strong> perform relatively better at 15-24%% timeliness,
            likely because shorter transit distances allow faster milestone publishing.
        </div>
    </div>
    '''}

    <!-- 5. ETA ACCURACY (Customer-Facing) -->
    <div class="section" id="eta">
        <h2>5. ETA Accuracy <span class="view-badge customer">Customer-Facing</span></h2>
        <p>ETA vs actual comparison for milestones Bosch received.</p>

        <table>
            <thead>
                <tr><th>Comparison</th><th>Pairs</th><th>Mean Delta</th><th>Median Delta</th>
                    <th>Std Dev</th><th>&le;1d</th><th>&le;3d</th><th>&le;7d</th><th>Bias</th></tr>
            </thead>
            <tbody>{cust_eta_rows}</tbody>
        </table>
        <div class="chart-box">{charts['cust_eta_bars']}</div>
        <div class="chart-box">{charts['cust_eta_hist']}</div>
    </div>

    <!-- 6. PLAUSIBILITY (Customer-Facing) -->
    <div class="section" id="plausibility">
        <h2>6. Milestone Plausibility <span class="view-badge customer">Customer-Facing</span></h2>
        <p>Sequence validation for milestones Bosch received.</p>

        <div class="insight critical">
            <strong>Only {cust_plaus['valid_pct']}% of shipments have a valid milestone sequence.</strong>
            {cust_plaus['invalid_count']:,} shipments have out-of-order milestones.
        </div>

        <div class="chart-grid">
            <div class="chart-box">{charts['cust_plausibility_pie']}</div>
            <div class="chart-box">{charts['cust_sequence_violations']}</div>
        </div>

        <h3>Sequence Pair Compliance</h3>
        <table>
            <thead><tr><th>Expected Order</th><th>Pairs Available</th><th>Correct %</th><th>Violations</th></tr></thead>
            <tbody>{cust_seq_rows}</tbody>
        </table>

        {"<h3>Future Date Anomalies (after 2026-03-01)</h3><table><thead><tr><th>Milestone</th><th>Count</th></tr></thead><tbody>" + anomaly_rows + "</tbody></table>" if anomaly_rows else ""}
    </div>

    <!-- 7. IFTSTA ERROR DETAILS -->
    <div class="section" id="iftsta-detail">
        <h2>7. IFTSTA Error Details</h2>
        <p>{iftsta['total_errors']:,} failed IFTSTA messages across {iftsta['unique_error_hbls']:,} HBLs
           ({iftsta['errors_per_day']}/day average).</p>

        <h3>Error Root Cause Breakdown</h3>
        <div class="chart-grid">
            <div class="chart-box">{charts['iftsta_cats']}</div>
            <div class="chart-box">{charts['iftsta_by_ms']}</div>
        </div>

        <h3>Error Category Details</h3>
        <table>
            <thead><tr><th>Root Cause</th><th>Failed Messages</th><th>% of Total</th></tr></thead>
            <tbody>""" + "".join(f"""
                <tr><td>{cat}</td><td>{count:,}</td><td>{round(count/iftsta['total_errors']*100, 1)}%</td></tr>"""
                for cat, count in iftsta["error_categories"].items()) + f"""
            </tbody>
        </table>

        <h3>Scenario Breakdown</h3>
        <table>
            <thead><tr><th>Scenario</th><th>Errors</th><th>%</th></tr></thead>
            <tbody>""" + "".join(f"""
                <tr><td>{sc}</td><td>{cnt:,}</td><td>{round(cnt/iftsta['total_errors']*100, 1)}%</td></tr>"""
                for sc, cnt in iftsta["by_scenario"].items()) + f"""
            </tbody>
        </table>

        <h3>Weekly Error Trend</h3>
        <div class="chart-box">{charts['iftsta_weekly']}</div>

        <h3>Top Error Messages</h3>
        <div class="chart-box">{charts['iftsta_top_errors']}</div>

        <h3>Errors per HBL</h3>
        <p>Mean: {iftsta['errors_per_hbl_stats']['mean']} &mdash;
           Median: {iftsta['errors_per_hbl_stats']['median']} &mdash;
           P90: {iftsta['errors_per_hbl_stats']['p90']} &mdash;
           Max: {iftsta['errors_per_hbl_stats']['max']}</p>
        <div class="chart-box">{charts['iftsta_per_hbl']}</div>

        <h3>Top Routes with Errors</h3>
        <div class="chart-box">{charts['iftsta_top_routes']}</div>
    </div>

    <!-- 8. BOSCH WEEK 5 CORRELATION -->
    <div class="section" id="bosch-correlation">
        <h2>8. Bosch Week 5 Correlation</h2>
        <p>Comparison of our customer-facing analysis against Bosch&rsquo;s own Week 5 performance report (SC4, Maersk carrier).
           Bosch tracks <strong>21 granular status codes</strong> across Actual and Estimated types, which we map to our 5 milestone categories.</p>

        <div class="insight">
            <strong>Scope difference:</strong> Bosch Week 5 covers ~527 shipments (single week),
            our analysis covers 13,701 shipments (multi-month). Bosch also tracks
            <strong>timeliness</strong> separately from completeness.
        </div>

        <h3>Direct Milestone Mapping</h3>
        <table>
            <thead><tr><th>Our Milestone</th><th>Bosch Status Code</th><th>Description</th></tr></thead>
            <tbody>
                <tr><td><strong>BCF</strong></td><td>S16</td><td>Shipment booked with carrier</td></tr>
                <tr><td><strong>PUP</strong></td><td>S02</td><td>Collected</td></tr>
                <tr><td><strong>DEP</strong></td><td>S04</td><td>Vessel/flight departed</td></tr>
                <tr><td><strong>ARR</strong></td><td>S07</td><td>Vessel/flight arrived</td></tr>
                <tr><td><strong>POD</strong></td><td>S31</td><td>Delivered</td></tr>
            </tbody>
        </table>

        <h3>Completeness Comparison (Actual + Estimated)</h3>
        <div class="chart-box">{charts.get('bosch_comparison', '')}</div>

        <table>
            <thead>
                <tr>
                    <th>Milestone</th>
                    <th>Bosch Code</th>
                    <th>Our Customer-Facing</th>
                    <th>Bosch Actual</th>
                    <th>Gap (Actual)</th>
                    <th>Bosch Estimated</th>
                    <th>Gap (Estimated)</th>
                </tr>
            </thead>
            <tbody>""" + "".join(f"""
                <tr>
                    <td><strong>{MILESTONE_LABELS[ms]}</strong></td>
                    <td>{BOSCH_W5_T1[ms]['code']}</td>
                    <td>{cust_comp['per_milestone'][ms]['pct']}%</td>
                    <td>{BOSCH_W5_T1[ms]['actual']['completeness']}%</td>
                    <td style="color: {COLORS['success'] if cust_comp['per_milestone'][ms]['pct'] >= BOSCH_W5_T1[ms]['actual']['completeness'] else COLORS['danger']}; font-weight: bold;">
                        {round(cust_comp['per_milestone'][ms]['pct'] - BOSCH_W5_T1[ms]['actual']['completeness'], 1):+.1f}pp</td>
                    <td>{BOSCH_W5_T1[ms]['estimated']['completeness'] if BOSCH_W5_T1[ms]['estimated'] else 'N/A'}{'%' if BOSCH_W5_T1[ms]['estimated'] else ''}</td>
                    <td style="color: {COLORS['success'] if BOSCH_W5_T1[ms]['estimated'] and cust_comp['per_milestone'][ms]['pct'] >= BOSCH_W5_T1[ms]['estimated']['completeness'] else COLORS['danger'] if BOSCH_W5_T1[ms]['estimated'] else COLORS['gray']};">
                        {(str(round(cust_comp['per_milestone'][ms]['pct'] - BOSCH_W5_T1[ms]['estimated']['completeness'], 1)) + 'pp') if BOSCH_W5_T1[ms]['estimated'] else 'N/A'}</td>
                </tr>""" for ms in MILESTONE_ORDER) + f"""
            </tbody>
        </table>

        <div class="insight critical">
            <strong>DEP is the critical gap:</strong> Our customer-facing DEP ({cust_comp['per_milestone']['DEP']['pct']}%)
            is {round(BOSCH_W5_T1['DEP']['actual']['completeness'] - cust_comp['per_milestone']['DEP']['pct'], 1)}pp BELOW
            Bosch&rsquo;s S04 Actual ({BOSCH_W5_T1['DEP']['actual']['completeness']}%) and
            {round(BOSCH_W5_T1['DEP']['estimated']['completeness'] - cust_comp['per_milestone']['DEP']['pct'], 1)}pp below
            their Estimated ({BOSCH_W5_T1['DEP']['estimated']['completeness']}%).
        </div>

        <div class="insight">
            <strong>POD and ARR align well on Actuals</strong> &mdash;
            our POD ({cust_comp['per_milestone']['POD']['pct']}%) is close to Bosch&rsquo;s S31 Actual ({BOSCH_W5_T1['POD']['actual']['completeness']}%),
            and ARR ({cust_comp['per_milestone']['ARR']['pct']}%) is close to S07 Actual ({BOSCH_W5_T1['ARR']['actual']['completeness']}%).
            However, Bosch Estimated rates are much higher (S31 Est: {BOSCH_W5_T1['POD']['estimated']['completeness']}%,
            S07 Est: {BOSCH_W5_T1['ARR']['estimated']['completeness']}%), showing a significant gap between estimated and actual message delivery.
        </div>

        <h3>Bosch Timeliness vs Completeness (Week 5)</h3>
        <p>Bosch tracks timeliness separately for both Actual and Estimated types.
           The gap reveals messages that were <strong>sent but arrived late</strong>.</p>
        <div class="chart-box">{charts.get('bosch_timeliness', '')}</div>

        <table>
            <thead>
                <tr><th>Milestone</th><th>Type</th><th>Completeness</th><th>Timeliness</th>
                    <th>Gap</th><th>Assessment</th></tr>
            </thead>
            <tbody>""" + "".join(
            (f"""
                <tr>
                    <td><strong>{MILESTONE_LABELS[ms]}</strong> ({BOSCH_W5_T1[ms]['code']})</td>
                    <td>Actual</td>
                    <td>{BOSCH_W5_T1[ms]['actual']['completeness']}%</td>
                    <td>{BOSCH_W5_T1[ms]['actual']['timeliness']}%</td>
                    <td style="color: {COLORS['danger'] if BOSCH_W5_T1[ms]['actual']['completeness'] - BOSCH_W5_T1[ms]['actual']['timeliness'] > 30 else COLORS['warning'] if BOSCH_W5_T1[ms]['actual']['completeness'] - BOSCH_W5_T1[ms]['actual']['timeliness'] > 15 else COLORS['success']}; font-weight: bold;">
                        {BOSCH_W5_T1[ms]['actual']['completeness'] - BOSCH_W5_T1[ms]['actual']['timeliness']}pp</td>
                    <td>{'CRITICAL' if BOSCH_W5_T1[ms]['actual']['completeness'] - BOSCH_W5_T1[ms]['actual']['timeliness'] > 40 else 'Concerning' if BOSCH_W5_T1[ms]['actual']['completeness'] - BOSCH_W5_T1[ms]['actual']['timeliness'] > 20 else 'Moderate' if BOSCH_W5_T1[ms]['actual']['completeness'] - BOSCH_W5_T1[ms]['actual']['timeliness'] > 10 else 'Good'}</td>
                </tr>"""
            + (f"""
                <tr>
                    <td></td>
                    <td>Estimated</td>
                    <td>{BOSCH_W5_T1[ms]['estimated']['completeness']}%</td>
                    <td>{BOSCH_W5_T1[ms]['estimated']['timeliness']}%</td>
                    <td style="color: {COLORS['danger'] if BOSCH_W5_T1[ms]['estimated']['completeness'] - BOSCH_W5_T1[ms]['estimated']['timeliness'] > 30 else COLORS['warning']};">
                        {BOSCH_W5_T1[ms]['estimated']['completeness'] - BOSCH_W5_T1[ms]['estimated']['timeliness']}pp</td>
                    <td>{'CRITICAL' if BOSCH_W5_T1[ms]['estimated']['completeness'] - BOSCH_W5_T1[ms]['estimated']['timeliness'] > 40 else 'Concerning' if BOSCH_W5_T1[ms]['estimated']['completeness'] - BOSCH_W5_T1[ms]['estimated']['timeliness'] > 20 else 'Good'}</td>
                </tr>""" if BOSCH_W5_T1[ms]['estimated'] else ""))
            for ms in MILESTONE_ORDER) + f"""
            </tbody>
        </table>

        <div class="insight critical">
            <strong>S31/POD Actual: 84% completeness but only 11% timeliness (73pp gap).</strong>
            Delivered messages are reaching Bosch but far too late to be actionable.
            S07/ARR Estimated: 93% completeness but only 21% timeliness (72pp gap).
            ETA updates are near-useless if they arrive after the vessel.
        </div>

        <h3>SC4 Overall vs Maersk (Table 2 Comparison)</h3>
        <p>How Maersk compares against the SC4 carrier average:</p>
        <table>
            <thead>
                <tr><th>Milestone</th><th>Maersk Actual (T1)</th><th>SC4 Overall Actual (T2)</th><th>Maersk vs SC4</th></tr>
            </thead>
            <tbody>""" + "".join(f"""
                <tr>
                    <td><strong>{MILESTONE_LABELS[ms]}</strong> ({BOSCH_W5_T1[ms]['code']})</td>
                    <td>{BOSCH_W5_T1[ms]['actual']['completeness']}%</td>
                    <td>{BOSCH_W5_T2[ms]['actual']['completeness'] if ms in BOSCH_W5_T2 else 'N/A'}{'%' if ms in BOSCH_W5_T2 else ''}</td>
                    <td style="color: {COLORS['success'] if ms in BOSCH_W5_T2 and BOSCH_W5_T1[ms]['actual']['completeness'] >= BOSCH_W5_T2[ms]['actual']['completeness'] else COLORS['danger'] if ms in BOSCH_W5_T2 else COLORS['gray']}; font-weight: bold;">
                        {(str(round(BOSCH_W5_T1[ms]['actual']['completeness'] - BOSCH_W5_T2[ms]['actual']['completeness'], 1)) + 'pp') if ms in BOSCH_W5_T2 else 'N/A'}</td>
                </tr>""" for ms in MILESTONE_ORDER) + f"""
            </tbody>
        </table>

        <h3>Key Differences in Methodology</h3>
        <table>
            <thead><tr><th>Aspect</th><th>Our Analysis</th><th>Bosch Week 5</th></tr></thead>
            <tbody>
                <tr><td>Scope</td><td>13,701 shipments (multi-month)</td><td>~527 shipments (single week)</td></tr>
                <tr><td>Milestone mapping</td><td>BCF, PUP, DEP, ARR, POD</td><td>S16, S02, S04, S07, S31 (+ Actual/Estimated per code)</td></tr>
                <tr><td>Completeness</td><td>Binary: milestone exists or not</td><td>Ratio: available vs required</td></tr>
                <tr><td>Timeliness</td><td>Reporting lag (hours)</td><td>% received within expected time window</td></tr>
                <tr><td>IFTSTA adjustment</td><td>Yes (errors excluded)</td><td>Already reflects what was received</td></tr>
                <tr><td>Estimated vs Actual</td><td>Combined in single milestone flag</td><td>Tracked separately per status code</td></tr>
            </tbody>
        </table>
    </div>

    <!-- 9. RECOMMENDATIONS -->
    <div class="section" id="recommendations">
        <h2>9. Key Findings &amp; Recommendations</h2>

        <div class="insight critical">
            <strong>IFTSTA errors hide {drop}pp of completeness from Bosch.</strong>
            Internal CW1 data shows {int_avg}% completeness, but only {cust_avg}% reaches the customer.
            Fixing {iftsta['total_errors']:,} failed messages ({iftsta['unique_error_hbls']:,} HBLs) is the
            highest-ROI action.
        </div>

        <div class="insight critical">
            <strong>60.7% sequence violation rate.</strong>
            Most shipments have milestones out of chronological order, undermining data trustworthiness.
        </div>

        <div class="insight">
            <strong>Departure milestone gap.</strong>
            DEP at {cust_comp['per_milestone']['DEP']['pct']}% (customer-facing) is the weakest milestone.
        </div>

        <h3>Recommended Actions (Priority Order)</h3>
        <ol style="padding-left: 1.5rem; margin-top: 0.5rem;">
            <li><strong>Fix IFTSTA master data (Highest ROI)</strong> &mdash;
                Missing ports (~40%) and missing parties (~33%) are the top root causes.
                Bulk master data corrections in ServiceBridge would recover {total_lost:,} milestones
                and add {drop}pp to customer-facing completeness immediately.</li>
            <li><strong>Set up IFTSTA error monitoring</strong> &mdash;
                Automated alerts for new failures to prevent accumulation.</li>
            <li><strong>Investigate sequence violations</strong> &mdash;
                60.7% invalid sequences need root-cause analysis by carrier, origin, and pack mode.</li>
            <li><strong>Improve DEP capture</strong> &mdash;
                Work with carriers to close the departure reporting gap.</li>
            <li><strong>Clean date anomalies</strong> &mdash;
                Review future-dated milestones (likely data entry errors).</li>
            <li><strong>Benchmark and track</strong> &mdash;
                Set weekly targets for customer-facing completeness and IFTSTA error reduction.</li>
        </ol>
    </div>

</div>

<div class="footer">
    Bosch LCL Milestone Analysis &mdash; Generated {now} &mdash; {len(df):,} shipments &mdash;
    Customer-facing view (IFTSTA errors excluded)
</div>

</body>
</html>"""
    return html


# ─── Main ────────────────────────────────────────────────────────────────────

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    filepath = os.path.join(script_dir, EXCEL_FILE)
    iftsta_path = os.path.join(script_dir, IFTSTA_FILE)
    output_path = os.path.join(script_dir, OUTPUT_FILE)

    print(f"Loading data from: {EXCEL_FILE}")
    df = load_data(filepath)
    print(f"  Loaded {len(df):,} rows x {len(df.columns)} columns")

    print(f"\nLoading IFTSTA error data from: {IFTSTA_FILE}")
    err_df = load_iftsta_errors(iftsta_path)
    print(f"  Loaded {len(err_df):,} error records")

    print("\nApplying IFTSTA mask to create customer-facing view...")
    df = apply_iftsta_mask(df, err_df)

    # Internal view (CW1 raw data)
    print("\n--- INTERNAL VIEW (CW1) ---")
    print("Computing completeness...")
    int_comp = compute_completeness(df, HAS_COLS, "internal")
    print(f"  Average: {int_comp['avg_score']}%")

    print("Computing timeliness...")
    int_time = compute_timeliness(df, HAS_COLS)

    print("Computing ETA accuracy...")
    int_eta = compute_eta_accuracy(df, HAS_COLS)

    print("Computing plausibility...")
    int_plaus = compute_plausibility(df, HAS_COLS)
    print(f"  Valid sequence: {int_plaus['valid_pct']}%")

    # Customer-facing view (IFTSTA errors removed)
    print("\n--- CUSTOMER-FACING VIEW ---")
    print("Computing completeness...")
    cust_comp = compute_completeness(df, CUST_HAS_COLS, "customer")
    print(f"  Average: {cust_comp['avg_score']}%")

    print("Computing timeliness...")
    cust_time = compute_timeliness(df, CUST_HAS_COLS)

    print("Computing ETA accuracy...")
    cust_eta = compute_eta_accuracy(df, CUST_HAS_COLS)

    print("Computing plausibility...")
    cust_plaus = compute_plausibility(df, CUST_HAS_COLS)
    print(f"  Valid sequence: {cust_plaus['valid_pct']}%")

    # IFTSTA analysis
    print("\n--- IFTSTA ERROR ANALYSIS ---")
    iftsta = compute_iftsta_analysis(df, err_df)
    dg = iftsta["downgrade_by_milestone"]
    print("\nImpact Summary:")
    print(f"  {'Milestone':<25} {'Internal':>10} {'Customer':>10} {'Drop':>8} {'Lost':>8}")
    print(f"  {'-'*61}")
    for ms in MILESTONE_ORDER:
        d = dg[ms]
        print(f"  {MILESTONE_LABELS[ms]:<25} {d['internal_pct']:>9}% {d['customer_pct']:>9}% {d['drop_pp']:>+7.2f}pp {d['lost']:>7,}")
    drop = round(int_comp['avg_score'] - cust_comp['avg_score'], 1)
    total_lost = sum(dg[ms]['lost'] for ms in MILESTONE_ORDER)
    print(f"  {'OVERALL':<25} {int_comp['avg_score']:>9}% {cust_comp['avg_score']:>9}% {-drop:>+7.1f}pp {total_lost:>7,}")

    # Timeliness RCA
    print("\n--- TIMELINESS ROOT CAUSE ANALYSIS ---")
    rca = compute_timeliness_rca(df, err_df)
    print("Timeliness overview:")
    for ms in MILESTONE_ORDER:
        print(f"  {MILESTONE_LABELS[ms]:<25} Timely: {rca[ms]['timely_pct']:>5}%  Mean Lag: {rca[ms]['mean_lag']:>7}h  Negative: {rca[ms]['neg_pct']:>5}%")

    print("\nGenerating HTML report...")
    html = generate_html(df, int_comp, int_time, int_eta, int_plaus,
                         cust_comp, cust_time, cust_eta, cust_plaus, iftsta, rca)

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"\nReport saved to: {output_path}")


if __name__ == "__main__":
    main()
