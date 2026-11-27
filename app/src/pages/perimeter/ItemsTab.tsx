import { useState } from "react";
import { Link } from "react-router-dom";
import { fmtNum } from "../../format";
import { usePerimeter } from "../../perimeter/PerimeterContext";
import { confirmRemoveItem } from "../../perimeter/confirm";
import { buildQueue, deadlines, groupTopics } from "../../perimeter/review";
import { CRITICALITIES, criticalityLabel, scopeLabel, typeLabel, type Criticality } from "../../perimeter/model";
import Picker from "./Picker";
import { itemPath } from "./paths";
import { fmtDay, today, type PerimeterView } from "./view";

/** The perimeter at a glance: totals, one card per item, and the usual measures. */
export default function ItemsTab({ view }: { view: PerimeterView }) {
  const { lang, cases } = view;
  const fr = lang === "fr";
  const P = usePerimeter();
  const [adding, setAdding] = useState(false);
  const queue = buildQueue(P.pkg, cases);
  const pending = [...queue.open, ...queue.deferred];
  const topics = groupTopics(pending, P.pkg.perimeter);
  const late = deadlines(P.pkg, today());
  const lastReview = P.pkg.reviews.at(-1);

  const stat = (label: string, value: string, to?: string) => (
    <div><dt>{label}</dt><dd>{to ? <Link to={to}>{value}</Link> : value}</dd></div>
  );

  return (
    <>
      <dl className="tally dashboard">
        {stat(fr ? "Cas à examiner" : "Cases to review", fmtNum(pending.length, lang), "/perimetre")}
        {stat(fr ? "Revues de cas dépassées" : "Overdue case reviews", fmtNum(late.reviews.length, lang), late.reviews.length ? "/perimetre/registre?echeance=retard" : undefined)}
        {stat(fr ? "Actions en retard" : "Overdue actions", fmtNum(late.actions.length, lang), late.actions.length ? "/perimetre/registre?echeance=retard" : undefined)}
        {stat(fr ? "Dernière revue close" : "Last closed review", lastReview ? fmtDay(lastReview.closed_at, lang) : "—")}
      </dl>

      <div className="btn-row">
        <button type="button" className="btn primary" aria-expanded={adding} onClick={() => setAdding((v) => !v)}>{adding ? (fr ? "Fermer l'ajout" : "Close") : (fr ? "Ajouter des éléments" : "Add items")}</button>
      </div>
      {adding && <section className="review-panel add-panel"><Picker view={view} /></section>}

      <div className="item-cards">
        {P.pkg.perimeter.map((item) => {
          const mine = P.pkg.follow_up.filter((f) => f.item_id === item.id);
          const waitingCount = pending.filter((c) => c.item_ids.includes(item.id)).length;
          const topicCount = topics.filter((t) => t.item_id === item.id).length;
          const lastDecision = mine.reduce((m, f) => (f.decided_at > m ? f.decided_at : m), "");
          const usual = [...mine].filter((f) => f.control_measure).sort((a, b) => b.decided_at.localeCompare(a.decided_at))[0]?.control_measure;
          const lateCount = [...late.reviews, ...late.actions].filter((f) => f.item_id === item.id).length;
          return (
            <article key={item.id} className="item-card">
              <header>
                <h4>{item.type === "family" || item.type === "origin" ? <Link to={itemPath(item)}>{item.label}</Link> : item.label}</h4>
                <span className="meta">{typeLabel(item.type, lang)}</span>
              </header>
              <p className="item-state">{item.history_scope === "" ? (fr ? "Point de départ à choisir" : "Starting point to choose")
                : waitingCount ? (fr ? `${fmtNum(waitingCount, lang)} cas à examiner${topicCount ? `, ${fmtNum(topicCount, lang)} sujet(s)` : ""}` : `${fmtNum(waitingCount, lang)} case(s) to review`)
                : (fr ? "À jour" : "Up to date")}</p>
              {lateCount > 0 && <p><Link className="late" to={`/perimetre/registre?element=${encodeURIComponent(item.id)}&echeance=retard`}>{fmtNum(lateCount, lang)} {fr ? "échéance(s) dépassée(s)" : "overdue deadline(s)"}</Link></p>}
              <dl>
                <div><dt>{fr ? "Au registre" : "In register"}</dt><dd>{mine.length ? <Link to={`/perimetre/registre?element=${encodeURIComponent(item.id)}`}>{fmtNum(mine.length, lang)}</Link> : "0"}</dd></div>
                <div><dt>{fr ? "Dernière décision" : "Last decision"}</dt><dd>{lastDecision ? fmtDay(lastDecision, lang) : "—"}</dd></div>
                <div><dt>{fr ? "Dernière mesure saisie" : "Latest measure"}</dt><dd>{usual ?? "—"}</dd></div>
                <div><dt>{fr ? "Point de départ" : "Starting point"}</dt><dd>{scopeLabel(item.history_scope, lang)}{item.history_skipped > 0 ? ` · ${fmtNum(item.history_skipped, lang)} ${fr ? "cas antérieurs non examinés" : "earlier cases not reviewed"}` : ""}</dd></div>
              </dl>
              <label className="field">{fr ? "Criticité" : "Criticality"}
                <select value={item.criticality} onChange={(e) => P.setCriticality(item.id, e.target.value as Criticality)}>
                  {CRITICALITIES.map((c) => <option key={c} value={c}>{criticalityLabel(c, lang)}</option>)}
                </select>
              </label>
              <label className="field">{fr ? "Note" : "Note"}<input type="text" maxLength={500} value={item.note} onChange={(e) => P.setNote(item.id, e.target.value)} placeholder={fr ? "Fournisseur, gamme…" : "Supplier, range…"} /></label>
              <button type="button" className="btn ghost" onClick={() => { if (confirmRemoveItem(P.pkg, item.id, lang)) P.remove(item.id); }}>{fr ? "Retirer du périmètre" : "Remove from perimeter"}</button>
            </article>
          );
        })}
      </div>

      <MeasureEditor view={view} />
    </>
  );
}

function MeasureEditor({ view }: { view: PerimeterView }) {
  const fr = view.lang === "fr";
  const P = usePerimeter();
  const [draft, setDraft] = useState("");
  return (
    <section className="review-panel measures">
      <h4>{fr ? "Vos mesures de maîtrise types" : "Your usual control measures"}</h4>
      <p className="meta">{fr ? "Proposées pendant la revue, pour écrire les mêmes mesures de la même façon." : "Offered during the review, so the same measure is always worded the same way."}</p>
      <ul>
        {P.pkg.measures.map((m) => (
          <li key={m}><span>{m}</span><button type="button" className="btn ghost" aria-label={`${fr ? "Retirer" : "Remove"} ${m}`} onClick={() => P.setMeasures(P.pkg.measures.filter((x) => x !== m))}>×</button></li>
        ))}
      </ul>
      <form className="measure-add" onSubmit={(e) => { e.preventDefault(); if (draft.trim()) { P.setMeasures([...P.pkg.measures, draft.trim()]); setDraft(""); } }}>
        <label className="field">{fr ? "Nouvelle mesure" : "New measure"}<input type="text" maxLength={500} value={draft} onChange={(e) => setDraft(e.target.value)} /></label>
        <button type="submit" className="btn" disabled={!draft.trim()}>{fr ? "Ajouter" : "Add"}</button>
      </form>
    </section>
  );
}
