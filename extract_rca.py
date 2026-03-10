"""
Extract detailed milestone-level RCA (Root Cause Analysis) data.

For each week, produces:
  - Per-milestone summary: required, available, in_time, missing count, gaps
  - Shipment-level detail: which HBLs are missing each milestone or late
  - SC4: HBL directly from detail sheets
  - SC3: LOAD_TO joined with shipments sheet to get HBL

Output: rca_data.json consumed by the dashboard.
"""

import openpyxl
import os
import json

BASE = "/Users/harsh.puri/Documents/work-maersk/Prototype Playground/Bosch Milestone Analysis"
RAW_DIR = os.path.join(BASE, "Bosch Milestone raw data")

WEEKS = ["CW01", "CW02", "CW03", "CW04", "CW05", "CW06", "CW07", "CW08"]
SC3_FILES = {f"CW{i:02d}": f"Maersk NGTM SC3_2026_CW{i:02d}.xlsx" for i in range(1, 9)}
SC4_FILES = {f"CW{i:02d}": f"Maersk SC4_2026_CW{i:02d}.xlsx" for i in range(1, 9)}

SC3_CRITICAL_CODES = {"S02", "S04", "S07", "S31"}
SC4_CRITICAL_CODES = {"S00", "S02", "S04", "S07", "S31"}

MILESTONE_NAMES = {
    "S00": "Shipment created",
    "S02": "Collected",
    "S04": "Vessel/flight departed",
    "S07": "Vessel/flight arrived",
    "S10": "On hand at origin SVC",
    "S13": "On hand at destination SVC",
    "S16": "Customs initiated",
    "S31": "Delivered",
    "S45": "Handover to broker",
    "S46": "Full Container loaded on vessel",
    "S50": "Received origin CFS",
    "S51": "Arrived destination CFS",
    "S52": "Empty Container picked up",
    "S53": "Full Container loaded on vessel",
    "S54": "Full Container discharge from vessel",
    "S55": "Empty Container returned",
    "S05": "In delivery",
    "S60": "Pre-Booking confirmed",
}


def find_sheet(wb, pattern_fn):
    for sn in wb.sheetnames:
        if pattern_fn(sn):
            return sn
    return None


def find_shipments_sheet(wb):
    return find_sheet(wb, lambda sn: sn.strip().lower() == "shipments")


def find_detail_sheet(wb, service_type):
    """Find the detail sheet for a service type.
    CW08+ has paired sheets: FCL (summary) + FCL_ (detail).
    CW01-CW07 has just FCL/BCO/LCL with detail data directly.
    """
    # First try the _ variant (CW08+)
    detail_name = find_sheet(wb, lambda sn: sn.strip() == f"{service_type}_")
    if detail_name:
        return detail_name
    # Fall back to direct sheet (CW01-CW07)
    return find_sheet(wb, lambda sn: sn.strip().upper() == service_type.upper())


def parse_milestone_code(name):
    if name and " - " in str(name):
        return str(name).split(" - ")[0].strip()
    return str(name).strip() if name else None


def read_total_summary(filepath):
    """Read TOTAL sheet summary rows."""
    wb = openpyxl.load_workbook(filepath, data_only=True)
    sheet_name = find_sheet(wb, lambda sn: sn.strip().upper().startswith("TOTAL") or sn.strip().upper() == "ALL")
    if not sheet_name:
        wb.close()
        return []

    ws = wb[sheet_name]
    header_row = None
    for i, row in enumerate(ws.iter_rows(min_row=1, max_row=10, values_only=True), 1):
        for cell in row:
            if cell and str(cell).strip().lower().startswith("required status"):
                header_row = i
                break
        if header_row:
            break
    if not header_row:
        header_row = 3

    rows = []
    for row in ws.iter_rows(min_row=header_row + 1, max_row=ws.max_row, values_only=True):
        milestone_name = row[0]
        if not milestone_name or str(milestone_name).strip().lower().startswith("required status"):
            continue
        code = parse_milestone_code(milestone_name)
        status_type = str(row[1]).strip() if row[1] else ""
        required = row[3] if row[3] and isinstance(row[3], (int, float)) else 0
        available = row[4] if row[4] and isinstance(row[4], (int, float)) else 0
        in_time = row[5] if row[5] and isinstance(row[5], (int, float)) else 0

        rows.append({
            "code": code,
            "name": MILESTONE_NAMES.get(code, code),
            "type": status_type,
            "required": int(required),
            "available": int(available),
            "in_time": int(in_time),
            "missing": int(required - available),
            "late": int(available - in_time),
            "completeness": round(available / required, 4) if required > 0 else 0,
            "timeliness": round(in_time / required, 4) if required > 0 else 0,
        })
    wb.close()
    return rows


def build_sc3_load_to_hbl_map(filepath):
    """Build mapping from LOAD_ID_TO_ID -> HBL from SC3 shipments sheet."""
    wb = openpyxl.load_workbook(filepath, data_only=True)
    sheet_name = find_shipments_sheet(wb)
    if not sheet_name:
        wb.close()
        return {}

    ws = wb[sheet_name]
    # Header at row 3
    header_row = 3
    headers = list(next(ws.iter_rows(min_row=header_row, max_row=header_row, values_only=True)))

    # Find LOAD_ID (col 0), TO_ID (col 1), HBL (col 86), MBL (col 85)
    load_col = 0
    to_col = 1
    hbl_col = None
    mbl_col = None
    for idx, h in enumerate(headers):
        if h and "House_Airway_Bill" in str(h):
            hbl_col = idx
        if h and "Airway_Bill_or_Bill_of_lading" == str(h).strip():
            mbl_col = idx

    if hbl_col is None:
        # Fallback to col 86
        hbl_col = 86 if len(headers) > 86 else None

    mapping = {}
    for row in ws.iter_rows(min_row=header_row + 1, max_row=ws.max_row, values_only=True):
        vals = list(row)
        if not vals[load_col]:
            continue
        load_id = str(vals[load_col]).strip()
        to_id = str(vals[to_col]).strip() if vals[to_col] else ""
        key = f"{load_id}_{to_id}"
        hbl = str(vals[hbl_col]).strip() if hbl_col and vals[hbl_col] else ""
        mbl = str(vals[mbl_col]).strip() if mbl_col and vals[mbl_col] else ""
        mapping[key] = {"hbl": hbl, "mbl": mbl, "load_id": load_id, "to_id": to_id}
        # Also map just load_id for cases where detail doesn't have full LOAD_TO
        if load_id not in mapping:
            mapping[load_id] = {"hbl": hbl, "mbl": mbl, "load_id": load_id, "to_id": to_id}

    wb.close()
    return mapping


def extract_sc4_detail(filepath):
    """Extract SC4 shipment-level milestone detail with HBLs."""
    wb = openpyxl.load_workbook(filepath, data_only=True)
    all_details = []

    for svc in ["FCL", "BCO", "LCL"]:
        sheet_name = find_detail_sheet(wb, svc)
        if not sheet_name:
            continue

        ws = wb[sheet_name]
        # Find header row with CONSIGNMENT
        header_row = None
        for i, row in enumerate(ws.iter_rows(min_row=1, max_row=10, values_only=True), 1):
            row_strs = [str(c).strip().upper() if c else "" for c in row]
            if "CONSIGNMENT" in row_strs:
                header_row = i
                break
        if not header_row:
            continue

        headers = [str(c).strip().upper() if c else "" for c in next(ws.iter_rows(min_row=header_row, max_row=header_row, values_only=True))]
        col_map = {h: i for i, h in enumerate(headers) if h}

        consignment_col = col_map.get("CONSIGNMENT", 0)
        hbl_col = col_map.get("HBL", 2)
        mbl_col = col_map.get("MBL", 3)
        code_col = col_map.get("STATUS_CODE_REQUIRED", 4)
        type_col = col_map.get("STATUS_TYPE", 5)
        avl_col = None
        for k, v in col_map.items():
            if "STATUS_CODE_AVAILABLE" in k:
                avl_col = v
                break

        if avl_col is None:
            continue

        for row in ws.iter_rows(min_row=header_row + 1, max_row=ws.max_row, values_only=True):
            vals = list(row)
            if not vals[consignment_col]:
                continue

            available = int(vals[avl_col]) if isinstance(vals[avl_col], (int, float)) else 0
            code = str(vals[code_col]).strip() if vals[code_col] else ""
            status_type = str(vals[type_col]).strip() if vals[type_col] else ""

            all_details.append({
                "consignment": str(vals[consignment_col]).strip(),
                "hbl": str(vals[hbl_col]).strip() if vals[hbl_col] else "",
                "mbl": str(vals[mbl_col]).strip() if vals[mbl_col] else "",
                "code": code,
                "type": status_type,
                "available": available,
                "service": svc,
            })

    wb.close()
    return all_details


def extract_sc3_detail(filepath):
    """Extract SC3 shipment-level milestone detail."""
    wb = openpyxl.load_workbook(filepath, data_only=True)
    all_details = []

    for svc in ["FCL", "BCO", "LCL"]:
        sheet_name = find_detail_sheet(wb, svc)
        if not sheet_name:
            continue

        ws = wb[sheet_name]
        header_row = None
        for i, row in enumerate(ws.iter_rows(min_row=1, max_row=10, values_only=True), 1):
            row_strs = [str(c).strip().upper() if c else "" for c in row]
            if any("STATUS_CODE_AVAILABLE" in s for s in row_strs):
                header_row = i
                break
        if not header_row:
            continue

        headers = [str(c).strip().upper() if c else "" for c in next(ws.iter_rows(min_row=header_row, max_row=header_row, values_only=True))]

        load_to_col = 0
        code_col = None
        type_col = None
        avl_col = None
        for idx, h in enumerate(headers):
            if h in ("STATUS CODE", "STATUS_CODE_REQUIRED"):
                code_col = idx
            if h == "STATUS_TYPE":
                type_col = idx
            if "STATUS_CODE_AVAILABLE" in h:
                avl_col = idx

        if avl_col is None or code_col is None:
            continue

        for row in ws.iter_rows(min_row=header_row + 1, max_row=ws.max_row, values_only=True):
            vals = list(row)
            if not vals[load_to_col]:
                continue

            available = int(vals[avl_col]) if isinstance(vals[avl_col], (int, float)) else 0
            code = str(vals[code_col]).strip() if vals[code_col] else ""
            status_type = str(vals[type_col]).strip() if type_col is not None and vals[type_col] else ""

            all_details.append({
                "load_to": str(vals[load_to_col]).strip(),
                "code": code,
                "type": status_type,
                "available": available,
                "service": svc,
            })

    wb.close()
    return all_details


def build_missing_shipments(sc4_details, sc3_details, sc3_hbl_map):
    """Build lists of missing/late shipments per milestone."""
    missing = {}

    # SC4 missing (available=0)
    for d in sc4_details:
        if d["available"] == 0:
            key = (d["code"], d["type"], "SC4")
            if key not in missing:
                missing[key] = []
            missing[key].append({
                "hbl": d["hbl"],
                "mbl": d["mbl"],
                "consignment": d["consignment"],
                "service": d["service"],
            })

    # SC3 missing (available=0)
    for d in sc3_details:
        if d["available"] == 0:
            key = (d["code"], d["type"], "SC3")
            if key not in missing:
                missing[key] = []
            # Resolve HBL from mapping
            load_to = d["load_to"]
            ref = sc3_hbl_map.get(load_to, {})
            missing[key].append({
                "hbl": ref.get("hbl", ""),
                "mbl": ref.get("mbl", ""),
                "load_to": load_to,
                "service": d["service"],
            })

    return missing


def process_week(week):
    """Process one week and return RCA data."""
    print(f"  Processing {week}...")

    sc3_file = os.path.join(RAW_DIR, SC3_FILES[week])
    sc4_file = os.path.join(RAW_DIR, SC4_FILES[week])

    if not os.path.exists(sc3_file) or not os.path.exists(sc4_file):
        print(f"    Files missing for {week}")
        return None

    # Summary data
    sc3_summary = read_total_summary(sc3_file)
    sc4_summary = read_total_summary(sc4_file)

    # Detail data
    sc4_details = extract_sc4_detail(sc4_file)
    sc3_details = extract_sc3_detail(sc3_file)

    # SC3 HBL mapping
    sc3_hbl_map = build_sc3_load_to_hbl_map(sc3_file)

    # Build missing shipment lists
    missing_map = build_missing_shipments(sc4_details, sc3_details, sc3_hbl_map)

    # Build milestone-level RCA
    milestones = []

    for scenario, summary, crit_codes in [
        ("SC3", sc3_summary, SC3_CRITICAL_CODES),
        ("SC4", sc4_summary, SC4_CRITICAL_CODES),
    ]:
        for row in summary:
            code = row["code"]
            stype = row["type"]
            is_critical = code in crit_codes
            missing_key = (code, stype, scenario)
            missing_list = missing_map.get(missing_key, [])

            # Limit to top 50 missing HBLs per milestone to keep JSON manageable
            missing_hbls = missing_list[:50]
            total_missing_shipments = len(missing_list)

            milestones.append({
                "scenario": scenario,
                "code": code,
                "name": row["name"],
                "type": stype,
                "is_critical": is_critical,
                "required": row["required"],
                "available": row["available"],
                "in_time": row["in_time"],
                "missing": row["missing"],
                "late": row["late"],
                "completeness": row["completeness"],
                "timeliness": row["timeliness"],
                "comp_gap": round(0.95 - row["completeness"], 4) if row["completeness"] < 0.95 else 0,
                "time_gap": round(0.70 - row["timeliness"], 4) if row["timeliness"] < 0.70 else 0,
                "severity": "critical" if row["completeness"] < 0.7 else "warning" if row["completeness"] < 0.9 else "ok",
                "missing_shipments": missing_hbls,
                "total_missing_shipments": total_missing_shipments,
            })

    # Sort by severity then by missing count
    severity_order = {"critical": 0, "warning": 1, "ok": 2}
    milestones.sort(key=lambda m: (severity_order.get(m["severity"], 3), -m["missing"]))

    # Aggregate stats
    total_missing = sum(m["missing"] for m in milestones)
    critical_issues = sum(1 for m in milestones if m["severity"] == "critical")
    warning_issues = sum(1 for m in milestones if m["severity"] == "warning")

    return {
        "week": week,
        "milestones": milestones,
        "total_missing": total_missing,
        "critical_issues": critical_issues,
        "warning_issues": warning_issues,
        "ok_issues": sum(1 for m in milestones if m["severity"] == "ok"),
    }


def main():
    print("=" * 80)
    print("BOSCH MILESTONE RCA DATA EXTRACTION")
    print("=" * 80)

    all_rca = []
    for week in WEEKS:
        result = process_week(week)
        if result:
            all_rca.append(result)

    # Export
    output_path = os.path.join(BASE, "rca_data.json")
    with open(output_path, "w") as f:
        json.dump(all_rca, f, indent=2, default=str)
    print(f"\nExported RCA data to: {output_path}")

    # Quick summary
    for r in all_rca:
        print(f"\n  {r['week']}: {r['critical_issues']} critical, {r['warning_issues']} warnings, {r['total_missing']} missing statuses")
        # Top 3 worst milestones
        for m in r["milestones"][:3]:
            print(f"    {m['scenario']} {m['code']} {m['type']:10s} — missing={m['missing']:4d}, comp={m['completeness']:.1%}, time={m['timeliness']:.1%}")

    print("\nDone.")


if __name__ == "__main__":
    main()
