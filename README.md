# Food Risk Intelligence

Outil de visualisation des données publiées dans les **IFS Trend Risk Reports** croisées avec le **FFN Mensuel** (DG SANTE, réseau ACN : RASFF + AAC + FFN).

FR · Interface et documentation en français ; données en anglais.

## ⚠️ Avertissement — Attribution & droits

> **Data source: IFS Trend Risk Reports.** All credit for the original data collection, selection, analysis and reporting belongs to **IFS International**.
>
> **Source des données : IFS Trend Risk Reports.** Le travail original de collecte, sélection, analyse et publication reste attribué à l'IFS.
>
> Fraud cases shown here derive from **JRC Food Fraud Monthly** reports (DG JRC, Commission européenne). FFN data from **DG SANTE** (ACN).
>
> **Aucun PDF source n'est inclus dans ce dépôt.** Les fichiers `pdfs/` sont téléchargés localement par le pipeline et exclus du versionnement (copyright IFS).
>
> Ce dépôt est un **outil de visualisation indépendant**, sans lien avec IFS, la JRC ou la DG SANTE. Il n'est pas un substitut aux rapports officiels — chaque donnée pointe vers son PDF source. Usage éducatif/professionnel d'analyse ; ne pas redistribuer le contenu des rapports eux-mêmes.

## ✨ Ce que fait l'app

- **Carte mondiale** des rappels IFS (mois unique, période, tous rapports — avec garde-fou « cumul non redistribué »)
- **Fraud Explorer** — cas de fraude IFS/JRC (document forgery, mislabelling, adulteration…)
- **FFN Explorer** — suspicions officielles UE cross-border : 70 classifications sources regroupées en 12 familles, carte par origine/notifiant, filtres combinés, deep-links PDF
- **Croisement IFS × FFN** — timeline comparée à échelles séparées, tendances ↑↓, croisement réel par pays commun, drill-down par mois, filtres pays/période avec chips
- **Fiches pays** — historique rappels, fraude, FFN, avec badges par source (IFS · JRC presse / FFN·ACN UE)
- Bilingue FR/EN · thème sombre/clair · 100 % SVG natif (React + d3-geo, zéro chart lib) · statique (fonctionne sur GitHub Pages ou en `file://`)

## 🚀 Démarrer

```bash
# 1. Les datasets JSON sont livrés dans app/public/ — l'app tourne telle quelle
cd app
npm install
npm run dev            # http://localhost:5173

# 2. Pour régénérer les données depuis les PDF sources (Python 3.10+)
pip install -r scripts/requirements.txt
python scripts/discover_ifs_pdfs.py     # → data/inventory.json
python scripts/extract.py               # → data/raw_extractions.json (télécharge pdfs/)
python scripts/normalize_and_build.py   # → data/dataset.json
python scripts/discover_ffn_pdfs.py     # → data/inventory_ffn.json
python scripts/extract_ffn.py           # → data/raw_ffn_extractions.json
python scripts/build_ffn_dataset.py     # → data/dataset_ffn.json + dataset_cross.json
# puis recopier les datasets dans app/public/ :
Copy-Item data\dataset.json, data\dataset_ffn.json, data\dataset_cross.json app\public\
```

`python scripts/update_monthly.py` rejoue toute la chaîne mensuellement (utilisé par la GitHub Action planifiée le 15 de chaque mois).

## 📁 Structure

```
app/                  Frontend React + Vite + TypeScript
  public/*.json       Datasets livrés (copy de data/)
  src/                Pages + i18n + CSS tokens (dark/light)
scripts/              Pipeline Python (pdfplumber) — requirements.txt fourni
data/                 Inventaires PDF + extractions brutes + datasets finaux
.github/workflows/    MAJ mensuelle (cron 15 du mois) + Pages optionnel
```

## 🗺️ Limites connues

- Fenêtre croisée IFS↔FFN : **26 mois (2024-06 → 2026-07)**, 25 avec les deux sources — **2024-08 = IFS non publié** (lacune de collecte, jamais un zéro)
- Les pays FFN-only (Vietnam, Chine, Turquie…) n'apparaissent pas sur la carte IFS (rappels) mais bien dans FFN — les fiches pays affichent les deux natures séparément
- Les rapports IFS avant juin 2024 sont derrière login IFS Database : l'extraction complète n'est possible que depuis juin 2024
- IFS = monde, FFN = UE cross-border uniquement (biais géographique opposé)

## 🤝 Contribuer / contact

Issues et PR bienvenues pour le code de visualisation. Pour toute demande concernant **les données**, adressez-vous directement aux ayants droit : [IFS Certification](https://www.ifs-certification.com/) et [DG SANTE / JRC](https://knowledge4policy.ec.europa.eu/jrc-food-fraud-monthly-report_en).
