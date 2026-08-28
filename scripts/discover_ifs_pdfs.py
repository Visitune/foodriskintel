"""
Phase 0 — Discover and verify IFS Trend Risk Report PDFs (2022→2026)

Usage:
    python discover_ifs_pdfs.py [--output ../data/inventory.json]

Checks official IFS URLs + known mirrors, HEAD-request each, outputs inventory.
"""

import json, sys, os, time, argparse
from pathlib import Path
from datetime import datetime
import requests

# ─── Configuration ──────────────────────────────────────────────────────────────
TIMEOUT = 12  # seconds per HEAD request
DELAY   = 0.3 # seconds between requests (be polite)

# Official base
IFS_BASE = "https://www.ifs-certification.com/images/ifs_documents"

# Known mirrors / third-party hosts (fallback)
MIRRORS = [
    "https://www.foodsafetykongress.de/files/hut/FoodSafetyKongress2024/Blog",
]

# Months to test (English names as used in filenames)
MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
]

# Years to cover
YEARS = [2022, 2023, 2024, 2025, 2026]

# We stop at current month (August 2026)
NOW = datetime.now()
STOP_YEAR  = NOW.year
STOP_MONTH = NOW.month  # 1-indexed

# ─── Helpers ────────────────────────────────────────────────────────────────────
def build_urls():
    """Generate all candidate URLs for each (month, year) combination."""
    candidates = []
    for year in YEARS:
        for month_idx, month_name in enumerate(MONTHS, start=1):
            if year == STOP_YEAR and month_idx > STOP_MONTH:
                break
            if year < 2022:
                continue

            base_name = f"IFS_Trend_Risk_Report_{month_name}_{year}.pdf"

            # Official IFS URL (two variants: with and without _EN)
            candidates.append({
                "month": month_name,
                "month_num": month_idx,
                "year": year,
                "variant": "official",
                "url": f"{IFS_BASE}/{base_name}",
            })
            candidates.append({
                "month": month_name,
                "month_num": month_idx,
                "year": year,
                "variant": "official_EN",
                "url": f"{IFS_BASE}/{month_name}_{year}_EN.pdf".replace("IFS_Trend_Risk_Report_", "IFS_Trend_Risk_Report_"),
            })
            # Actually the _EN variant uses same prefix, just appends _EN before .pdf
            # Let's fix: IFS_Trend_Risk_Report_July_2026_EN.pdf
            candidates.append({
                "month": month_name,
                "month_num": month_idx,
                "year": year,
                "variant": "official_EN2",
                "url": f"{IFS_BASE}/IFS_Trend_Risk_Report_{month_name}_{year}_EN.pdf",
            })

            # Mirror URLs (known patterns)
            for mirror in MIRRORS:
                candidates.append({
                    "month": month_name,
                    "month_num": month_idx,
                    "year": year,
                    "variant": "mirror_fsk",
                    "url": f"{mirror}/IFS_Trend_Risk_Report_{month_name}_{year}.pdf",
                })
                candidates.append({
                    "month": month_name,
                    "month_num": month_idx,
                    "year": year,
                    "variant": "mirror_fsk_EN",
                    "url": f"{mirror}/IFS_Trend_Risk_Report_{month_name}_{year}_EN.pdf",
                })

    # Deduplicate by URL
    seen = set()
    unique = []
    for c in candidates:
        if c["url"] not in seen:
            seen.add(c["url"])
            unique.append(c)
    return unique


def check_url(url: str, session: requests.Session) -> dict:
    """HEAD request → status, content-length, content-type."""
    try:
        r = session.head(url, timeout=TIMEOUT, allow_redirects=True)
        ctype = r.headers.get("Content-Type", "")
        clen  = r.headers.get("Content-Length", "0")
        return {
            "status": r.status_code,
            "content_type": ctype,
            "content_length": int(clen) if clen.isdigit() else 0,
            "accessible": r.status_code == 200 and "pdf" in ctype.lower(),
        }
    except requests.RequestException as e:
        return {"status": 0, "content_type": "", "content_length": 0, "accessible": False, "error": str(e)}


# ─── Main ───────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Discover IFS Trend Risk Report PDFs")
    parser.add_argument("--output", default=str(Path(__file__).resolve().parent.parent / "data" / "inventory.json"))
    args = parser.parse_args()

    candidates = build_urls()
    print(f"Checking {len(candidates)} candidate URLs …")

    session = requests.Session()
    session.headers.update({"User-Agent": "IFS-Trend-Risk-Inventory/1.0 (research)"})

    results = []
    found_count = 0
    for i, c in enumerate(candidates, 1):
        resp = check_url(c["url"], session)
        status_char = "OK" if resp["accessible"] else "--"
        size_kb = resp["content_length"] // 1024 if resp["content_length"] else 0
        print(f"  [{i:3d}/{len(candidates)}] {status_char} {c['year']}-{c['month_num']:02d} ({c['variant']}) -> {resp['status']} {size_kb:>5}KB  {c['url']}")
        if resp["accessible"]:
            found_count += 1
        results.append({**c, **resp})
        time.sleep(DELAY)

    # Deduplicate: keep best accessible version per (year, month)
    best = {}
    for r in results:
        key = (r["year"], r["month_num"])
        if key not in best or (r["accessible"] and not best[key]["accessible"]):
            best[key] = r
        elif r["accessible"] and best[key]["accessible"]:
            # prefer official > mirror
            if r["variant"].startswith("official") and not best[key]["variant"].startswith("official"):
                best[key] = r

    accessible = {k: v for k, v in sorted(best.items()) if v["accessible"]}
    not_found  = {k: v for k, v in sorted(best.items()) if not v["accessible"]}

    # Build clean inventory
    inventory = []
    for (y, m), r in sorted(accessible.items()):
        inventory.append({
            "year": y,
            "month": r["month"],
            "month_num": m,
            "url": r["url"],
            "variant": r["variant"],
            "content_length_bytes": r["content_length"],
            "content_type": r["content_type"],
            "status": "verified",
            "discovered_at": datetime.now().isoformat(),
        })

    # Summary
    summary = {
        "total_candidates": len(candidates),
        "accessible": len(accessible),
        "not_found": len(not_found),
        "years_covered": sorted(set(y for y, _ in accessible.keys())),
        "months_accessible": [f"{y}-{m:02d}" for y, m in sorted(accessible.keys())],
        "months_missing": [f"{y}-{m:02d}" for y, m in sorted(not_found.keys())],
        "generated_at": datetime.now().isoformat(),
    }

    output = {"summary": summary, "reports": inventory}
    os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"\n{'='*60}")
    print(f"FOUND:      {len(accessible)} accessible PDFs")
    print(f"NOT FOUND:  {len(not_found)} candidates failed")
    print(f"OUTPUT:     {args.output}")
    print(f"{'='*60}")

    if not_found:
        print("\nMissing months (check manually):")
        for (y, m), r in sorted(not_found.items()):
            print(f"  {y}-{m:02d} ({r['month']})")


if __name__ == "__main__":
    main()
