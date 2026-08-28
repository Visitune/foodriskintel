import { useState, useMemo } from "react";
import type { Dataset, FoodFraudEntry } from "./types";
import { t } from "./i18n";
import type { Lang } from "./i18n";

export default function FraudExplorer({ data, lang }: { data: Dataset; lang: Lang }) {
  const tr = t[lang];
  const [reasonFilter, setReasonFilter] = useState<string>("all");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [sortCol, setSortCol] = useState<keyof FoodFraudEntry>("month_num");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const reasons = useMemo(
    () =>
      Array.from(new Set(data.food_fraud.map((f) => f.reason_normalized))).sort(),
    [data]
  );

  const countries = useMemo(
    () =>
      Array.from(
        new Set(data.food_fraud.map((f) => f.country_normalized))
      ).sort(),
    [data]
  );

  const filtered = useMemo(() => {
    let result = data.food_fraud;
    if (reasonFilter !== "all") {
      result = result.filter((f) => f.reason_normalized === reasonFilter);
    }
    if (countryFilter !== "all") {
      result = result.filter((f) => f.country_normalized === countryFilter);
    }
    result = [...result].sort((a, b) => {
      const va = a[sortCol];
      const vb = b[sortCol];
      if (typeof va === "string" && typeof vb === "string") {
        return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      const na = Number(va) || 0;
      const nb = Number(vb) || 0;
      return sortDir === "asc" ? na - nb : nb - na;
    });
    return result;
  }, [data, reasonFilter, countryFilter, sortCol, sortDir]);

  const toggleSort = (col: keyof FoodFraudEntry) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("desc");
    }
  };

  // Aggregate by product
  const byProduct = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((f) => {
      map[f.product_normalized] = (map[f.product_normalized] || 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);
  }, [filtered]);

  // Aggregate by month
  const byMonth = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((f) => {
      const key = `${f.month.slice(0, 3)} ${f.year}`;
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map);
  }, [filtered]);

  return (
    <div className="page">
      <div className="page-header">
        <h2>{tr.fraudIfs.title}</h2>
        <p className="subtitle">
          {tr.fraudIfs.sub(filtered.length, reasons.length, countries.length)}
        </p>
      </div>
      <div className="source-banner" style={{flexDirection:'column', alignItems:'flex-start', gap:6}}>
        <span><strong>{lang==="fr" ? "Source : IFS Trend Risk Reports — section Food Fraud" : "Source: IFS Trend Risk Reports — Food Fraud section"}</strong> {lang==="fr" ? "reprise des" : "from the"} <strong>JRC Food Fraud Monthly Reports</strong> (KC-FFQ, DG JRC). <a href="https://knowledge4policy.ec.europa.eu/jrc-food-fraud-monthly-report_en" target="_blank" rel="noopener noreferrer">JRC Monthly Report</a> (ex : <a href="https://knowledge4policy.ec.europa.eu/sites/default/files/202604.pdf" target="_blank" rel="noopener noreferrer">202604.pdf</a>).</span>
        <span style={{fontSize:12, opacity:0.9}}>
          {lang==="fr" ? "Nature JRC : source officielle UE fondée sur veille presse / EMM — screening quotidien d'articles mondiaux classifiés par le JRC. Chaque cas IFS cite son lien presse. Pour le réseau officiel UE (RASFF/AAC/FFN), voir FFN Explorer." : "JRC nature: official EU source based on press / EMM media monitoring — daily screening of world press classified by JRC. Each IFS case links to its press source. For the official EU network (RASFF/AAC/FFN), see FFN Explorer."}
        </span>
      </div>

      <div className="controls">
        <select value={reasonFilter} onChange={(e) => setReasonFilter(e.target.value)}>
          <option value="all">{lang==="fr"?"Tous types de fraude":"All fraud types"}</option>
          {reasons.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)}>
          <option value="all">{lang==="fr"?"Tous pays":"All countries"}</option>
          {countries.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {(reasonFilter!=="all"||countryFilter!=="all") && (
        <div className="chip-row">
          <span className="meta">{lang==="fr"?"Filtres actifs :":"Active filters:"}</span>
          {reasonFilter!=="all" && <span className="chip"><b>{reasonFilter}</b><button className="chip-x" aria-label={lang==="fr"?"Retirer le filtre type":"Remove type filter"} onClick={()=>setReasonFilter("all")}>✕</button></span>}
          {countryFilter!=="all" && <span className="chip"><b>{countryFilter}</b><button className="chip-x" aria-label={lang==="fr"?"Retirer le filtre pays":"Remove country filter"} onClick={()=>setCountryFilter("all")}>✕</button></span>}
          <button className="btn-mini" onClick={()=>{setReasonFilter("all");setCountryFilter("all");}}>{lang==="fr"?"✕ Réinitialiser les filtres":"✕ Reset filters"}</button>
        </div>
      )}

      <div className="grid-2">
        <div className="card">
          <h3>{lang==="fr"?"Par type de produit":"By Product Type"}</h3>
          <div className="bar-list">
            {byProduct.map(([product, count]) => (
              <div key={product} className="bar-row">
                <span className="bar-label">{product}</span>
                <div className="bar-track">
                  <div
                    className="bar-fill warn"
                    style={{ width: `${(count / byProduct[0][1]) * 100}%` }}
                  />
                </div>
                <span className="bar-value">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3>{lang==="fr"?"Par période":"By Period"}</h3>
          <div className="mini-timeline">
            {byMonth.map(([month, count]) => (
              <div key={month} className="mini-bar-wrapper">
                <div className="mini-bar-container">
                  <div
                    className="mini-bar"
                    style={{
                      height: `${(count / Math.max(...byMonth.map((m) => m[1]))) * 100}%`,
                    }}
                  />
                </div>
                <span className="mini-label">{month}</span>
                <span className="mini-count">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <h3>{lang==="fr"?"Détail des cas":"Cases Detail"}</h3>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {(
                  [
                    ["year", lang==="fr"?"Année":"Year"],
                    ["month_num", lang==="fr"?"Mois":"Month"],
                    ["product_normalized", lang==="fr"?"Produit":"Product"],
                    ["reason_normalized", lang==="fr"?"Motif":"Reason"],
                    ["country_normalized", lang==="fr"?"Pays":"Country"],
                  ] as [keyof FoodFraudEntry, string][]
                ).map(([col, label]) => (
                  <th
                    key={col}
                    className="sortable"
                    aria-sort={
                      sortCol === col
                        ? sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <button type="button" onClick={() => toggleSort(col)}>
                      {label} {sortCol === col ? (sortDir === "asc" ? "↑" : "↓") : ""}
                    </button>
                  </th>
                ))}
                <th>{lang==="fr"?"Détecté en":"Detected in"}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f, i) => (
                <tr key={i}>
                  <td className="mono">{f.year}</td>
                  <td>{f.month}</td>
                  <td>{f.product_normalized}</td>
                  <td>
                    <span className="tag">{f.reason_normalized}</span>
                  </td>
                  <td>{f.country_normalized}</td>
                  <td>{f.detected_in || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
