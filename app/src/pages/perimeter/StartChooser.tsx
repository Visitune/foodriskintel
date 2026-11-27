import { useState } from "react";
import { fmtMonth, fmtNum } from "../../format";
import { usePerimeter } from "../../perimeter/PerimeterContext";
import { groupTopics, inScope, startCandidates, type StartScope } from "../../perimeter/review";
import { scopeLabel } from "../../perimeter/model";
import type { PerimeterView } from "./view";

const SCOPES: StartScope[] = ["3m", "1m", "all", "next"];

/** Asked once per added item: without it, the whole history would count as new. */
export default function StartChooser({ view, onDone }: { view: PerimeterView; onDone?: () => void }) {
  const { lang, cases, latest, complete } = view;
  const fr = lang === "fr";
  const P = usePerimeter();
  const [scope, setScope] = useState<StartScope>("3m");
  const waiting = P.pkg.perimeter.filter((i) => i.history_scope === "");
  const candidates = startCandidates(P.pkg, cases).filter((c) => c.source !== "ifs");

  const options = SCOPES.map((s) => {
    const kept = candidates.filter((c) => inScope(c, s, latest));
    return { scope: s, cases: kept.length, topics: groupTopics(kept, P.pkg.perimeter).length };
  });

  const apply = () => {
    P.setStart(scope, waiting.map((i) => i.id), candidates.filter((c) => !inScope(c, scope, latest)));
    onDone?.();
  };

  return (
    <section className="review-panel">
      <h3>{fr ? "À partir de quand voulez-vous surveiller ?" : "From when do you want to watch?"}</h3>
      <p className="meta">
        {fr ? "Concerne : " : "Applies to: "}<strong>{waiting.map((i) => i.label).join(", ")}</strong>.{" "}
        {fr
          ? `La période se compte depuis les dernières données publiées (suspicions UE : ${fmtMonth(latest.ffn, lang, "short")} ; presse JRC : ${fmtMonth(latest.jrc, lang, "short")}).`
          : `Periods are counted back from the latest published data (EU suspicions: ${fmtMonth(latest.ffn, lang, "short")}; JRC press: ${fmtMonth(latest.jrc, lang, "short")}).`}
      </p>
      <div className="choice-list" role="radiogroup" aria-label={fr ? "Point de départ" : "Starting point"}>
        {options.map((o) => (
          <label key={o.scope} className={scope === o.scope ? "choice on" : "choice"}>
            <input type="radio" name="start-scope" checked={scope === o.scope} onChange={() => setScope(o.scope)} />
            <span className="choice-title">{scopeLabel(o.scope, lang)}{o.scope === "3m" && <span className="tag">{fr ? "proposé" : "suggested"}</span>}</span>
            <span className="choice-meta">{o.cases === 0
              ? (fr ? "aucun cas à examiner aujourd'hui" : "nothing to review today")
              : fr ? `${fmtNum(o.cases, lang)} cas à examiner, en ${fmtNum(o.topics, lang)} sujet(s)` : `${fmtNum(o.cases, lang)} case(s) to review, in ${fmtNum(o.topics, lang)} topic(s)`}</span>
          </label>
        ))}
      </div>
      <p className="meta">{fr
        ? "Les cas plus anciens sont notés « antérieurs au démarrage, non examinés ». Ils ne sont jamais présentés comme évalués."
        : "Older cases are recorded as “before the start, not reviewed”. They are never shown as assessed."}</p>
      <button type="button" className="btn primary big-btn" onClick={apply} disabled={!complete}>{fr ? "Démarrer ma surveillance" : "Start watching"}</button>
    </section>
  );
}
