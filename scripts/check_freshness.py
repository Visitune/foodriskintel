"""
Freshness check — is the latest expected IFS / FFN report in the inventory?

IFS publishes the report of month M between the ~20th and ~27th of M+1;
FFN publishes month M during M+1. A month is "expected" once the 28th of
M+1 has passed.

Usage:
    python scripts/check_freshness.py [--markdown out.md]

Exit code 0 = up to date, 3 = at least one source late (markdown body written
for a GitHub issue).
"""
import json, sys, argparse
from pathlib import Path
from datetime import date

ROOT = Path(__file__).resolve().parent.parent


def expected_month(today: date) -> str:
    """Latest month M whose 28th of M+1 is <= today."""
    y, m = today.year, today.month  # candidate M+1
    if today.day < 28:
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    # (y, m) is now M+1 → M is the month before
    m -= 1
    if m == 0:
        y, m = y - 1, 12
    return f"{y}-{m:02d}"


def latest(inventory_path: Path) -> str | None:
    if not inventory_path.exists():
        return None
    reps = json.loads(inventory_path.read_text(encoding="utf-8")).get("reports", [])
    if not reps:
        return None
    r = max(reps, key=lambda x: (x["year"], x["month_num"]))
    return f"{r['year']}-{r['month_num']:02d}"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--markdown", help="Write a GitHub issue body here when late")
    parser.add_argument("--today", help="Override today's date (YYYY-MM-DD), for tests")
    args = parser.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")

    today = date.fromisoformat(args.today) if args.today else date.today()
    exp = expected_month(today)
    ifs = latest(ROOT / "data" / "inventory.json")
    ffn = latest(ROOT / "data" / "inventory_ffn.json")
    late = {name: got for name, got in (("IFS", ifs), ("FFN", ffn)) if got is None or got < exp}

    print(f"Expected latest month: {exp} | IFS: {ifs} | FFN: {ffn}")
    if not late:
        print("Up to date.")
        return 0

    lines = [
        f"Le dernier rapport attendu est **{exp}** (vérification du {today.isoformat()}).",
        "",
        "| Source | Dernier mois disponible |",
        "|---|---|",
    ] + [f"| {k} | {v or 'aucun'} |" for k, v in late.items()]
    if "IFS" in late:
        lines += [
            "",
            "### Rapport IFS Trend Risk introuvable automatiquement",
            "IFS diffuse le rapport par newsletter aux membres de son réseau ; l'URL publique ne suit pas toujours le même nom de fichier.",
            "",
            "**Pour l'ajouter à la main (2 clics) :**",
            "1. Onglet **Actions** → *Monthly Food Risk Intelligence Update* → **Run workflow**",
            f"2. Renseigner `ifs_month` = `{exp}` et `ifs_url` = lien du PDF (reçu par newsletter ou trouvé sur le site IFS), puis **Run**.",
            "",
            "Le lien est mémorisé dans `data/manual_sources.json` ; les données et le site sont régénérés automatiquement.",
        ]
    if "FFN" in late:
        lines += [
            "",
            "### Rapport FFN non publié",
            "Vérifier https://food.ec.europa.eu/food-safety/acn/ffn-monthly_en — le format des liens a peut-être changé.",
        ]
    lines += ["", "_Issue ouverte automatiquement ; elle sera fermée dès que les données seront à jour._"]
    if args.markdown:
        Path(args.markdown).write_text("\n".join(lines), encoding="utf-8")
    print("\n".join(lines))
    return 3


if __name__ == "__main__":
    raise SystemExit(main())
