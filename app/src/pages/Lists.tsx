import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Lang } from "../i18n";
import type { RiskIndex } from "../types";
import { fmtNum, lastMonths } from "../format";
import { SearchBox, Sparkline, TrendBadge } from "../components/ui";

export function Materials({ index, lang }: { index: RiskIndex; lang: Lang }) {
  const fr = lang === "fr";
  const months = lastMonths(index.sources.ffn.latest, 24);
  const fams = Object.entries(index.families).sort((a, b) => b[1].ffn_cases + b[1].fraud_cases - (a[1].ffn_cases + a[1].fraud_cases));
  return (
    <div className="page">
      <header className="page-header">
        <h2>{fr ? "Matières premières" : "Raw materials"}</h2>
        <p className="subtitle">{fr ? "Familles de matières, regroupant les catégories officielles UE et les produits cités dans la presse." : "Material families, grouping official EU categories and products cited in the press."}</p>
      </header>
      <SearchBox index={index} lang={lang} />
      <div className="tile-grid">
        {fams.map(([id, f]) => (
          <Link key={id} to={`/matiere/${id}`} className="tile">
            <span className="tile-title">{f.label[lang]}</span>
            <span className="tile-figures">
              <span><strong>{fmtNum(f.ffn_cases, lang)}</strong> {fr ? "suspicions UE" : "EU suspicions"}</span>
              <span><strong>{fmtNum(f.fraud_cases, lang)}</strong> {fr ? "cas presse" : "press cases"}</span>
            </span>
            <Sparkline months={months} values={f.ffn_by_month} lang={lang} height={36} />
            <TrendBadge trend={f.ffn_trend} lang={lang} />
          </Link>
        ))}
      </div>
    </div>
  );
}

export function Origins({ index, lang }: { index: RiskIndex; lang: Lang }) {
  const fr = lang === "fr";
  const [filter, setFilter] = useState("");
  const rows = useMemo(() => Object.entries(index.origins)
    .filter(([c]) => c.toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => b[1].ffn_cases + b[1].fraud_cases - (a[1].ffn_cases + a[1].fraud_cases)), [index, filter]);
  return (
    <div className="page">
      <header className="page-header">
        <h2>{fr ? "Pays d'origine" : "Origin countries"}</h2>
        <p className="subtitle">{fr ? "Pays d'où proviennent les produits signalés (suspicions UE) ou où des fraudes ont été rapportées (presse)." : "Countries flagged products come from (EU suspicions) or where fraud was reported (press)."}</p>
      </header>
      <input className="input" type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={fr ? "Filtrer les pays…" : "Filter countries…"} aria-label={fr ? "Filtrer les pays" : "Filter countries"} />
      <div className="table-scroll">
        <table className="data-table">
          <thead><tr>
            <th>{fr ? "Pays" : "Country"}</th><th className="num">{fr ? "Suspicions UE" : "EU suspicions"}</th><th>{fr ? "Tendance" : "Trend"}</th>
            <th className="num">{fr ? "Fraude presse" : "Press fraud"}</th><th>{fr ? "Matière la plus signalée" : "Most reported material"}</th>
          </tr></thead>
          <tbody>
            {rows.map(([c, o]) => {
              const topFam = Object.entries(o.ffn_by_family)[0]?.[0];
              return (
                <tr key={c}>
                  <td><Link to={`/origine/${encodeURIComponent(c)}`}>{c}</Link></td>
                  <td className="num">{fmtNum(o.ffn_cases, lang)}</td>
                  <td><TrendBadge trend={o.ffn_trend} lang={lang} /></td>
                  <td className="num">{fmtNum(o.fraud_cases, lang)}</td>
                  <td>{topFam ? <Link to={`/matiere/${topFam}?origine=${encodeURIComponent(c)}`}>{index.labels.families[topFam]?.[lang]}</Link> : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
