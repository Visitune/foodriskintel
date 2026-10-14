"""
Data quality gate — run after the build, before publishing.

Usage:
    python scripts/check_dataset.py

Errors (exit 1) block the commit/deploy; warnings are printed only.
"""
import csv, json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
from taxonomy import MATERIAL_FAMILIES  # noqa: E402

OFFICIAL_CATEGORIES = {c[0].upper() + c[1:] for *_, cats, _ in MATERIAL_FAMILIES for c in cats} | {"Wine"}

errors, warnings = [], []


def check_ifs():
    ifs = json.loads((ROOT / "data" / "dataset.json").read_text(encoding="utf-8"))
    inv = json.loads((ROOT / "data" / "inventory.json").read_text(encoding="utf-8"))
    if len(ifs["reports"]) < len(inv["reports"]):
        errors.append(f"IFS: {len(ifs['reports'])} reports built but {len(inv['reports'])} in inventory (month lost)")

    by_report = {}
    for r in ifs["recalls"]:
        by_report.setdefault(r["report_id"], set()).add(r["country_raw"])
    for rep in ifs["reports"]:
        n = len(by_report.get(rep["id"], ()))
        if n < 30:
            errors.append(f"IFS {rep['id']}: only {n} recall countries extracted (map layout changed?)")
        if "USA (USDA)" not in by_report.get(rep["id"], ()):
            warnings.append(f"IFS {rep['id']}: USA (USDA) missing")
        if rep.get("food_fraud_status") == "not_found":
            errors.append(f"IFS {rep['id']}: fraud table not found and not announced as skipped")

    for c in ifs["food_fraud"]:
        if "\n" in c["product_normalized"] or "\n" in c["country_normalized"]:
            errors.append(f"IFS fraud: line break left in label {c['product_normalized']!r}")
    review = [c for c in ifs["food_fraud"] if c.get("needs_review")]
    if len(review) > 5:
        errors.append(f"IFS fraud: {len(review)} rows need review (column shift?)")
    for c in review:
        warnings.append(f"IFS fraud {c['report_id']} to review: {c['product_normalized']} / {c['reason_raw']!r} / {c['country_raw']!r}")
    no_link = sum(1 for c in ifs["food_fraud"] if not c.get("press_url"))
    if no_link:
        warnings.append(f"IFS fraud: {no_link} cases without press link")

    # Golden file: hand-checked recall values
    golden = ROOT / "data" / "tests" / "golden_july2024.csv"
    if golden.exists():
        rows = [r for r in csv.DictReader(open(golden, encoding="utf-8-sig")) if r["metric"] == "recall"]
        idx = {(r["publication_date"], r["country_raw"]): r["value"] for r in ifs["recalls"]}
        months = {"January": 1, "February": 2, "March": 3, "April": 4, "May": 5, "June": 6, "July": 7,
                  "August": 8, "September": 9, "October": 10, "November": 11, "December": 12}
        ok = 0
        for r in rows:
            m, y = r["report_publication"].split()
            country = r["country"].replace("T�rkiye", "Türkiye")
            names = {"Czech Republic": ["Czech Rep."], "Finland": ["Finland", "Finnland"]}.get(country, [country])
            key = (f"{y}-{months[m]:02d}", country)
            got = next((idx[(key[0], n)] for n in names if (key[0], n) in idx), None)
            if got is not None and str(got) == r["value"].strip():
                ok += 1
            else:
                warnings.append(f"Golden mismatch {key}: expected {r['value']} got {got}")
        rate = ok / len(rows) if rows else 1
        print(f"Golden recalls: {ok}/{len(rows)} ({rate:.1%})")
        if rate < 0.95:
            errors.append(f"Golden recall concordance {rate:.1%} < 95%")


def check_ffn():
    ffn = json.loads((ROOT / "data" / "dataset_ffn.json").read_text(encoding="utf-8"))
    cats = {c["product_category"] for c in ffn["cases"]}
    odd = cats - OFFICIAL_CATEGORIES
    if odd:
        warnings.append(f"FFN: non-official categories {sorted(odd)}")
    for r in ffn["reports"]:
        if r["total_suspicions"] and r["cases_count"] < 0.8 * r["total_suspicions"]:
            warnings.append(f"FFN {r['id']}: {r['cases_count']} cases for {r['total_suspicions']} suspicions")
        if r["cases_count"] == 0:
            errors.append(f"FFN {r['id']}: no case extracted")
    unknown = sum(1 for c in ffn["cases"] if c["classification_group"] == "unknown")
    if unknown > 0.08 * len(ffn["cases"]):
        warnings.append(f"FFN: {unknown} cases with unknown classification")


def check_jrc():
    jrc = json.loads((ROOT / "data" / "dataset_jrc.json").read_text(encoding="utf-8"))
    by_report = {}
    for i in jrc["incidents"]:
        by_report[i["report_id"]] = by_report.get(i["report_id"], 0) + 1
    for r in jrc["reports"]:
        n = by_report.get(r["id"], 0)
        if r["status"] == "no_text":
            warnings.append(f"JRC {r['id']}: image-only PDF, no incident extracted (shown as a gap)")
        elif n < 10:
            errors.append(f"JRC {r['id']}: only {n} incidents extracted (layout changed?)")
    inc = jrc["incidents"]
    for label, n in (("without category", sum(1 for i in inc if not i["categories"])),
                     ("without fraud type", sum(1 for i in inc if not i["reasons"])),
                     ("without country", sum(1 for i in inc if not i["countries"]))):
        if n > 0.15 * len(inc):
            errors.append(f"JRC: {n}/{len(inc)} incidents {label}")
        elif n:
            warnings.append(f"JRC: {n}/{len(inc)} incidents {label}")


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    check_ifs()
    check_ffn()
    check_jrc()
    for w in warnings:
        print(f"WARN  {w}")
    for e in errors:
        print(f"ERROR {e}")
    print(f"\n{len(errors)} error(s), {len(warnings)} warning(s)")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
