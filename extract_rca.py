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


def extract_eta_ref_rca(filepath):
    """Extract ETA accuracy and Reference Completeness shipment-level RCA from SC4 shipments sheet.

    Returns dict with:
      - eta_2p: {total, accepted, failed, rate, failed_shipments[]}
      - eta_2d: {total, accepted, failed, rate, failed_shipments[]}
      - ref: {total, complete, incomplete, rate, incomplete_shipments[]}
    """
    wb = openpyxl.load_workbook(filepath, data_only=True)
    sheet_name = find_shipments_sheet(wb)
    if not sheet_name:
        wb.close()
        return None

    ws = wb[sheet_name]
    header_row = None
    for i, row in enumerate(ws.iter_rows(min_row=1, max_row=5, values_only=True), 1):
        for cell in row:
            if cell and "UNIQUE_SHIPMENT" in str(cell):
                header_row = i
                break
        if header_row:
            break
    if not header_row:
        header_row = 3

    headers = list(next(ws.iter_rows(min_row=header_row, max_row=header_row, values_only=True)))
    col_map = {}
    for i, h in enumerate(headers):
        if h:
            col_map[str(h).strip()] = i

    # Find relevant columns
    hbl_col = col_map.get("HOUSE_BILL_OF_LADING", 1)
    mbl_col = col_map.get("MASTER_BILL_OF_LADING", 2)
    consignment_col = col_map.get("CONSIGNMENT_ID_1", 9)
    transport_col = col_map.get("TRANSPORT_SERVICE_PRIORITY", None)
    origin_col = col_map.get("CONSIGNOR_ADDRESS_CITY_NAME", None)
    dest_col = col_map.get("CONSIGNEE_ADDRESS_CITY_NAME", None)
    carrier_col = col_map.get("CARRIER_1", None)

    s07_col = s31_col = s07_dev_col = s31_dev_col = None
    civ_col = dn_col = None
    eta_col = ata_col = del_est_col = delivered_col = None
    for key, idx in col_map.items():
        if "S07_Accepted" in key:
            s07_col = idx
        if "S31_Accepted" in key:
            s31_col = idx
        if "S07_Deviation" in key:
            s07_dev_col = idx
        if "S31_Deviation" in key:
            s31_dev_col = idx
        if "COMMERCIAL_INVOICE" in key:
            civ_col = idx
        if "DELIVERY_NOTE" in key:
            dn_col = idx
        if key == "ETA_DATE_TIME":
            eta_col = idx
        if key == "ATA_DATE_TIME":
            ata_col = idx
        if key == "DELIVERY_DATE_ACT_EST_PLAN":
            del_est_col = idx
        if key == "DELIVERED_DATE_TIME":
            delivered_col = idx

    eta_2p_failed = []
    eta_2p_accepted = 0
    eta_2p_total = 0
    eta_2d_failed = []
    eta_2d_accepted = 0
    eta_2d_total = 0
    ref_incomplete = []
    ref_complete_count = 0
    ref_total = 0

    for row in ws.iter_rows(min_row=header_row + 1, max_row=ws.max_row, values_only=True):
        vals = list(row)
        if not vals[0]:
            continue

        hbl = str(vals[hbl_col]).strip() if vals[hbl_col] else ""
        mbl = str(vals[mbl_col]).strip() if vals[mbl_col] else ""
        consignment = str(vals[consignment_col]).strip() if vals[consignment_col] else ""
        transport = str(vals[transport_col]).strip() if transport_col is not None and vals[transport_col] else ""
        origin = str(vals[origin_col]).strip() if origin_col is not None and vals[origin_col] else ""
        dest = str(vals[dest_col]).strip() if dest_col is not None and vals[dest_col] else ""
        carrier = str(vals[carrier_col]).strip() if carrier_col is not None and vals[carrier_col] else ""

        base_info = {
            "hbl": hbl,
            "mbl": mbl,
            "consignment": consignment,
            "transport": transport,
            "origin": origin,
            "dest": dest,
            "carrier": carrier,
        }

        # ETA 2P (S07)
        if s07_col is not None and vals[s07_col] is not None:
            eta_2p_total += 1
            s07_val = vals[s07_col]
            if s07_val == 1:
                eta_2p_accepted += 1
            else:
                deviation = vals[s07_dev_col] if s07_dev_col and vals[s07_dev_col] else None
                eta_val = vals[eta_col] if eta_col is not None else None
                ata_val = vals[ata_col] if ata_col is not None else None
                eta_2p_failed.append({
                    **base_info,
                    "deviation_hours": round(float(deviation), 1) if deviation and isinstance(deviation, (int, float)) else None,
                    "estimated": str(eta_val)[:16] if eta_val else None,
                    "actual": str(ata_val)[:16] if ata_val else None,
                })

        # ETA 2D (S31)
        if s31_col is not None and vals[s31_col] is not None:
            eta_2d_total += 1
            s31_val = vals[s31_col]
            if s31_val == 1:
                eta_2d_accepted += 1
            else:
                deviation = vals[s31_dev_col] if s31_dev_col and vals[s31_dev_col] else None
                del_est_val = vals[del_est_col] if del_est_col is not None else None
                delivered_val = vals[delivered_col] if delivered_col is not None else None
                eta_2d_failed.append({
                    **base_info,
                    "deviation_hours": round(float(deviation), 1) if deviation and isinstance(deviation, (int, float)) else None,
                    "estimated": str(del_est_val)[:16] if del_est_val else None,
                    "actual": str(delivered_val)[:16] if delivered_val else None,
                })

        # Reference Completeness
        ref_total += 1
        civ_val = vals[civ_col] if civ_col else None
        dn_val = vals[dn_col] if dn_col else None
        has_civ = civ_val is not None and str(civ_val).strip() not in ("", "None", "NA")
        has_dn = dn_val is not None and str(dn_val).strip() not in ("", "None", "NA")
        if has_civ or has_dn:
            ref_complete_count += 1
        else:
            ref_incomplete.append({
                **base_info,
                "has_civ": has_civ,
                "has_dn": has_dn,
            })

    wb.close()

    return {
        "eta_2p": {
            "total": eta_2p_total,
            "accepted": eta_2p_accepted,
            "failed": eta_2p_total - eta_2p_accepted,
            "rate": round(eta_2p_accepted / eta_2p_total, 4) if eta_2p_total > 0 else None,
            "failed_shipments": eta_2p_failed,
            "total_failed_shipments": len(eta_2p_failed),
        },
        "eta_2d": {
            "total": eta_2d_total,
            "accepted": eta_2d_accepted,
            "failed": eta_2d_total - eta_2d_accepted,
            "rate": round(eta_2d_accepted / eta_2d_total, 4) if eta_2d_total > 0 else None,
            "failed_shipments": eta_2d_failed,
            "total_failed_shipments": len(eta_2d_failed),
        },
        "ref": {
            "total": ref_total,
            "complete": ref_complete_count,
            "incomplete": ref_total - ref_complete_count,
            "rate": round(ref_complete_count / ref_total, 4) if ref_total > 0 else None,
            "incomplete_shipments": ref_incomplete,
            "total_incomplete_shipments": len(ref_incomplete),
        },
    }


def extract_plausibility_rca(filepath):
    """Extract milestone sequence plausibility violations from SC4 shipments sheet.

    Checks:
      - POD > Delivery (ATA after DELIVERED — physically impossible)
      - POL > POD (ATD after ATA)
      - Pickup > POL (COLLECTED after ATD)
      - Gap > 60 days between consecutive stages
    """
    from datetime import datetime, timedelta

    wb = openpyxl.load_workbook(filepath, data_only=True)
    sheet_name = find_shipments_sheet(wb)
    if not sheet_name:
        wb.close()
        return None

    ws = wb[sheet_name]
    header_row = None
    for i, row in enumerate(ws.iter_rows(min_row=1, max_row=5, values_only=True), 1):
        for cell in row:
            if cell and "UNIQUE_SHIPMENT" in str(cell):
                header_row = i
                break
        if header_row:
            break
    if not header_row:
        header_row = 3

    headers = list(next(ws.iter_rows(min_row=header_row, max_row=header_row, values_only=True)))
    col_map = {}
    for i, h in enumerate(headers):
        if h:
            col_map[str(h).strip()] = i

    hbl_col = col_map.get("HOUSE_BILL_OF_LADING", 1)
    mbl_col = col_map.get("MASTER_BILL_OF_LADING", 2)
    consignment_col = col_map.get("CONSIGNMENT_ID_1", 9)
    carrier_col = col_map.get("CARRIER_1", None)
    origin_col = col_map.get("CONSIGNOR_ADDRESS_CITY_NAME", None)
    dest_col = col_map.get("CONSIGNEE_ADDRESS_CITY_NAME", None)
    transport_col = col_map.get("TRANSPORT_SERVICE_PRIORITY", None)
    dataset_col = col_map.get("DATASET", None)

    collected_col = col_map.get("COLLECTED_DATE_TIME", 74)
    atd_col = col_map.get("ATD_DATE_TIME", 77)
    ata_col = col_map.get("ATA_DATE_TIME", 79)
    delivered_col = col_map.get("DELIVERED_DATE_TIME", 81)
    etd_col = col_map.get("ETD_DATE_TIME", 76)
    eta_col = col_map.get("ETA_DATE_TIME", 78)

    RULES = [
        {"id": "pod_gt_delivery", "label": "POD > Delivery", "desc": "Port arrival after door delivery",
         "severity": "critical", "check_cols": (ata_col, delivered_col)},
        {"id": "pol_gt_pod", "label": "POL > POD", "desc": "Departure after port arrival",
         "severity": "critical", "check_cols": (atd_col, ata_col)},
        {"id": "pickup_gt_pol", "label": "Pickup > POL", "desc": "Collection after vessel departure",
         "severity": "critical", "check_cols": (collected_col, atd_col)},
    ]

    violations = []
    total_shipments = 0
    affected_hbls = set()

    for row in ws.iter_rows(min_row=header_row + 1, max_row=ws.max_row, values_only=True):
        vals = list(row)
        if not vals[0]:
            continue
        total_shipments += 1

        hbl = str(vals[hbl_col]).strip() if vals[hbl_col] else ""
        mbl = str(vals[mbl_col]).strip() if vals[mbl_col] else ""
        consignment = str(vals[consignment_col]).strip() if vals[consignment_col] else ""
        carrier = str(vals[carrier_col]).strip() if carrier_col is not None and vals[carrier_col] else ""
        origin = str(vals[origin_col]).strip() if origin_col is not None and vals[origin_col] else ""
        dest = str(vals[dest_col]).strip() if dest_col is not None and vals[dest_col] else ""
        transport = str(vals[transport_col]).strip() if transport_col is not None and vals[transport_col] else ""
        dataset = str(vals[dataset_col]).strip() if dataset_col is not None and vals[dataset_col] else ""

        base_info = {
            "hbl": hbl, "mbl": mbl, "consignment": consignment,
            "carrier": carrier, "origin": origin, "dest": dest,
            "transport": transport, "dataset": dataset,
        }

        collected = vals[collected_col] if isinstance(vals[collected_col], datetime) else None
        atd = vals[atd_col] if isinstance(vals[atd_col], datetime) else None
        ata = vals[ata_col] if isinstance(vals[ata_col], datetime) else None
        delivered = vals[delivered_col] if isinstance(vals[delivered_col], datetime) else None

        dates = {"collected": collected, "atd": atd, "ata": ata, "delivered": delivered}

        # Sequence violations
        for rule in RULES:
            col_a, col_b = rule["check_cols"]
            date_a = vals[col_a] if isinstance(vals[col_a], datetime) else None
            date_b = vals[col_b] if isinstance(vals[col_b], datetime) else None
            if date_a and date_b and date_a > date_b:
                gap_days = (date_a - date_b).days
                affected_hbls.add(hbl)
                violations.append({
                    **base_info,
                    "rule": rule["id"],
                    "rule_label": rule["label"],
                    "severity": rule["severity"],
                    "gap_days": gap_days,
                    "date_a": date_a.isoformat() if date_a else None,
                    "date_b": date_b.isoformat() if date_b else None,
                })

        # Gap > 60 days between consecutive stages
        stage_pairs = [
            ("collected", "atd", "Pickup → Departure"),
            ("atd", "ata", "Departure → Arrival"),
            ("ata", "delivered", "Arrival → Delivery"),
        ]
        for key_a, key_b, pair_label in stage_pairs:
            da = dates[key_a]
            db = dates[key_b]
            if da and db and db > da and (db - da).days > 60:
                gap_days = (db - da).days
                affected_hbls.add(hbl)
                violations.append({
                    **base_info,
                    "rule": "gap_gt_60d",
                    "rule_label": f"Gap > 60d: {pair_label}",
                    "severity": "warning",
                    "gap_days": gap_days,
                    "date_a": da.isoformat(),
                    "date_b": db.isoformat(),
                })

    wb.close()

    # Summarize by rule
    from collections import Counter
    rule_counts = Counter(v["rule"] for v in violations)
    severity_counts = Counter(v["severity"] for v in violations)

    # Gap buckets for POD > Delivery
    pod_violations = [v for v in violations if v["rule"] == "pod_gt_delivery"]
    gap_buckets = {"1-7d": 0, "8-30d": 0, "31-60d": 0, "61-90d": 0, ">90d": 0}
    for v in pod_violations:
        g = v["gap_days"]
        if g <= 7:
            gap_buckets["1-7d"] += 1
        elif g <= 30:
            gap_buckets["8-30d"] += 1
        elif g <= 60:
            gap_buckets["31-60d"] += 1
        elif g <= 90:
            gap_buckets["61-90d"] += 1
        else:
            gap_buckets[">90d"] += 1

    return {
        "total_shipments": total_shipments,
        "affected_hbls": len(affected_hbls),
        "total_violations": len(violations),
        "critical_count": severity_counts.get("critical", 0),
        "warning_count": severity_counts.get("warning", 0),
        "rule_counts": dict(rule_counts),
        "gap_buckets": gap_buckets,
        "violations": violations,
        "total_violation_records": len(violations),
    }


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

            missing_hbls = missing_list
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

    # ETA & Reference RCA (SC4 only)
    eta_ref_rca = extract_eta_ref_rca(sc4_file)

    # Plausibility RCA (SC4 only)
    plausibility_rca = extract_plausibility_rca(sc4_file)

    return {
        "week": week,
        "milestones": milestones,
        "total_missing": total_missing,
        "critical_issues": critical_issues,
        "warning_issues": warning_issues,
        "ok_issues": sum(1 for m in milestones if m["severity"] == "ok"),
        "eta_ref_rca": eta_ref_rca,
        "plausibility_rca": plausibility_rca,
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
