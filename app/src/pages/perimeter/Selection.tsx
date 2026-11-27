import { fmtNum } from "../../format";
import { usePerimeter } from "../../perimeter/PerimeterContext";
import { confirmRemoveItem } from "../../perimeter/confirm";
import { monthlyVolume } from "../../perimeter/review";
import { CRITICALITIES, criticalityLabel, typeLabel, type Criticality } from "../../perimeter/model";
import type { PerimeterView } from "./view";

/** What has been picked so far, with the workload it represents. */
export default function Selection({ view, onNext }: { view: PerimeterView; onNext: () => void }) {
  const { lang, cases, latest, complete } = view;
  const fr = lang === "fr";
  const P = usePerimeter();
  const volume = Math.round(monthlyVolume(cases, latest));

  return (
    <aside className="selection" aria-label={fr ? "Votre sélection" : "Your selection"}>
      <h4>{fr ? "Votre sélection" : "Your selection"} ({fmtNum(P.pkg.perimeter.length, lang)})</h4>
      {!P.pkg.perimeter.length && <p className="meta">{fr ? "Rien pour l'instant : cliquez sur une matière ou une origine." : "Nothing yet: click a material or an origin."}</p>}
      <ul>
        {P.pkg.perimeter.map((i) => (
          <li key={i.id}>
            <span><strong>{i.label}</strong><span className="meta"> {typeLabel(i.type, lang)}</span></span>
            <select value={i.criticality} onChange={(e) => P.setCriticality(i.id, e.target.value as Criticality)} aria-label={`${fr ? "Criticité" : "Criticality"} — ${i.label}`}>
              {CRITICALITIES.map((c) => <option key={c} value={c}>{criticalityLabel(c, lang)}</option>)}
            </select>
            <button type="button" className="btn ghost" aria-label={`${fr ? "Retirer" : "Remove"} ${i.label}`} onClick={() => { if (confirmRemoveItem(P.pkg, i.id, lang)) P.remove(i.id); }}>×</button>
          </li>
        ))}
      </ul>
      {P.pkg.perimeter.length > 0 && (
        <p className="volume" role="status">{!complete ? (fr ? "Estimation en cours…" : "Estimating…")
          : fr ? `Environ ${fmtNum(volume, lang)} cas par mois, en moyenne sur 12 mois publiés (doublons exclus).`
          : `About ${fmtNum(volume, lang)} case(s) a month, averaged over 12 published months (duplicates excluded).`}</p>
      )}
      <button type="button" className="btn primary big-btn" disabled={!P.pkg.perimeter.length} onClick={onNext}>{fr ? "Continuer" : "Continue"}</button>
    </aside>
  );
}
