import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fmtMonth, fmtNum } from "../../format";
import { usePerimeter } from "../../perimeter/PerimeterContext";
import { buildQueue, deadlines, groupTopics, sessionSummary } from "../../perimeter/review";
import type { Saver } from "../../perimeter/useSave";
import { criticalityLabel } from "../../perimeter/model";
import { baselineFromIndex } from "../../perimeter/match";
import StartChooser from "./StartChooser";
import TopicCard from "./TopicCard";
import { fmtDay, problemLabel, today, type PerimeterView } from "./view";

/** The monthly review: where I stand → topic by topic → a clear end. */
export default function ReviewTab({ view, saver }: { view: PerimeterView; saver: Saver }) {
  const { lang, cases, complete, index } = view;
  const fr = lang === "fr";
  const P = usePerimeter();
  const [reviewing, setReviewing] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [decidedOnce, setDecidedOnce] = useState(false);
  const [revisit, setRevisit] = useState(false);

  const queue = useMemo(() => buildQueue(P.pkg, cases), [P.pkg, cases]);
  const pending = revisit ? queue.deferred : queue.open;
  const topics = useMemo(() => groupTopics(pending, P.pkg.perimeter), [pending, P.pkg.perimeter]);
  const topic = topics.find((t) => t.id === selectedId) ?? topics[0];
  const summary = sessionSummary(P.pkg);
  const settled = summary.discarded + summary.controlled + summary.actions;
  const handled = settled + summary.deferred;
  const lastReview = P.pkg.reviews.at(-1);
  const waiting = P.pkg.perimeter.some((i) => i.history_scope === "");

  if (waiting) return <StartChooser view={view} />;

  if (reviewing && topic) {
    const total = handled + queue.open.length;
    const criticalTopics = topics.filter((t) => t.criticality === "haute").length;
    return (
      <div className="review">
        <div className="progress-row">
          <button type="button" className="btn ghost" onClick={() => { setReviewing(false); setRevisit(false); }}>{fr ? "Quitter la revue" : "Leave the review"}</button>
          <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={handled}
            aria-label={fr ? "Avancement de la revue" : "Review progress"}>
            <span style={{ width: `${total ? (handled / total) * 100 : 0}%` }} />
          </div>
          <span className="meta">{fmtNum(handled, lang)} / {fmtNum(total, lang)} {fr ? "cas traités" : "cases done"}</span>
        </div>
        {revisit && <p className="meta">{fr ? "Vous revoyez les cas reportés." : "You are revisiting deferred cases."}</p>}
        <div className="review-cols">
          <nav className="queue" aria-label={fr ? "Sujets à examiner" : "Topics to review"}>
            <p className="queue-head">{fmtNum(topics.length, lang)} {fr ? "sujet(s) restant(s)" : "topic(s) left"}{criticalTopics ? ` · ${fmtNum(criticalTopics, lang)} ${fr ? "critique(s)" : "critical"}` : ""}</p>
            {topics.map((t) => (
              <button key={t.id} type="button" className={t.id === topic.id ? "queue-item on" : "queue-item"} aria-current={t.id === topic.id ? "true" : undefined} onClick={() => setSelectedId(t.id)}>
                <span className="queue-title">{problemLabel(view, t.source, t.problem)}</span>
                <span className="queue-sub">{P.pkg.perimeter.find((i) => i.id === t.item_id)?.label} · {t.source.toUpperCase()} · {fmtNum(t.cases.length, lang)} {fr ? "cas" : "case(s)"}</span>
                {t.criticality === "haute" && <span className="crit crit-haute">{criticalityLabel(t.criticality, lang)}</span>}
              </button>
            ))}
          </nav>
          <TopicCard key={`${topic.id}#${topic.cases.length}`} view={view} topic={topic} focusOnMount={decidedOnce}
            onDecided={(n) => {
              setDecidedOnce(true);
              // Move on to the following topic, whether or not this one is emptied.
              const at = topics.findIndex((t) => t.id === topic.id);
              setSelectedId(n === topic.cases.length ? topics[at + 1]?.id ?? "" : topic.id);
            }} />
        </div>
      </div>
    );
  }

  const openTopics = groupTopics(queue.open, P.pkg.perimeter);
  const critical = openTopics.filter((t) => t.criticality === "haute").length;
  const closedToday = !!lastReview && handled === 0 && new Date(lastReview.closed_at).toDateString() === new Date().toDateString();
  // Cases deferred before the closing come back later: they do not reopen today's review.
  const postponed = new Set(P.pkg.follow_up.filter((f) => f.status === "a_evaluer" && f.decided_at).map((f) => f.case_key));
  const onlyPostponed = closedToday && queue.open.every((c) => postponed.has(c.key));
  const finished = queue.open.length === 0 || onlyPostponed;
  const late = deadlines(P.pkg, today());
  const ifsMonth = cases.reduce((m, c) => (c.source === "ifs" && c.month > m ? c.month : m), "");
  const ifsContext = cases.filter((c) => c.source === "ifs" && c.month === ifsMonth);

  // Writing the file must start inside the click: the browser requires it.
  const close = () => {
    const record = { ...summary, data: baselineFromIndex(index), closed_at: new Date().toISOString() };
    P.closeReview(record);
    setReviewing(false);
    void saver.save({ ...P.pkg, reviews: [...P.pkg.reviews, record] }, P.rev + 1);
  };

  const tally = (
    <dl className="tally">
      <div><dt>{fr ? "Non pertinents" : "Not relevant"}</dt><dd>{fmtNum(summary.discarded, lang)}</dd></div>
      <div><dt>{fr ? "Maîtrisés" : "Controlled"}</dt><dd>{fmtNum(summary.controlled, lang)}</dd></div>
      <div><dt>{fr ? "Actions à prévoir" : "Actions needed"}</dt><dd>{fmtNum(summary.actions, lang)}</dd></div>
      <div><dt>{fr ? "Reportés" : "Deferred"}</dt><dd>{fmtNum(summary.deferred, lang)}</dd></div>
    </dl>
  );

  return (
    <div className="review">
      <section className="review-panel">
        {!finished ? (
          <>
            <p className="review-state">{handled ? (fr ? "Revue en cours" : "Review in progress") : (fr ? "Revue à faire" : "Review to do")}</p>
            <h3>{fr
              ? `${fmtNum(queue.open.length, lang)} cas à examiner, réunis en ${fmtNum(openTopics.length, lang)} sujet(s)${critical ? `, dont ${fmtNum(critical, lang)} critique(s)` : ""}.`
              : `${fmtNum(queue.open.length, lang)} case(s) to review, in ${fmtNum(openTopics.length, lang)} topic(s)${critical ? `, ${fmtNum(critical, lang)} critical` : ""}.`}</h3>
            {handled > 0 && tally}
            <button type="button" className="btn primary big-btn" onClick={() => { setRevisit(false); setReviewing(true); }}>
              {handled ? (fr ? "Reprendre la revue" : "Resume the review") : (fr ? "Commencer la revue" : "Start the review")}
            </button>
          </>
        ) : handled > 0 ? (
          <>
            <p className="review-state done">{fr ? "Tous les sujets sont passés en revue" : "Every topic has been reviewed"}</p>
            <h3>{fr ? "Il reste à clore et enregistrer votre revue." : "Close and save your review."}</h3>
            {tally}
            <div className="btn-row">
              <button type="button" className="btn primary big-btn" onClick={close} disabled={!complete}>{fr ? "Clore et enregistrer ma revue" : "Close and save my review"}</button>
              {queue.deferred.length > 0 && <button type="button" className="btn" onClick={() => { setRevisit(true); setReviewing(true); }}>{fr ? "Revoir les cas reportés" : "Revisit deferred cases"} ({fmtNum(queue.deferred.length, lang)})</button>}
            </div>
          </>
        ) : (
          <>
            <p className="review-state done">{closedToday ? (fr ? "Revue terminée" : "Review complete") : (fr ? "Rien à examiner" : "Nothing to review")}</p>
            <h3>{closedToday
              ? (fr ? "Votre revue d'aujourd'hui est close." : "Today's review is closed.")
              : complete ? (fr ? "Aucun nouveau cas dans votre périmètre." : "No new case in your perimeter.") : (fr ? "La liste est incomplète : toutes les sources ne sont pas chargées." : "The list is incomplete: not every source is loaded.")}</h3>
            {!closedToday && <button type="button" className="btn" onClick={close} disabled={!complete}>{fr ? "Noter qu'une revue a été faite" : "Record that a review was done"}</button>}
            {onlyPostponed && queue.open.length > 0 && <button type="button" className="btn" onClick={() => { setRevisit(false); setReviewing(true); }}>{fr ? "Examiner les cas reportés" : "Review deferred cases"} ({fmtNum(queue.open.length, lang)})</button>}
          </>
        )}
        <p className="meta">{lastReview
          ? `${fr ? "Dernière revue close le " : "Last review closed on "}${fmtDay(lastReview.closed_at, lang)}.`
          : (fr ? "Aucune revue close pour l'instant." : "No review closed yet.")}</p>
        {late.reviews.length + late.actions.length > 0 && (
          <p><Link className="late" to="/perimetre/registre?echeance=retard">{fr
            ? `Échéances dépassées : ${fmtNum(late.reviews.length, lang)} revue(s) de cas, ${fmtNum(late.actions.length, lang)} action(s).`
            : `Overdue: ${fmtNum(late.reviews.length, lang)} case review(s), ${fmtNum(late.actions.length, lang)} action(s).`}</Link></p>
        )}
      </section>

      {ifsContext.length > 0 && (
        <section className="context-panel">
          <h4>{fr ? `Pour contexte : rappels IFS de vos origines, ${fmtMonth(ifsMonth, lang, "short")}` : `Context: IFS recalls for your origins, ${fmtMonth(ifsMonth, lang, "short")}`}</h4>
          <p className="meta">{fr ? "Totaux mensuels par pays, tous produits confondus. Rien à décider." : "Monthly totals per country, all products. Nothing to decide."}</p>
          <p>{ifsContext.map((c) => <a key={c.key} className="context-chip" href={c.url} target="_blank" rel="noopener noreferrer">{c.summary}</a>)}</p>
        </section>
      )}
    </div>
  );
}
