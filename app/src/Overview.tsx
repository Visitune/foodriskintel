import { Link } from "react-router-dom";
import type { Dataset, FfnDataset, CrossDataset } from "./types";

export default function Overview({ data, ffn, cross, lang }: { data: Dataset; ffn: FfnDataset | null; cross: CrossDataset | null; lang: "fr"|"en" }) {
  const s = data.summary;

  // Top 10 countries by total recalls
  const countryTotals: Record<string, number> = {};
  data.recalls.forEach((r) => {
    countryTotals[r.country_normalized] = (countryTotals[r.country_normalized] || 0) + r.value;
  });
  const top10 = Object.entries(countryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // Fraud by reason
  const fraudByReason: Record<string, number> = {};
  data.food_fraud.forEach((f) => {
    const reason = f.reason_normalized || "Unknown";
    fraudByReason[reason] = (fraudByReason[reason] || 0) + 1;
  });
  const topReasons = Object.entries(fraudByReason)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  // Reports per year
  const byYear: Record<number, number> = {};
  data.reports.forEach((r) => {
    byYear[r.year] = (byYear[r.year] || 0) + 1;
  });

  const maxRecalls = top10[0]?.[1] || 1;

  const t = lang==="fr" ? {
    title: "Vue d'ensemble",
    sub: `IFS ${s.total_reports} rapports · FFN ${ffn?.summary.total_reports ?? "—"} rapports · Fenêtre ${cross?.window.start ?? data.date_range.start} → ${cross?.window.end ?? data.date_range.end}`,
    srcIfs: "Source : IFS Trend Risk Reports",
    srcFfn: "Source : EU FFN Monthly (DG SANTE)",
    disc: "Outil de visualisation uniquement — toujours consulter les rapports officiels.",
  } : {
    title: "Dashboard Overview",
    sub: `IFS ${s.total_reports} reports · FFN ${ffn?.summary.total_reports ?? "—"} reports · Window ${cross?.window.start ?? data.date_range.start} → ${cross?.window.end ?? data.date_range.end}`,
    srcIfs: "Source: IFS Trend Risk Reports",
    srcFfn: "Source: EU FFN Monthly (DG SANTE)",
    disc: "Visualization tool only — always refer to official reports.",
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>{t.title}</h2>
        <p className="subtitle">{t.sub}</p>
      </div>

      <div className="source-banner">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 0a8 8 0 100 16A8 8 0 008 0zm1 12H7v-2h2v2zm0-4H7V4h2v4z" />
        </svg>
        <span>
          <strong>{t.srcIfs}</strong> &amp; <strong>{t.srcFfn}</strong> — {t.disc}
          {" "}<a href="https://www.ifs-certification.com/" target="_blank" rel="noopener noreferrer">IFS</a> · <a href="https://food.ec.europa.eu/food-safety/acn/ffn-monthly_en" target="_blank" rel="noopener noreferrer">FFN</a>
        </span>
      </div>

      <div className="stat-grid">
        <div className="stat-card accent">
          <div className="stat-value">{s.total_recall_values.toLocaleString()}</div>
          <div className="stat-label">{lang==="fr"?"Rappels totaux (IFS)":"Total recalls (IFS)"}</div>
        </div>
        <div className="stat-card warn">
          <div className="stat-value">{ffn ? ffn.summary.total_suspicions.toLocaleString() : "—"}</div>
          <div className="stat-label">{lang==="fr"?"Suspicions FFN":"FFN suspicions"}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{ffn ? ffn.summary.total_cases.toLocaleString() : s.total_food_fraud_cases}</div>
          <div className="stat-label">{ffn ? (lang==="fr"?"Cas détaillés FFN":"FFN detailed cases") : (lang==="fr"?"Cas fraude":"Fraud cases")}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{s.total_reports} / {ffn?.summary.total_reports ?? "—"}</div>
          <div className="stat-label">{lang==="fr"?"Rapports IFS / FFN":"Reports IFS / FFN"}</div>
        </div>
      </div>
      {cross && (
        <div className="card">
          <h3>{lang==="fr" ? "Fenêtre croisée" : "Cross window"}</h3>
          <div className="stat-grid" style={{marginTop:8}}>
            <div className="stat-card"><div className="stat-value">{cross.window.start} → {cross.window.end}</div><div className="stat-label">{cross.summary.months_in_window} {lang==="fr"?"mois":"months"}</div></div>
            <div className="stat-card"><div className="stat-value">{cross.summary.months_with_both_sources}/{cross.summary.months_in_window}</div><div className="stat-label">{lang==="fr"?"mois avec les deux":"months with both"}</div></div>
            <div className="stat-card warn"><div className="stat-value">{cross.summary.ffn_total_in_window.toLocaleString()}</div><div className="stat-label">{lang==="fr"?"FFN dans fenêtre":"FFN in window"}</div></div>
            <div className="stat-card accent"><div className="stat-value">{cross.summary.ifs_recalls_total_in_window.toLocaleString()}</div><div className="stat-label">{lang==="fr"?"IFS rappels dans fenêtre":"IFS recalls in window"}</div></div>
          </div>
          <div className="meta" style={{marginTop:8}}>{lang==="fr" ? "Échelles séparées — ne jamais sommer IFS et FFN (périmètres différents : monde vs UE cross-border)." : "Separate scales — never sum IFS and FFN (different scopes: world vs EU cross-border)."}</div>
        </div>
      )}

      <div className="grid-2">
        <div className="card">
          <h3>{lang==="fr"?"Top 10 pays par rappels":"Top 10 Countries by Recalls"}</h3>
          <div className="bar-list">
            {top10.map(([country, total]) => (
              <Link key={country} to={`/country/${encodeURIComponent(country)}`} className="bar-row" style={{ textDecoration:"none", color:"inherit" }} aria-label={lang==="fr"?`Fiche pays ${country}`:`Country sheet ${country}`}>
                <span className="bar-label">{country}</span>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{ width: `${(total / maxRecalls) * 100}%` }}
                  />
                </div>
                <span className="bar-value">{total.toLocaleString()}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="card">
          <h3>{lang==="fr"?"Cas fraude par type":"Fraud Cases by Type"}</h3>
          <div className="bar-list">
            {topReasons.map(([reason, count]) => (
              <div key={reason} className="bar-row">
                <span className="bar-label">{reason}</span>
                <div className="bar-track">
                  <div
                    className="bar-fill warn"
                    style={{
                      width: `${(count / topReasons[0][1]) * 100}%`,
                    }}
                  />
                </div>
                <span className="bar-value">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <h3>{lang==="fr"?"Rapports par année":"Reports by Year"}</h3>
        <div className="year-bars">
          {Object.entries(byYear)
            .sort()
            .map(([year, count]) => (
              <div key={year} className="year-bar">
                <div
                  className="year-bar-fill"
                  style={{ height: `${(count / Math.max(...Object.values(byYear))) * 100}%` }}
                />
                <span className="year-bar-label">{year}</span>
                <span className="year-bar-count">{count}</span>
              </div>
            ))}
        </div>
      </div>

      <div className="card">
        <h3>{lang==="fr"?"Rapports récents":"Recent Reports"}</h3>
        <table>
          <thead>
            <tr>
              <th>{lang==="fr"?"Rapport":"Report"}</th>
              <th>{lang==="fr"?"Pays":"Countries"}</th>
              <th>{lang==="fr"?"Fraude":"Fraud"}</th>
            </tr>
          </thead>
          <tbody>
            {data.reports
              .slice()
              .reverse()
              .slice(0, 6)
              .map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.month} {r.year}
                  </td>
                  <td>{Object.keys(r.recalls).length}</td>
                  <td>{r.food_fraud_count}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
