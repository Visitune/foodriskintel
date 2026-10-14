"""
Extract food fraud incidents from JRC Food Fraud Monthly reports.

Usage:
    python extract_jrc.py [--inventory ../data/inventory_jrc.json] [--output ../data/raw_jrc_extractions.json]

The layout changed several times (free text in 2024-2025, tables in 2026), so
parsing works on word coordinates, which are stable across versions:

  left column   description, date, source names (hyperlinks to the articles)
  right column  country (first line of each incident), product categories
                (official EU list, sometimes wrapped over 2-3 lines), fraud type

An incident starts on each right-column line naming a country and ends where
the next one starts. Reports published as images only (June 2024) yield no
text and are flagged "no_text", never read as "0 incidents".
"""
import json, os, re, sys, time, argparse
from collections import Counter
from datetime import datetime
from pathlib import Path
import requests
import pdfplumber

sys.path.insert(0, str(Path(__file__).resolve().parent))
from taxonomy import MATERIAL_FAMILIES, split_reasons  # noqa: E402
from build_ffn_dataset import COUNTRIES, ALIASES  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
PDF_DIR = ROOT / "pdfs" / "jrc"

DATE_RX = re.compile(r"\b(\d{2})/(\d{2})/(\d{4})\b")
HEADER_RX = re.compile(r"JRC Food Fraud Monthly Report|Monthly Report \d+/\d+|^\s*\d+/\d+\s*$|Monthly Summary of Articles|"
                       r"Retrieved mainly from|Disclaimer|Food Fraud incidents|Ispra|Copyrights|stock\.adobe|Knowledge Centre for Food", re.I)


def _key(text: str) -> str:
    """Normalised comparison key: 'Other food products/ mixed' == 'other food product / mixed'."""
    t = text.lower().replace("’", "'")
    t = re.sub(r"[,/()]", " ", t)
    t = re.sub(r"\b(and|products?|thereof|other than)\b", " ", t)
    return re.sub(r"\s+", " ", t).strip()


_CATEGORIES = {}
for _fid, _fr, _en, _cats, _rx in MATERIAL_FAMILIES:
    for _c in _cats:
        _CATEGORIES[_key(_c)] = _c[0].upper() + _c[1:]
_CATEGORIES[_key("Wine")] = "Wine"
_CATEGORIES[_key("Dietetic foods, food supplements, fortified foods")] = "Dietetic foods, food supplements and fortified foods"
_CATEGORIES[_key("Other food products / mixed")] = "Other food product / mixed"
_CATEGORIES[_key("Poultry meat and poultry meat products")] = "Poultry meat and poultry meat products"

# Country names, longest first, for greedy matching inside a line ("France Italy")
_COUNTRY_NAMES = {c.lower(): c for c in COUNTRIES}
_COUNTRY_NAMES.update({k: v for k, v in ALIASES.items() if len(k) > 3})
_COUNTRY_NAMES.update({"türkiye": "Turkey", "turkiye": "Turkey", "côte d'ivoire": "Côte d'Ivoire", "usa": "United States",
                       "uk": "United Kingdom", "eu": "European Union", "european union": "European Union",
                       "czech republic": "Czechia", "hong kong": "Hong Kong", "global": "Global", "worldwide": "Global",
                       "republic of korea": "South Korea", "korea": "South Korea", "the netherlands": "Netherlands"})
_COUNTRY_RX = re.compile(r"(?<![a-zà-ÿ])(" + "|".join(re.escape(n) for n in sorted(_COUNTRY_NAMES, key=len, reverse=True)) + r")(?![a-zà-ÿ])")


def parse_countries(line: str) -> list:
    low = line.lower().replace("’", "'").replace("�", "ô")
    found = []
    for m in _COUNTRY_RX.finditer(low):
        c = _COUNTRY_NAMES[m.group(1)]
        if c not in found:
            found.append(c)
    return found


def is_country_line(line: str) -> bool:
    """A right-column line made only of country names (not a category such as 'Wine')."""
    countries = parse_countries(line)
    if not countries:
        return False
    rest = _COUNTRY_RX.sub("", line.lower().replace("’", "'").replace("�", "ô"))
    return len(re.sub(r"[\s,;/&.-]|and", "", rest)) <= 2


def parse_right(lines: list) -> tuple:
    """Right-column lines after the country → (categories, fraud keys, leftovers).

    Categories are matched line by line (a category may wrap over 2-3 lines);
    every other line is fraud-type text, joined before parsing because fraud
    types wrap too ("Adulteration/ Product" + "tampering")."""
    cats, fraud_text, buf = [], [], ""
    for line in lines:
        if not buf and not _key(line):   # wrapped tail of a category already matched ("products")
            continue
        buf = f"{buf} {line}".strip()
        k = _key(buf)
        if k in _CATEGORIES:
            cats.append(_CATEGORIES[k])
            buf = ""
        elif not any(c.startswith(k) for c in _CATEGORIES):
            fraud_text.append(buf)
            buf = ""
    if buf and _key(buf):
        prefix = [v for c, v in _CATEGORIES.items() if c.startswith(_key(buf))]
        if prefix:
            cats.append(prefix[0])
        else:
            fraud_text.append(buf)
    joined = " ".join(fraud_text)
    frauds = split_reasons(joined)
    leftovers = [joined] if joined and not frauds else []
    return list(dict.fromkeys(cats)), frauds, leftovers


def _lines(words: list) -> list:
    """Group words into text lines (top within 3 pt), left to right."""
    rows = []
    for w in sorted(words, key=lambda w: (round(w["top"]), w["x0"])):
        if rows and abs(rows[-1]["top"] - w["top"]) < 3:
            rows[-1]["words"].append(w)
        else:
            rows.append({"top": w["top"], "words": [w]})
    for r in rows:
        r["words"].sort(key=lambda w: w["x0"])
        r["text"] = " ".join(w["text"] for w in r["words"])
    return rows


def extract_page(page) -> list:
    words = [w for w in page.extract_words(x_tolerance=1.5, extra_attrs=["upright"]) if w.get("upright", True)]
    if not words:
        return []
    width = page.width
    # Right column start = most frequent word x0 in the right part of the page
    right_x = Counter(round(w["x0"]) for w in words if w["x0"] > 0.6 * width)
    if not right_x:
        return []
    split = right_x.most_common(1)[0][0] - 8
    left = [l for l in _lines([w for w in words if w["x1"] <= split + 2]) if not HEADER_RX.search(l["text"])]
    right = [l for l in _lines([w for w in words if w["x0"] >= split]) if not HEADER_RX.search(l["text"])]
    links = [h for h in (page.hyperlinks or []) if h.get("uri", "").startswith("http") and h["x0"] < split]

    anchors = [i for i, l in enumerate(right) if is_country_line(l["text"])]
    incidents = []
    for n, ai in enumerate(anchors):
        top = right[ai]["top"] - 4
        bottom = right[anchors[n + 1]]["top"] - 4 if n + 1 < len(anchors) else page.height
        r_lines = [l["text"] for l in right[ai + 1:(anchors[n + 1] if n + 1 < len(anchors) else len(right))]]
        cats, frauds, leftovers = parse_right(r_lines)
        span_links = [h for h in links if top <= (h["top"] + h["bottom"]) / 2 < bottom]

        def in_link(w):
            return any(h["x0"] - 1 <= w["x0"] and w["x1"] <= h["x1"] + 1 and h["top"] - 2 <= w["top"] <= h["bottom"] + 2 for h in span_links)

        desc_parts, date = [], None
        for l in left:
            if not (top <= l["top"] < bottom):
                continue
            d = DATE_RX.search(l["text"])
            if d and not date:
                date = f"{d.group(3)}-{d.group(2)}-{d.group(1)}"
            kept = [w["text"] for w in l["words"] if not in_link(w) and not DATE_RX.fullmatch(w["text"])]
            text = " ".join(kept)
            text = re.sub(r"^(Date|Source)\s*:.*$", "", text).strip()
            if text:
                desc_parts.append(text)
        description = re.sub(r"\s+", " ", re.sub(r"(\w)- (\w)", r"\1\2", " ".join(desc_parts))).strip()
        incidents.append({
            "countries": parse_countries(right[ai]["text"]),
            "categories": cats,
            "fraud_types": frauds,
            "unparsed": leftovers,
            "description": description,
            "date": date,
            "urls": list(dict.fromkeys(h["uri"] for h in span_links)),
        })
    return incidents


def extract_pdf(path: Path) -> dict:
    out = {"incidents": [], "errors": [], "status": "ok"}
    try:
        pdf = pdfplumber.open(str(path))
    except Exception as e:
        return {"incidents": [], "errors": [f"cannot open: {e}"], "status": "error"}
    chars = sum(len(p.chars) for p in pdf.pages[:3])
    if chars < 200:
        out["status"] = "no_text"   # scanned / image-only report
    for i, page in enumerate(pdf.pages):
        try:
            out["incidents"] += extract_page(page)
        except Exception as e:
            out["errors"].append(f"page {i + 1}: {e}")
    pdf.close()
    # Some reports link every date to the same article (layout bug in the PDF):
    # a URL repeated across 3+ incidents is not a source of any of them.
    seen = Counter(u for inc in out["incidents"] for u in inc["urls"])
    for inc in out["incidents"]:
        inc["urls"] = [u for u in inc["urls"] if seen[u] < 3]
    return out


def main():
    parser = argparse.ArgumentParser(description="Extract JRC Food Fraud Monthly incidents")
    parser.add_argument("--inventory", default=str(ROOT / "data" / "inventory_jrc.json"))
    parser.add_argument("--output", default=str(ROOT / "data" / "raw_jrc_extractions.json"))
    args = parser.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")

    inventory = json.loads(Path(args.inventory).read_text(encoding="utf-8"))["reports"]
    previous = {}
    if os.path.exists(args.output):
        previous = {e["id"]: e for e in json.loads(Path(args.output).read_text(encoding="utf-8"))["extractions"]}

    PDF_DIR.mkdir(parents=True, exist_ok=True)
    session = requests.Session()
    session.headers.update({"User-Agent": "Mozilla/5.0 (Food-Risk-Intelligence extractor; research)"})
    extractions = []
    for rep in inventory:
        if not rep.get("pdf_url"):
            continue
        path = PDF_DIR / f"{rep['id']}.pdf"
        if not path.exists() or path.stat().st_size < 10000:
            try:
                r = session.get(rep["pdf_url"], timeout=90)
                r.raise_for_status()
                path.write_bytes(r.content)
                time.sleep(0.3)
            except requests.RequestException as e:
                if rep["id"] in previous:
                    print(f"  {rep['id']}: download failed - reusing previous extraction")
                    extractions.append(previous[rep["id"]])
                else:
                    print(f"  {rep['id']}: FAILED {e}")
                continue
        res = extract_pdf(path)
        no_country = sum(1 for x in res["incidents"] if not x["categories"])
        print(f"  {rep['id']:24s} {res['status']:8s} {len(res['incidents']):4d} incidents"
              f"  (without category: {no_country})")
        extractions.append({"id": rep["id"], "months": rep["months"], "pdf_url": rep["pdf_url"],
                            "pdf_fr_url": rep.get("pdf_fr_url"), "publication_url": rep["publication_url"], **res})

    Path(args.output).write_text(json.dumps({"generated_at": datetime.now().isoformat(),
                                             "extractions": extractions}, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"JRC: {sum(len(e['incidents']) for e in extractions)} incidents from {len(extractions)} reports")


if __name__ == "__main__":
    main()
