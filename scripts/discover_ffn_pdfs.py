"""
Phase FFN-0 — Discover EU FFN Monthly Reports (ACN)
Scrape https://food.ec.europa.eu/food-safety/acn/ffn-monthly_en
to resolve UUID-based download URLs.

Usage:
    python discover_ffn_pdfs.py [--output ../data/inventory_ffn.json]

Output: inventory_ffn.json with ~31 reports (2024-01 → 2026-07)
"""
import json, re, time, argparse, requests
from pathlib import Path
from datetime import datetime

FFN_PAGE = "https://food.ec.europa.eu/food-safety/acn/ffn-monthly_en"
BASE = "https://food.ec.europa.eu"

TIMEOUT = 15
HEAD_TIMEOUT = 12

# Map fr month names not needed — FFN filenames are always ff_ffn_monthly-report_YYYYMM.pdf
MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"]

def fetch_page(session):
    r = session.get(FFN_PAGE, timeout=TIMEOUT)
    r.raise_for_status()
    return r.text

def parse_links(html):
    # Matches: /document/download/<uuid>_en?filename=ff_ffn_monthly-report_202607.pdf
    # Also direct /document/download/<uuid>_en
    pat = re.compile(
        r'href="(/document/download/([0-9a-f\-]+)_en\?filename=ff_ffn_monthly-report_(\d{4})(\d{2})\.pdf)"',
        re.IGNORECASE
    )
    results = []
    for m in pat.finditer(html):
        href, uuid, year, month = m.group(1), m.group(2), int(m.group(3)), int(m.group(4))
        url = BASE + href  # keep ?filename param, EC requires it
        # also store clean url without filename for HEAD fallback
        clean = BASE + f"/document/download/{uuid}_en"
        results.append({
            "year": year,
            "month_num": month,
            "month": MONTH_NAMES[month-1],
            "uuid": uuid,
            "url": url,
            "clean_url": clean,
            "filename": f"ff_ffn_monthly-report_{year}{month:02d}.pdf",
        })
    # Deduplicate by YYYYMM keeping first
    dedup = {}
    for r in results:
        key = (r["year"], r["month_num"])
        if key not in dedup:
            dedup[key] = r
    return sorted(dedup.values(), key=lambda x: (x["year"], x["month_num"]))

def head_check(url, session):
    try:
        # Use GET with stream to handle EC which sometimes 403 on HEAD
        r = session.head(url, timeout=HEAD_TIMEOUT, allow_redirects=True)
        if r.status_code == 200:
            ctype = r.headers.get("Content-Type","")
            clen = r.headers.get("Content-Length","0")
            return {
                "status": 200,
                "content_type": ctype,
                "content_length": int(clen) if clen.isdigit() else 0,
                "accessible": "pdf" in ctype.lower() or int(clen) > 50000,
                "final_url": r.url
            }
        # fallback to GET range
        r2 = session.get(url, timeout=HEAD_TIMEOUT, stream=True)
        ctype = r2.headers.get("Content-Type","")
        clen = r2.headers.get("Content-Length","0")
        accessible = r2.status_code == 200
        return {
            "status": r2.status_code,
            "content_type": ctype,
            "content_length": int(clen) if clen.isdigit() else 0,
            "accessible": accessible,
            "final_url": r2.url
        }
    except Exception as e:
        return {"status": 0, "content_type": "", "content_length": 0, "accessible": False, "error": str(e)}

def main():
    parser = argparse.ArgumentParser(description="Discover FFN monthly reports")
    parser.add_argument("--output", default=str(Path(__file__).resolve().parent.parent / "data" / "inventory_ffn.json"))
    args = parser.parse_args()

    session = requests.Session()
    session.headers.update({"User-Agent": "FFN-Inventory/1.0 (research; contact: food-risk-intelligence)"})

    print(f"Fetching {FFN_PAGE} ...")
    html = fetch_page(session)
    links = parse_links(html)
    print(f"Parsed {len(links)} unique FFN report links from HTML")

    if not links:
        # debug: dump snippet
        snippet = html[html.lower().find("ffn_monthly-report")-500: html.lower().find("ffn_monthly-report")+2000] if "ffn_monthly-report" in html.lower() else html[:3000]
        print("No links parsed, snippet:")
        print(snippet[:2000])
        raise SystemExit(1)

    # HEAD check each
    for r in links:
        info = head_check(r["url"], session)
        # if fails try clean_url
        if not info["accessible"]:
            alt = head_check(r["clean_url"], session)
            if alt["accessible"]:
                info = alt
                r["url_alt_ok"] = True
        r.update({
            "status": info["status"],
            "content_type": info.get("content_type",""),
            "content_length_bytes": info.get("content_length",0),
            "accessible": info["accessible"],
            "checked_at": datetime.now().isoformat(),
            "final_url": info.get("final_url", r["url"]),
        })
        # cross-window flag: aligned with IFS 2024-06→present
        r["in_cross_window"] = (r["year"] > 2024) or (r["year"] == 2024 and r["month_num"] >= 6)
        r["variant"] = "official_ffn"
        print(f"  {r['year']}-{r['month_num']:02d} {r['month']:9s} -> {info['status']} {'OK' if info['accessible'] else '--'} {info.get('content_length',0)//1024}KB {r['uuid'][:8]}... in_cross={r['in_cross_window']}")
        time.sleep(0.2)

    accessible = [r for r in links if r["accessible"]]
    not_found = [r for r in links if not r["accessible"]]
    # Build summary
    summary = {
        "total_candidates": len(links),
        "accessible": len(accessible),
        "not_found": len(not_found),
        "years_covered": sorted(set(r["year"] for r in accessible)),
        "months_accessible": [f"{r['year']}-{r['month_num']:02d}" for r in sorted(accessible, key=lambda x:(x["year"], x["month_num"]))],
        "months_in_cross_window": [f"{r['year']}-{r['month_num']:02d}" for r in sorted([x for x in accessible if x["in_cross_window"]], key=lambda x:(x["year"], x["month_num"]))],
        "generated_at": datetime.now().isoformat(),
        "source_page": FFN_PAGE,
    }

    reports = []
    for r in sorted(accessible, key=lambda x:(x["year"], x["month_num"])):
        reports.append({
            "year": r["year"],
            "month": r["month"],
            "month_num": r["month_num"],
            "filename": r["filename"],
            "uuid": r["uuid"],
            "url": r["url"],
            "clean_url": r["clean_url"],
            "final_url": r.get("final_url",""),
            "variant": r["variant"],
            "content_length_bytes": r["content_length_bytes"],
            "content_type": r["content_type"],
            "in_cross_window": r["in_cross_window"],
            "status": "verified",
            "discovered_at": datetime.now().isoformat(),
        })

    output = {"summary": summary, "reports": reports, "all_links": links}
    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"\n{'='*60}")
    print(f"FOUND:      {len(accessible)} FFN PDFs")
    print(f"CROSS WIN:  {len([r for r in accessible if r['in_cross_window']])} (2024-06->)")
    print(f"OUTPUT:     {args.output}")
    print(f"{'='*60}")

if __name__ == "__main__":
    main()
