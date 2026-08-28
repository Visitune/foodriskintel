# Inventaire FFN — EU Agri-Food Fraud Network Monthly Reports

**Date :** 2026-08-28  
**Source :** https://food.ec.europa.eu/food-safety/acn/ffn-monthly_en  
**Script :** `scripts/discover_ffn_pdfs.py`

## Résumé

| Métrique | Valeur |
|---|---|
| Rapports listés sur la page | 31 |
| Accessibles (HTTP 200 + PDF) | 31 |
| Fenêtre commune IFS (2024-06 → 2026-07) | 26 |
| Hors fenêtre (2024-01 → 2024-05) | 5 |
| Période couverte | 2024-01 → 2026-07 |

Tous les PDFs utilisent le pattern `ff_ffn_monthly-report_YYYYMM.pdf` avec UUID volatile `document/download/<uuid>_en`. Le discovery scrape la page et résout l'UUID courant — ne pas hardcoder les UUIDs.

## Rapports en fenêtre croisée (26)

| Mois | UUID | Taille | Cases | Susp. totales |
|---|---|---|---|---|
| 2024-06 | 1572521d | ~768KB | 254 | 265 |
| 2024-07 | a0fa0333 | 1025KB | 298 | 325 |
| 2024-08 | 6b5b3c4a | 611KB | 217 | 222 |
| 2024-09 | f3cdd149 | 810KB | 205 | 213 |
| 2024-10 | e29455d7 | 873KB | 281 | 291 |
| 2024-11 | c015876a | 637KB | 226 | 232 |
| 2024-12 | 81d0f36d | 698KB | 245 | 248 |
| 2025-01 | 3e4c8ebf | 450KB | 215 | 220 |
| 2025-02 | d5cfa85c | 715KB | 205 | 214 |
| 2025-03 | c5153710 | 662KB | 227 | 237 |
| 2025-04 | ca3f5482 | 920KB | 227 | 235 |
| 2025-05 | 8433119d | 477KB | 125 | 129 |
| 2025-06 | 966e1030 | 559KB | 137 | 164 |
| 2025-07 | 75126209 | 2307KB | 130 | 136 |
| 2025-08 | bf32a6b1 | 1295KB | 160 | 166 |
| 2025-09 | c5a1d061 | 4353KB | 158 | 164 |
| 2025-10 | 69a5d774 | 2451KB | 217 | 223 |
| 2025-11 | c243e24b | 616KB | 192 | 194 |
| 2025-12 | ddf861ad | 683KB | 190 | 196 |
| 2026-01 | 8df50c8a | 517KB | 185 | 189 |
| 2026-02 | fc02d6f4 | 1959KB | 152 | 159 |
| 2026-03 | 39c8523f | 1074KB | 194 | 203 |
| 2026-04 | 3f01d034 | 599KB | 177 | 188 |
| 2026-05 | b2392656 | 654KB | 147 | 150 |
| 2026-06 | 38a6addd | 708KB | 212 | 215 |
| 2026-07 | 68fa7bc0 | 772KB | 205 | 207 |

> Exemple cible : `ff_ffn_monthly-report_202607.pdf` (UUID 68fa7bc0…) — 11 pages, 207 suspicions, 205 cas détaillés extraits (99%).

## Extraction — qualité

* **Figures** (p3) : `by_product_category` (23–31 catégories/mois), `by_fraud_category` (3 types stables : Record tampering / Product tampering / Other non-compliances), `by_detection_source` (Border / Market / Consumer complaint…).
* **Cas détaillés** (p4–10) : `CLASSIFICATION | PRODUCT CATEGORY | COMMODITY | ISSUE | ORIGIN | NOTIFIED BY` — extraction via `pdfplumber` + forward-fill sur `classification/product_category` rowspan. **Couverture 96–99%** (ex 202607 205/207).
* **Top produits cumulés (31 mois)** : Fruits & légumes 1546, Dietetic/supplements 1114, Cereals 420 — cohérent avec ACN cross-border.
* **Limites** : taux de couverture dépendante du layout InDesign (fusion de cellules). `needs_review` si `cases_count / total_suspicions <0.9`.

## Fenêtre commune IFS

* IFS : 27 PDFs accessibles (inventory.json) mais dataset.json n'en expose que 22 après déduplication (`detect_period_from_text` biaisé — `December_2024.pdf` taggé October 2025). La fenêtre théorique 2024-06→2026-07 = 26 mois, mais 6 mois sont marqués `ifs_present=false` dans `dataset_cross.json` à cause de ce décalage. **Action** : corriger `publication_month` par filename quand `extract_text` incertain.
* Stockage : `pdfs/ffn/ff_ffn_monthly-report_YYYYMM.pdf` séparé de `pdfs/IFS_*.pdf`.

## Mise à jour mensuelle

Relancer `python scripts/discover_ffn_pdfs.py --output data/inventory_ffn.json` début de mois (FFN publié ~J+7/15). Le script détecte automatiquement un nouveau `YYYYMM`. Puis `python scripts/extract_ffn.py` + `python scripts/build_ffn_dataset.py`.
