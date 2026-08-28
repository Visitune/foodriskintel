# Cahier des charges — Food Risk Intelligence
## Prototype de visualisation des données issues des IFS Trend Risk Reports

**Version :** 0.1 — MVP  
**Date :** 27 août 2026  
**Statut :** Document de cadrage évolutif

---

# 1. Objet du projet

Créer un outil indépendant de **visualisation, d'organisation et d'exploration de données publiées dans les IFS Trend Risk Reports**.

L'objectif n'est pas de recréer, remplacer ou concurrencer les publications ou outils de l'IFS. L'outil constitue uniquement une couche technique de mise en forme permettant :

- visualisation sur une carte mondiale interactive ;
- exploration par pays et période ;
- structuration historique des informations publiées ;
- gestion correcte des périodes mensuelles et cumulées ;
- exploration des cas de Food Fraud ;
- traçabilité systématique vers les publications sources.

---

# 2. Attribution et positionnement

## 2.1 Attribution permanente à l'IFS

Toutes les données, analyses et sélections originales provenant des rapports doivent être clairement attribuées à l'IFS.

Mention à afficher :

> **Data source: IFS Trend Risk Reports. All credit for the original data collection, selection, analysis and reporting belongs to IFS.**

En français :

> **Source des données : IFS Trend Risk Reports. L'ensemble du travail original de collecte, sélection, analyse et publication reste attribué à l'IFS.**

## 2.2 Positionnement

L'application doit préciser clairement :

> Cet outil indépendant est uniquement destiné à la visualisation et à l'organisation d'informations publiées dans les IFS Trend Risk Reports. Il n'est pas un outil officiel de l'IFS, n'est pas affilié à l'IFS et ne vise pas à remplacer les publications, services ou outils de l'IFS.

Cette attribution doit apparaître sur la page principale, dans le pied de page, dans les sources et dans les exports éventuels.

## 2.3 Traçabilité

Chaque donnée doit pouvoir être reliée, autant que possible, à :

- l'organisation source : `IFS` ;
- le document source ;
- le mois et l'année du rapport ;
- la période réelle couverte ;
- la page ou section source ;
- l'URL officielle du PDF.

---

# 3. Objectifs fonctionnels

## 3.1 Carte mondiale interactive

La carte constitue la fonctionnalité principale du MVP.

L'utilisateur doit pouvoir :

- zoomer et dézoomer ;
- déplacer la carte ;
- cliquer sur un pays ;
- survoler un pays ;
- visualiser une intensité relative ;
- filtrer selon les rapports ou périodes disponibles.

Selon les données disponibles, la carte affiche :

- le nombre de rappels publié pour un pays ;
- le nombre de cas Food Fraud associés à un pays ;
- une valeur publiée dans un rapport spécifique ;
- un cumul uniquement lorsqu'il est méthodologiquement justifié.

## 3.2 Gestion des périodes

Le système ne doit jamais supposer :

> **1 PDF = 1 mois de données.**

Chaque rapport doit comporter :

- `report_publication_date`
- `report_publication_month`
- `data_period_start`
- `data_period_end`
- `months_covered`
- `period_type`
- `period_semantics`

Types possibles :

- `monthly`
- `two_month_cumulative`
- `multi_month_cumulative`
- `point_in_time`
- `unknown`
- `mixed`

### Règle fondamentale

Une donnée cumulée sur deux mois ne doit jamais être automatiquement répartie entre ces deux mois.

Exemple :

| Période source | Valeur |
|---|---:|
| Mai 2026 | 45 |
| Juin–Juillet 2026 | 90 |

Le système peut afficher `Mai–Juillet = 135` si les périodes sont non chevauchantes, mais ne doit jamais inventer `Juin = 45` et `Juillet = 45`.

---

# 4. Périmètre du MVP

Le premier MVP réel doit intégrer environ **10 rapports IFS**, couvrant une période suffisamment large pour tester :

- les variations de structure des PDF ;
- les périodes différentes ;
- les éventuels cumuls sur deux mois ;
- les données de recalls ;
- les données Food Fraud.

Les mois manquants ou ambiguës ne doivent jamais être complétés artificiellement.

---

# 5. Modules du MVP

## Module A — World Recall Map

- carte mondiale ;
- zoom ;
- clic pays ;
- infobulles ;
- filtre par rapport ;
- affichage de la période réelle ;
- lien vers le PDF source.

## Module B — Country Detail

Pour chaque pays :

- valeurs publiées dans les différents rapports ;
- historique uniquement sur des périodes comparables ;
- détail des sources ;
- avertissement lorsque les périodes ne sont pas directement comparables.

## Module C — Food Fraud Explorer

Champs recherchés :

- produit ;
- pays ;
- type ou motif ;
- période détectée ou rapportée ;
- rapport source ;
- URL source lorsque disponible.

## Module D — Source Explorer

Pour chaque rapport :

- titre ;
- date de publication ;
- URL officielle ;
- période réelle identifiée ;
- données extraites ;
- statut de validation.

---

# 6. Modèle de données

## `reports`

| Champ | Description |
|---|---|
| `report_id` | Identifiant unique |
| `report_title` | Titre officiel |
| `publication_date` | Date de publication |
| `official_url` | URL officielle IFS |
| `extraction_status` | Statut extraction |
| `validation_status` | Validation humaine |

## `report_periods`

| Champ | Description |
|---|---|
| `period_id` | Identifiant |
| `report_id` | Rapport parent |
| `metric` | recalls / food_fraud / autre |
| `period_start` | Début |
| `period_end` | Fin |
| `months_covered` | Nombre de mois |
| `period_type` | Type de période |
| `period_semantics` | Description précise |
| `confidence` | Niveau de confiance |
| `validation_status` | Validé / à vérifier |

## `recalls_by_country`

| Champ | Description |
|---|---|
| `record_id` | Identifiant |
| `report_id` | Rapport |
| `period_id` | Période |
| `country_raw` | Nom tel que publié |
| `country_normalized` | Nom normalisé |
| `recall_count` | Valeur publiée |
| `page_reference` | Page source |
| `source_url` | URL IFS |
| `extraction_method` | Manuel / automatique / hybride |
| `validation_status` | Statut |

## `food_fraud_cases`

| Champ | Description |
|---|---|
| `case_id` | Identifiant |
| `report_id` | Rapport |
| `period_id` | Période |
| `product_raw` | Produit publié |
| `product_normalized` | Produit normalisé |
| `country_raw` | Pays |
| `country_normalized` | Pays normalisé |
| `fraud_reason_raw` | Motif publié |
| `fraud_type_normalized` | Catégorie normalisée |
| `original_source_url` | Source originale si disponible |
| `ifs_report_url` | Rapport IFS |
| `validation_status` | Statut |

---

# 7. Pipeline de récupération et d'extraction

1. **Inventaire des rapports** : mois, année, URL, accessibilité et statut.
2. **Téléchargement** : conservation du nom, URL officielle et date de récupération.
3. **Extraction** : texte, tableaux, valeurs des cartes, liens sources et indications de période.
4. **Détection des périodes** : recherche explicite de mois, plages de mois, cumul, `detected in`, `during`, `since`, etc.
5. **Normalisation** : pays, produits et types de fraude, tout en conservant la valeur originale.
6. **Validation** : statuts `extracted`, `automatically_detected`, `needs_review`, `verified`.

Une détection automatique ambiguë doit obligatoirement être marquée pour revue.

---

# 8. Règles de qualité

Le système ne doit jamais :

- inventer une valeur manquante ;
- répartir automatiquement un cumul ;
- interpoler un mois absent ;
- convertir une période ambiguë en mois individuel.

Les valeurs doivent être étiquetées selon leur nature :

- `Monthly value`
- `Two-month cumulative value`
- `Published map value`
- `Reporting-period value`

---

# 9. Interface utilisateur

## Écran 1 — Global Overview

- titre ;
- attribution IFS ;
- filtre de période ;
- indicateurs ;
- carte mondiale.

## Écran 2 — Interactive World Map

- zoom ;
- déplacement ;
- clic ;
- infobulles ;
- légende ;
- filtres pays et période.

## Écran 3 — Country Detail

- pays ;
- valeurs par rapport ;
- périodes réelles ;
- sources ;
- cas Food Fraud lorsque disponibles.

## Écran 4 — Food Fraud Explorer

Filtres :

- période ;
- pays ;
- produit ;
- type de fraude.

## Écran 5 — Sources & Methodology

- provenance IFS ;
- rôle limité de l'outil ;
- méthode d'extraction ;
- limites ;
- logique des périodes ;
- statuts de validation.

---

# 10. Architecture technique MVP

```text
IFS Trend Risk Reports (PDF)
            |
            v
    Inventory / Download
            |
            v
    Extraction pipeline
            |
            +----> Period detection
            +----> Recall extraction
            +----> Food Fraud extraction
            |
            v
       Structured dataset
      CSV / JSON / SQLite
            |
            v
     Interactive web MVP
            |
            +----> World map
            +----> Country explorer
            +----> Food Fraud explorer
            +----> Sources
```

Technologies envisagées :

- Python pour récupération et extraction ;
- extraction PDF texte/tableaux ;
- règles + assistance IA avec validation ;
- CSV / JSON pour le prototype ;
- SQLite ou PostgreSQL ensuite ;
- HTML/JavaScript ou React ;
- Leaflet ou MapLibre pour la carte.

---

# 11. Plan de développement

## Phase 1 — Inventaire

Identifier environ 10 rapports accessibles et documenter les périodes.

**Livrable :** registre des rapports.

## Phase 2 — Extraction

Extraire recalls par pays et Food Fraud, enregistrer les sources et marquer les incertitudes.

**Livrable :** dataset structuré validé.

## Phase 3 — MVP réel

Remplacer toutes les mock data par les données extraites et intégrer les périodes réelles et la traçabilité IFS.

**Livrable :** application testable.

## Phase 4 — Validation

Vérifier :

- cohérence des valeurs ;
- périodes cumulées ;
- doublons ;
- correspondance carte / PDF ;
- attribution IFS.

## Phase 5 — Extension

Après validation :

- historique 2 à 3 ans ;
- davantage de rapports ;
- filtres avancés ;
- analyses par produit ;
- tendances ;
- exports ;
- mise à jour automatisée.

---

# 12. Critères d'acceptation

Le MVP est acceptable si :

1. il contient uniquement des données réellement extraites ou explicitement marquées comme non validées ;
2. chaque donnée peut être reliée à un rapport IFS ;
3. aucune valeur mensuelle n'est inventée à partir d'un cumul ;
4. périodes de publication et périodes de données sont distinctes ;
5. la carte est interactive ;
6. un utilisateur peut cliquer sur un pays ;
7. la source IFS est visible ;
8. le rôle de visualisation est clairement expliqué ;
9. l'outil ne se présente jamais comme un produit officiel IFS ;
10. les rapports originaux restent accessibles.

---

# 13. Risques à surveiller

## Variabilité des PDF

**Réponse :** extraction hybride et validation.

## Ambiguïté temporelle

**Réponse :** modèle fondé sur les périodes, pas seulement sur le mois du fichier.

## Comparabilité

**Réponse :** ne cumuler que des périodes explicitement compatibles.

## Extraction des cartes

**Réponse :** contrôle humain et conservation du PDF source.

## Attribution et propriété intellectuelle

**Réponse :** attribution permanente, liens vers les publications et absence de présentation comme outil officiel.

---

# 14. Prochaine action

> **Constituer un registre d'environ 10 IFS Trend Risk Reports, déterminer pour chaque rapport la période réellement couverte pour les recalls et le Food Fraud, puis construire un dataset validé avant extension du MVP.**

---

# Références principales

- urlIFS — Risk Managementhttps://www.ifs-certification.com/fr/ifs-portfolio/risk-management
- urlIFS Trend Risk Report — July 2024https://www.ifs-certification.com/images/ifs_documents/IFS_Trend_Risk_Report_July_2024.pdf
- urlIFS Trend Risk Report — April 2025https://www.ifs-certification.com/images/ifs_documents/IFS_Trend_Risk_Report_April_2025.pdf
- urlIFS Trend Risk Report — September 2025https://www.ifs-certification.com/images/ifs_documents/IFS_Trend_Risk_Report_September_2025.pdf
- urlIFS Trend Risk Report — July 2026https://www.ifs-certification.com/images/ifs_documents/IFS_Trend_Risk_Report_July_2026_EN.pdf
