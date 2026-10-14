import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Lang } from "../i18n";
import type { FfnCase, FoodFraudEntry, RiskIndex } from "../types";
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

/** IFS/JRC press fraud cases with press + IFS PDF links. */
export function FraudCaseTable({ cases, index, lang, filename }: { cases: FoodFraudEntry[]; index: RiskIndex; lang: Lang; filename: string }) {
  const fr = lang === "fr";
  const sorted = useMemo(() => [...cases].sort((a, b) => b.publication_date.localeCompare(a.publication_date)), [cases]);
  const reasons = (c: FoodFraudEntry) => (c.reasons?.length ? c.reasons.map((r) => index.labels.reasons[r]?.[lang] ?? r).join(", ") : c.reason_normalized);
  const exportCsv = () => downloadCsv(filename, sorted.map((c) => ({
    [fr ? "Rapport IFS" : "IFS report"]: c.publication_date,
    [fr ? "Détecté" : "Detected"]: c.detected_in,
    [fr ? "Produit" : "Product"]: c.product_normalized,
    [fr ? "Type de fraude" : "Fraud type"]: reasons(c),
    [fr ? "Pays" : "Country"]: (c.countries || [c.country_normalized]).join(" / "),
    [fr ? "Article de presse" : "Press article"]: c.press_url || "",
    [fr ? "Rapport IFS (PDF)" : "IFS report (PDF)"]: c.source_url,
  })), lang);

  return (
    <div>
      <div className="table-head">
        <span className="meta">{fmtNum(cases.length, lang)} {fr ? "cas de fraude rapportés par la presse" : "press-reported fraud cases"}</span>
        <button type="button" className="btn" onClick={exportCsv} disabled={!cases.length}>{fr ? "Exporter CSV" : "Export CSV"}</button>
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead><tr>
            <th>{fr ? "Rapport IFS" : "IFS report"}</th><th>{fr ? "Produit" : "Product"}</th><th>{fr ? "Type de fraude" : "Fraud type"}</th>
            <th>{fr ? "Pays" : "Country"}</th><th>{fr ? "Sources" : "Sources"}</th>
          </tr></thead>
          <tbody>
            {sorted.map((c, i) => (
              <tr key={i}>
                <td className="nowrap">{fmtMonth(c.publication_date, lang, "short")}{c.detected_in && <div className="cell-sub">{fr ? "détecté" : "detected"} {c.detected_in}</div>}</td>
                <td>{c.product_normalized}</td>
                <td>{reasons(c)}{c.needs_review && <div className="cell-sub warn-text">{fr ? "ligne incomplète dans le PDF" : "incomplete row in the PDF"}</div>}</td>
                <td>{(c.countries?.length ? c.countries : [c.country_normalized]).map((o, j) => <span key={o}>{j > 0 && " / "}<Link to={`/origine/${encodeURIComponent(o)}`}>{o}</Link></span>)}</td>
                <td className="nowrap">
                  {c.press_url && <a href={c.press_url} target="_blank" rel="noopener noreferrer">{fr ? "Article" : "Article"}</a>}
                  {c.press_url && " · "}
                  <a href={c.source_url} target="_blank" rel="noopener noreferrer">{fr ? "Rapport IFS" : "IFS report"}</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
