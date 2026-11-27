import { useState } from "react";
import { downloadCsv } from "../../format";
import { usePerimeter } from "../../perimeter/PerimeterContext";
import { nextReview, periodLabel, reasonLabel, statusLabel } from "../../perimeter/model";
import { exportPerimeterXlsx } from "../../perimeter/xlsx";
import type { Saver } from "../../perimeter/useSave";
import { Card } from "../shared";
import FileLoader from "./FileLoader";
import OwnerFields from "./OwnerFields";
import { today, type PerimeterView } from "./view";

export default function FileTab({ view, saver }: { view: PerimeterView; saver: Saver }) {
  const { lang, index, caseById } = view;
  const fr = lang === "fr";
  const P = usePerimeter();
  const [error, setError] = useState("");

  const exportXlsx = async () => {
    setError("");
    try {
      await exportPerimeterXlsx({ pkg: P.pkg, index, caseById, lang });
    } catch {
      setError(fr ? "L'export Excel a échoué. Réessayez." : "Excel export failed. Please retry.");
    }
  };

  const exportCsv = () =>
    downloadCsv(`perimetre-FRI-${today()}.csv`, P.pkg.follow_up.map((f) => ({
      [fr ? "Référence" : "Reference"]: caseById.get(f.case_key)?.reference ?? f.case_key,
      [fr ? "Source" : "Source"]: f.source.toUpperCase(),
      [fr ? "Élément" : "Item"]: P.pkg.perimeter.find((i) => i.id === f.item_id)?.label ?? "",
      [fr ? "Statut" : "Status"]: statusLabel(f.status, lang),
      [fr ? "Motif" : "Reason"]: reasonLabel(f.decision_reason, lang),
      [fr ? "Mesure ou action" : "Measure or action"]: f.control_measure,
      [fr ? "Périodicité" : "Period"]: f.every_months ? periodLabel(f.every_months, lang) : f.frequency,
      [fr ? "Responsable" : "Owner"]: f.owner,
      [fr ? "Date de revue" : "Review date"]: f.date_reviewed,
      [fr ? "Prochaine revue" : "Next review"]: nextReview(f),
      [fr ? "Échéance" : "Due date"]: f.due_date,
      [fr ? "Exigence IFS" : "IFS requirement"]: f.ifs_ref,
      [fr ? "Commentaire" : "Comment"]: f.comment,
      [fr ? "Lien source" : "Source link"]: f.url || caseById.get(f.case_key)?.url || "",
    })), lang);

  return (
    <>
      <Card title={fr ? "Votre fichier de périmètre" : "Your perimeter file"}>
        <p className="meta">{fr
          ? "C'est votre copie de référence (.vey). Conservez-la sur le réseau de l'entreprise ou dans le dossier d'audit. Elle contient vos choix et vos notes, jamais le contenu des rapports."
          : "This is your reference copy (.vey). Keep it on the company network or in the audit file. It holds your choices and notes, never report content."}</p>
        <div className="btn-row">
          <button type="button" className="btn primary" onClick={() => void saver.save()}>{saver.fileName ? (fr ? "Mettre à jour le fichier" : "Update the file") : fr ? "Enregistrer le fichier" : "Save the file"}</button>
          {saver.fileName && <button type="button" className="btn ghost" onClick={() => saver.relink(null)}>{fr ? "Enregistrer ailleurs la prochaine fois" : "Save elsewhere next time"}</button>}
        </div>
        {saver.fileName && <p className="meta">{fr ? "Fichier lié : " : "Linked file: "}<strong>{saver.fileName}</strong></p>}
        <FileLoader lang={lang} saver={saver} />
        <p className="meta">{fr ? "Exemple fictif : " : "Fictional example: "}<a href={`${import.meta.env.BASE_URL}exemple-perimetre.vey`} download>exemple-perimetre.vey</a></p>
      </Card>

      <Card title={fr ? "Votre société (reprise dans les exports)" : "Your company (included in exports)"}>
        <OwnerFields lang={lang} />
      </Card>

      <Card title="Exports">
        <div className="btn-row">
          <button type="button" className="btn" onClick={exportXlsx}>{fr ? "Exporter vers Excel (.xlsx)" : "Export to Excel (.xlsx)"}</button>
          <button type="button" className="btn" onClick={exportCsv} disabled={!P.pkg.follow_up.length}>{fr ? "Exporter le registre (CSV)" : "Export the register (CSV)"}</button>
          <button type="button" className="btn" onClick={() => window.print()}>{fr ? "Imprimer la synthèse (PDF)" : "Print summary (PDF)"}</button>
        </div>
        {error && <p className="import-preview error" role="alert">{error}</p>}
        <p className="meta">{fr ? "Les exports ne remplacent pas le fichier de périmètre : ils ne peuvent pas être rechargés." : "Exports do not replace the perimeter file: they cannot be loaded back."}</p>
      </Card>
    </>
  );
}
