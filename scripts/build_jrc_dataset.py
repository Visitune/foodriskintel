"""
Build the JRC Food Fraud Monthly dataset consumed by the app (data/dataset_jrc.json).

Input : data/raw_jrc_extractions.json (extract_jrc.py)
Each incident gets the shared taxonomy (material family, fraud reason keys)
and a month: the article date when printed, else the report's first month.
"""
import json, sys
from collections import Counter
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from taxonomy import material_family  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw_jrc_extractions.json"
OUT = ROOT / "data" / "dataset_jrc.json"


def main():
    raw = json.loads(RAW.read_text(encoding="utf-8"))["extractions"]
    reports, incidents = [], []
    for e in raw:
        report_months = e["months"]
        for n, x in enumerate(e["incidents"]):
            month = x["date"][:7] if x.get("date") else report_months[0]
            # Dates outside the report period are typos in the PDF: keep the report month
            if month not in report_months and not (report_months[0] <= month <= report_months[-1]):
                month = report_months[0]
            cats = x["categories"]
            fam_cat = next((c for c in cats if not c.lower().startswith("other food")), cats[0] if cats else "")
            incidents.append({
                "id": f"{e['id']}-{n + 1}",
                "report_id": e["id"],
                "month": month,
                "date": x.get("date"),
                "description": x["description"],
                "countries": x["countries"],
                "categories": cats,
                "material_family": material_family(fam_cat, x["description"]),
                "reasons": x["fraud_types"],
                "urls": x["urls"],
                "pdf_url": e["pdf_url"],
            })
        reports.append({
            "id": e["id"],
            "months": report_months,
            "status": e["status"],
            "incidents": len(e["incidents"]),
            "pdf_url": e["pdf_url"],
            "pdf_fr_url": e.get("pdf_fr_url"),
            "publication_url": e["publication_url"],
        })
    reports.sort(key=lambda r: r["months"])
    incidents.sort(key=lambda i: (i["month"], i["id"]))
    covered = [m for r in reports if r["status"] == "ok" for m in r["months"]]
    dataset = {
        "generated_at": datetime.now().isoformat(),
        "date_range": {"start": reports[0]["months"][0], "end": reports[-1]["months"][-1]} if reports else {},
        "summary": {
            "reports": len(reports),
            "incidents": len(incidents),
            "months_covered": covered,
            "months_no_text": [m for r in reports if r["status"] == "no_text" for m in r["months"]],
            "countries": len({c for i in incidents for c in i["countries"]}),
        },
        "reports": reports,
        "incidents": incidents,
    }
    OUT.write_text(json.dumps(dataset, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    fam = Counter(i["material_family"] for i in incidents)
    print(f"JRC dataset: {len(incidents)} incidents, {len(reports)} reports, "
          f"{dataset['date_range']} → {OUT.stat().st_size // 1024} KB")
    print(f"  families: {fam.most_common(8)}")


if __name__ == "__main__":
    main()
