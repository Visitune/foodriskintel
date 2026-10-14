"""
Build the lightweight material / origin index consumed by the app home page,
search and material / origin pages (data/index.json → app/public/index.json).

Inputs : data/dataset.json (IFS recalls + IFS/JRC fraud), data/dataset_ffn.json
Output : data/index.json

Nothing here is a risk score: only counts of published cases, per source,
kept separate (IFS/JRC fraud cases are press monitoring; FFN cases are EU
official suspicions). Trends compare the last 6 months with the 6 before.
"""
import json, sys
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from taxonomy import (MATERIAL_FAMILIES, FAMILY_LABELS, CLASSIFICATION_GROUPS,  # noqa: E402
                      FRAUD_REASONS, SUBSTANCES)

ROOT = Path(__file__).resolve().parent.parent
IFS = ROOT / "data" / "dataset.json"
FFN = ROOT / "data" / "dataset_ffn.json"
OUT = ROOT / "data" / "index.json"

TOP = 12


def month_key(rec):
    return f"{rec['year']}-{rec['month_num']:02d}"


def months_between(start, end):
    y, m = map(int, start.split("-"))
    ey, em = map(int, end.split("-"))
    out = []
    while (y, m) <= (ey, em):
        out.append(f"{y}-{m:02d}")
        m += 1
        if m > 12:
            y, m = y + 1, 1
    return out


def trend(by_month, months):
    """Last 6 months vs previous 6 (only months where the source published)."""
    last, prev = months[-6:], months[-12:-6]
    a = sum(by_month.get(m, 0) for m in last)
    b = sum(by_month.get(m, 0) for m in prev)
    if a + b < 5:
        return {"last6": a, "prev6": b, "direction": "insufficient"}
    if b == 0:
        return {"last6": a, "prev6": b, "direction": "new"}
    ratio = a / b
    direction = "up" if ratio >= 1.3 else "down" if ratio <= 0.7 else "stable"
    return {"last6": a, "prev6": b, "ratio": round(ratio, 2), "direction": direction}


def top(counter, n=TOP):
    return dict(counter.most_common(n))


def main():
    ifs = json.loads(IFS.read_text(encoding="utf-8"))
    ffn = json.loads(FFN.read_text(encoding="utf-8"))
    ffn_months = [r["id"] for r in ffn["reports"]]
    ifs_months = [r["publication_date"] for r in ifs["reports"]]
    fraud_published = [r["publication_date"] for r in ifs["reports"] if r.get("food_fraud_status") == "published"]

    fam = defaultdict(lambda: {"ffn": Counter(), "ffn_month": Counter(), "ffn_origin": Counter(),
                               "ffn_group": Counter(), "ffn_sub": Counter(), "ffn_commodity": Counter(),
                               "fraud": Counter(), "fraud_month": Counter(), "fraud_country": Counter(),
                               "fraud_reason": Counter(), "fraud_product": Counter()})
    org = defaultdict(lambda: {"ffn_month": Counter(), "ffn_family": Counter(), "ffn_group": Counter(),
                               "ffn_sub": Counter(), "fraud_family": Counter(), "fraud_reason": Counter(),
                               "fraud_month": Counter(), "notified": Counter()})
    commodity_family = defaultdict(Counter)
    substance_family = defaultdict(Counter)

    for c in ffn["cases"]:
        f, m = c["material_family"], c["report_id"]
        F = fam[f]
        F["ffn"]["cases"] += 1
        F["ffn_month"][m] += 1
        F["ffn_group"][c["classification_group"]] += 1
        com = c["commodity"].strip().lower()
        if com:
            F["ffn_commodity"][com] += 1
            commodity_family[com][f] += 1
        for s in c["substances"]:
            F["ffn_sub"][s] += 1
            substance_family[s][f] += 1
        origins = [o for o in (c.get("origins_list") or [c["origin_normalized"]]) if o != "Unknown"]
        for o in origins:
            F["ffn_origin"][o] += 1
            O = org[o]
            O["ffn_month"][m] += 1
            O["ffn_family"][f] += 1
            O["ffn_group"][c["classification_group"]] += 1
            for s in c["substances"]:
                O["ffn_sub"][s] += 1
            if c["notified_by_normalized"] != "Unknown":
                O["notified"][c["notified_by_normalized"]] += 1

    for c in ifs["food_fraud"]:
        f, m = c["material_family"], c["publication_date"]
        F = fam[f]
        F["fraud"]["cases"] += 1
        F["fraud_month"][m] += 1
        F["fraud_product"][c["product_normalized"]] += 1
        for r in c.get("reasons") or []:
            F["fraud_reason"][r] += 1
        for country in c.get("countries") or []:
            F["fraud_country"][country] += 1
            O = org[country]
            O["fraud_family"][f] += 1
            O["fraud_month"][m] += 1
            for r in c.get("reasons") or []:
                O["fraud_reason"][r] += 1

    families = {}
    for fid, *_ in MATERIAL_FAMILIES:
        F = fam.get(fid)
        if not F:
            continue
        families[fid] = {
            "label": FAMILY_LABELS[fid],
            "ffn_cases": F["ffn"]["cases"],
            "ffn_by_month": dict(sorted(F["ffn_month"].items())),
            "ffn_trend": trend(F["ffn_month"], ffn_months),
            "ffn_top_origins": top(F["ffn_origin"]),
            "ffn_by_group": top(F["ffn_group"], 20),
            "ffn_top_substances": top(F["ffn_sub"]),
            "ffn_top_commodities": top(F["ffn_commodity"], 15),
            "fraud_cases": F["fraud"]["cases"],
            "fraud_by_month": dict(sorted(F["fraud_month"].items())),
            "fraud_trend": trend(F["fraud_month"], fraud_published),
            "fraud_top_countries": top(F["fraud_country"]),
            "fraud_by_reason": top(F["fraud_reason"], 20),
            "fraud_top_products": top(F["fraud_product"], 10),
        }

    origins = {}
    for o, O in org.items():
        n_ffn = sum(O["ffn_family"].values())
        n_fraud = sum(O["fraud_family"].values())
        origins[o] = {
            "ffn_cases": n_ffn,
            "ffn_by_month": dict(sorted(O["ffn_month"].items())),
            "ffn_trend": trend(O["ffn_month"], ffn_months),
            "ffn_by_family": top(O["ffn_family"], 25),
            "ffn_by_group": top(O["ffn_group"], 20),
            "ffn_top_substances": top(O["ffn_sub"], 8),
            "ffn_top_notifiers": top(O["notified"], 6),
            "fraud_cases": n_fraud,
            "fraud_by_family": top(O["fraud_family"], 25),
            "fraud_by_reason": top(O["fraud_reason"], 20),
        }

    # Search vocabulary: families, origins, substances, frequent commodities
    search = []
    for fid, F in families.items():
        search.append({"t": "family", "id": fid, "fr": F["label"]["fr"], "en": F["label"]["en"],
                       "n": F["ffn_cases"] + F["fraud_cases"]})
    for o, O in origins.items():
        search.append({"t": "origin", "id": o, "n": O["ffn_cases"] + O["fraud_cases"]})
    for s, fams in substance_family.items():
        search.append({"t": "substance", "id": s, "n": sum(fams.values()), "f": fams.most_common(1)[0][0]})
    for com, fams in commodity_family.items():
        n = sum(fams.values())
        if n >= 2 and 2 < len(com) <= 60:
            search.append({"t": "commodity", "id": com, "n": n, "f": fams.most_common(1)[0][0]})
    for c in ifs["food_fraud"]:
        p = c["product_normalized"].lower()
        if not any(x["t"] == "commodity" and x["id"] == p for x in search):
            search.append({"t": "commodity", "id": p, "n": 1, "f": c["material_family"]})
    search.sort(key=lambda x: -x["n"])

    # "What's new": latest month of each source vs its 12-month average
    latest_ffn = ffn_months[-1]
    prev12 = ffn_months[-13:-1]
    new_ffn = []
    for fid, F in families.items():
        cur = F["ffn_by_month"].get(latest_ffn, 0)
        avg = sum(F["ffn_by_month"].get(m, 0) for m in prev12) / max(len(prev12), 1)
        if cur >= 5 and cur >= 1.5 * avg:
            new_ffn.append({"family": fid, "count": cur, "avg12": round(avg, 1)})
    new_ffn.sort(key=lambda x: -x["count"] / max(x["avg12"], 1))
    latest_ifs = ifs_months[-1] if ifs_months else None
    latest_fraud_month = fraud_published[-1] if fraud_published else None

    index = {
        "generated_at": datetime.now().isoformat(),
        "sources": {
            "ifs": {"first": ifs_months[0] if ifs_months else None, "latest": latest_ifs,
                    "reports": len(ifs_months), "fraud_latest": latest_fraud_month,
                    "fraud_not_published": [r["publication_date"] for r in ifs["reports"]
                                            if r.get("food_fraud_status") == "not_published"],
                    "fraud_cases": len(ifs["food_fraud"])},
            "ffn": {"first": ffn_months[0], "latest": latest_ffn, "reports": len(ffn_months),
                    "cases": len(ffn["cases"])},
        },
        "labels": {
            "families": FAMILY_LABELS,
            "groups": {k: {"fr": v[0], "en": v[1]} for k, v in CLASSIFICATION_GROUPS.items()},
            "reasons": {k: {"fr": v[0], "en": v[1]} for k, v in FRAUD_REASONS.items()},
            "substances": [name for name, _ in SUBSTANCES],
        },
        "highlights": {
            "ffn_month": latest_ffn,
            "ffn_rising_families": new_ffn[:6],
            "ffn_month_total": sum(1 for c in ffn["cases"] if c["report_id"] == latest_ffn),
            "fraud_month": latest_fraud_month,
            "fraud_month_cases": [
                {k: c[k] for k in ("product_normalized", "material_family", "reasons", "countries", "press_url")}
                for c in ifs["food_fraud"] if c["publication_date"] == latest_fraud_month],
        },
        "families": families,
        "origins": dict(sorted(origins.items(), key=lambda kv: -(kv[1]["ffn_cases"] + kv[1]["fraud_cases"]))),
        "search": search,
    }
    OUT.write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Index: {len(families)} families, {len(origins)} origins, {len(search)} search terms "
          f"→ {OUT.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
