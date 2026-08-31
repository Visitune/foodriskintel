import { Link } from "react-router-dom";
import type { Dataset, FfnDataset, CrossDataset } from "./types";
import { t } from "./i18n";
import type { Lang } from "./i18n";

export default function Overview({ data, ffn, cross, lang }: { data: Dataset; ffn: FfnDataset | null; cross: CrossDataset | null; lang: Lang }) {
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
  const tr = t[lang];

  return (
    <div className="page">
      <div className="page-header">
        <h2>{tr.overview.title}</h2>
        <p className="subtitle">{tr.overview.sub(s.total_reports, ffn?.summary.total_reports ?? "—", cross?.window.start ?? data.date_range.start, cross?.window.end ?? data.date_range.end)}</p>
      </div>

      <div className="source-banner">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 0a8 8 0 100 16A8 8 0 008 0zm1 12H7v-2h2v2zm0-4H7V4h2v4z" />
        </svg>
        <span>
          <strong>{tr.overview.srcIfs}</strong> &amp; <strong>{tr.overview.srcFfn}</strong> — {tr.overview.disc}
          {" "}<a href="https://www.ifs-certification.com/" target="_blank" rel="noopener noreferrer">IFS</a> · <a href="https://food.ec.europa.eu/food-safety/acn/ffn-monthly_en" target="_blank" rel="noopener noreferrer">FFN</a>
        </span>
      </div>

      <div className="section-label">{tr.overview.allTimeLabel}</div>
      <div className="stat-grid">
        <div className="stat-card accent">
          <div className="stat-value">{s.total_recall_values.toLocaleString()}</div>
          <div className="stat-label">{tr.overview.recalls}</div>
        </div>
        <div className="stat-card warn">
          <div className="stat-value">{ffn ? ffn.summary.total_suspicions.toLocaleString() : "—"}</div>
          <div className="stat-label">{tr.overview.ffnSusp}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{ffn ? ffn.summary.total_cases.toLocaleString() : s.total_food_fraud_cases}</div>
          <div className="stat-label">{ffn ? tr.overview.ffnCases : tr.overview.fraudCasesFallback}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{s.total_reports}</div>
          <div className="stat-label">{tr.overview.reportsIfs}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{ffn?.summary.total_reports ?? "—"}</div>
          <div className="stat-label">{tr.overview.reportsFfn}</div>
        </div>
      </div>
      {cross && (
        <div className="card">
          <h3>{tr.overview.window}</h3>
          <div className="stat-grid" style={{marginTop:8}}>
            <div className="stat-card"><div className="stat-value stat-value-wrap">{cross.window.start}<br />→ {cross.window.end}</div><div className="stat-label">{cross.summary.months_in_window} {tr.overview.months}</div></div>
            <div className="stat-card"><div className="stat-value">{cross.summary.months_with_both_sources}/{cross.summary.months_in_window}</div><div className="stat-label">{tr.overview.withBoth}</div></div>
            <div className="stat-card warn"><div className="stat-value">{cross.summary.ffn_total_in_window.toLocaleString()}</div><div className="stat-label">{tr.cross.ffnInWindow}</div></div>
            <div className="stat-card accent"><div className="stat-value">{cross.summary.ifs_recalls_total_in_window.toLocaleString()}</div><div className="stat-label">{tr.cross.ifsInWindow}</div></div>
          </div>
          <div className="meta" style={{marginTop:8}}>{tr.overview.separate}</div>
        </div>
      )}

      <div className="grid-2">
        <div className="card">
          <h3>{tr.overview.topCountries}</h3>
          <div className="bar-list">
            {top10.map(([country, total]) => (
              <Link key={country} to={`/country/${encodeURIComponent(country)}`} className="bar-row" style={{ textDecoration:"none", color:"inherit" }} aria-label={tr.overview.countrySheetAria(country)}>
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
          <h3>{tr.overview.fraudByType}</h3>
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
        <h3>{tr.overview.reportsByYear}</h3>
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
        <h3>{tr.overview.recent}</h3>
        <table>
          <thead>
            <tr>
              <th>{tr.overview.colReport}</th>
              <th>{tr.overview.colCountries}</th>
              <th>{tr.overview.colFraud}</th>
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
