import { useEffect, useId, useRef, useState } from "react";
import { fmtMonth, fmtNum } from "../../format";
import { Flag } from "../../flags";
import { SourceTag } from "../../components/ui";
import { usePerimeter, type Decision } from "../../perimeter/PerimeterContext";
import { lastEntry, productKey, type PerimeterCase, type Topic } from "../../perimeter/review";
import { criticalityLabel, DECISION_REASONS, PERIODS, periodLabel, reasonLabel, statusLabel, typeLabel, type DecisionReason, type FollowUpStatus } from "../../perimeter/model";
import { fmtDay, problemLabel, today, type PerimeterView } from "./view";

const CHOICES: { status: FollowUpStatus; fr: string; en: string; hintFr: string; hintEn: string }[] = [
  { status: "non_pertinent", fr: "Non pertinent", en: "Not relevant", hintFr: "Ne concerne pas notre activité", hintEn: "Does not concern us" },
  { status: "evalue", fr: "Maîtrisé", en: "Controlled", hintFr: "Une mesure existante couvre ce risque", hintEn: "An existing measure covers this risk" },
  { status: "action_prevue", fr: "Action à prévoir", en: "Action needed", hintFr: "Avec un responsable et une échéance", hintEn: "With an owner and a due date" },
  { status: "a_evaluer", fr: "Plus tard", en: "Later", hintFr: "Reste à décider", hintEn: "Still to decide" },
];

/** One topic: why it is shown, its cases, past decisions, then the decision. */
export default function TopicCard({ view, topic, focusOnMount, onDecided }: {
  view: PerimeterView; topic: Topic; focusOnMount: boolean; onDecided: (count: number) => void;
}) {
  const { lang, caseById } = view;
  const fr = lang === "fr";
  const P = usePerimeter();
  const ids = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<FollowUpStatus | null>(null);
  const [reason, setReason] = useState<DecisionReason>("");
  const [measure, setMeasure] = useState("");
  const [every, setEvery] = useState(0);
  const [ifsRef, setIfsRef] = useState("");
  const [owner, setOwner] = useState("");
  const [due, setDue] = useState("");
  const [reviewDate, setReviewDate] = useState(today);
  const [comment, setComment] = useState("");

  useEffect(() => { if (focusOnMount) headingRef.current?.focus(); }, [focusOnMount]);

  // Keys 1 to 4 pick a decision, except while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof Element && !!e.target.closest("textarea, select, input:not([type=checkbox]):not([type=radio])");
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      const choice = CHOICES[Number(e.key) - 1];
      if (choice) { e.preventDefault(); setStatus(choice.status); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const item = P.pkg.perimeter.find((i) => i.id === topic.item_id);
  const selected = topic.cases.filter((c) => !excluded.has(c.key));
  const groups = new Map<string, PerimeterCase[]>();
  for (const c of topic.cases) {
    const k = productKey(c.product);
    const list = groups.get(k);
    if (list) list.push(c);
    else groups.set(k, [c]);
  }

  const toggle = (keys: string[], on: boolean) => setExcluded((prev) => {
    const next = new Set(prev);
    for (const k of keys) if (on) next.delete(k); else next.add(k);
    return next;
  });

  // Earlier decisions on the same item and the same kind of problem.
  const similar = [...new Map(P.pkg.follow_up
    .filter((f) => f.item_id === topic.item_id && f.status !== "a_evaluer" && caseById.get(f.case_key)?.problem === topic.problem)
    .sort((a, b) => a.decided_at.localeCompare(b.decided_at))
    .map((f) => [`${f.status}|${f.control_measure}|${f.decision_reason}`, f])).values()].slice(-3).reverse();

  const previous = status === "evalue" || status === "action_prevue" ? lastEntry(P.pkg, topic.item_id, status) : undefined;
  const typedMeasures = [...new Set([...P.pkg.measures, ...P.pkg.follow_up.map((f) => f.control_measure).filter(Boolean).slice(-20)])];

  const missing = !selected.length ? (fr ? "Cochez au moins un cas." : "Tick at least one case.")
    : !status ? (fr ? "Choisissez une décision." : "Choose a decision.")
    : status === "non_pertinent" && !reason ? (fr ? "Indiquez le motif." : "Give the reason.")
    : status === "evalue" && !measure.trim() ? (fr ? "Indiquez la mesure qui couvre ce risque." : "Name the measure that covers this risk.")
    : status === "action_prevue" && (!measure.trim() || !owner.trim() || !due) ? (fr ? "Indiquez l'action, le responsable et l'échéance." : "Give the action, owner and due date.")
    : "";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (missing || !status) return;
    const keepMeasure = status === "evalue" || status === "action_prevue";
    const decision: Decision = {
      status,
      decision_reason: status === "non_pertinent" ? reason : "",
      control_measure: keepMeasure ? measure.trim() : "",
      frequency: "",
      every_months: status === "evalue" ? every : 0,
      ifs_ref: keepMeasure ? ifsRef.trim() : "",
      owner: keepMeasure ? owner.trim() : "",
      due_date: status === "action_prevue" ? due : "",
      date_reviewed: status === "a_evaluer" ? "" : reviewDate,
      comment: comment.trim(),
    };
    P.decide(selected, decision);
    onDecided(selected.length);
  };

  const field = (name: string, label: string, value: string, set: (v: string) => void, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="field" htmlFor={`${ids}-${name}`}>{label}
      <input id={`${ids}-${name}`} type="text" maxLength={500} value={value} onChange={(e) => set(e.target.value)} {...extra} />
    </label>
  );

  return (
    <article className="topic-card" aria-labelledby={`${ids}-title`}>
      <header>
        <div className="topic-tags">
          <SourceTag src={topic.source} lang={lang} />
          <span className={`crit crit-${topic.criticality}`}>{fr ? "Criticité " : "Criticality "}{criticalityLabel(topic.criticality, lang).toLowerCase()}</span>
        </div>
        <h3 id={`${ids}-title`} tabIndex={-1} ref={headingRef}>{problemLabel(view, topic.source, topic.problem)}</h3>
        <p className="why">{fr ? "Présenté parce que vous surveillez " : "Shown because you watch "}
          <strong>{item?.label ?? "—"}</strong>{item ? ` (${typeLabel(item.type, lang).toLowerCase()})` : ""}.
          {item?.note ? <span className="meta"> {fr ? "Votre note : " : "Your note: "}{item.note}</span> : null}
        </p>
      </header>

      <div className="case-select-head">
        <strong>{fr ? `${fmtNum(selected.length, lang)} cas concerné(s) par la décision sur ${fmtNum(topic.cases.length, lang)}` : `${fmtNum(selected.length, lang)} of ${fmtNum(topic.cases.length, lang)} case(s) covered by the decision`}</strong>
        <button type="button" className="link-btn" onClick={() => toggle(topic.cases.map((c) => c.key), selected.length !== topic.cases.length)}>
          {selected.length === topic.cases.length ? (fr ? "Tout décocher" : "Untick all") : (fr ? "Tout cocher" : "Tick all")}
        </button>
      </div>
      <div className="case-select">
        {[...groups.entries()].map(([k, list]) => {
          const on = list.filter((c) => !excluded.has(c.key)).length;
          return (
            <fieldset key={k}>
              <legend>
                <label>
                  <input type="checkbox" checked={on === list.length} ref={(el) => { if (el) el.indeterminate = on > 0 && on < list.length; }}
                    onChange={(e) => toggle(list.map((c) => c.key), e.target.checked)} />
                  {list[0].product || (fr ? "Produit non précisé" : "Unspecified product")} <span className="meta">({fmtNum(list.length, lang)})</span>
                </label>
              </legend>
              {list.map((c) => (
                <div key={c.key} className="case-row">
                  <input type="checkbox" id={`${ids}-${c.key}`} checked={!excluded.has(c.key)} onChange={(e) => toggle([c.key], e.target.checked)} />
                  <label htmlFor={`${ids}-${c.key}`}>
                    <span>{c.summary}{c.rows > 1 ? ` (×${c.rows})` : ""}</span>
                    <span className="case-meta">
                      {fmtMonth(c.month, lang, "short")}
                      {c.origins.slice(0, 4).map((o) => <span key={o} className="with-flag"><Flag country={o} />{o}</span>)}
                    </span>
                  </label>
                  {c.url && <a href={c.url} target="_blank" rel="noopener noreferrer" aria-label={`${fr ? "Source" : "Source"} — ${c.summary}`}>{fr ? "source" : "source"}</a>}
                </div>
              ))}
            </fieldset>
          );
        })}
      </div>

      {similar.length > 0 && (
        <div className="similar">
          <strong>{fr ? "Vos décisions précédentes sur ce type de problème" : "Your earlier decisions on this kind of problem"}</strong>
          {similar.map((f) => (
            <p key={f.case_key}>{statusLabel(f.status, lang)}{f.decision_reason ? ` — ${reasonLabel(f.decision_reason, lang)}` : ""}{f.control_measure ? ` — ${f.control_measure}` : ""}{f.decided_at ? ` (${fmtDay(f.decided_at, lang)})` : ""}</p>
          ))}
        </div>
      )}

      <form className="decision" onSubmit={submit} onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); e.currentTarget.requestSubmit(); } }}>
        <div className="decision-choices" role="radiogroup" aria-label={fr ? "Votre décision" : "Your decision"}>
          {CHOICES.map((c, i) => (
            <label key={c.status} className={status === c.status ? "choice on" : "choice"}>
              <input type="radio" name={`${ids}-decision`} checked={status === c.status} onChange={() => setStatus(c.status)} />
              <span className="choice-title"><kbd aria-hidden="true">{i + 1}</kbd>{fr ? c.fr : c.en}</span>
              <span className="choice-meta">{fr ? c.hintFr : c.hintEn}</span>
            </label>
          ))}
        </div>

        {status === "non_pertinent" && (
          <div className="reason-row" role="radiogroup" aria-label={fr ? "Motif" : "Reason"}>
            {DECISION_REASONS.map((r) => (
              <label key={r} className={reason === r ? "reason on" : "reason"}>
                <input type="radio" name={`${ids}-reason`} checked={reason === r} onChange={() => setReason(r)} />{reasonLabel(r, lang)}
              </label>
            ))}
          </div>
        )}

        {previous && (
          <button type="button" className="reuse" onClick={() => { setMeasure(previous.control_measure); setEvery(previous.every_months); setOwner(previous.owner); setIfsRef(previous.ifs_ref); }}>
            {fr ? "Reprendre la dernière saisie : " : "Reuse the last entry: "}<strong>{previous.control_measure}</strong>{previous.owner ? ` · ${previous.owner}` : ""}{previous.every_months ? ` · ${periodLabel(previous.every_months, lang).toLowerCase()}` : ""}
          </button>
        )}

        {(status === "evalue" || status === "action_prevue") && (
          <div className="field-grid">
            {field("measure", status === "evalue" ? (fr ? "Mesure de maîtrise" : "Control measure") : (fr ? "Action à mener" : "Action to take"), measure, setMeasure, { list: `${ids}-measures`, required: true })}
            <datalist id={`${ids}-measures`}>{typedMeasures.map((m) => <option key={m} value={m} />)}</datalist>
            {field("owner", fr ? "Responsable" : "Owner", owner, setOwner, { required: status === "action_prevue" })}
            {status === "evalue"
              ? (
                <label className="field" htmlFor={`${ids}-every`}>{fr ? "Revoir ce cas (facultatif)" : "Review again (optional)"}
                  <select id={`${ids}-every`} value={every} onChange={(e) => setEvery(Number(e.target.value))}>
                    {PERIODS.map((n) => <option key={n} value={n}>{periodLabel(n, lang)}</option>)}
                  </select>
                </label>
              )
              : field("due", fr ? "Échéance" : "Due date", due, setDue, { type: "date", required: true })}
            {field("ifs", fr ? "Exigence IFS (facultatif)" : "IFS requirement (optional)", ifsRef, setIfsRef)}
          </div>
        )}

        {status && (
          <div className="field-grid">
            {status !== "a_evaluer" && field("reviewed", fr ? "Date de la décision" : "Decision date", reviewDate, setReviewDate, { type: "date" })}
            {field("comment", fr ? "Commentaire (facultatif)" : "Comment (optional)", comment, setComment)}
          </div>
        )}

        <div className="decision-submit">
          <button type="submit" className="btn primary big-btn" disabled={!!missing}>{fr ? "Valider et suivant" : "Confirm and next"}</button>
          <span className="meta" aria-live="polite">{missing || (fr ? "Ctrl + Entrée pour valider" : "Ctrl + Enter to confirm")}</span>
        </div>
      </form>
    </article>
  );
}
