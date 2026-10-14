import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Lang } from "../i18n";
import type { FfnCase, JrcIncident, RiskIndex } from "../types";
import { downloadCsv, fmtMonth, fmtNum } from "../format";

export const caseOrigins = (c: FfnCase) =>
  (c.origins_list && c.origins_list.length ? c.origins_list : [c.origin_normalized]).filter((o) => o !== "Unknown");

export function countBy<T>(items: T[], key: (x: T) => string | string[] | undefined): [string, number][] {
  const m = new Map<string, number>();
  for (const it of items) {
    const k = key(it);
    for (const v of Array.isArray(k) ? k : k ? [k] : []) m.set(v, (m.get(v) || 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

const PAGE = 50;

/** Detailed FFN cases with PDF links, paginated, exportable. */
export function FfnCaseTable({ cases, index, lang, filename }: { cases: FfnCase[]; index: RiskIndex; lang: Lang; filename: string }) {
  const fr = lang === "fr";
  const [shown, setShown] = useState(PAGE);
  const sorted = useMemo(() => [...cases].sort((a, b) => b.report_id.localeCompare(a.report_id)), [cases]);
  const exportCsv = () => downloadCsv(filename, sorted.map((c) => ({
    [fr ? "Mois du rapport FFN" : "FFN report month"]: c.report_id,
    [fr ? "Produit" : "Commodity"]: c.commodity,
    [fr ? "Catégorie" : "Category"]: c.product_category,
    [fr ? "Type de non-conformité" : "Non-compliance type"]: index.labels.groups[c.classification_group || "unknown"]?.[lang] ?? c.classification,
    [fr ? "Détail" : "Detail"]: c.issue,
    [fr ? "Origine" : "Origin"]: caseOrigins(c).join(" / ") || "—",
    [fr ? "Notifié par" : "Notified by"]: c.notified_by_normalized,
    [fr ? "Source (PDF DG SANTE)" : "Source (DG SANTE PDF)"]: c.source_url,
  })), lang);

  return (
    <div>
      <div className="table-head">
        <span className="meta">{fmtNum(cases.length, lang)} {fr ? "suspicions UE (FFN)" : "EU suspicions (FFN)"}</span>
        <button type="button" className="btn" onClick={exportCsv} disabled={!cases.length}>{fr ? "Exporter CSV" : "Export CSV"}</button>
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead><tr>
            <th>{fr ? "Mois" : "Month"}</th><th>{fr ? "Produit" : "Product"}</th><th>{fr ? "Problème signalé" : "Reported issue"}</th>
            <th>{fr ? "Origine" : "Origin"}</th><th>{fr ? "Notifié par" : "Notified by"}</th><th>{fr ? "Source" : "Source"}</th>
          </tr></thead>
          <tbody>
            {sorted.slice(0, shown).map((c, i) => (
              <tr key={i}>
                <td className="nowrap">{fmtMonth(c.report_id, lang, "short")}</td>
                <td>{c.commodity || "—"}<div className="cell-sub">{c.product_category}</div></td>
                <td><span className="tag">{index.labels.groups[c.classification_group || "unknown"]?.[lang]}</span><div className="cell-sub">{c.issue}</div></td>
                <td>{caseOrigins(c).map((o, j) => <span key={o}>{j > 0 && " / "}<Link to={`/origine/${encodeURIComponent(o)}`}>{o}</Link></span>)}{!caseOrigins(c).length && "—"}</td>
                <td>{c.notified_by_normalized}</td>
                <td><a href={c.source_url} target="_blank" rel="noopener noreferrer">PDF</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {shown < sorted.length && (
        <button type="button" className="btn more" onClick={() => setShown((s) => s + PAGE)}>
          {fr ? `Afficher ${Math.min(PAGE, sorted.length - shown)} de plus` : `Show ${Math.min(PAGE, sorted.length - shown)} more`} ({fmtNum(sorted.length - shown, lang)})
        </button>
      )}
    </div>
  );
}

const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };

/** JRC press fraud incidents, with links to the articles and to the JRC report. */
export function FraudCaseTable({ cases, index, lang, filename }: { cases: JrcIncident[]; index: RiskIndex; lang: Lang; filename: string }) {
  const fr = lang === "fr";
  const [shown, setShown] = useState(PAGE);
  const sorted = useMemo(() => [...cases].sort((a, b) => (b.date || b.month).localeCompare(a.date || a.month)), [cases]);
  const reasons = (c: JrcIncident) => c.reasons.map((r) => index.labels.reasons[r]?.[lang] ?? r).join(", ") || "—";
  const exportCsv = () => downloadCsv(filename, sorted.map((c) => ({
    [fr ? "Date" : "Date"]: c.date || c.month,
    [fr ? "Description" : "Description"]: c.description,
    [fr ? "Catégories" : "Categories"]: c.categories.join(" / "),
    [fr ? "Type de fraude" : "Fraud type"]: reasons(c),
    [fr ? "Pays" : "Country"]: c.countries.join(" / "),
    [fr ? "Articles de presse" : "Press articles"]: c.urls.join(" "),
    [fr ? "Rapport JRC (PDF)" : "JRC report (PDF)"]: c.pdf_url,
  })), lang);

  return (
    <div>
      <div className="table-head">
        <span className="meta">{fmtNum(cases.length, lang)} {fr ? "incidents de fraude rapportés par la presse" : "press-reported fraud incidents"}</span>
        <button type="button" className="btn" onClick={exportCsv} disabled={!cases.length}>{fr ? "Exporter CSV" : "Export CSV"}</button>
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead><tr>
            <th>{fr ? "Date" : "Date"}</th><th>{fr ? "Ce qui s'est passé" : "What happened"}</th><th>{fr ? "Type de fraude" : "Fraud type"}</th>
            <th>{fr ? "Pays" : "Country"}</th><th>{fr ? "Sources" : "Sources"}</th>
          </tr></thead>
          <tbody>
            {sorted.slice(0, shown).map((c) => (
              <tr key={c.id}>
                <td className="nowrap">{c.date ? new Date(c.date).toLocaleDateString(fr ? "fr-FR" : "en-GB") : fmtMonth(c.month, lang, "short")}</td>
                <td>{c.description || "—"}{c.categories.length > 0 && <div className="cell-sub">{c.categories.join(" · ")}</div>}</td>
                <td>{reasons(c)}</td>
                <td>{c.countries.map((o, j) => <span key={o}>{j > 0 && " / "}<Link to={`/origine/${encodeURIComponent(o)}`}>{o}</Link></span>)}{!c.countries.length && "—"}</td>
                <td>
                  {c.urls.slice(0, 3).map((u) => <div key={u}><a href={u} target="_blank" rel="noopener noreferrer">{host(u)}</a></div>)}
                  <div><a href={c.pdf_url} target="_blank" rel="noopener noreferrer">{fr ? "Rapport JRC" : "JRC report"}</a></div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {shown < sorted.length && (
        <button type="button" className="btn more" onClick={() => setShown((x) => x + PAGE)}>
          {fr ? `Afficher ${Math.min(PAGE, sorted.length - shown)} de plus` : `Show ${Math.min(PAGE, sorted.length - shown)} more`} ({fmtNum(sorted.length - shown, lang)})
        </button>
      )}
    </div>
  );
}

export function Card({ title, children, aside, id }: { title: React.ReactNode; children: React.ReactNode; aside?: React.ReactNode; id?: string }) {
  return (
    <section className="card" id={id}>
      <div className="card-head"><h3>{title}</h3>{aside}</div>
      {children}
    </section>
  );
}
