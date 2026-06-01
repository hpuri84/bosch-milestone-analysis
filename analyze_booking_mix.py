#!/usr/bin/env python3
"""Booking Mix analysis: SC3 vs SC4 shipment-count split per week vs 80/20 target.

SC4 = ocean (Asia->Europe). SC3 = NGTM road/inland legs. Different datasets.
Headline mix = share of shipment COUNT that is SC3 vs SC4 per week.
Only comparable cross-dataset dimension is DESTINATION country:
  SC4 dest -> CONSIGNEE_ADDRESS_COUNTRY ; SC3 dest -> Leg_Delivery_Country.
"""
import json
import os
from datetime import datetime, timezone

import openpyxl

BASE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(BASE, "Bosch Milestone raw data")
OUT = os.path.join(BASE, "dashboard", "public", "booking_mix.json")

WEEKS = [f"CW{i:02d}" for i in range(1, 21)]
TARGET_SC3 = 0.80
TARGET_SC4 = 0.20


def sc3_path(week):
    n = int(week[2:])
    name = f"Maersk NGTM SC3_2026_{week}.xlsx" if n <= 9 else f"Maersk SC3_2026_{week}.xlsx"
    return os.path.join(RAW, name)


def sc4_path(week):
    return os.path.join(RAW, f"Maersk SC4_2026_{week}.xlsx")


def find_shipments_sheet(wb):
    # 1. by name (case-insensitive, strip trailing spaces)
    for ws in wb.worksheets:
        if ws.title.strip().lower() == "shipments":
            return ws
    # 2. scan first 5 rows of each sheet for a marker
    for ws in wb.worksheets:
        for r in range(1, 6):
            row = next(ws.iter_rows(min_row=r, max_row=r, values_only=True), ())
            for v in row:
                if isinstance(v, str):
                    u = v.upper()
                    if "UNIQUE_SHIPMENT" in u or u == "LOAD_ID":
                        return ws
    return wb.worksheets[0]


def detect_header_row(ws):
    # SC4 has UNIQUE_SHIPMENT_ID; SC3 starts with LOAD_ID. Fallback row 3.
    for r in range(1, 6):
        row = next(ws.iter_rows(min_row=r, max_row=r, values_only=True), ())
        for v in row:
            if isinstance(v, str):
                u = v.upper()
                if "UNIQUE_SHIPMENT" in u or u == "LOAD_ID":
                    return r
    return 3


def col_index(headers, substr):
    for i, h in enumerate(headers):
        if isinstance(h, str) and substr.lower() in h.lower():
            return i
    return None


def analyze_file(path, country_substr):
    """Return (row_count, {country: count}). row_count = rows where first col non-empty."""
    if not os.path.exists(path):
        return None, {}
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    try:
        ws = find_shipments_sheet(wb)
        hdr_row = detect_header_row(ws)
        headers = list(next(ws.iter_rows(min_row=hdr_row, max_row=hdr_row, values_only=True), ()))
        c_idx = col_index(headers, country_substr)
        count = 0
        countries = {}
        for row in ws.iter_rows(min_row=hdr_row + 1, values_only=True):
            if not row:
                continue
            first = row[0]
            if first in (None, ""):
                continue
            count += 1
            if c_idx is not None and c_idx < len(row):
                cv = row[c_idx]
                if cv not in (None, ""):
                    key = str(cv).strip().upper()
                    countries[key] = countries.get(key, 0) + 1
        return count, countries
    finally:
        wb.close()


def main():
    weekly = []
    by_dest = {}
    diag = {}  # week -> (sc3_rows, sc3_with_country)

    for week in WEEKS:
        p3, p4 = sc3_path(week), sc4_path(week)
        if not (os.path.exists(p3) or os.path.exists(p4)):
            continue
        sc3, sc3_c = analyze_file(p3, "Leg_Delivery_Country")
        sc4, sc4_c = analyze_file(p4, "CONSIGNEE_ADDRESS_COUNTRY")
        sc3 = sc3 or 0
        sc4 = sc4 or 0
        total = sc3 + sc4
        if total == 0:
            continue
        sc3_share = sc3 / total
        sc4_share = sc4 / total
        weekly.append({
            "week": week,
            "sc3": sc3,
            "sc4": sc4,
            "total": total,
            "sc3_share": round(sc3_share, 4),
            "sc4_share": round(sc4_share, 4),
            "gap_pp": round(sc3_share * 100 - 80, 1),
        })
        diag[week] = (sc3, sum(sc3_c.values()))

        # merge dest countries
        all_c = set(sc3_c) | set(sc4_c)
        rows = []
        for c in all_c:
            a = sc3_c.get(c, 0)
            b = sc4_c.get(c, 0)
            t = a + b
            rows.append({
                "country": c,
                "sc3": a,
                "sc4": b,
                "total": t,
                "sc3_share": round(a / t, 4) if t else 0,
            })
        rows.sort(key=lambda x: x["total"], reverse=True)
        by_dest[week] = rows

    # trailing 4-week avg sc3_share
    trailing4 = {}
    for i, w in enumerate(weekly):
        window = weekly[max(0, i - 3): i + 1]
        avg = sum(x["sc3_share"] for x in window) / len(window)
        trailing4[w["week"]] = round(avg, 4)

    latest_week = weekly[-1]["week"] if weekly else None

    notes = [
        "Booking mix is measured by shipment COUNT, not container or volume.",
        "Weekly files are activity snapshots, not cumulative bookings — mix is volatile week to week.",
        "CW20 SC3 (200 rows) and CW18 SC4 (208 rows) appear to be PARTIAL extracts vs typical ~400-650; treat single-week values as directional. Trailing-average is more reliable.",
        "SC4 = ocean freight (Asia origin -> Europe). SC3 = NGTM road/inland legs (LSP trucking, mostly within Europe). Only DESTINATION country is comparable across the two datasets.",
    ]

    payload = {
        "generated": datetime.now(timezone.utc).isoformat(),
        "target_sc3": TARGET_SC3,
        "target_sc4": TARGET_SC4,
        "weekly": weekly,
        "trailing4_sc3_share": trailing4,
        "by_dest_country": by_dest,
        "latest_week": latest_week,
        "notes": notes,
    }
    with open(OUT, "w") as f:
        json.dump(payload, f, indent=2)

    # ---- sanity printout ----
    print(f"Wrote {OUT}\n")
    print(f"{'WEEK':6} {'SC3':>6} {'SC4':>6} {'TOTAL':>7} {'SC3%':>7} {'gap_pp':>7} {'trail4%':>8}")
    for w in weekly:
        print(f"{w['week']:6} {w['sc3']:>6} {w['sc4']:>6} {w['total']:>7} "
              f"{w['sc3_share']*100:>6.1f}% {w['gap_pp']:>7} "
              f"{trailing4[w['week']]*100:>7.1f}%")

    print("\nSC3 dest-country extraction check (rows_with_country / total_sc3_rows):")
    for wk, (tot, withc) in diag.items():
        flag = "  <-- WARN near-zero" if tot and withc / tot < 0.1 else ""
        print(f"  {wk}: {withc}/{tot}{flag}")

    if latest_week:
        print(f"\nTop 12 dest countries for {latest_week} (SC3 / SC4 / total / SC3%):")
        for r in by_dest[latest_week][:12]:
            print(f"  {r['country']:4} sc3={r['sc3']:>4} sc4={r['sc4']:>4} "
                  f"total={r['total']:>4} sc3%={r['sc3_share']*100:>5.1f}%")

    cw20 = next((w for w in weekly if w["week"] == "CW20"), None)
    if cw20:
        ok = cw20["sc3"] == 200 and cw20["sc4"] == 648 and abs(cw20["sc3_share"] * 100 - 23.6) < 0.2
        print(f"\nCW20 CONFIRM: sc3={cw20['sc3']} sc4={cw20['sc4']} "
              f"sc3_share={cw20['sc3_share']*100:.1f}%  -> {'PASS' if ok else 'FAIL'}")


if __name__ == "__main__":
    main()
