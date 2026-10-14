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
def extract_food_fraud(page) -> list:
    """Extract food fraud cases from a PDF page."""
    cases = []
    tables = page.extract_tables()
    
    for table in tables:
        if not table or len(table) < 4:  # Need at least header + 1 data row
            continue
        
        # Check if this table has food fraud data (look for known fraud reasons)
        has_fraud = False
        for row in table:
            row_text = " ".join(str(c).lower() for c in row if c)
            if any(reason in row_text for reason in ["document forgery", "mislabelling", "adulteration", "grey market", "counterfeit", "smuggling"]):
                has_fraud = True
                break
        
        if not has_fraud:
            continue
        
        # Find where data starts (skip header rows)
        data_start = 0
        for i, row in enumerate(table):
            row_text = " ".join(str(c).lower() for c in row if c)
            # Skip rows that are part of the header
            if "product" in row_text and "scope" in row_text:
                data_start = i + 1
            elif "ingredient" in row_text and "reason" in row_text:
                data_start = i + 1
            elif "country" in row_text and "detected" in row_text:
                data_start = i + 1
        
        # Parse data rows (table has 8 columns)
        # Columns: [0]=empty, [1]=IFS Scope, [2]=empty, [3]=Product, [4]=Reason, [5]=Country, [6]=Detected in, [7]=Source
        for row in table[data_start:]:
            if not row or len(row) < 7:
                continue
            
            # Extract by position
            product = str(row[3]).strip() if row[3] else ""
            reason = str(row[4]).strip() if row[4] else ""
            country = str(row[5]).strip() if row[5] else ""
            detected_in = str(row[6]).strip() if row[6] else ""
            
            # Skip empty rows
            if not product and not reason:
                continue
            
            # Skip header-like rows
            if "source" in product.lower() or "scope" in product.lower():
                continue
            
            # Skip Link cell
            if product == "Link":
                continue
            
            if country and product:
                cases.append({
                    "product_raw": product,
                    "reason_raw": reason,
                    "country_raw": country,
                    "detected_in": detected_in,
                })
    
    return cases


# ─── Recalls Extraction ─────────────────────────────────────────────────────────
def extract_recalls(page) -> dict:
    """Extract recalls by country from the map page."""
    words = page.extract_words()
    
    # Build list of country positions
    country_positions = []
    for w in words:
        text = w["text"]
        for country in RECALL_COUNTRIES:
            if text == country or text.startswith(country.split()[0]):
                # Check if this is the right country (handle multi-word)
                if country.startswith(text):
                    # Need to check if next words complete the name
                    pass
                country_positions.append({
                    "text": text,
                    "country": country,
                    "x0": w["x0"],
                    "y0": w["top"],
                })
                break
    
    # Handle multi-word countries
    merged = []
    skip = set()
    for i, cp in enumerate(country_positions):
        if i in skip:
            continue
        # Check if this is part of a multi-word country
        if cp["country"] in ["South Korea", "New Zealand", "Viet Nam", "Czech Rep.", "USA (FDA)", "USA (USDA)"]:
            merged.append(cp)
        else:
            merged.append(cp)
    
    # For USA, handle FDA and USDA separately
    usa_entries = [w for w in words if w["text"] == "USA"]
    fda_entries = [w for w in words if w["text"] == "(FDA)"]
    usda_entries = [w for w in words if w["text"] == "(USDA)"]
    
    for i, usa_w in enumerate(usa_entries):
        if i < len(fda_entries):
            merged.append({
                "text": "USA (FDA)",
                "country": "USA (FDA)",
                "x0": usa_w["x0"],
                "y0": usa_w["top"],
            })
        if i < len(usda_entries):
            merged.append({
                "text": "USA (USDA)",
                "country": "USA (USDA)",
                "x0": usa_w["x0"],
                "y0": usa_w["top"],
            })
    
    # Remove duplicate USA entries
    seen_usa = set()
    cleaned = []
    for m in merged:
        if m["country"] in ["USA (FDA)", "USA (USDA)"]:
            key = m["country"]
            if key not in seen_usa:
                seen_usa.add(key)
                cleaned.append(m)
        else:
            cleaned.append(m)
    merged = cleaned
    
    # Find all numbers on the page
    numbers = []
    for w in words:
        text = w["text"]
        if text.replace(".", "").replace("-", "").isdigit() and len(text) <= 4:
            val = int(text.replace(".", "").replace("-", ""))
            if 0 <= val <= 500:  # reasonable recall count range
                numbers.append({
                    "value": val,
                    "x0": w["x0"],
                    "y0": w["top"],
                })
    
    # Match each country with nearest number below it
    recalls = {}
    used_numbers = set()
    
    for cp in merged:
        country = cp["country"]
        cx, cy = cp["x0"], cp["y0"]
        
        # Find nearest number below and to the right (within reasonable range)
        best = None
        best_dist = float("inf")
        
        for j, num in enumerate(numbers):
            if j in used_numbers:
                continue
            nx, ny = num["x0"], num["y0"]
            
            # Number should be below the country (within 25 units)
            dy = ny - cy
            if dy < 5 or dy > 25:
                continue
            
            # Number should be roughly aligned horizontally (within 80 units)
            dx = abs(nx - cx)
            if dx > 80:
                continue
            
            # Distance metric
            dist = (dx ** 2 + dy ** 2) ** 0.5
            if dist < best_dist:
                best_dist = dist
                best = (j, num)
        
        if best:
            idx, num = best
            recalls[country] = num["value"]
            used_numbers.add(idx)
    
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
    # Optional cross-check: if text month differs, log but keep filename
    period_text = detect_period_from_text(full_text)
    if period_text and (period_text["month"] != result["publication_month"] or period_text["year"] != result["publication_year"]):
        result["errors"].append(f"Text month {period_text['month']} {period_text['year']} differs from filename {result['publication_month']} {result['publication_year']} — keeping filename")
    
    # Find the recalls page and food fraud page
    for i, page in enumerate(pdf.pages):
        text = page.extract_text() or ""
        
        # Food fraud page
        if "food fraud" in text.lower() and ("detected" in text.lower() or "table" in text.lower()):
            try:
                cases = extract_food_fraud(page)
                if cases:  # Only overwrite if we found something
                    result["food_fraud"] = cases
            except Exception as e:
                result["errors"].append(f"Food fraud extraction error on page {i+1}: {e}")
        
        # Recalls page
        if "recalls around the world" in text.lower() or "recalls" in text.lower() and "country" in text.lower():
            try:
                recalls = extract_recalls(page)
                if recalls:
                    result["recalls"] = recalls
            except Exception as e:
                result["errors"].append(f"Recalls extraction error on page {i+1}: {e}")
    
    pdf.close()
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
