"""
Build normalized FFN dataset + cross window with IFS
"""
import json
from pathlib import Path
from datetime import datetime
import re

RAW_FFN = Path(__file__).resolve().parent.parent / "data" / "raw_ffn_extractions.json"
RAW_IFS = Path(__file__).resolve().parent.parent / "data" / "raw_extractions.json"
OUT_FFN = Path(__file__).resolve().parent.parent / "data" / "dataset_ffn.json"
OUT_CROSS = Path(__file__).resolve().parent.parent / "data" / "dataset_cross.json"

# Normalize country mapping shared
COUNTRIES = {
    "Albania","Algeria","Andorra","Angola","Antigua and Barbuda","Argentina","Armenia","Australia","Austria","Azerbaijan",
    "Bahamas","Bahrain","Bangladesh","Barbados","Belarus","Belgium","Belize","Benin","Bhutan","Bolivia",
    "Bosnia and Herzegovina","Botswana","Brazil","Brunei","Bulgaria","Burkina Faso","Burundi","Cabo Verde","Cambodia",
    "Cameroon","Canada","Central African Republic","Chad","Chile","China","Colombia","Comoros","Congo","Congo DR",
    "Costa Rica","Croatia","Cuba","Cyprus","Czechia","Denmark","Djibouti","Dominica","Dominican Republic","Ecuador",
    "Egypt","El Salvador","Equatorial Guinea","Eritrea","Estonia","Eswatini","Ethiopia","Fiji","Finland","France",
    "Gabon","Gambia","Georgia","Germany","Ghana","Greece","Grenada","Guatemala","Guinea","Guinea-Bissau","Guyana",
    "Honduras","Hungary","Iceland","India","Indonesia","Iran","Iraq","Ireland","Israel","Italy","Jamaica","Japan",
    "Jordan","Kazakhstan","Kenya","Kiribati","Kosovo","Kuwait","Kyrgyzstan","Laos","Latvia","Lebanon","Lesotho",
    "Liberia","Libya","Liechtenstein","Lithuania","Luxembourg","Madagascar","Malawi","Malaysia","Maldives","Mali",
    "Malta","Marshall Islands","Mauritania","Mauritius","Mexico","Micronesia","Moldova","Monaco","Mongolia",
    "Montenegro","Morocco","Mozambique","Myanmar","Namibia","Nauru","Nepal","Netherlands","New Zealand","Nicaragua",
    "Niger","Nigeria","North Korea","North Macedonia","Norway","Oman","Pakistan","Palau","Palestine","Panama",
    "Papua New Guinea","Paraguay","Peru","Philippines","Poland","Portugal","Qatar","Romania","Russia",
    "Rwanda","Saint Kitts and Nevis","Saint Lucia","Saint Vincent and the Grenadines","Samoa","San Marino",
    "Sao Tome and Principe","Saudi Arabia","Senegal","Serbia","Seychelles","Sierra Leone","Singapore","Slovakia",
    "Slovenia","Solomon Islands","Somalia","South Africa","South Korea","South Sudan","Spain","Sri Lanka","Sudan",
    "Suriname","Sweden","Switzerland","Syria","Taiwan","Tajikistan","Tanzania","Thailand","Timor-Leste","Togo",
    "Tonga","Trinidad and Tobago","Tunisia","Turkey","Turkmenistan","Tuvalu","Uganda","Ukraine",
    "United Arab Emirates","United Kingdom","United States","Uruguay","Uzbekistan","Vanuatu","Venezuela","Vietnam",
    "Western Sahara","Yemen","Zambia","Zimbabwe","Côte d'Ivoire","Falkland Islands",
}
_BY_LOWER = {c.lower(): c for c in COUNTRIES}

ALIASES = {
    "usa": "United States", "us": "United States", "u.s.": "United States", "united states of america": "United States",
    "uk": "United Kingdom", "u.k.": "United Kingdom", "england": "United Kingdom", "scotland": "United Kingdom",
    "wales": "United Kingdom", "northern ireland": "United Kingdom", "great britain": "United Kingdom",
    "viet nam": "Vietnam", "czech republic": "Czechia", "czech": "Czechia",
    "turkiye": "Turkey", "türkiye": "Turkey", "republic of turkey": "Turkey",
    "republic of korea": "South Korea", "r. of korea": "South Korea", "democratic people's republic of korea": "North Korea",
    "r. of north macedonia": "North Macedonia", "republic of north macedonia": "North Macedonia",
    "macedonia": "North Macedonia", "fyrom": "North Macedonia", "republic of macedonia": "North Macedonia",
    "srilanka": "Sri Lanka", "philipines": "Philippines",
    "republic of côte d'ivoire": "Côte d'Ivoire", "côte d'ivoire": "Côte d'Ivoire",
    "ivoire coast": "Côte d'Ivoire", "ivory coast": "Côte d'Ivoire",
    "dominican": "Dominican Republic", "dominican rep.": "Dominican Republic",
    "trinidad and": "Trinidad and Tobago", "bosnia and": "Bosnia and Herzegovina", "bosnia": "Bosnia and Herzegovina",
    "herzegovina": "Bosnia and Herzegovina",
    "territory of western sahara": "Western Sahara", "uae": "United Arab Emirates",
    "swetten": "Sweden", "swedish": "Sweden",
    "democratic republic of congo": "Congo DR", "dr congo": "Congo DR", "dem. rep. congo": "Congo DR",
    "republic of congo": "Congo", "south african republic": "South Africa", "republic of kenya": "Kenya",
    "republic of moldova": "Moldova", "islamic republic of iran": "Iran", "iran (islamic republic of)": "Iran",
    "venezuela (bolivarian republic of)": "Venezuela", "bolivia (plurinational state of)": "Bolivia",
    "falkland islands": "Falkland Islands", "falkland is.": "Falkland Islands", "timor leste": "Timor-Leste",
    "saint kitts": "Saint Kitts and Nevis", "saint kitts and": "Saint Kitts and Nevis",
    "saint vincent": "Saint Vincent and the Grenadines", "saint vincent and": "Saint Vincent and the Grenadines",
}

JUNK = {"", "unknown", "origin", "mixed", "various", "multiple", "unknown origin"}
_SPLIT = re.compile(r"\s*(?:,|;|\s+and\s+|\s+via\s+|/(?=\s)|\s+e-?\s*marketed\s+(?:from|in)\s+|\s+processed\s+in\s+|\s+marketed\s+(?:from|in)\s+|\s+via\s+the\s+)\s*", re.I)

def _recognize(part):
    p = part.strip()
    p = re.sub(r"^\(\s*\w{0,3}\s*", " ", p)                       # "(NL e-", "(e Poland"
    p = re.sub(r"^I\s+(?=[A-ZÀ-Þ])", "", p)                       # column artifact "I Austria"
    p = re.sub(r"\be-?\s*marketed\b", " ", p, flags=re.I)         # "e-marketed ..."
    p = re.sub(r"\s*\b(?:via|processed\s+in|marketed\s+from|marketed\s+in|raw)\b", " ", p, flags=re.I)
    p = re.sub(r"\s*\b(?:and|from|the)$", "", p, flags=re.I)
    p = re.sub(r"\s+", " ", p).strip(" ,.;:*()'")
    if not p or p.lower() in JUNK:
        return None
    key = p.lower()
    if key in ALIASES:
        return ALIASES[key]
    return _BY_LOWER.get(key)

def clean_country(raw):
    """Return (primary_country, list_of_countries) from messy FFN origin text."""
    s = (raw or "").strip()
    has_unknown = bool(re.search(r"\bunknown\b", s, re.I))
    found = []
    for part in _SPLIT.split(s):
        r = _recognize(part)
        if r:
            if r not in found:
                found.append(r)
            continue
        if part and re.search(r"\band\b", part, re.I):
            for sub in re.split(r"\s+and\s+", part, flags=re.I):
                r2 = _recognize(sub)
                if r2 and r2 not in found:
                    found.append(r2)
    if has_unknown:
        return "Unknown", found if found else ["Unknown"]
    if found:
        return found[0], found
    return "Unknown", ["Unknown"]

def normalize_country(c):
    return clean_country(c)[0]

def build_ffn():
    raw = json.loads(RAW_FFN.read_text(encoding="utf-8"))
    extractions = raw["extractions"]
    reports=[]
    all_cases=[]
    for e in extractions:
        year=e["year"]
        month_num=e["month_num"]
        report_id=f"{year}-{month_num:02d}"
        figures=e.get("figures",{})
        total=e.get("total_suspicions") or len(e["cases"])
        reports.append({
            "id": report_id,
            "year": year,
            "month": e["month"],
            "month_num": month_num,
            "publication_date": f"{year}-{month_num:02d}",
            "filename": e["filename"],
            "source_url": e["source_url"],
            "uuid": e["uuid"],
            "in_cross_window": e.get("in_cross_window", False),
            "total_suspicions": total,
            "by_product_category": figures.get("by_product_category",{}),
            "by_fraud_category": figures.get("by_fraud_category",{}),
            "by_detection_source": figures.get("by_detection_source",{}),
            "cases_count": len(e["cases"]),
        })
        for c in e["cases"]:
            prim, lst = clean_country(c["origin"])
            all_cases.append({
                "report_id": report_id,
                "year": year,
                "month": e["month"],
                "month_num": month_num,
                "publication_date": f"{year}-{month_num:02d}",
                "classification": c["classification"],
                "product_category": c["product_category"],
                "commodity": c["commodity"],
                "issue": c["issue"],
                "origin_raw": c["origin"],
                "origin_normalized": prim,
                "origins_list": lst,
                "notified_by_raw": c["notified_by"],
                "notified_by_normalized": clean_country(c["notified_by"])[0],
                "source_url": e["source_url"],
            })
    reports.sort(key=lambda r:(r["year"], r["month_num"]))
    all_cases.sort(key=lambda r:(r["year"], r["month_num"]))
    # summary
    total_sus = sum(r["total_suspicions"] for r in reports if r["total_suspicions"])
    countries_origin = sorted(set(c["origin_normalized"] for c in all_cases))
    countries_notified = sorted(set(c["notified_by_normalized"] for c in all_cases))
    by_product_all={}
    for r in reports:
        for k,v in r["by_product_category"].items():
            by_product_all[k]=by_product_all.get(k,0)+v
    return {
        "generated_at": datetime.now().isoformat(),
        "date_range": {"start": f"{reports[0]['year']}-{reports[0]['month_num']:02d}", "end": f"{reports[-1]['year']}-{reports[-1]['month_num']:02d}"},
        "summary": {
            "total_reports": len(reports),
            "total_suspicions": total_sus,
            "total_cases": len(all_cases),
            "countries_origin": len(countries_origin),
            "countries_notified": len(countries_notified),
            "coverage_note": "FFN covers cross-border ACN suspicions only"
        },
        "reports": reports,
        "cases": all_cases,
        "by_product_all": by_product_all,
        "countries_origin": countries_origin,
        "countries_notified": countries_notified,
    }

def build_cross():
    ffn = json.loads(OUT_FFN.read_text(encoding="utf-8")) if OUT_FFN.exists() else build_ffn()
    # IFS dataset
    ifs_raw = json.loads((Path(__file__).resolve().parent.parent / "data" / "dataset.json").read_text(encoding="utf-8"))
    ifs_by_month = {r["id"]: r for r in ifs_raw["reports"]}
    # Map IFS id like "2024-feb" to "2024-02"
    # Need to reconstruct
    # ifs reports have id "2024-feb" etc, but we can key by year-month_num
    ifs_map = {}
    for r in ifs_raw["reports"]:
        key = f"{r['year']}-{r['month_num']:02d}"
        ifs_map[key]=r
    ffn_map = {r["id"]: r for r in ffn["reports"]}
    # cross window: computed from the months flagged in_cross_window
    # generate all months in that window that exist in both
    cross=[]
    for fid, fr in sorted(ffn_map.items()):
        if not fr["in_cross_window"]:
            continue
        im = ifs_map.get(fid)
        cross.append({
            "month": fid,
            "year": fr["year"],
            "month_num": fr["month_num"],
            "ffn_total_suspicions": fr["total_suspicions"],
            "ffn_cases": fr["cases_count"],
            "ffn_top_product": max(fr["by_product_category"], key=fr["by_product_category"].get) if fr["by_product_category"] else None,
            "ifs_present": im is not None,
            "ifs_recalls_total": sum(im["recalls"].values()) if im else None,
            "ifs_food_fraud_count": im["food_fraud_count"] if im else None,
            "ifs_url": im["source_url"] if im else None,
            "ffn_url": fr["source_url"],
            "in_cross_window": True,
        })
    # stats
    ffn_totals = [c["ffn_total_suspicions"] for c in cross]
    ifs_totals = [c["ifs_recalls_total"] for c in cross if c["ifs_recalls_total"] is not None]
    return {
        "generated_at": datetime.now().isoformat(),
        "window": {"start": cross[0]["month"] if cross else None, "end": cross[-1]["month"] if cross else None, "months": len(cross)},
        "summary": {
            "months_in_window": len(cross),
            "months_with_both_sources": len([c for c in cross if c["ifs_present"]]),
            "months_ffn_only": len([c for c in cross if not c["ifs_present"]]),
            "ffn_total_in_window": sum(ffn_totals),
            "ifs_recalls_total_in_window": sum(ifs_totals) if ifs_totals else 0,
        },
        "cross": cross,
        "ffn_reports": ffn["reports"],
        "ifs_reports": ifs_raw["reports"],
    }

if __name__=="__main__":
    ffn = build_ffn()
    OUT_FFN.parent.mkdir(parents=True, exist_ok=True)
    OUT_FFN.write_text(json.dumps(ffn, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"FFN dataset: {ffn['summary']['total_reports']} reports, {ffn['summary']['total_suspicions']} suspicions, {ffn['summary']['total_cases']} detailed cases")
    print(f"  products: {len(ffn['by_product_all'])} by_product_all top 5: {sorted(ffn['by_product_all'].items(), key=lambda x:x[1], reverse=True)[:5]}")
    cross = build_cross()
    OUT_CROSS.write_text(json.dumps(cross, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Cross dataset: {cross['summary']['months_in_window']} months window, {cross['summary']['months_with_both_sources']} with both, ffn_total {cross['summary']['ffn_total_in_window']}")
    for c in cross["cross"][-4:]:
        print(f"  {c['month']} FFN {c['ffn_total_suspicions']} IFS {'-' if not c['ifs_present'] else c['ifs_recalls_total']}")

