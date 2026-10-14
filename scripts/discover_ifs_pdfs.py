"""
Phase 0 — Discover and verify IFS Trend Risk Report PDFs.

Usage:
    python discover_ifs_pdfs.py [--output ../data/inventory.json]
    python discover_ifs_pdfs.py --register 2026-08 https://…/report.pdf [--register-only]

Strategy (in priority order, per month):
  1. Manual sources  — data/manual_sources.json {"YYYY-MM": "url"} (newsletter link, etc.)
  2. Already verified — months present in the existing inventory are kept (cumulative;
                        a month found once is never lost because a URL disappears)
  3. Page scraping    — IFS pages scanned for .pdf links containing "Trend" + "Risk"
  4. URL patterns     — official host, its CDN and known mirrors, several filename variants

A URL is accepted if HEAD (or a GET fallback on the first bytes) returns a PDF.
"""

import json, re, os, time, argparse
from pathlib import Path
from datetime import datetime
import requests

# ─── Configuration ──────────────────────────────────────────────────────────────
TIMEOUT = 12  # seconds per request
DELAY   = 0.3 # seconds between requests (be polite)

ROOT = Path(__file__).resolve().parent.parent
MANUAL_SOURCES = ROOT / "data" / "manual_sources.json"

# Official hosts (site + its CDN) and known third-party mirrors
HOSTS = [
    ("official", "https://www.ifs-certification.com/images/ifs_documents"),
    ("cdn",      "https://ifs-certification.b-cdn.net/images/ifs_documents"),
    ("mirror_fsk", "https://www.foodsafetykongress.de/files/hut/FoodSafetyKongress2024/Blog"),
]

# Pages scanned for direct PDF links
SCRAPE_PAGES = [
    "https://www.ifs-certification.com/index.php/en/ifs-portfolio/risk-management",
    "https://www.ifs-certification.com/en/news-overview",
    "https://www.ifs-certification.com/index.php/de/ifs-portfolio/risk-management",
    "https://www.ifs-certification.com/index.php/fr/ifs-portfolio/risk-management",
]

MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
]
MONTH_LOOKUP = {m.lower(): i for i, m in enumerate(MONTHS, start=1)}
MONTH_LOOKUP.update({m[:3].lower(): i for i, m in enumerate(MONTHS, start=1)})
MONTH_LOOKUP["sept"] = 9

# First month ever published in the series covered by this tool
START = (2024, 1)


def months_to_check(now: datetime):
    """All (year, month) from START up to the current month — no hardcoded years."""
    y, m = START
    while (y, m) <= (now.year, now.month):
        yield y, m
        m += 1
        if m > 12:
            y, m = y + 1, 1


def filename_variants(month_name: str, year: int):
    """IFS changes separators from one month to the next (July 2026: '_EN',
    August 2026: '-EN'), so every plausible combination is generated —
    the formats already observed first."""
    observed = [
        f"IFS_Trend_Risk_Report_{month_name}_{year}-EN.pdf",
        f"IFS_Trend_Risk_Report_{month_name}_{year}_EN.pdf",
        f"IFS_Trend_Risk_Report_{month_name}_{year}.pdf",
    ]
    combos = []
    for s1 in ("_", "-"):                     # inside "IFS_Trend_Risk_Report"
        for s2 in ("_", "-"):                 # before month
            for s3 in ("_", "-", ""):         # between month and year
                for suffix in ("-EN", "_EN", "", "-en", "_en"):
                    for month in (month_name, month_name[:3]):
                        combos.append(f"IFS{s1}Trend{s1}Risk{s1}Report{s2}{month}{s3}{year}{suffix}.pdf")
    return list(dict.fromkeys(observed + combos))


def parse_month_from_url(url: str):
    """Return (year, month_num) from a filename like ..._August_2026_EN.pdf, else None."""
    name = url.rsplit("/", 1)[-1].lower()
    ym = re.search(r"(20\d{2})", name)
    if not ym:
        return None
    for token in re.split(r"[^a-z]+", name):
        if token in MONTH_LOOKUP:
            return int(ym.group(1)), MONTH_LOOKUP[token]
    return None


# ─── Network helpers ────────────────────────────────────────────────────────────
def check_url(url: str, session: requests.Session) -> dict:
    """HEAD, then GET fallback reading the first bytes (%PDF signature)."""
    info = {"status": 0, "content_type": "", "content_length": 0, "accessible": False}
    try:
        r = session.head(url, timeout=TIMEOUT, allow_redirects=True)
        ctype = r.headers.get("Content-Type", "")
        clen = r.headers.get("Content-Length", "0")
        info.update(status=r.status_code, content_type=ctype,
                    content_length=int(clen) if clen.isdigit() else 0)
        if r.status_code == 200 and "pdf" in ctype.lower():
            info["accessible"] = True
            return info
        if r.status_code == 404:
            return info
    except requests.RequestException as e:
        info["error"] = str(e)
    # Fallback: some servers/CDNs refuse HEAD or mislabel the content-type
    try:
        with session.get(url, timeout=TIMEOUT, stream=True, allow_redirects=True) as r:
            head = next(r.iter_content(1024), b"")
            clen = r.headers.get("Content-Length", "0")
            info.update(status=r.status_code, content_type=r.headers.get("Content-Type", ""),
                        content_length=int(clen) if clen.isdigit() else 0)
            info["accessible"] = r.status_code == 200 and head.startswith(b"%PDF")
    except requests.RequestException as e:
        info["error"] = str(e)
    return info


def scrape_pdf_links(session: requests.Session) -> dict:
    """{(year, month): url} for Trend Risk PDFs linked from known IFS pages."""
    found = {}
    pat = re.compile(r'(?:href|src)="([^"]+\.pdf)"', re.IGNORECASE)
    for page in SCRAPE_PAGES:
        try:
            html = session.get(page, timeout=TIMEOUT).text
        except requests.RequestException as e:
            print(f"  scrape failed {page}: {e}")
            continue
        for href in pat.findall(html):
            low = href.lower()
            if "trend" not in low or "risk" not in low:
                continue
            url = requests.compat.urljoin(page, href)
            ym = parse_month_from_url(url)
            if ym and ym not in found:
                found[ym] = url
        time.sleep(DELAY)
    return found


def load_json(path: Path, default):
    if path.exists():
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return default


def register_manual(month: str, url: str):
    """Persist a manual source (e.g. link received by IFS newsletter)."""
    if not re.fullmatch(r"20\d{2}-(0[1-9]|1[0-2])", month):
        raise SystemExit(f"Invalid month '{month}', expected YYYY-MM")
    if not url.lower().startswith("http"):
        raise SystemExit(f"Invalid URL '{url}'")
    manual = load_json(MANUAL_SOURCES, {})
    manual[month] = url
    MANUAL_SOURCES.parent.mkdir(parents=True, exist_ok=True)
    with open(MANUAL_SOURCES, "w", encoding="utf-8") as f:
        json.dump(dict(sorted(manual.items())), f, indent=2, ensure_ascii=False)
    print(f"Registered manual source {month} -> {url}")


# ─── Main ───────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Discover IFS Trend Risk Report PDFs")
    parser.add_argument("--output", default=str(ROOT / "data" / "inventory.json"))
    parser.add_argument("--register", nargs=2, metavar=("YYYY-MM", "URL"),
                        help="Add a manual source to data/manual_sources.json, then run discovery")
    parser.add_argument("--register-only", action="store_true",
                        help="With --register: only save the manual source, skip discovery")
    args = parser.parse_args()

    if args.register:
        register_manual(*args.register)
        if args.register_only:
            return

    now = datetime.now()
    session = requests.Session()
    session.headers.update({"User-Agent": "Mozilla/5.0 (IFS-Trend-Risk-Inventory/2.0; research)"})

    previous = load_json(Path(args.output), {"reports": []})
    known = {(r["year"], r["month_num"]): r for r in previous.get("reports", [])}
    manual = {tuple(int(x) for x in k.split("-")): v for k, v in load_json(MANUAL_SOURCES, {}).items()}

    print("Scraping IFS pages for PDF links …")
    scraped = scrape_pdf_links(session)
    print(f"  {len(scraped)} Trend Risk PDF links found on pages")

    inventory, missing, checked = [], [], 0
    for y, m in months_to_check(now):
        month_name = MONTHS[m - 1]
        candidates = []
        if (y, m) in manual:
            candidates.append(("manual", manual[(y, m)]))
        if (y, m) in known and (y, m) not in manual:
            # Already verified in a previous run: keep without re-checking
            inventory.append(known[(y, m)])
            continue
        if (y, m) in scraped:
            candidates.append(("scraped", scraped[(y, m)]))
        # Recent months (where a new report is expected): every filename
        # variant on the official host. Older gaps: observed formats only,
        # to keep the weekly run short (a manual source still works for them).
        recent = (now.year * 12 + now.month) - (y * 12 + m) <= 6
        variants = filename_variants(month_name, y)
        for variant, host in HOSTS:
            names = variants if (recent and variant == "official") else variants[:3]
            for fname in names:
                candidates.append((variant, f"{host}/{fname}"))

        hit = None
        for variant, url in candidates:
            checked += 1
            resp = check_url(url, session)
            time.sleep(DELAY if resp["status"] != 404 else 0.05)
            if resp["accessible"]:
                hit = (variant, url, resp)
                break
        if hit:
            variant, url, resp = hit
            print(f"  OK  {y}-{m:02d} ({variant}) {url}")
            inventory.append({
                "year": y,
                "month": month_name,
                "month_num": m,
                "url": url,
                "variant": variant,
                "content_length_bytes": resp["content_length"],
                "content_type": resp["content_type"],
                "status": "verified",
                "discovered_at": now.isoformat(),
            })
        else:
            missing.append(f"{y}-{m:02d}")
            print(f"  --  {y}-{m:02d} not found ({len(candidates)} candidates)")

    # Never drop a previously verified month, even outside the checked range
    listed = {(r["year"], r["month_num"]) for r in inventory}
    inventory += [r for k, r in known.items() if k not in listed]
    inventory.sort(key=lambda r: (r["year"], r["month_num"]))
    latest = f"{inventory[-1]['year']}-{inventory[-1]['month_num']:02d}" if inventory else None
    summary = {
        "total_candidates_checked": checked,
        "accessible": len(inventory),
        "not_found": len(missing),
        "years_covered": sorted({r["year"] for r in inventory}),
        "months_accessible": [f"{r['year']}-{r['month_num']:02d}" for r in inventory],
        "months_missing": missing,
        "latest_month": latest,
        "manual_sources": len(manual),
        "generated_at": now.isoformat(),
    }

    os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump({"summary": summary, "reports": inventory}, f, indent=2, ensure_ascii=False)

    print(f"\n{'='*60}")
    print(f"FOUND:    {len(inventory)} reports (latest {latest})")
    print(f"MISSING:  {', '.join(missing) or 'none'}")
    print(f"OUTPUT:   {args.output}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
