import { useParams, useNavigate } from "react-router-dom";
import type { Dataset, FfnDataset } from "./types";
import type { Lang } from "./i18n";

export default function CountryDetail({ data, ffn, lang }: { data: Dataset; ffn?: FfnDataset | null; lang: Lang }) {
  const { country } = useParams();
  const navigate = useNavigate();
  const countryName = decodeURIComponent(country || "");

  // Find recalls for this country across all reports
  const recalls = data.recalls.filter(
    (r) => r.country_normalized === countryName
  );

  // Find food fraud cases where this country is the source or detection location (IFS/JRC)
  const fraudSource = data.food_fraud.filter(
    (f) => f.country_normalized === countryName
  );
  const fraudDetected = data.food_fraud.filter(
    (f) => f.detected_in === countryName
  );
  // FFN cases where country is origin or notified_by
  const ffnOrigin = ffn ? ffn.cases.filter(c => (c.origins_list?.length ? c.origins_list : [c.origin_normalized]).includes(countryName)) : [];
  const ffnNotified = ffn ? ffn.cases.filter(c => c.notified_by_normalized === countryName) : [];

  // Timeline data for chart
  const timeline = data.reports.map((r) => {
    const entry = recalls.find((rc) => rc.report_id === r.id);
    return {
      report: r,
      value: entry?.value || 0,
    };
  });

  const maxTimeline = Math.max(1, ...timeline.map((t) => t.value));

  const totalRecalls = recalls.reduce((sum, r) => sum + r.value, 0);
  const hasFFN = ffnOrigin.length > 0 || ffnNotified.length > 0;
  if (recalls.length === 0 && fraudSource.length === 0 && fraudDetected.length === 0 && !hasFFN) {
    return (
      <div className="page">
        <div className="page-header">
          <button className="back-btn" onClick={() => navigate(-1)}>
            &larr; {lang==="fr"?"Retour":"Back"}
          </button>
          <h2>{countryName}</h2>
          <p className="subtitle">{lang==="fr"?"Aucune donnée pour ce pays":"No data found for this country"} — données IFS/FFN restent EN</p>
        </div>
      </div>
    );
  }

  const latestEntry = recalls.length ? recalls[recalls.length - 1] : null;
  const prevEntry = recalls.length > 1 ? recalls[recalls.length - 2] : null;
  const trend = latestEntry && prevEntry
    ? ((latestEntry.value - prevEntry.value) / Math.max(1, prevEntry.value)) * 100
    : 0;

  return (
    <div className="page">
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate(-1)}>
          &larr; {lang==="fr"?"Retour":"Back"}
        </button>
        <h2>{countryName}</h2>
        <p className="subtitle">
          {lang==="fr"
            ? `${recalls.length} rapports IFS · ${totalRecalls} rappels · ${fraudSource.length} cas fraude IFS/JRC · ${ffnOrigin.length + ffnNotified.length} suspicions FFN (ACN UE — nature différente)`
            : `${recalls.length} IFS reports | ${totalRecalls} recalls | ${fraudSource.length} IFS/JRC fraud cases | ${ffnOrigin.length + ffnNotified.length} FFN suspicions (EU ACN — different nature)`}
        </p>
        {recalls.length === 0 && hasFFN && (
          <p className="meta" style={{marginTop:6}}>{lang==="fr"
            ? "Pays sans rappel IFS publié — uniquement des cas FFN / fraude. Les rappels IFS couvrent le monde ; FFN couvre le réseau ACN UE."
            : "Country without published IFS recalls — FFN / fraud cases only. IFS recalls cover the world; FFN covers the EU ACN network."}</p>
        )}
      </div>
      {(ffnOrigin.length>0 || ffnNotified.length>0) && (
        <div className="source-banner" style={{flexDirection:'column', gap:4}}>
          <span><strong>{lang==="fr"?"FFN pour ce pays":"FFN for this country"}</strong> — {ffnOrigin.length} {lang==="fr"?"comme origine":"as origin"}, {ffnNotified.length} {lang==="fr"?"comme notifiant":"as notifier"}. Cliquez un cas pour son PDF.</span>
        </div>
      )}

      <div className="stat-grid">
        <div className="stat-card accent">
          <div className="stat-value">{totalRecalls}</div>
          <div className="stat-label">{lang==="fr"?"Rappels totaux":"Total recalls"}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{latestEntry ? latestEntry.value : "—"}</div>
          <div className="stat-label">{latestEntry ? (lang==="fr"?`Dernière période (${latestEntry.month} ${latestEntry.year})`:`Latest period (${latestEntry.month} ${latestEntry.year})`) : (lang==="fr"?"Aucun rappel IFS":"No IFS recalls")}</div>
        </div>
        <div className={`stat-card ${trend > 0 ? "warn" : ""}`}>
          <div className="stat-value">
            {latestEntry && prevEntry ? `${trend > 0 ? "+" : ""}${trend.toFixed(0)}%` : "—"}
          </div>
          <div className="stat-label">{lang==="fr"?"vs période précédente":"vs previous period"}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{fraudSource.length}</div>
          <div className="stat-label">{lang==="fr"?"Cas fraude (IFS)":"Fraud cases (IFS)"}</div>
        </div>
      </div>

      {recalls.length > 0 && (
      <div className="card">
        <h3>{lang==="fr"?"Chronologie rappels":"Recalls Timeline"}<span className="src-tag ifs">IFS</span></h3>
        <div className="timeline-chart">
          {timeline.map((t, i) => (
            <div key={i} className="timeline-bar-wrapper">
              <div className="timeline-bar-container">
                <div
                  className="timeline-bar"
                  style={{ height: `${(t.value / maxTimeline) * 100}%` }}
                />
              </div>
              <span className="timeline-value">{t.value}</span>
              <span className="timeline-label">
                {t.report.month.slice(0, 3)} {String(t.report.year).slice(2)}
              </span>
            </div>
          ))}
        </div>
      </div>
      )}

      <div className="grid-2">
        {ffnOrigin.length > 0 && (
          <div className="card">
            <h3>{lang==="fr"?"FFN — comme origine":"FFN — as origin"} ({ffnOrigin.length})<span className="src-tag ffn">FFN·ACN UE</span></h3>
            <table><thead><tr><th>{lang==="fr"?"Mois":"Month"}</th><th>{lang==="fr"?"Produit":"Product"}</th><th>Classification</th><th>PDF</th></tr></thead><tbody>
              {ffnOrigin.slice(0,30).map((c,i)=><tr key={i}><td>{c.month.slice(0,3)} {String(c.year).slice(2)}</td><td>{c.product_category}</td><td><span className="tag">{c.classification.slice(0,30)}</span></td><td><a href={c.source_url} target="_blank" rel="noopener noreferrer" aria-label="PDF"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="1.6"/><path d="M14 2v6h6" stroke="currentColor" strokeWidth="1.4"/></svg></a></td></tr>)}
            </tbody></table>
          </div>
        )}
        {ffnNotified.length > 0 && (
          <div className="card">
            <h3>{lang==="fr"?"FFN — comme notifiant":"FFN — as notifier"} ({ffnNotified.length})<span className="src-tag ffn">FFN·ACN UE</span></h3>
            <table><thead><tr><th>{lang==="fr"?"Mois":"Month"}</th><th>{lang==="fr"?"Produit":"Product"}</th><th>{lang==="fr"?"Origine":"Origin"}</th><th>PDF</th></tr></thead><tbody>
              {ffnNotified.slice(0,30).map((c,i)=><tr key={i}><td>{c.month.slice(0,3)} {String(c.year).slice(2)}</td><td>{c.product_category}</td><td title={c.origin_raw}>{c.origins_list && c.origins_list.length>1 ? c.origins_list.join(", ") : c.origin_normalized}</td><td><a href={c.source_url} target="_blank" rel="noopener noreferrer" aria-label="PDF"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="1.6"/><path d="M14 2v6h6" stroke="currentColor" strokeWidth="1.4"/></svg></a></td></tr>)}
            </tbody></table>
          </div>
        )}
        {fraudSource.length > 0 && (
          <div className="card">
            <h3>{lang==="fr"?"Cas fraude — pays source":"Fraud Cases — Source Country"}<span className="src-tag jrc">IFS · JRC presse</span></h3>
            <table>
              <thead>
                <tr>
                  <th>{lang==="fr"?"Mois":"Month"}</th>
                  <th>{lang==="fr"?"Produit":"Product"}</th>
                  <th>{lang==="fr"?"Motif":"Reason"}</th>
                </tr>
              </thead>
              <tbody>
                {fraudSource.map((f, i) => (
                  <tr key={i}>
                    <td>
                      {f.month.slice(0, 3)} {String(f.year).slice(2)}
                    </td>
                    <td>{f.product_normalized}</td>
                    <td>{f.reason_normalized}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {fraudDetected.length > 0 && (
          <div className="card">
            <h3>{lang==="fr"?"Cas fraude — détecté dans":"Fraud Cases — Detected In"}<span className="src-tag jrc">IFS · JRC presse</span></h3>
            <table>
              <thead>
                <tr>
                  <th>{lang==="fr"?"Mois":"Month"}</th>
                  <th>{lang==="fr"?"Produit":"Product"}</th>
                  <th>{lang==="fr"?"Motif":"Reason"}</th>
                  <th>{lang==="fr"?"Détecté dans":"Detected in"}</th>
                </tr>
              </thead>
              <tbody>
                {fraudDetected.map((f, i) => (
                  <tr key={i}>
                    <td>
                      {f.month.slice(0, 3)} {String(f.year).slice(2)}
                    </td>
                    <td>{f.product_normalized}</td>
                    <td>{f.reason_normalized}</td>
                    <td>{f.country_normalized}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {recalls.length > 0 && (
      <div className="card">
        <h3>{lang==="fr"?"Rapports par période":"Reports by Period"}<span className="src-tag ifs">IFS</span></h3>
        <table>
          <thead>
            <tr>
              <th>{lang==="fr"?"Rapport":"Report"}</th>
              <th>{lang==="fr"?"Rappels":"Recalls"}</th>
              <th>{lang==="fr"?"Tendance":"Trend"}</th>
            </tr>
          </thead>
          <tbody>
            {recalls.map((r, i) => {
              const prev = i > 0 ? recalls[i - 1].value : null;
              const change = prev !== null ? r.value - prev : null;
              return (
                <tr key={r.report_id}>
                  <td>
                    {r.month} {r.year}
                  </td>
                  <td className="mono">{r.value}</td>
                  <td className={change !== null && change > 0 ? "trend-up" : change !== null && change < 0 ? "trend-down" : ""}>
                    {change !== null ? (change > 0 ? `+${change}` : change) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
