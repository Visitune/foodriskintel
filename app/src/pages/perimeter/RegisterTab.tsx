import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fmtNum } from "../../format";
import { usePerimeter, type BulkPatch, type FollowUp } from "../../perimeter/PerimeterContext";
import { deadlines } from "../../perimeter/review";
import { FOLLOWUP_STATUSES, nextReview, PERIODS, periodLabel, reasonLabel, sourceLabel, statusLabel, type CaseSource } from "../../perimeter/model";
import { fmtDay, today, type PerimeterView } from "./view";

const PAGE = 100;
const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** The register: a readable list, filters, and one panel to edit a case. */
export default function RegisterTab({ view }: { view: PerimeterView }) {
  const { lang, caseById, complete } = view;
  const fr = lang === "fr";
  const P = usePerimeter();
  const [params, setParams] = useSearchParams();
  const [openKey, setOpenKey] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [shown, setShown] = useState(PAGE);

  const filters = {
    status: params.get("statut") ?? "",
    item: params.get("element") ?? "",
    source: params.get("source") ?? "",
    due: params.get("echeance") ?? "",
    text: params.get("q") ?? "",
  };
  const setFilter = (name: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    setParams(next, { replace: true });
    setShown(PAGE);
    // A hidden row must never stay selected for a bulk change.
    setSelected(new Set());
  };

  const day = today();
  const late = deadlines(P.pkg, day);
  const lateKeys = new Set([...late.reviews, ...late.actions].map((f) => f.case_key));
  const itemLabel = (id: string) => P.pkg.perimeter.find((i) => i.id === id)?.label ?? "—";
  const summaryOf = (f: FollowUp) => caseById.get(f.case_key)?.summary ?? f.case_key.split("|").slice(0, 2).join(" ");
  const dueOf = (f: FollowUp) => (f.status === "action_prevue" ? f.due_date : nextReview(f));

  const rows = P.pkg.follow_up
    .filter((f) => (!filters.status || f.status === filters.status)
      && (!filters.item || f.item_id === filters.item)
      && (!filters.source || f.source === filters.source)
      && (filters.due !== "retard" || lateKeys.has(f.case_key))
      && (filters.due !== "prevue" || !!dueOf(f))
      && (!filters.text || fold(`${summaryOf(f)} ${f.control_measure} ${f.owner} ${f.ifs_ref} ${f.comment}`).includes(fold(filters.text))))
    .sort((a, b) => b.decided_at.localeCompare(a.decided_at));
  const visible = rows.slice(0, shown);
  const open = P.pkg.follow_up.find((f) => f.case_key === openKey);
  const picked = rows.filter((f) => selected.has(f.case_key)).map((f) => f.case_key);

  if (!P.pkg.follow_up.length)
    return <p className="meta">{fr ? "Le registre se remplit avec les décisions de vos revues." : "The register fills up with your review decisions."}</p>;

  const select = (name: string, label: string, value: string, options: [string, string][]) => (
    <label className="field">{label}
      <select value={value} onChange={(e) => setFilter(name, e.target.value)}>
        <option value="">{fr ? "Tous" : "All"}</option>
        {options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
      </select>
    </label>
  );

  return (
    <div className="register">
      <div className="filters">
        {select("statut", fr ? "Statut" : "Status", filters.status, FOLLOWUP_STATUSES.map((s) => [s, statusLabel(s, lang)]))}
        {select("element", fr ? "Élément" : "Item", filters.item, P.pkg.perimeter.map((i) => [i.id, i.label]))}
        {select("source", "Source", filters.source, (["ffn", "jrc", "ifs"] as CaseSource[]).map((s) => [s, sourceLabel(s, lang)]))}
        {select("echeance", fr ? "Échéance" : "Deadline", filters.due, [["retard", fr ? "Dépassée" : "Overdue"], ["prevue", fr ? "Avec échéance" : "Has a deadline"]])}
        <label className="field">{fr ? "Rechercher" : "Search"}<input type="search" value={filters.text} onChange={(e) => setFilter("q", e.target.value)} /></label>
      </div>
      <p className="meta" role="status">{fmtNum(rows.length, lang)} {fr ? "cas affichés sur" : "of"} {fmtNum(P.pkg.follow_up.length, lang)}</p>

      {picked.length > 0 && <BulkBar view={view} keys={picked} onDone={() => setSelected(new Set())} />}

      <div className={open ? "register-cols with-panel" : "register-cols"}>
        <div className="table-scroll">
          <table className="data-table register-table">
            <thead><tr>
              <th><input type="checkbox" aria-label={fr ? "Tout sélectionner" : "Select all"}
                checked={visible.length > 0 && visible.every((f) => selected.has(f.case_key))}
                onChange={(e) => setSelected(new Set(e.target.checked ? visible.map((f) => f.case_key) : []))} /></th>
              <th>{fr ? "Cas" : "Case"}</th><th>{fr ? "Décision" : "Decision"}</th><th>{fr ? "Échéance" : "Deadline"}</th>
            </tr></thead>
            <tbody>
              {visible.map((f) => {
                const due = dueOf(f);
                return (
                  <tr key={f.case_key} className={f.case_key === openKey ? "on" : ""}>
                    <td><input type="checkbox" checked={selected.has(f.case_key)} aria-label={`${fr ? "Sélectionner" : "Select"} ${summaryOf(f)}`}
                      onChange={(e) => setSelected((prev) => { const next = new Set(prev); if (e.target.checked) next.add(f.case_key); else next.delete(f.case_key); return next; })} /></td>
                    <td>
                      <button type="button" className="link-btn row-open" aria-expanded={f.case_key === openKey} onClick={() => setOpenKey(f.case_key)}>{summaryOf(f)}</button>
                      <div className="cell-sub">{itemLabel(f.item_id)} · {f.source.toUpperCase()}{!caseById.has(f.case_key) && complete ? ` · ${fr ? "plus visible dans la source actuelle" : "no longer in the current source"}` : ""}</div>
                    </td>
                    <td><span className={`state state-${f.status}`}>{statusLabel(f.status, lang)}</span>
                      <div className="cell-sub">{[reasonLabel(f.decision_reason, lang), f.control_measure, f.owner].filter(Boolean).join(" · ")}</div></td>
                    <td className="nowrap">{due ? <span className={lateKeys.has(f.case_key) ? "late" : ""}>{fmtDay(due, lang)}{lateKeys.has(f.case_key) ? (fr ? " (dépassée)" : " (overdue)") : ""}</span> : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {shown < rows.length && <button type="button" className="btn more" onClick={() => setShown((n) => n + PAGE)}>{fr ? "Afficher la suite" : "Show more"} ({fmtNum(rows.length - shown, lang)})</button>}
        </div>
        {open && <CasePanel key={open.case_key} view={view} entry={open} itemLabel={itemLabel(open.item_id)} title={summaryOf(open)} onClose={() => setOpenKey("")} />}
      </div>
    </div>
  );
}

function CasePanel({ view, entry: f, title, itemLabel, onClose }: { view: PerimeterView; entry: FollowUp; title: string; itemLabel: string; onClose: () => void }) {
  const { lang, caseById } = view;
  const fr = lang === "fr";
  const P = usePerimeter();
  const ref = caseById.get(f.case_key);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); heading.current?.scrollIntoView({ block: "nearest" }); }, []);

  const input = (field: "control_measure" | "owner" | "date_reviewed" | "due_date" | "comment" | "ifs_ref", label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="field">{label}<input type="text" maxLength={500} value={f[field]} onChange={(e) => P.setFollowUp(f.case_key, field, e.target.value)} {...extra} /></label>
  );
  const url = f.url || ref?.url;

  return (
    <aside className="case-panel" aria-label={fr ? "Détail du cas" : "Case detail"} onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}>
      <div className="panel-head">
        <h4 tabIndex={-1} ref={heading}>{title}</h4>
        <button type="button" className="btn ghost" onClick={onClose}>{fr ? "Fermer" : "Close"}</button>
      </div>
      <p className="meta">{itemLabel}{ref ? ` · ${ref.reference}` : ""}{url ? <> · <a href={url} target="_blank" rel="noopener noreferrer">source</a></> : null}</p>
      <label className="field">{fr ? "Statut" : "Status"}
        <select value={f.status} onChange={(e) => P.setFollowUp(f.case_key, "status", e.target.value)}>
          {FOLLOWUP_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s, lang)}</option>)}
        </select>
      </label>
      {f.decision_reason && <p className="meta">{reasonLabel(f.decision_reason, lang)}</p>}
      {input("control_measure", fr ? "Mesure ou action" : "Measure or action", { list: "register-measures" })}
      <datalist id="register-measures">{P.pkg.measures.map((m) => <option key={m} value={m} />)}</datalist>
      {input("owner", fr ? "Responsable" : "Owner")}
      {input("date_reviewed", fr ? "Date de la décision ou dernière revue" : "Decision or last review date", { type: "date" })}
      {f.status === "action_prevue" && input("due_date", fr ? "Échéance" : "Due date", { type: "date" })}
      {f.status === "evalue" && (
        <>
          <label className="field">{fr ? "Périodicité de revue" : "Review period"}
            <select value={f.every_months} onChange={(e) => P.setEvery(f.case_key, Number(e.target.value))}>
              {[...new Set([...PERIODS, f.every_months])].map((n) => <option key={n} value={n}>{periodLabel(n, lang)}</option>)}
            </select>
          </label>
          {f.frequency && <p className="meta">{fr ? "Fréquence saisie auparavant : " : "Previously typed frequency: "}{f.frequency}</p>}
          {nextReview(f) && <p className="meta">{fr ? "Prochaine revue : " : "Next review: "}{fmtDay(nextReview(f), lang)}</p>}
          <button type="button" className="btn" onClick={() => P.setFollowUp(f.case_key, "date_reviewed", today())}>{fr ? "Revue faite aujourd'hui" : "Reviewed today"}</button>
        </>
      )}
      {input("ifs_ref", fr ? "Exigence IFS de référence (facultatif)" : "IFS requirement (optional)")}
      {input("comment", fr ? "Commentaire" : "Comment")}
      <button type="button" className="btn ghost" onClick={() => { P.removeFollowUp(f.case_key); onClose(); }}>{fr ? "Retirer du registre" : "Remove from register"}</button>
    </aside>
  );
}

/** Apply the same measure, owner or period to several cases. Empty fields change nothing. */
function BulkBar({ view, keys, onDone }: { view: PerimeterView; keys: string[]; onDone: () => void }) {
  const { lang } = view;
  const fr = lang === "fr";
  const P = usePerimeter();
  const [measure, setMeasure] = useState("");
  const [owner, setOwner] = useState("");
  const [every, setEvery] = useState("");
  const [reviewed, setReviewed] = useState("");
  const [ifsRef, setIfsRef] = useState("");

  const patch: BulkPatch = {
    ...(measure.trim() && { control_measure: measure.trim() }),
    ...(owner.trim() && { owner: owner.trim() }),
    ...(every && { every_months: Number(every) }),
    ...(reviewed && { date_reviewed: reviewed }),
    ...(ifsRef.trim() && { ifs_ref: ifsRef.trim() }),
  };
  const text = (label: string, value: string, set: (v: string) => void, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="field">{label}<input type="text" maxLength={500} value={value} onChange={(e) => set(e.target.value)} {...extra} /></label>
  );

  return (
    <form className="bulk-bar" onSubmit={(e) => { e.preventDefault(); P.bulk(keys, patch); onDone(); }}>
      <strong>{fmtNum(keys.length, lang)} {fr ? "cas sélectionnés — les champs vides ne changent rien" : "case(s) selected — empty fields change nothing"}</strong>
      <div className="field-grid">
        {text(fr ? "Mesure ou action" : "Measure or action", measure, setMeasure, { list: "bulk-measures" })}
        <datalist id="bulk-measures">{P.pkg.measures.map((m) => <option key={m} value={m} />)}</datalist>
        {text(fr ? "Responsable" : "Owner", owner, setOwner)}
        <label className="field">{fr ? "Périodicité" : "Period"}
          <select value={every} onChange={(e) => setEvery(e.target.value)}>
            <option value="">{fr ? "Inchangée" : "Unchanged"}</option>
            {PERIODS.filter(Boolean).map((n) => <option key={n} value={n}>{periodLabel(n, lang)}</option>)}
          </select>
        </label>
        {text(fr ? "Date de revue" : "Review date", reviewed, setReviewed, { type: "date" })}
        {text(fr ? "Exigence IFS" : "IFS requirement", ifsRef, setIfsRef)}
      </div>
      <div className="btn-row">
        <button type="submit" className="btn primary" disabled={!Object.keys(patch).length}>{fr ? "Appliquer à la sélection" : "Apply to selection"}</button>
        <button type="button" className="btn ghost" onClick={onDone}>{fr ? "Désélectionner" : "Clear selection"}</button>
      </div>
    </form>
  );
}
