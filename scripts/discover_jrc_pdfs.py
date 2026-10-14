"""
Discover JRC Food Fraud Monthly reports (European Commission, Knowledge for Policy).

Usage:
    python discover_jrc_pdfs.py [--output ../data/inventory_jrc.json]

The listing page links one publication page per report ("food-fraud-summary-
may-june-2026"); each publication page links the English PDF (filename not
predictable, e.g. 202605_0.pdf) and translations (202605_FR.pdf …).
The inventory is cumulative: a report found once is never dropped.
"""
import json, re, time, argparse
from pathlib import Path
from datetime import datetime
import requests

BASE = "https://knowledge-for-policy.ec.europa.eu"
LISTING = f"{BASE}/jrc-food-fraud-monthly-report_en"
ROOT = Path(__file__).resolve().parent.parent
TIMEOUT = 30
START = (2024, 1)   # same window as the other sources

MONTHS = ["january", "february", "march", "april", "may", "june", "july",
          "august", "september", "october", "november", "december"]
SLUG_RX = re.compile(r'href="([^"]*food-fraud-summary-((?:[a-z]+-)+)(\d{4})(?:_en)?)"', re.I)
PDF_RX = re.compile(r'href="([^"]*/sites/default/files/[^"]+\.pdf)"', re.I)


def parse_listing(html: str) -> dict:
    """{slug: {"url", "year", "months": ["YYYY-MM", …]}} from the listing page."""
    out = {}
    for href, names, year in SLUG_RX.findall(html):
        months = [MONTHS.index(n) + 1 for n in names.strip("-").split("-") if n in MONTHS]
        if not months:
            continue
        y = int(year)
        slug = f"{names}{year}".lower()
        if (y, max(months)) < START:
            continue
        out[slug] = {
            "id": slug,
            "year": y,
            "months": [f"{y}-{m:02d}" for m in months],
            "publication_url": requests.compat.urljoin(BASE, href),
        }
    return out


BOILERPLATE = re.compile(r"terms|privacy|conditions|_ps_|statement", re.I)
LANG_RX = re.compile(r"_(?:EN_)?([A-Z]{2})(?:_\d+)?\.pdf$")


def find_pdfs(html: str, page_url: str, first_month: str) -> dict:
    """Pick the English report PDF (and the French translation when present).

    File names are inconsistent over time: 202601.pdf, 202605_0.pdf,
    202602_EN_1.pdf, food_fraud_newsletter_05-2024.pdf; translations are
    202605_FR.pdf, 202602_FR_0.pdf, 202602_EN_GA.pdf (Irish)… and every page
    also links site-wide PDFs (terms and conditions, privacy statement).
    """
    y, m = first_month.split("-")
    period_tokens = (f"{y}{m}", f"{m}-{y}", f"{m}_{y}", f"{y}-{m}", f"{y}_{m}")
    en, fr = [], None
    for h in dict.fromkeys(PDF_RX.findall(html)):
        name = h.rsplit("/", 1)[-1]
        if BOILERPLATE.search(name):
            continue
        url = requests.compat.urljoin(page_url, h)
        lang = LANG_RX.search(name)
        code = lang.group(1) if lang else "EN"
        if "_EN_" in name and code != "EN":          # _EN_GA, _EN_MT: translations
            continue
        if code == "FR":
            fr = fr or url
        elif code == "EN":
            en.append((not any(t in name for t in period_tokens), url))
    en.sort()   # files naming the report period first
    return {"pdf_url": en[0][1] if en else None, "pdf_fr_url": fr}


def main():
    parser = argparse.ArgumentParser(description="Discover JRC Food Fraud Monthly reports")
    parser.add_argument("--output", default=str(ROOT / "data" / "inventory_jrc.json"))
    args = parser.parse_args()

    session = requests.Session()
    session.headers.update({"User-Agent": "Mozilla/5.0 (Food-Risk-Intelligence inventory; research)"})

    previous = {}
    out_path = Path(args.output)
    if out_path.exists():
        previous = {r["id"]: r for r in json.loads(out_path.read_text(encoding="utf-8"))["reports"]}

    html = session.get(LISTING, timeout=TIMEOUT).text
    listed = parse_listing(html)
    print(f"{len(listed)} JRC reports listed since {START[0]}-{START[1]:02d}")
    if not listed and not previous:
        raise SystemExit("No JRC report found on the listing page — layout changed?")

    reports = dict(previous)
    for slug, rep in sorted(listed.items(), key=lambda kv: kv[1]["months"]):
        if slug in previous and previous[slug].get("pdf_url"):
            continue
        try:
            page = session.get(rep["publication_url"], timeout=TIMEOUT).text
        except requests.RequestException as e:
            print(f"  -- {slug}: {e}")
            continue
        pdfs = find_pdfs(page, rep["publication_url"], rep["months"][0])
        print(f"  {'OK' if pdfs['pdf_url'] else '--'} {slug} -> {pdfs['pdf_url']}")
        reports[slug] = {**rep, **pdfs, "discovered_at": datetime.now().isoformat()}
        time.sleep(0.3)

    ordered = sorted(reports.values(), key=lambda r: r["months"])
    summary = {
        "reports": len(ordered),
        "with_pdf": sum(1 for r in ordered if r.get("pdf_url")),
        "first_month": ordered[0]["months"][0] if ordered else None,
        "latest_month": ordered[-1]["months"][-1] if ordered else None,
        "generated_at": datetime.now().isoformat(),
    }
    out_path.write_text(json.dumps({"summary": summary, "reports": ordered}, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"JRC inventory: {summary['with_pdf']}/{summary['reports']} with PDF, "
          f"{summary['first_month']} → {summary['latest_month']}")


if __name__ == "__main__":
    main()
