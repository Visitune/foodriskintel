import { Link } from "react-router-dom";
import type { Lang } from "../i18n";
import type { RiskIndex } from "../types";
import { GLOSSARY } from "../glossary";
import { fmtMonth, fmtNum } from "../format";
import { SourceTag } from "../components/ui";
import { Card } from "./shared";

export default function Guide({ index, lang }: { index: RiskIndex; lang: Lang }) {
  const fr = lang === "fr";
  const s = index.sources;
  const rows = [
    {
      tag: <SourceTag src="ffn" lang={lang} />,
      what: fr ? "Suspicions de fraude ou de non-conformité échangées entre États membres via le réseau européen (FFN/ACN)." : "Suspected fraud or non-compliance exchanged between Member States through the EU network (FFN/ACN).",
      who: fr ? "Commission européenne, DG SANTE — rapport mensuel" : "European Commission, DG SANTE — monthly report",
      scope: fr ? "UE, cas impliquant au moins 2 États membres" : "EU, cases involving at least 2 Member States",
      not: fr ? "Pas une condamnation ; pas les alertes sanitaires RASFF (pathogènes, allergènes)." : "Not a conviction; not RASFF health alerts (pathogens, allergens).",
      cover: `${fmtMonth(s.ffn.first, lang)} → ${fmtMonth(s.ffn.latest, lang)} · ${fmtNum(s.ffn.cases, lang)} ${fr ? "cas" : "cases"}`,
      link: "https://food.ec.europa.eu/food-safety/acn/ffn-monthly_en",
    },
    {
      tag: <SourceTag src="jrc" lang={lang} />,
      what: fr ? "Incidents de fraude parus dans la presse mondiale, recensés chaque mois par le JRC (l'IFS en reprend une sélection dans son rapport)." : "Fraud incidents reported in the world press, compiled monthly by the JRC (IFS republishes a selection in its report).",
      who: fr ? "JRC — Centre commun de recherche, Commission européenne" : "JRC — Joint Research Centre, European Commission",
      scope: fr ? "Monde, 30 à 160 incidents par rapport, mensuel ou bimestriel" : "World, 30 to 160 incidents per report, monthly or bimonthly",
      not: fr ? "Pas exhaustif ni officiel : faits rapportés par la presse. Rapports publiés en image (non lisibles) affichés comme absence, jamais comme zéro." : "Neither exhaustive nor official: press-reported facts. Image-only reports are shown as missing, never as zero.",
      cover: `${fmtMonth(s.jrc.first, lang)} → ${fmtMonth(s.jrc.latest, lang)} · ${fmtNum(s.jrc.incidents, lang)} incidents`,
      link: "https://knowledge4policy.ec.europa.eu/jrc-food-fraud-monthly-report_en",
    },
    {
      tag: <SourceTag src="ifs" lang={lang} />,
      what: fr ? "Nombre de rappels produits publiés chaque mois par les autorités de ~35 pays, relevé sur la carte du rapport IFS Trend Risk." : "Number of product recalls published each month by authorities of ~35 countries, read on the IFS Trend Risk Report map.",
      who: fr ? "IFS Management GmbH — rapport mensuel" : "IFS Management GmbH — monthly report",
      scope: fr ? "Monde, par autorité qui publie" : "World, by publishing authority",
      not: fr ? "Pas l'origine des produits ; pas de détail par produit ou danger." : "Not the products' origin; no breakdown by product or hazard.",
      cover: `${fmtMonth(s.ifs.first, lang)} → ${fmtMonth(s.ifs.latest, lang)} · ${s.ifs.reports} ${fr ? "rapports" : "reports"}`,
      link: "https://www.ifs-certification.com/index.php/en/ifs-portfolio/risk-management",
    },
  ];

  return (
    <div className="page prose">
      <header className="page-header">
        <h2>{fr ? "Comprendre les données" : "Understanding the data"}</h2>
        <p className="subtitle">{fr ? "D'où viennent les chiffres, ce qu'ils veulent dire — et ce qu'ils ne disent pas." : "Where the figures come from, what they mean — and what they don't."}</p>
      </header>

      <Card title={fr ? "Trois sources, trois natures différentes" : "Three sources, three different natures"}>
        <div className="table-scroll">
          <table className="data-table source-table">
            <thead><tr>
              <th>{fr ? "Source" : "Source"}</th><th>{fr ? "Ce que c'est" : "What it is"}</th><th>{fr ? "Producteur" : "Producer"}</th>
              <th>{fr ? "Périmètre" : "Scope"}</th><th>{fr ? "Ce que ce n'est pas" : "What it is not"}</th><th>{fr ? "Couverture ici" : "Coverage here"}</th>
            </tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>{r.tag}<div><a href={r.link} target="_blank" rel="noopener noreferrer">{fr ? "Site officiel" : "Official site"}</a></div></td>
                  <td>{r.what}</td><td>{r.who}</td><td>{r.scope}</td><td>{r.not}</td><td className="nowrap">{r.cover}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p><strong>{fr ? "Règle d'or : " : "Golden rule: "}</strong>{fr
          ? "on n'additionne jamais les chiffres de deux sources. Chaque bloc de l'application indique sa source par une étiquette de couleur."
          : "never add up figures from two sources. Each block of the app shows its source with a coloured label."}</p>
      </Card>

      <Card title={fr ? "Lire les chiffres correctement" : "Reading the figures correctly"}>
        <ul>
          <li>{fr ? "Un pays souvent cité comme origine est souvent aussi un gros exportateur vers l'UE : comparez à vos volumes, pas dans l'absolu." : "A country often cited as origin is often a large exporter to the EU: compare with your volumes, not in absolute terms."}</li>
          <li>{fr ? "Les rapports sont publiés avec un décalage : le rapport d'un mois décrit souvent les cas du mois précédent." : "Reports are published with a lag: one month's report often describes the previous month's cases."}</li>
          <li>{fr ? "Les tendances comparent les 6 derniers mois publiés aux 6 précédents ; en dessous de 5 cas, aucune tendance n'est affichée." : "Trends compare the last 6 published months with the 6 before; below 5 cases no trend is shown."}</li>
          <li>{fr ? "Aucun score de risque n'est calculé : l'outil montre des faits publiés, l'évaluation reste la vôtre." : "No risk score is computed: the tool shows published facts, the assessment remains yours."}</li>
          <li>{fr ? `Rapports JRC publiés uniquement en image (non exploitables) : ${s.jrc.months_no_text.map((m) => fmtMonth(m, lang, "short")).join(", ")}.` : `JRC reports published as images only (not readable): ${s.jrc.months_no_text.map((m) => fmtMonth(m, lang, "short")).join(", ")}.`}</li>
        </ul>
      </Card>

      <Card title={fr ? "Glossaire" : "Glossary"}>
        <dl className="glossary">
          {Object.entries(GLOSSARY).map(([k, g]) => (
            <div key={k}><dt>{g.term[lang]}</dt><dd>{g.def[lang]}</dd></div>
          ))}
        </dl>
      </Card>

      <Card title={fr ? "Mise à jour et méthode" : "Updates and method"}>
        <p>{fr
          ? "Les rapports sont recherchés automatiquement chaque semaine ; leurs tableaux sont extraits des PDF officiels puis contrôlés (comparaison avec des valeurs vérifiées à la main, détection des colonnes décalées). Chaque cas renvoie vers son document source."
          : "Reports are searched automatically every week; their tables are extracted from the official PDFs and checked (comparison with hand-verified values, detection of shifted columns). Each case links to its source document."}</p>
        <p><Link to="/sources">{fr ? "Détail de la couverture et de la méthode d'extraction" : "Coverage and extraction method details"}</Link></p>
      </Card>

      <Card title={fr ? "Attribution" : "Attribution"}>
        <p>{fr
          ? "Données : IFS Trend Risk Reports (IFS Management GmbH), JRC Food Fraud Monthly (Commission européenne), FFN Monthly (DG SANTE). Outil de visualisation indépendant, sans lien avec ces organismes. Il ne remplace pas les rapports officiels."
          : "Data: IFS Trend Risk Reports (IFS Management GmbH), JRC Food Fraud Monthly (European Commission), FFN Monthly (DG SANTE). Independent visualisation tool, not affiliated with these bodies. It does not replace the official reports."}</p>
        <p className="meta">{fr ? "Application conçue par " : "App designed by "}<a href="https://visipilot.com" target="_blank" rel="noopener noreferrer">VisiPilot</a>.</p>
      </Card>
    </div>
  );
}
