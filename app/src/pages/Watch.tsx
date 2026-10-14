import { Link, useNavigate } from "react-router-dom";
import type { Lang } from "../i18n";
import type { Dataset, RiskIndex } from "../types";
import { fmtMonth, fmtNum, lastMonths } from "../format";
import { SearchBox, SourceTag, Term, TrendBadge, termPath } from "../components/ui";
import { Card } from "./shared";

const EXAMPLES: { fr: string; en: string; t: "family" | "origin" | "substance" | "commodity"; id: string; f?: string }[] = [
  { fr: "Miel", en: "Honey", t: "family", id: "honey" },
  { fr: "Huiles & olive", en: "Oils & olive", t: "family", id: "oils" },
  { fr: "Herbes & épices", en: "Herbs & spices", t: "family", id: "spices" },
  { fr: "Inde", en: "India", t: "origin", id: "India" },
  { fr: "Turquie", en: "Turkey", t: "origin", id: "Turkey" },
  { fr: "Oxyde d'éthylène", en: "Ethylene oxide", t: "substance", id: "Ethylene oxide", f: "spices" },
];

export default function Watch({ ifs, index, lang }: { ifs: Dataset; index: RiskIndex; lang: Lang }) {
  const fr = lang === "fr";
  const navigate = useNavigate();
  const { sources, highlights } = index;
  const last12 = lastMonths(sources.ffn.latest, 12);
  const sum12 = (r: Record<string, number>) => last12.reduce((a, m) => a + (r[m] || 0), 0);

  const topFamilies = Object.entries(index.families)
    .filter(([id]) => id !== "other")
    .map(([id, f]) => ({ id, f, n: sum12(f.ffn_by_month) }))
    .sort((a, b) => b.n - a.n).slice(0, 8);
  const topOrigins = Object.entries(index.origins)
    .map(([id, o]) => ({ id, o, n: sum12(o.ffn_by_month) }))
    .sort((a, b) => b.n - a.n).slice(0, 8);
  const fraudSkippedLatest = sources.ifs.fraud_not_published.includes(sources.ifs.latest);
  const latestIfs = ifs.reports[ifs.reports.length - 1];

  return (
    <div className="page watch">
      <section className="hero">
        <h1>{fr ? "Que signale-t-on sur vos matières premières ?" : "What is being reported about your raw materials?"}</h1>
        <p className="hero-sub">{fr
          ? <>Pour les entreprises certifiées IFS : retrouvez en un clic les fraudes et non-conformités publiées sur une matière ou un pays d'origine — à partir de 3 sources publiques, avec le lien vers chaque document.</>
          : <>For IFS-certified companies: find in one click the fraud and non-compliance cases published for a raw material or an origin country — from 3 public sources, with a link to each document.</>}</p>
        <SearchBox index={index} lang={lang} big autoFocus />
        <div className="chip-row examples">
          <span className="meta">{fr ? "Exemples :" : "Examples:"}</span>
          {EXAMPLES.map((e) => (
            <button type="button" key={e.id} className="chip" onClick={() => navigate(termPath({ t: e.t, id: e.id, n: 0, f: e.f }))}>{e[lang]}</button>
          ))}
        </div>
      </section>

      <section className="freshness" aria-label={fr ? "Fraîcheur des données" : "Data freshness"}>
        <div><SourceTag src="ffn" lang={lang} /> <span>{fr ? "jusqu'à" : "up to"} <strong>{fmtMonth(sources.ffn.latest, lang)}</strong></span></div>
        <div><SourceTag src="jrc" lang={lang} /> <span>{fr ? "jusqu'à" : "up to"} <strong>{fmtMonth(sources.ifs.fraud_latest, lang)}</strong>{fraudSkippedLatest && (fr ? " (pas de tableau dans le dernier rapport)" : " (no table in the latest report)")}</span></div>
        <div><SourceTag src="ifs" lang={lang} /> <span>{fr ? "jusqu'à" : "up to"} <strong>{fmtMonth(sources.ifs.latest, lang)}</strong></span></div>
        <Link to="/comprendre">{fr ? "D'où viennent ces données ?" : "Where does this data come from?"}</Link>
      </section>

      <div className="grid-2">
        <Card title={fr ? `Nouveau — suspicions UE de ${fmtMonth(highlights.ffn_month, lang)}` : `New — EU suspicions of ${fmtMonth(highlights.ffn_month, lang)}`} aside={<SourceTag src="ffn" lang={lang} />}>
          <p>{fr
            ? <><strong>{fmtNum(highlights.ffn_month_total, lang)}</strong> <Term id="ffn" lang={lang}>suspicions</Term> publiées ce mois-ci.</>
            : <><strong>{fmtNum(highlights.ffn_month_total, lang)}</strong> <Term id="ffn" lang={lang}>suspicions</Term> published this month.</>}</p>
          {highlights.ffn_rising_families.length > 0 ? (
            <>
              <h4 className="sub-h">{fr ? "Matières nettement au-dessus de leur moyenne sur 12 mois" : "Materials well above their 12-month average"}</h4>
              <ul className="link-list">
                {highlights.ffn_rising_families.map((r) => (
                  <li key={r.family}>
                    <Link to={`/matiere/${r.family}`}>{index.labels.families[r.family]?.[lang]}</Link>
                    <span className="meta"> {fmtNum(r.count, lang)} {fr ? "cas (moyenne" : "cases (average"} {String(r.avg12).replace(".", fr ? "," : ".")})</span>
                  </li>
                ))}
              </ul>
            </>
          ) : <p className="meta">{fr ? "Aucune matière nettement au-dessus de sa moyenne ce mois-ci." : "No material well above its average this month."}</p>}
        </Card>

        <Card title={fr ? `Nouveau — fraude presse (${fmtMonth(highlights.fraud_month, lang)})` : `New — press fraud (${fmtMonth(highlights.fraud_month, lang)})`} aside={<SourceTag src="jrc" lang={lang} />}>
          {latestIfs && latestIfs.food_fraud_status === "not_published" && (
            <p className="notice">{fr
              ? `Le rapport IFS de ${fmtMonth(latestIfs.publication_date, lang)} ne contient pas de tableau de fraude : derniers cas disponibles ci-dessous.`
              : `The IFS report of ${fmtMonth(latestIfs.publication_date, lang)} has no fraud table: latest available cases below.`}</p>
          )}
          <ul className="case-list">
            {highlights.fraud_month_cases.slice(0, 8).map((c, i) => (
              <li key={i}>
                <Link to={`/matiere/${c.material_family}`}>{c.product_normalized}</Link>
                <span className="meta"> — {c.reasons.map((r) => index.labels.reasons[r]?.[lang] ?? r).join(", ")} · {c.countries.join(" / ")}</span>
                {c.press_url && <> · <a href={c.press_url} target="_blank" rel="noopener noreferrer">{fr ? "article" : "article"}</a></>}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid-2">
        <Card title={fr ? "Matières les plus signalées (12 derniers mois)" : "Most reported materials (last 12 months)"} aside={<Link to="/matieres">{fr ? "Toutes" : "All"}</Link>}>
          <ul className="rank-list">
            {topFamilies.map(({ id, f, n }) => (
              <li key={id}>
                <Link to={`/matiere/${id}`}>{f.label[lang]}</Link>
                <span className="rank-n">{fmtNum(n, lang)}</span>
                <TrendBadge trend={f.ffn_trend} lang={lang} />
              </li>
            ))}
          </ul>
          <p className="meta">{fr ? "Nombre de suspicions officielles UE (FFN). Tendance : 6 derniers mois comparés aux 6 précédents." : "Number of official EU suspicions (FFN). Trend: last 6 months vs previous 6."}</p>
        </Card>
        <Card title={fr ? "Origines les plus signalées (12 derniers mois)" : "Most reported origins (last 12 months)"} aside={<Link to="/origines">{fr ? "Toutes" : "All"}</Link>}>
          <ul className="rank-list">
            {topOrigins.map(({ id, o, n }) => (
              <li key={id}>
                <Link to={`/origine/${encodeURIComponent(id)}`}>{id}</Link>
                <span className="rank-n">{fmtNum(n, lang)}</span>
                <TrendBadge trend={o.ffn_trend} lang={lang} />
              </li>
            ))}
          </ul>
          <p className="meta">{fr ? "Pays d'origine des produits signalés. Un volume élevé reflète aussi les volumes importés dans l'UE." : "Origin countries of flagged products. High counts also reflect volumes imported into the EU."}</p>
        </Card>
      </div>

      <Card title={fr ? "Comment s'en servir pour votre certification IFS" : "How to use it for your IFS certification"}>
        <ol className="steps">
          <li><strong>{fr ? "Cherchez chaque matière première sensible" : "Search each sensitive raw material"}</strong> {fr ? "de votre plan (épices, miel, huiles, produits de la mer…) et chacune de vos origines." : "in your plan (spices, honey, oils, seafood…) and each of your origins."}</li>
          <li><strong>{fr ? "Lisez « ce qui est signalé »" : "Read “what is reported”"}</strong> {fr ? ": ce sont vos scénarios de fraude à évaluer (substitution, dilution, fausse origine, substance interdite)." : ": these are your fraud scenarios to assess (substitution, dilution, false origin, banned substance)."}</li>
          <li><strong>{fr ? "Exportez les cas en CSV" : "Export the cases as CSV"}</strong> {fr ? "et joignez-les à votre " : "and attach them to your "}<Term id="vaccp" lang={lang}>{fr ? "évaluation de vulnérabilité" : "vulnerability assessment"}</Term>{fr ? ", avec la date de consultation." : ", with the consultation date."}</li>
          <li><strong>{fr ? "Revenez chaque mois" : "Come back every month"}</strong> {fr ? ": les données sont mises à jour automatiquement dès la parution des rapports." : ": data is updated automatically as soon as reports are published."}</li>
        </ol>
      </Card>
    </div>
  );
}
