import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Dataset, FfnDataset, CrossDataset } from "./types";
import { t } from "./i18n";
import type { Lang } from "./i18n";
import SectionNav from "./SectionNav";

const monthKey = (c: { year: number; month_num: number }) => `${c.year}-${String(c.month_num).padStart(2, "0")}`;
const norm = (c: string) => c.trim().toLowerCase();
const hasOrigin = (c: { origin_normalized: string; origins_list?: string[] }, country: string) =>
  (c.origins_list && c.origins_list.length ? c.origins_list : [c.origin_normalized]).some(o => norm(o) === norm(country));

export default function CrossView({ ifs, ffn, cross, lang }: { ifs: Dataset; ffn: FfnDataset; cross: CrossDataset; lang: Lang }) {
  const tr = t[lang];
  const allMonths = useMemo(() => cross.cross.map(c => c.month), [cross]);
  const [periodFrom, setPeriodFrom] = useState(allMonths[0]);
  const [periodTo, setPeriodTo] = useState(allMonths[allMonths.length - 1]);
  const [country, setCountry] = useState("all");
  const [drill, setDrill] = useState<string | null>(null);

  const countryOptions = useMemo(() => {
    const s = new Set<string>();
    ifs.recalls.forEach(r => s.add(r.country_normalized));
    ffn.cases.forEach(c => { (c.origins_list?.length ? c.origins_list : [c.origin_normalized]).forEach(o => s.add(o)); s.add(c.notified_by_normalized); });
    return [...s].sort();
  }, [ifs, ffn]);

  const countryMonths = useMemo(() => {
    if (country === "all") return null;
    const m = new Map<string, { ifs: number | null; ffn: number }>();
    ifs.recalls.forEach(r => {
      if (norm(r.country_normalized) !== norm(country)) return;
      const k = r.publication_date.slice(0, 7);
      const e = m.get(k) ?? { ifs: 0, ffn: 0 };
      e.ifs = (e.ifs ?? 0) + r.value;
      m.set(k, e);
    });
    ffn.cases.forEach(c => {
      if (!hasOrigin(c, country) && norm(c.notified_by_normalized) !== norm(country)) return;
      const k = monthKey(c);
      const e = m.get(k) ?? { ifs: null, ffn: 0 };
      e.ffn += 1;
      m.set(k, e);
    });
    return m;
  }, [country, ifs, ffn]);

  const rows = useMemo(() => {
    return cross.cross
      .filter(c => c.month >= periodFrom && c.month <= periodTo)
      .map(c => {
        if (country === "all") return { ...c, ffn_v: c.ffn_total_suspicions, ifs_v: c.ifs_recalls_total };
        const e = countryMonths?.get(c.month);
        return { ...c, ffn_v: e?.ffn ?? 0, ifs_v: e ? e.ifs : (c.ifs_present ? 0 : null) };
      })
      .filter(c => country === "all" || c.ffn_v > 0 || (c.ifs_v ?? 0) > 0);
  }, [cross, periodFrom, periodTo, country, countryMonths]);

  const maxFfn = Math.max(...rows.map(c => c.ffn_v || 0), 1);
  const maxIfs = Math.max(...rows.map(c => c.ifs_v || 0), 1);

  const totals = useMemo(() => ({
    ffn: rows.reduce((a, c) => a + c.ffn_v, 0),
    ifs: rows.reduce((a, c) => a + (c.ifs_v || 0), 0),
    missing: rows.filter(c => c.ifs_v === null).length,
  }), [rows]);

  const overlapCountries = useMemo(() => {
    const ffnSet = new Set(ffn.countries_origin);
    const ifsSet = new Set(ifs.countries);
    return {
      both: [...ffnSet].filter(x => ifsSet.has(x)).sort(),
      ffnOnly: [...ffnSet].filter(x => !ifsSet.has(x)).length,
      ifsOnly: [...ifsSet].filter(x => !ffnSet.has(x)).length,
    };
  }, [ffn, ifs]);

  const byProductFfn = useMemo(() => {
    if (country === "all") return Object.entries(ffn.by_product_all).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const m: Record<string, number> = {};
    ffn.cases.forEach(c => {
      if (monthKey(c) < periodFrom || monthKey(c) > periodTo) return;
      if (!hasOrigin(c, country) && norm(c.notified_by_normalized) !== norm(country)) return;
      m[c.product_category] = (m[c.product_category] || 0) + 1;
    });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [ffn, country, periodFrom, periodTo]);
  const byProductFfnMax = byProductFfn[0]?.[1] || 1;

  const drillData = useMemo(() => {
    if (!drill) return null;
    const ifsReport = ifs.reports.find(r => r.publication_date === drill);
    const ifsRecalls = ifs.recalls
      .filter(r => r.publication_date === drill && (country === "all" || norm(r.country_normalized) === norm(country)))
      .sort((a, b) => b.value - a.value).slice(0, 8);
    const ffnCases = ffn.cases.filter(c => monthKey(c) === drill && (country === "all" || hasOrigin(c, country) || norm(c.notified_by_normalized) === norm(country)));
    const ffnByOrigin: Record<string, number> = {};
    ffnCases.forEach(c => { ffnByOrigin[c.origin_normalized] = (ffnByOrigin[c.origin_normalized] || 0) + 1; });
    return {
      ifsRecalls,
      ifsFraud: ifsRecalls.length && ifsReport ? ifs.food_fraud.filter(f => f.publication_date === drill).length : null,
      ffnCasesCount: ffnCases.length,
      ffnTopOrigins: Object.entries(ffnByOrigin).sort((a, b) => b[1] - a[1]).slice(0, 6),
    };
  }, [drill, country, ifs, ffn]);

  const trendOf = (i: number, key: "ffn_v" | "ifs_v") => {
    if (i === 0) return "";
    const cur = rows[i][key], prev = rows[i - 1][key];
    if (cur === null || prev === null || prev === undefined || cur === undefined) return "";
    if (cur > prev * 1.1) return "↑";
    if (cur < prev * 0.9) return "↓";
    return "→";
  };
  const trendClass = (sym: string) => sym === "↑" ? "trend up" : sym === "↓" ? "trend down" : "trend flat";

  const activeFilters: { label: string; clear: () => void }[] = [];
  if (periodFrom !== allMonths[0] || periodTo !== allMonths[allMonths.length - 1])
    activeFilters.push({ label: `${tr.cross.period} ${periodFrom} → ${periodTo}`, clear: () => { setPeriodFrom(allMonths[0]); setPeriodTo(allMonths[allMonths.length - 1]); } });
  if (country !== "all") activeFilters.push({ label: `${tr.cross.country}: ${country}`, clear: () => setCountry("all") });

  const resetAll = () => { setPeriodFrom(allMonths[0]); setPeriodTo(allMonths[allMonths.length - 1]); setCountry("all"); setDrill(null); };

  return (
    <div className="page">
      <div className="page-header">
        <h2>{tr.cross.title}</h2>
        <p className="subtitle">{tr.cross.sub(cross.window.start, cross.window.end, cross.summary.months_in_window, cross.summary.months_with_both_sources)}</p>
      </div>

      <SectionNav sections={[
        { id: "apercu", label: tr.cross.navOverview },
        { id: "tendance", label: tr.cross.trend },
        { id: "details", label: tr.cross.navDetails },
      ]} />

      <div className="source-banner">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0a8 8 0 100 16A8 8 0 008 0zm1 12H7v-2h2v2zm0-4H7V4h2v4z" /></svg>
        <span>
          <strong>{tr.cross.banner.split(" — ")[0]} —</strong> {tr.cross.banner.split(" — ").slice(1).join(" — ")}
          &nbsp;Sources : <a href="https://www.ifs-certification.com/" target="_blank" rel="noopener noreferrer">IFS</a> &amp; <a href="https://food.ec.europa.eu/food-safety/acn/ffn-monthly_en" target="_blank" rel="noopener noreferrer">EC FFN</a>
        </span>
      </div>

      <div className="controls" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span className="meta">{tr.cross.from}</span>
          <select value={periodFrom} onChange={e => setPeriodFrom(e.target.value)}>{allMonths.map(m => <option key={m}>{m}</option>)}</select>
        </label>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span className="meta">{tr.cross.to}</span>
          <select value={periodTo} onChange={e => setPeriodTo(e.target.value)}>{allMonths.map(m => <option key={m}>{m}</option>)}</select>
        </label>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span className="meta">{tr.cross.country}</span>
          <select value={country} onChange={e => { setCountry(e.target.value); setDrill(null); }}>
            <option value="all">{tr.cross.allCountries}</option>
            {countryOptions.map(c => <option key={c}>{c}</option>)}
          </select>
        </label>
      </div>

      {activeFilters.length > 0 && (
        <div className="chip-row">
          <span className="meta">{tr.cross.activeFilters} :</span>
          {activeFilters.map(f => (
            <span key={f.label} className="chip"><b>{f.label}</b><button className="chip-x" onClick={f.clear} aria-label={tr.cross.remove}>✕</button></span>
          ))}
          <button className="btn-mini" onClick={resetAll}>✕ {tr.cross.reset}</button>
        </div>
      )}

      <div id="apercu" className="stat-grid">
        <div className="stat-card"><div className="stat-value">{totals.ffn.toLocaleString()}</div><div className="stat-label">{tr.cross.colFfn}{country !== "all" ? ` — ${country}` : ` ${tr.cross.windowSuffix}`}</div></div>
        <div className="stat-card accent"><div className="stat-value">{totals.ifs.toLocaleString()}</div><div className="stat-label">{tr.cross.colIfs}{country !== "all" ? ` — ${country}` : ` ${tr.cross.windowSuffix}`}</div></div>
        <div className="stat-card warn"><div className="stat-value">{overlapCountries.both.length}</div><div className="stat-label">{lang === "fr" ? "Pays dans les DEUX sources" : "Countries in BOTH sources"}</div></div>
        <div className="stat-card"><div className="stat-value">{rows.length}{totals.missing > 0 && <span className="badge-missing" title={tr.cross.missingNote}> · {totals.missing} {tr.cross.missing}</span>}</div><div className="stat-label">{lang === "fr" ? "mois affichés" : "months shown"}</div></div>
      </div>

      <div id="tendance" className="card">
        <h3>{tr.cross.timeline}</h3>
        <div className="meta" style={{ marginBottom: 6 }}>{tr.cross.trendHint} · {tr.cross.clickMonth}</div>
        <div className="hide-mobile" style={{ overflowX: "auto" }}>
          <table>
            <thead><tr><th>{tr.cross.colIfs ? (lang === "fr" ? "Mois" : "Month") : ""}</th><th>{tr.cross.colFfn}</th><th>Δ</th><th>{tr.cross.colIfs}</th><th>Δ</th><th>{lang === "fr" ? "Top produit FFN" : "FFN top product"}</th><th>{lang === "fr" ? "Sources" : "Sources"}</th></tr></thead>
            <tbody>
              {rows.map((c, i) => (
                <tr key={c.month} className={drill === c.month ? "row-active" : ""} style={{ opacity: c.ifs_v === null ? 0.55 : 1, cursor: "pointer" }} onClick={() => setDrill(drill === c.month ? null : c.month)} aria-expanded={drill === c.month}>
                  <td className="mono">{c.month} <span style={{ opacity: 0.5 }}>{drill === c.month ? "▾" : "▸"}</span></td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div className="bar-track" style={{ width: 80, height: 8 }}><div className="bar-fill warn" style={{ width: `${(c.ffn_v / maxFfn) * 100}%`, height: 8 }} /></div>
                      <b>{c.ffn_v}</b>
                    </div>
                  </td>
                  <td><span className={trendClass(trendOf(i, "ffn_v"))}>{trendOf(i, "ffn_v")}</span></td>
                  <td>
                    {c.ifs_v !== null ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div className="bar-track" style={{ width: 80, height: 8 }}><div className="bar-fill" style={{ width: `${(c.ifs_v / maxIfs) * 100}%`, height: 8 }} /></div>
                        <b>{c.ifs_v}</b>
                      </div>
                    ) : <span className="badge-missing" title={tr.cross.missingNote}>{tr.cross.missing}</span>}
                  </td>
                  <td><span className={trendClass(trendOf(i, "ifs_v"))}>{trendOf(i, "ifs_v")}</span></td>
                  <td title={c.ffn_top_product || ""}>{country === "all" ? (c.ffn_top_product?.slice(0, 28) || "—") : "—"}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <Link to={`/ffn?report=${c.month}`} aria-label={`${tr.cross.openFfn} ${c.month}`}>{lang === "fr" ? "FFN" : "FFN"}</Link>
                    {" · "}<a href={c.ffn_url} target="_blank" rel="noopener noreferrer" aria-label="FFN PDF">PDF</a>
                    {c.ifs_url && <><br />{lang === "fr" ? "Carte" : "Map"} · <a href={c.ifs_url} target="_blank" rel="noopener noreferrer" aria-label={`${tr.cross.openIfs} ${c.month}`}>PDF</a></>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mobile-cards show-mobile-only" style={{ flexDirection: "column", gap: 10 }}>
          {rows.map((c, i) => (
            <div
              key={c.month}
              className={"case-card" + (drill === c.month ? " active" : "")}
              style={{ opacity: c.ifs_v === null ? 0.6 : 1, cursor: "pointer" }}
              onClick={() => setDrill(drill === c.month ? null : c.month)}
              aria-expanded={drill === c.month}
            >
              <div className="case-card-top">
                <span className="mono">{c.month}</span>
                <span style={{ opacity: 0.6 }}>{drill === c.month ? "▾" : "▸"}</span>
              </div>
              <div className="case-card-row"><span className="case-card-label">{tr.cross.colFfn}</span>{c.ffn_v} <span className={trendClass(trendOf(i, "ffn_v"))}>{trendOf(i, "ffn_v")}</span></div>
              <div className="case-card-row">
                <span className="case-card-label">{tr.cross.colIfs}</span>
                {c.ifs_v !== null ? <>{c.ifs_v} <span className={trendClass(trendOf(i, "ifs_v"))}>{trendOf(i, "ifs_v")}</span></> : <span className="badge-missing" title={tr.cross.missingNote}>{tr.cross.missing}</span>}
              </div>
              {country === "all" && c.ffn_top_product && (
                <div className="case-card-row"><span className="case-card-label">{lang === "fr" ? "Top produit FFN" : "FFN top product"}</span>{c.ffn_top_product.slice(0, 34)}</div>
              )}
              <div className="case-card-row" onClick={e => e.stopPropagation()}>
                <Link to={`/ffn?report=${c.month}`} aria-label={`${tr.cross.openFfn} ${c.month}`}>FFN</Link>
                {" · "}<a href={c.ffn_url} target="_blank" rel="noopener noreferrer" aria-label="FFN PDF">PDF</a>
                {c.ifs_url && <>{" · "}{lang === "fr" ? "Carte" : "Map"} <a href={c.ifs_url} target="_blank" rel="noopener noreferrer" aria-label={`${tr.cross.openIfs} ${c.month}`}>PDF</a></>}
              </div>
            </div>
          ))}
        </div>
        {drill && drillData && (
          <div className="drill-panel" style={{ marginTop: 8, padding: "12px 14px", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", background: "var(--bg-elevated)" }}>
            <strong className="mono">{drill}</strong>
            <div className="grid-2" style={{ marginTop: 8 }}>
              <div>
                <h4 style={{ margin: "0 0 6px", fontSize: 13 }}>{lang === "fr" ? "IFS — rappels par pays (top 8)" : "IFS — recalls by country (top 8)"}</h4>
                {drillData.ifsRecalls.length ? drillData.ifsRecalls.map(r => (
                  <div key={r.country_normalized} className="bar-row">
                    <span className="bar-label"><Link to={`/origine/${encodeURIComponent(r.country_normalized)}`}>{r.country_normalized}</Link></span>
                    <div className="bar-track"><div className="bar-fill" style={{ width: `${(r.value / (drillData.ifsRecalls[0]?.value || 1)) * 100}%` }} /></div>
                    <span className="bar-value">{r.value}</span>
                  </div>
                )) : <div className="meta">{lang === "fr" ? "Aucune donnée IFS pour ce mois." : "No IFS data for this month."}</div>}
              </div>
              <div>
                <h4 style={{ margin: "0 0 6px", fontSize: 13 }}>{lang === "fr" ? `FFN — ${drillData.ffnCasesCount} cas (top origines)` : `FFN — ${drillData.ffnCasesCount} cases (top origins)`}</h4>
                {drillData.ffnTopOrigins.length ? drillData.ffnTopOrigins.map(([o, n]) => (
                  <div key={o} className="bar-row">
                    <span className="bar-label"><Link to={`/origine/${encodeURIComponent(o)}`}>{o}</Link></span>
                    <div className="bar-track"><div className="bar-fill warn" style={{ width: `${(n / (drillData.ffnTopOrigins[0]?.[1] || 1)) * 100}%` }} /></div>
                    <span className="bar-value">{n}</span>
                  </div>
                )) : <div className="meta">{lang === "fr" ? "Aucun cas FFN." : "No FFN cases."}</div>}
              </div>
            </div>
          </div>
        )}
        <div className="meta" style={{ marginTop: 8 }}>{tr.overview.separate} {totals.missing > 0 && <>· {totals.missing} {tr.cross.missingNote}</>}</div>
      </div>

      <div id="details" className="grid-2">
        <div className="card">
          <h3>{tr.cross.topFfn}{country !== "all" ? ` — ${country}` : ""}</h3>
          <div className="bar-list">{byProductFfn.map(([p, c]) => (
            <div key={p} className="bar-row"><span className="bar-label" title={p}>{p.slice(0, 34)}</span><div className="bar-track"><div className="bar-fill warn" style={{ width: `${(c / byProductFfnMax) * 100}%` }} /></div><span className="bar-value">{c}</span></div>
          ))}</div>
        </div>
        <div className="card">
          <h3>{tr.cross.commonTitle}</h3>
          <div className="meta" style={{ marginBottom: 8 }}>{tr.cross.commonHint}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {overlapCountries.both.map(c => (
              <Link key={c} to={`/origine/${encodeURIComponent(c)}`} className="chip" style={{ textDecoration: "none" }}
                onClick={() => { setCountry(c); setPeriodFrom(allMonths[0]); setPeriodTo(allMonths[allMonths.length - 1]); }}>
                <b>{c}</b>
              </Link>
            ))}
          </div>
          <div className="meta" style={{ marginTop: 10 }}>
            + <b>{overlapCountries.ffnOnly}</b> {lang === "fr" ? "FFN-only" : "FFN-only"} (origines exotiques) · <b>{overlapCountries.ifsOnly}</b> IFS-only ({lang === "fr" ? "hors ACN UE" : "non-EU ACN"}).
            <br />{lang === "fr" ? "FFN couvre uniquement cross-border ACN → biais UE. IFS couvre monde via rappels nationaux." : "FFN covers EU cross-border ACN only → EU bias. IFS covers the world via national recalls."}
          </div>
        </div>
      </div>
    </div>
  );
}
