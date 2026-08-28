"""
Phase 1 — Normalize + Build final dataset for the frontend.

Usage:
    python normalize_and_build.py [--input ../data/raw_extractions.json] [--output ../data/dataset.json]

Reads raw extractions, deduplicates, normalizes countries/fraud reasons,
and generates the final JSON consumed by the React frontend.
"""

import json, sys, os, re, argparse
from pathlib import Path
from datetime import datetime

# ─── Country Normalization ──────────────────────────────────────────────────────
COUNTRY_NORMALIZE = {
    "USA (FDA)": "United States",
    "USA (USDA)": "United States",
    "Viet Nam": "Vietnam",
    "Czech Rep.": "Czechia",
    "Czech Republic": "Czechia",
    "Finnland": "Finland",
    "Türkiye": "Turkey",
    "South Korea": "South Korea",
    "New Zealand": "New Zealand",
    "England": "United Kingdom",
    "Scotland": "United Kingdom",
    "UK": "United Kingdom",
    "Bolivia (Plurinational State of)": "Bolivia",
}

# ─── Fraud Reason Normalization ─────────────────────────────────────────────────
FRAUD_REASON_NORMALIZE = {
    "document forgery": "Document forgery",
    "mislabelling": "Mislabelling",
    "adulteration": "Adulteration",
    "grey market": "Grey market",
    "counterfeit": "Counterfeit",
    "smuggling": "Smuggling",
    "product tampering": "Product tampering",
    " illegal trade": "Illegal trade",
    "illegal trade": "Illegal trade",
}

# ─── Product Normalization ──────────────────────────────────────────────────────
PRODUCT_NORMALIZE = {
    "baby eels": "Eels",
    "mozeralla": "Mozzarella",
    "mozarella": "Mozzarella",
    " various foods": "Various foods",
    "basmati rice": "Rice",
    "chacha": "Wine",
    "liquor": "Alcohol",
    "wine": "Wine",
    " alcohol": "Alcohol",
    "milk": "Dairy products",
    "flour": "Grains and flour",
    "spices": "Spices",
    "meats": "Meat",
    "fish": "Fish and seafood",
    "pork": "Meat",
    "lamb": "Meat",
    "poultry": "Meat",
    "eggs": "Eggs",
    "coffee": "Coffee",
    "mushrooms": "Mushrooms",
    "rice": "Rice",
    "strawberries": "Fruits",
    "figs": "Fruits",
    "pomegranates": "Fruits",
    "sweet potatoes": "Vegetables",
    "tomatoes": "Vegetables",
}

# ─── Month Mapping ──────────────────────────────────────────────────────────────
MONTH_NUM = {
    "January": 1, "February": 2, "March": 3, "April": 4,
    "May": 5, "June": 6, "July": 7, "August": 8,
    "September": 9, "October": 10, "November": 11, "December": 12,
}

MONTH_SHORT = {
    "January": "Jan", "February": "Feb", "March": "Mar", "April": "Apr",
    "May": "May", "June": "Jun", "July": "Jul", "August": "Aug",
    "September": "Sep", "October": "Oct", "November": "Nov", "December": "Dec",
}


def normalize_country(name: str) -> str:
    """Normalize country name."""
    name = name.strip()
    # Handle compound names
    if name.startswith("USA"):
        return "United States"
    if name in COUNTRY_NORMALIZE:
        return COUNTRY_NORMALIZE[name]
    return name


def normalize_fraud_reason(reason: str) -> str:
    """Normalize fraud reason."""
    reason = reason.strip().lower()
    if reason in FRAUD_REASON_NORMALIZE:
        return FRAUD_REASON_NORMALIZE[reason]
    return reason.title()


def normalize_product(product: str) -> str:
    """Normalize product name."""
    product = product.strip()
    product_lower = product.lower()
    if product_lower in PRODUCT_NORMALIZE:
        return PRODUCT_NORMALIZE[product_lower]
    return product


def deduplicate_extractions(extractions: list) -> list:
    """Deduplicate extractions by year-month, keeping official over _EN variant."""
    seen = {}
    for ext in extractions:
        year = ext.get("publication_year")
        month = ext.get("publication_month")
        if not year or not month:
            continue
        
        key = f"{year}-{month}"
        if key not in seen:
            seen[key] = ext
        else:
            # Prefer the one with more recalls data
            existing = seen[key]
            if len(ext.get("recalls", {})) > len(existing.get("recalls", {})):
                seen[key] = ext
            # Also prefer the one with more food fraud
            if len(ext.get("food_fraud", [])) > len(existing.get("food_fraud", [])):
                seen[key] = ext
    
    return list(seen.values())


def detect_period_type(ext: dict, all_extractions: list) -> str:
    """Detect if a report covers a single month or two-month cumulative period.
    
    Heuristic: If the next month's report exists and has similar data, 
    this might be a two-month cumulative report. However, without the 
    introduction text, we default to 'monthly' and let the UI handle selection.
    
    The IFS reports typically state in their introduction if they cover
    a cumulative period (e.g., "This report covers January and February 2024").
    """
    # Default to monthly - the UI will handle cumulative selection
    return "monthly"


def build_dataset(extractions: list) -> dict:
    """Build the final dataset for the frontend."""
    reports = []
    all_recalls = []
    all_fraud = []
    
    for ext in extractions:
        year = ext.get("publication_year")
        month = ext.get("publication_month")
        if not year or not month:
            continue
        
        month_num = MONTH_NUM.get(month, 0)
        month_short = MONTH_SHORT.get(month, month[:3])
        report_id = f"{year}-{month_short.lower()}"
        
        # Build report entry
        report = {
            "id": report_id,
            "year": year,
            "month": month,
            "month_num": month_num,
            "publication_date": f"{year}-{month_num:02d}",
            "source_url": ext.get("source_url", ""),
            "recalls": {},
            "food_fraud_count": len(ext.get("food_fraud", [])),
            "period_type": detect_period_type(ext, extractions),
        }
        
        # Normalize recalls
        for country_raw, value in ext.get("recalls", {}).items():
            country_norm = normalize_country(country_raw)
            report["recalls"][country_raw] = value
            
            all_recalls.append({
                "report_id": report_id,
                "year": year,
                "month": month,
                "month_num": month_num,
                "publication_date": f"{year}-{month_num:02d}",
                "country_raw": country_raw,
                "country_normalized": country_norm,
                "value": value,
                "source_url": ext.get("source_url", ""),
            })
        
        # Normalize food fraud
        for case in ext.get("food_fraud", []):
            product_raw = case.get("product_raw", "")
            reason_raw = case.get("reason_raw", "")
            country_raw = case.get("country_raw", "")
            detected_in = case.get("detected_in", "")
            
            all_fraud.append({
                "report_id": report_id,
                "year": year,
                "month": month,
                "month_num": month_num,
                "publication_date": f"{year}-{month_num:02d}",
                "product_raw": product_raw,
                "product_normalized": normalize_product(product_raw),
                "reason_raw": reason_raw,
                "reason_normalized": normalize_fraud_reason(reason_raw),
                "country_raw": country_raw,
                "country_normalized": normalize_country(country_raw),
                "detected_in": detected_in,
                "source_url": ext.get("source_url", ""),
            })
        
        reports.append(report)
    
    # Sort by date
    reports.sort(key=lambda r: (r["year"], r["month_num"]))
    all_recalls.sort(key=lambda r: (r["year"], r["month_num"]))
    all_fraud.sort(key=lambda r: (r["year"], r["month_num"]))
    
    # Get unique countries
    countries = sorted(set(
        r["country_normalized"] for r in all_recalls
    ))
    
    # Get date range
    if reports:
        date_range = {
            "start": f"{reports[0]['year']}-{reports[0]['month_num']:02d}",
            "end": f"{reports[-1]['year']}-{reports[-1]['month_num']:02d}",
            "start_year": reports[0]["year"],
            "end_year": reports[-1]["year"],
        }
    else:
        date_range = {}
    
    # Summary stats
    total_recalls = sum(r["value"] for r in all_recalls)
    total_fraud = len(all_fraud)
    countries_with_data = len(set(r["country_normalized"] for r in all_recalls if r["value"] > 0))
    
    return {
        "generated_at": datetime.now().isoformat(),
        "date_range": date_range,
        "summary": {
            "total_reports": len(reports),
            "total_recall_values": total_recalls,
            "total_food_fraud_cases": total_fraud,
            "countries_with_data": countries_with_data,
        },
        "reports": reports,
        "countries": countries,
        "recalls": all_recalls,
        "food_fraud": all_fraud,
    }


def main():
    parser = argparse.ArgumentParser(description="Normalize and build IFS dataset")
    parser.add_argument("--input", default=str(Path(__file__).resolve().parent.parent / "data" / "raw_extractions.json"))
    parser.add_argument("--output", default=str(Path(__file__).resolve().parent.parent / "data" / "dataset.json"))
    args = parser.parse_args()
    
    # Load raw extractions
    with open(args.input, "r", encoding="utf-8") as f:
        raw = json.load(f)
    
    extractions = raw.get("extractions", [])
    print(f"Loaded {len(extractions)} raw extractions")
    
    # Deduplicate
    deduped = deduplicate_extractions(extractions)
    print(f"After dedup: {len(deduped)} reports")
    
    # Build dataset
    dataset = build_dataset(deduped)
    
    # Save
    os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(dataset, f, indent=2, ensure_ascii=False)
    
    # Print summary
    s = dataset["summary"]
    print(f"\n{'='*60}")
    print(f"Reports:     {s['total_reports']}")
    print(f"Recalls:     {s['total_recall_values']} total values across {s['countries_with_data']} countries")
    print(f"Food Fraud:  {s['total_food_fraud_cases']} cases")
    print(f"Date Range:  {dataset['date_range']['start']} to {dataset['date_range']['end']}")
    print(f"Countries:   {len(dataset['countries'])}")
    print(f"Output:      {args.output}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
