"""
Phase FFN-1 — Extract FFN monthly suspicions from EU PDFs
Usage:
    python extract_ffn.py [--inventory ../data/inventory_ffn.json] [--output ../data/raw_ffn_extractions.json]
Downloads PDFs if missing, extracts figures + detailed cases
"""
import json, re, time, argparse, requests
from pathlib import Path
from datetime import datetime
import pdfplumber

PDF_DIR = Path(__file__).resolve().parent.parent / "pdfs" / "ffn"
PDF_DIR.mkdir(parents=True, exist_ok=True)

FFN_MONTHS = {m.lower(): i for i, m in enumerate(["January","February","March","April","May","June","July","August","September","October","November","December"], start=1)}

def download_pdf(url, dest, session):
    if dest.exists() and dest.stat().st_size > 10000:
        return True
    try:
        r = session.get(url, timeout=60)
        if r.status_code == 200 and len(r.content) > 10000:
            dest.write_bytes(r.content)
            return True
        print(f"    DL failed {r.status_code} len {len(r.content)}")
    except Exception as e:
        print(f"    DL exception {e}")
    return False

def extract_figures(text):
    """Extract Figure 1/2/3 counts from combined text of page 3."""
    figures = {"by_product_category": {}, "by_fraud_category": {}, "by_detection_source": {}}
    # Find blocks
    # Figure 1
    m1 = re.search(r"Figure 1: Suspicions per product category(.*?)(Figure 2:|$)", text, re.DOTALL)
    if m1:
        block = m1.group(1)
        # each entry like "Fruits and vegetables 20"  - need to split lines that contain a trailing number
        for line in block.split("\n"):
            line=line.strip()
            if not line or line.startswith("Figure") or line.startswith("0 ") or re.match(r"^\d+ \d+", line):
                continue
            # last token is count
            mm = re.match(r"(.+?)\s+(\d+)$", line)
            if mm:
                cat = mm.group(1).strip()
                cnt = int(mm.group(2))
                # filter out axis labels like "0 10 20..."
                if cat and not re.match(r"^[\d\s]+$", cat) and len(cat) > 2:
                    figures["by_product_category"][cat] = cnt
    m2 = re.search(r"Figure 2: Suspicions per fraud category(.*?)(Figure 3:|$)", text, re.DOTALL)
    if m2:
        block = m2.group(1)
        for line in block.split("\n"):
            line=line.strip()
            if not line or re.match(r"^[\d\s]+$", line):
                continue
            mm = re.match(r"(.+?)\s+(\d+)$", line)
            if mm:
                figures["by_fraud_category"][mm.group(1).strip()] = int(mm.group(2))
    m3 = re.search(r"Figure 3: Source of detection(.*?)(1\. PRODUCT|\Z)", text, re.DOTALL)
    if m3:
        block = m3.group(1)
        for line in block.split("\n"):
            line=line.strip()
            if not line or re.match(r"^[\d\s]+$", line):
                continue
            mm = re.match(r"(.+?)\s+(\d+)$", line)
            if mm:
                figures["by_detection_source"][mm.group(1).strip()] = int(mm.group(2))
    return figures

def clean_cell(c):
    if c is None:
        return ""
    return str(c).replace("\n"," ").strip()

KNOWN_PRODUCT_CATEGORIES = {
    "cocoa and cocoa preparations, coffee and tea","confectionery","fruits and vegetables","dietetic foods, food supplements and fortified foods",
    "other food product / mixed","fats and oils","cereals and bakery products","fish and fish products","meat and meat products (other than poultry)",
    "milk and milk products","herbs and spices","poultry meat and poultry meat products","crustaceans and products thereof",
    "prepared dishes and snacks","alcoholic beverages","non-alcoholic beverages","nuts, nut products and seeds","feed materials",
    "honey and royal jelly","bivalve molluscs and products thereof","food additives and flavourings","food contact materials",
    "natural mineral waters","wine","live animals","compound feeds","gastropods","soups, broths, sauces and condiments",
    "ices and desserts","eggs and egg products","additives not compliant with eu mlsi"
}

def is_classification(txt):
    low=txt.lower()
    keywords=["adulter","additive","unapproved","undeclared","dietary","nutrition","product attribute","residue","unauthorised","record tamper","product tamper","other non","classification","fcm","food, ingredient","illegal","mislabel","counterfeit","tampering"]
    return any(k in low for k in keywords) or low.startswith("product related") or low.startswith("eu protected")

def looks_like_product_category(txt):
    low=txt.lower().strip()
    return low in KNOWN_PRODUCT_CATEGORIES or any(cat in low for cat in KNOWN_PRODUCT_CATEGORIES)

def extract_cases_from_tables(tables):
    cases=[]
    for table in tables:
        if not table or len(table) <2:
            continue
        # Detect header row contains CLASSIFICATION
        header_found=False
        for r in table[:3]:
            row_txt=" ".join(clean_cell(c).lower() for c in r)
            if "classification" in row_txt and ("product" in row_txt or "commodity" in row_txt):
                header_found=True
                break
        if not header_found:
            continue
        # Find header index
        hdr_idx=-1
        for i,r in enumerate(table):
            if "CLASSIFICATION" in " ".join(clean_cell(c) for c in r):
                hdr_idx=i
                break
        if hdr_idx==-1:
            continue
        # Determine column mapping: we expect 6 cols but pdfplumber returns 16-18 due to split.
        # Simplify: table columns appear as: [classification, product_category, commodity, issue, origin, notified_by]
        # But extract_tables returns scattered empty columns. We use positional heuristics:
        # Search for known product categories to align.
        last_class=""
        last_prod=""
        for row in table[hdr_idx+1:]:
            # Skip empty
            cells=[clean_cell(c) for c in row]
            joined=" ".join(c for c in cells if c)
            if not joined or len(joined)<5:
                continue
            # Skip if row is just a continuation of category label fragments
            if joined.lower().startswith("product") or joined.lower().startswith("classification"):
                continue
            # Heuristic: origin and notified_by are last two non-empty cells that look like country names
            # Commodity is often before issue. We parse by taking non-empty cells:
            nonempty=[c for c in cells if c]
            # For typical 6-col table, nonempty should be 6
            # For fragmented tables, nonempty may be 5-6
            if len(nonempty) <3:
                continue
            # Forward-fill aware mapping
            nonempty=[c for c in cells if c]
            if len(nonempty) <2:
                continue
            # Filter header repeats early
            joined_low=" ".join(nonempty).lower()
            if "product category" in joined_low and "commodity" in joined_low:
                continue
            if len(nonempty)>=3 and nonempty[0].lower() in ["classification","product category","commodity","issue"] :
                continue
            # Detect if classification present
            has_class = is_classification(nonempty[0])
            # For len 6 with class present: [class, prod, comm, issue, origin, notified]
            # For len 5 with class missing: [prod, comm, issue, origin, notified] -> need to fill class
            # For len 5 with class present but prod missing: rare
            # General approach: origin/notified are last 2
            origin = nonempty[-2]
            notified = nonempty[-1]
            if not origin or not notified or re.search(r"\d{4}", origin) or re.search(r"\d{4}", notified):
                continue
            middle = nonempty[:-2]
            classification=""
            product_category=""
            commodity=""
            issue=""
            if has_class:
                classification = nonempty[0]
                last_class = classification
                # remaining middle after classification: middle[1:]
                rem = middle[1:]
                if len(rem)==0:
                    continue
                # rem could be [prod, comm, issue] or [prod, comm] etc
                # Detect product
                if rem and looks_like_product_category(rem[0]):
                    product_category = rem[0]
                    last_prod = product_category
                    if len(rem)>=2:
                        commodity = rem[1]
                    if len(rem)>=3:
                        issue = " ".join(rem[2:])
                else:
                    # product missing, use last_prod
                    product_category = last_prod
                    commodity = rem[0] if rem else ""
                    issue = " ".join(rem[1:]) if len(rem)>1 else ""
            else:
                # classification missing -> fill
                classification = last_class
                # middle contains prod..?
                if middle and looks_like_product_category(middle[0]):
                    product_category = middle[0]
                    last_prod = product_category
                    if len(middle)>=2:
                        commodity = middle[1]
                    if len(middle)>=3:
                        issue = " ".join(middle[2:])
                else:
                    # prod also missing
                    product_category = last_prod
                    commodity = middle[0] if middle else ""
                    issue = " ".join(middle[1:]) if len(middle)>1 else ""
            if not classification or not product_category:
                # still need both for valid case; skip if missing
                if not product_category:
                    continue
                if not classification:
                    classification = last_class or "Unknown"
            cases.append({
                "classification": classification.strip(),
                "product_category": product_category.strip(),
                "commodity": commodity.strip(),
                "issue": issue.strip(),
                "origin": origin.strip(),
                "notified_by": notified.strip(),
            })
    return cases

def extract_from_pdf(pdf_path: Path):
    result={"file": pdf_path.name, "figures": {}, "cases": [], "errors": [], "pages": 0, "text_len":0}
    try:
        pdf=pdfplumber.open(str(pdf_path))
    except Exception as e:
        result["errors"].append(f"open failed {e}")
        return result
    result["pages"]=len(pdf.pages)
    full_text=""
    all_cases=[]
    figures=None
    for i, page in enumerate(pdf.pages):
        txt=page.extract_text() or ""
        full_text+=txt+"\n"
        if "Figure 1: Suspicions per product category" in txt:
            figures=extract_figures(txt + "\n" + (pdf.pages[i+1].extract_text() if i+1<len(pdf.pages) else ""))
            result["figures"]=figures
        # extract tables for cases
        try:
            tables=page.extract_tables()
            if tables:
                cases=extract_cases_from_tables(tables)
                if cases:
                    all_cases.extend(cases)
        except Exception as e:
            result["errors"].append(f"table extract p{i+1} {e}")
    result["text_len"]=len(full_text)
    result["cases"]=all_cases
    # if figures not found try full text
    if not result["figures"]:
        try:
            result["figures"]=extract_figures(full_text)
        except Exception as e:
            result["errors"].append(f"figures {e}")
    # also try to capture total from figures sum
    if result["figures"] and result["figures"].get("by_product_category"):
        result["total_suspicions"] = sum(result["figures"]["by_product_category"].values())
    else:
        result["total_suspicions"] = len(all_cases) if all_cases else None
    pdf.close()
    return result

def main():
    parser=argparse.ArgumentParser(description="Extract FFN")
    parser.add_argument("--inventory", default=str(Path(__file__).resolve().parent.parent / "data" / "inventory_ffn.json"))
    parser.add_argument("--output", default=str(Path(__file__).resolve().parent.parent / "data" / "raw_ffn_extractions.json"))
    parser.add_argument("--limit", type=int, default=0)
    args=parser.parse_args()

    with open(args.inventory, "r", encoding="utf-8") as f:
        inv=json.load(f)
    reports=inv.get("reports", [])
    if args.limit:
        reports=reports[:args.limit]
    print(f"Processing {len(reports)} FFN reports...")
    session=requests.Session()
    session.headers.update({"User-Agent":"FFN-Extractor/1.0"})

    extractions=[]
    for i, rep in enumerate(reports,1):
        year, month=rep["year"], rep["month"]
        fname=rep["filename"]
        url=rep["url"]
        dest=PDF_DIR / fname
        print(f"\n[{i}/{len(reports)}] {year}-{month:9s} {fname}")
        if not download_pdf(url, dest, session):
            # try clean_url
            alt=rep.get("clean_url")
            if alt:
                print("  retry clean_url")
                download_pdf(alt, dest, session)
        if not dest.exists():
            print("  SKIP download failed")
            continue
        print(f"  file {dest.stat().st_size//1024}KB")
        res=extract_from_pdf(dest)
        res.update({
            "year": year,
            "month": month,
            "month_num": rep["month_num"],
            "filename": fname,
            "uuid": rep["uuid"],
            "source_url": url,
            "in_cross_window": rep.get("in_cross_window", False),
        })
        print(f"  figures: prod_cat {len(res['figures'].get('by_product_category',{}))} fraud {len(res['figures'].get('by_fraud_category',{}))} cases {len(res['cases'])} total_susp {res.get('total_suspicions')}")
        if res["errors"]:
            for e in res["errors"]:
                print(f"  WARN {e}")
        extractions.append(res)
        time.sleep(0.3)

    output={"generated_at": datetime.now().isoformat(), "total_reports": len(extractions), "extractions": extractions}
    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    print(f"\n{'='*60}")
    print(f"Extracted {len(extractions)} reports -> {args.output}")
    print(f"{'='*60}")

if __name__=="__main__":
    main()
