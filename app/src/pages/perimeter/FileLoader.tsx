import { useState } from "react";
import type { Lang } from "../../i18n";
import { usePerimeter, type PerimeterPackage } from "../../perimeter/PerimeterContext";
import { readPackageFile } from "../../perimeter/io";
import { canRewriteFile, pickFile, rememberLink, type VeyHandle } from "../../perimeter/fileStore";
import type { Saver } from "../../perimeter/useSave";
import { fmtDay } from "./view";

/** Loading a .vey file: always compared with the current work before anything is replaced. */
export default function FileLoader({ lang, saver, onLoaded }: { lang: Lang; saver: Saver; onLoaded?: () => void }) {
  const fr = lang === "fr";
  const P = usePerimeter();
  const [candidate, setCandidate] = useState<{ pkg: PerimeterPackage; handle: VeyHandle | null } | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  // The classic file field stays as a fallback when the browser picker is refused.
  const [usePicker, setUsePicker] = useState(canRewriteFile);
  const empty = !P.pkg.perimeter.length;

  const read = async (file: File, handle: VeyHandle | null) => {
    const res = await readPackageFile(file);
    if (res.ok) {
      setMessage(null);
      setCandidate({ pkg: res.pkg, handle });
      return;
    }
    const why: Record<string, string> = {
      too_big: fr ? "Fichier trop volumineux (20 Mo maximum)." : "File too large (20 MB maximum).",
      not_json: fr ? "Fichier illisible." : "Unreadable file.",
      bad_format: fr ? "Ce n'est pas un fichier de périmètre Food Risk Intelligence." : "Not a Food Risk Intelligence perimeter file.",
      future_version: fr ? "Ce fichier vient d'une version plus récente de l'application : mettez-la à jour." : "This file comes from a newer app version: update the app first.",
    };
    setCandidate(null);
    setMessage({ ok: false, text: why[res.reason] ?? (fr ? "Fichier refusé : contenu invalide." : "File rejected: invalid content.") });
  };

  const openWithPicker = async () => {
    try {
      const picked = await pickFile();
      if (picked) await read(picked.file, picked.handle);
    } catch {
      setUsePicker(false);
      setMessage({ ok: false, text: fr ? "Le navigateur a refusé l'accès au fichier. Réessayez avec le bouton." : "The browser refused file access. Try the button again." });
    }
  };

  const accept = async () => {
    if (!candidate) return;
    if (P.dirty && !window.confirm(fr
      ? "Votre travail en cours n'est pas enregistré dans un fichier. Le charger le remplacera définitivement. Continuer ?"
      : "Your current work is not saved in a file. Loading will replace it for good. Continue?")) return;
    // From now on, saving targets the file just opened (or asks again).
    saver.relink(candidate.handle ? await rememberLink(candidate.handle, candidate.pkg.created_at) : null);
    P.replace(candidate.pkg);
    setCandidate(null);
    setMessage({ ok: true, text: fr ? "Fichier chargé." : "File loaded." });
    onLoaded?.();
  };

  const describe = (p: PerimeterPackage) => {
    const decided = p.follow_up.filter((f) => f.status !== "a_evaluer").length;
    return fr
      ? `${p.perimeter.length} élément(s), ${decided} décision(s), ${p.reviews.length} revue(s) close(s), modifié le ${fmtDay(p.updated_at, lang)}`
      : `${p.perimeter.length} item(s), ${decided} decision(s), ${p.reviews.length} closed review(s), changed on ${fmtDay(p.updated_at, lang)}`;
  };
  const older = !!candidate && !empty && candidate.pkg.updated_at < P.pkg.updated_at;

  return (
    <div>
      {usePicker
        ? <button type="button" className="btn" onClick={openWithPicker}>{fr ? "Charger un fichier" : "Load a file"}</button>
        : (
          <label className="btn file-btn">{fr ? "Charger un fichier" : "Load a file"}
            <input type="file" accept=".vey,application/json" onChange={(e) => { const f = e.target.files?.[0]; if (f) read(f, null); e.target.value = ""; }} />
          </label>
        )}
      {message && <p className={message.ok ? "import-preview ok" : "import-preview error"} role="status">{message.text}</p>}
      {candidate && (
        <div className="import-preview">
          <p><strong>{fr ? "Fichier choisi : " : "Chosen file: "}</strong>{describe(candidate.pkg)}</p>
          {!empty && <p><strong>{fr ? "Travail en cours : " : "Current work: "}</strong>{describe(P.pkg)}{P.dirty ? (fr ? " (pas encore dans un fichier)" : " (not in a file yet)") : ""}</p>}
          {older && <p className="warn-text">{fr ? "Attention : le fichier choisi est plus ancien que votre travail en cours." : "Careful: the chosen file is older than your current work."}</p>}
          <div className="btn-row">
            <button type="button" className="btn primary" onClick={accept}>{empty ? (fr ? "Charger ce fichier" : "Load this file") : (fr ? "Remplacer par ce fichier" : "Replace with this file")}</button>
            <button type="button" className="btn ghost" onClick={() => setCandidate(null)}>{fr ? "Garder mon travail actuel" : "Keep my current work"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
