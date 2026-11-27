import type { Saver } from "../../perimeter/useSave";
import { usePerimeter } from "../../perimeter/PerimeterContext";
import FileLoader from "./FileLoader";
import Picker from "./Picker";
import Selection from "./Selection";
import StartChooser from "./StartChooser";
import OwnerFields from "./OwnerFields";
import type { PerimeterView } from "./view";

export type SetupStep = "pick" | "start" | "company";

/** First use in three steps: what, since when, who. */
export default function Setup({ view, saver, step, onStep }: {
  view: PerimeterView; saver: Saver; step: SetupStep; onStep: (s: SetupStep | null) => void;
}) {
  const { lang } = view;
  const fr = lang === "fr";
  const P = usePerimeter();
  const titles: [SetupStep, string][] = [
    ["pick", fr ? "Que surveiller ?" : "What to watch?"],
    ["start", fr ? "Depuis quand ?" : "Since when?"],
    ["company", fr ? "Votre société" : "Your company"],
  ];

  return (
    <div className="setup">
      <ol className="steps-bar">
        {titles.map(([id, label], i) => (
          <li key={id} className={id === step ? "on" : ""} aria-current={id === step ? "step" : undefined}><span>{i + 1}</span>{label}</li>
        ))}
      </ol>

      {step === "pick" && (
        <>
          <div className="setup-cols">
            <Picker view={view} />
            <Selection view={view} onNext={() => onStep("start")} />
          </div>
          <div className="setup-load">
            <p className="meta">{fr ? "Vous avez déjà un fichier de périmètre ?" : "Already have a perimeter file?"}</p>
            <FileLoader lang={lang} saver={saver} onLoaded={() => onStep(null)} />
            <p className="meta">{fr ? "Tout reste sur votre poste : aucun serveur ne reçoit vos choix." : "Everything stays on your computer: no server receives your choices."}</p>
          </div>
        </>
      )}

      {step === "start" && (
        <>
          <button type="button" className="btn ghost setup-back" onClick={() => onStep("pick")}>{fr ? "Modifier la sélection" : "Change the selection"}</button>
          <StartChooser view={view} onDone={() => onStep("company")} />
        </>
      )}

      {step === "company" && (
        <section className="review-panel">
          <h3>{fr ? "Dernière étape : qui assure cette surveillance ?" : "Last step: who runs this watch?"}</h3>
          <p className="meta">{fr ? "Facultatif. Ces informations figurent dans vos exports." : "Optional. These appear in your exports."}</p>
          <OwnerFields lang={lang} />
          <div className="btn-row">
            <button type="button" className="btn primary big-btn" onClick={() => { void saver.save(); onStep(null); }}>{fr ? "Enregistrer mon fichier et commencer" : "Save my file and start"}</button>
            <button type="button" className="btn ghost big-btn" onClick={() => onStep(null)}>{fr ? "Enregistrer plus tard" : "Save later"}</button>
          </div>
          <p className="meta">{fr ? `${P.pkg.perimeter.length} élément(s) sous surveillance.` : `${P.pkg.perimeter.length} item(s) watched.`}</p>
        </section>
      )}
    </div>
  );
}
