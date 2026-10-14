"""
Phase 1 — Extract recalls & food fraud from IFS Trend Risk Reports PDFs.

Usage:
    python extract.py [--inventory ../data/inventory.json] [--output ../data/raw_extractions.json]

Downloads PDFs if missing, extracts data using pdfplumber, outputs raw extractions.
"""

import json, sys, os, re, time, argparse
from pathlib import Path
from datetime import datetime
import requests
import pdfplumber

# ─── Configuration ──────────────────────────────────────────────────────────────
PDF_DIR = Path(__file__).resolve().parent.parent / "pdfs"
PDF_DIR.mkdir(exist_ok=True)

# Known country names on the recalls map (order matters for multi-word)
RECALL_COUNTRIES = [
    "New Zealand", "South Korea", "USA (FDA)", "USA (USDA)",
    "Czech Rep.", "Viet Nam",
    "England", "Scotland", "Iceland", "Ireland", "Denmark", "Finland",
    "Finnland",  # typo in some reports
    "Netherlands", "Luxembourg", "Hungary", "Austria", "Belgium",
    "Germany", "France", "Spain", "Italy", "Greece", "Romania",
    "Croatia", "Poland", "Slovakia", "China", "Japan", "Israel",
    "Brazil", "Argentina", "Australia", "Canada", "Singapore",
    "Philippines", "Türkiye", "Turkey",
]

# Fraud reason normalization
FRAUD_REASON_MAP = {
    "document forgery": "Document forgery",
    "mislabelling": "Mislabelling",
    "adulteration": "Adulteration",
    "grey market": "Grey market",
    "counterfeit": "Counterfeit",
    "smuggling": "Smuggling",
    "product tampering": "Product tampering",
}

# Country normalization
COUNTRY_NORMALIZE = {
    "USA (FDA)": "United States",
    "USA (USDA)": "United States",
    "Viet Nam": "Vietnam",
    "Czech Rep.": "Czechia",
    "Finnland": "Finland",
    "Türkiye": "Turkey",
    "South Korea": "South Korea",
    "New Zealand": "New Zealand",
    "England": "United Kingdom",
    "Scotland": "United Kingdom",
}


# ─── PDF Download ───────────────────────────────────────────────────────────────
def download_pdf(url: str, dest: Path, session: requests.Session) -> bool:
    if dest.exists() and dest.stat().st_size > 10000:
        return True
    try:
        r = session.get(url, timeout=60)
        if r.status_code == 200 and len(r.content) > 10000:
            dest.write_bytes(r.content)
            return True
    except Exception as e:
        print(f"    DOWNLOAD FAILED: {e}")
    return False


# ─── Period Detection ───────────────────────────────────────────────────────────
MONTHS = {
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
}

def detect_period_from_text(text: str) -> dict:
    """Detect month/year from PDF text."""
    for month_name, month_num in MONTHS.items():
        pattern = rf'\b{month_name}\s+(\d{{4}})\b'
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            return {"month": month_name.capitalize(), "month_num": month_num, "year": int(m.group(1))}
    return None


def detect_data_period_from_text(text: str) -> dict:
    """Try to detect the actual data period (may differ from publication month)."""
    # Look for "detected in" pattern for food fraud
    patterns = [
        r'detected\s+in\s+(\w+)\s+(\d{2,4})',
        r'covering?\s+the\s+period\s+(\w+)\s*(?:to|-)\s*(\w+)\s+(\d{4})',
        r'during\s+(\w+)\s+(\d{4})',
    ]
    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            return {"raw": m.group(0)}
    return None


# ─── Food Fraud Extraction ──────────────────────────────────────────────────────
KNOWN_REASONS = {
    "document forgery", "mislabelling", "misbranding", "adulteration", "grey market",
    "counterfeit", "smuggling", "product tampering", "contraband", "illegal trade",
    "theft", "bribery of officials", "expired products", "illegal processing",
}

# Header keyword → logical column (first match wins, checked on lowercased header text)
HEADER_KEYS = [
    ("product", ("ingredient", "product")),
    ("reason", ("reason",)),
    ("country", ("country", "region")),
    ("detected_in", ("detected",)),
    ("source", ("source",)),
]


def _clean(cell) -> str:
    """Collapse PDF line breaks and spaces inside a cell."""
    return re.sub(r"\s+", " ", str(cell)).strip() if cell else ""


def _map_columns(rows: list) -> tuple:
    """Find the header row and map logical columns to indices by header text.

    Column positions vary between reports (8 or 9 columns), so they are never
    hardcoded. Returns (col_map, first_data_row) or (None, 0).
    """
    for i, row in enumerate(rows[:4]):
        cells = [_clean(c).lower() for c in row]
        if not any("reason" in c for c in cells):
            continue
        col_map = {}
        for key, words in HEADER_KEYS:
            for j, c in enumerate(cells):
                # "IFS Product Scope" is a pictogram column: skip it for "product"
                if key == "product" and ("ifs" in c or "scope" in c):
                    continue
                if j not in col_map.values() and any(w in c for w in words):
                    col_map[key] = j
                    break
        if {"product", "reason", "country"} <= col_map.keys():
            return col_map, i + 1
    return None, 0


def extract_food_fraud(page) -> list:
    """Extract food fraud cases from a PDF page (header-driven, with press links)."""
    cases = []
    links = [h for h in (page.hyperlinks or []) if h.get("uri")]

    for table in page.find_tables():
        rows = table.extract()
        if not rows or len(rows) < 3:
            continue
        col_map, start = _map_columns(rows)
        if not col_map:
            continue

        for r_idx in range(start, len(rows)):
            row = rows[r_idx]
            get = lambda k: _clean(row[col_map[k]]) if k in col_map and col_map[k] < len(row) else ""
            product, reason, country = get("product"), get("reason"), get("country")
            if not product and not reason:
                continue
            low = product.lower()
            if low in ("product", "scope", "link") or "ingredient" in low:
                continue

            # Press link: hyperlink annotation vertically inside this row
            press_url = ""
            bbox = table.rows[r_idx].bbox if r_idx < len(table.rows) else None
            if bbox:
                _, top, _, bottom = bbox
                for h in links:
                    mid = (h["top"] + h["bottom"]) / 2
                    if top - 1 <= mid <= bottom + 1:
                        press_url = h["uri"]
                        break

            # Consistency check: a shifted row puts a reason in the country column
            needs_review = (
                not country
                or reason.lower() not in KNOWN_REASONS and country.lower() in KNOWN_REASONS
                or not reason
            )
            cases.append({
                "product_raw": product,
                "reason_raw": reason,
                "country_raw": country,
                "detected_in": get("detected_in"),
                "press_url": press_url,
                "needs_review": bool(needs_review),
            })

    return cases


# ─── Recalls Extraction ─────────────────────────────────────────────────────────
MULTI_WORD = {("Czech", "Rep."): "Czech Rep.", ("Viet", "Nam"): "Viet Nam",
              ("New", "Zealand"): "New Zealand", ("South", "Korea"): "South Korea",
              ("USA", "(FDA)"): "USA (FDA)", ("USA", "(USDA)"): "USA (USDA)"}
SINGLE_WORD = {c for c in RECALL_COUNTRIES if " " not in c}


def _labels(words: list) -> list:
    """Country labels on the recalls map with their bounding box."""
    labels, used = [], set()
    for i, w in enumerate(words):
        if i in used:
            continue
        # Multi-word label: next word on the same line, close to the right
        for j in range(i + 1, min(i + 4, len(words))):
            nxt = words[j]
            if abs(nxt["top"] - w["top"]) < 3 and 0 <= nxt["x0"] - w["x1"] < 12:
                name = MULTI_WORD.get((w["text"], nxt["text"]))
                if name:
                    labels.append({"country": name, "x0": w["x0"], "x1": nxt["x1"], "top": w["top"]})
                    used.update({i, j})
                break
        if i in used:
            continue
        if w["text"] in SINGLE_WORD:
            labels.append({"country": w["text"], "x0": w["x0"], "x1": w["x1"], "top": w["top"]})
    return labels


def extract_recalls(page) -> dict:
    """Extract recalls by country from the map page.

    Each label is paired with the closest number printed just below it.
    A "-" on the map means "not reported" and is returned as None (never 0).
    """
    words = page.extract_words()
    labels = _labels(words)

    values = []
    for w in words:
        t = w["text"]
        if t in ("-", "–") or (t.isdigit() and len(t) <= 4):
            values.append({"value": None if not t.isdigit() else int(t),
                           "cx": (w["x0"] + w["x1"]) / 2, "top": w["top"]})

    # Global greedy matching on distance (label centre → value centre)
    pairs = []
    for li, lab in enumerate(labels):
        lcx = (lab["x0"] + lab["x1"]) / 2
        for vi, v in enumerate(values):
            dy = v["top"] - lab["top"]
            dx = abs(v["cx"] - lcx)
            if 5 <= dy <= 25 and dx <= 60:
                pairs.append(((dx ** 2 + dy ** 2) ** 0.5, li, vi))
    recalls, l_used, v_used = {}, set(), set()
    for _, li, vi in sorted(pairs):
        if li in l_used or vi in v_used:
            continue
        l_used.add(li); v_used.add(vi)
        recalls[labels[li]["country"]] = values[vi]["value"]
    return recalls


# ─── Main Extraction ────────────────────────────────────────────────────────────
def extract_from_pdf(pdf_path: Path) -> dict:
    """Extract all data from a single PDF."""
    result = {
        "file": pdf_path.name,
        "publication_month": None,
        "publication_year": None,
        "data_period": None,
        "recalls": {},
        "food_fraud": [],
        "errors": [],
    }
    
    try:
        pdf = pdfplumber.open(str(pdf_path))
    except Exception as e:
        result["errors"].append(f"Cannot open PDF: {e}")
        return result
    
    # Publication period = filename is source of truth (inventory month/year)
    # Keep text detection only for warning / data_period, not for publication
    fname = pdf_path.stem
    for month_name, month_num in MONTHS.items():
        if month_name in fname.lower():
            result["publication_month"] = month_name.capitalize()
            year_m = re.search(r'(\d{4})', fname)
            if year_m:
                result["publication_year"] = int(year_m.group(1))
            break
    full_text = ""
    for page in pdf.pages[:3]:
        t = page.extract_text()
        if t:
            full_text += t + "\n"
    # IFS sometimes skips the fraud table ("unable to provide you with a summary
    # of food fraud cases"): that month is "not published", never "0 cases".
    fraud_skipped = "unable to provide you with a summary of food fraud" in re.sub(r"\s+", " ", full_text.lower())
    # Optional cross-check: if text month differs, log but keep filename
    period_text = detect_period_from_text(full_text)
    if period_text and (period_text["month"] != result["publication_month"] or period_text["year"] != result["publication_year"]):
        result["errors"].append(f"Text month {period_text['month']} {period_text['year']} differs from filename {result['publication_month']} {result['publication_year']} — keeping filename")
    
    # Find the recalls page and food fraud page
    for i, page in enumerate(pdf.pages):
        text = page.extract_text() or ""
        
        # Food fraud table (may continue over several pages)
        low = text.lower()
        if "food fraud" in low or "reason" in low and "detected" in low:
            try:
                cases = extract_food_fraud(page)
                result["food_fraud"].extend(cases)
                if cases and not result["data_period"]:
                    m = re.search(r"cases detected in (\w+)\s+(\d{4})", low)
                    if m and m.group(1) in MONTHS:
                        result["data_period"] = f"{m.group(2)}-{MONTHS[m.group(1)]:02d}"
            except Exception as e:
                result["errors"].append(f"Food fraud extraction error on page {i+1}: {e}")

        # Recalls map: keep the page yielding the most countries
        if "recalls" in low:
            try:
                recalls = extract_recalls(page)
                if len(recalls) > len(result["recalls"]):
                    result["recalls"] = recalls
            except Exception as e:
                result["errors"].append(f"Recalls extraction error on page {i+1}: {e}")

    pdf.close()
    if result["food_fraud"]:
        result["food_fraud_status"] = "published"
    elif fraud_skipped:
        result["food_fraud_status"] = "not_published"
    else:
        result["food_fraud_status"] = "not_found"
        result["errors"].append("Food fraud table not found although not announced as skipped")
    return result


# ─── Main ───────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Extract IFS Trend Risk Report data")
    parser.add_argument("--inventory", default=str(Path(__file__).resolve().parent.parent / "data" / "inventory.json"))
    parser.add_argument("--output", default=str(Path(__file__).resolve().parent.parent / "data" / "raw_extractions.json"))
    args = parser.parse_args()
    
    # Load inventory
    with open(args.inventory, "r", encoding="utf-8") as f:
        inventory = json.load(f)
    
    reports = inventory.get("reports", [])
    print(f"Processing {len(reports)} reports from inventory...")
    
    session = requests.Session()
    session.headers.update({"User-Agent": "IFS-Extractor/1.0 (research)"})

    # Previous extractions: reused when a PDF can no longer be downloaded,
    # so a transient outage never removes an already-published month.
    previous = {}
    if os.path.exists(args.output):
        with open(args.output, "r", encoding="utf-8") as f:
            for ex in json.load(f).get("extractions", []):
                previous[ex.get("report_id")] = ex

    extractions = []
    reused = []

    for i, report in enumerate(reports, 1):
        year = report["year"]
        month = report["month"]
        url = report["url"]
        # Local name is built from the inventory (not the URL) so that manual
        # sources with arbitrary filenames still carry the right month.
        fname = f"IFS_Trend_Risk_Report_{month}_{year}.pdf"
        report_id = f"ifs-{year}-{month[:3].lower()}"

        pdf_path = PDF_DIR / fname
        print(f"\n[{i}/{len(reports)}] {year}-{month:07s} ({report.get('variant', 'official')})")

        # Download
        if not download_pdf(url, pdf_path, session):
            if report_id in previous:
                print(f"  Download failed - reusing previous extraction")
                extractions.append(previous[report_id])
                reused.append(report_id)
            else:
                print(f"  FAILED: could not download and no previous extraction")
            continue
        
        print(f"  Downloaded: {pdf_path.name} ({pdf_path.stat().st_size // 1024}KB)")
        
        # Extract
        result = extract_from_pdf(pdf_path)
        result["source_url"] = url
        result["report_id"] = report_id
        result["publication_month"] = month
        result["publication_year"] = year
        
        recalls_count = len(result["recalls"])
        fraud_count = len(result["food_fraud"])
        print(f"  Recalls: {recalls_count} countries | Food Fraud: {fraud_count} cases")
        
        if result["errors"]:
            for e in result["errors"]:
                print(f"  WARNING: {e.encode('ascii', 'replace').decode()}")
        
        extractions.append(result)
        time.sleep(0.5)
    
    # Save
    output = {
        "generated_at": datetime.now().isoformat(),
        "total_reports": len(extractions),
        "reused_previous": reused,
        "extractions": extractions,
    }
    
    os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    
    print(f"\n{'='*60}")
    print(f"Extracted: {len(extractions)} reports")
    print(f"Output: {args.output}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
