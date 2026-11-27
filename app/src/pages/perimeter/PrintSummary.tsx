import { fmtMonth } from "../../format";
import { usePerimeter, type FollowUp } from "../../perimeter/PerimeterContext";
import { criticalityLabel, nextReview, periodLabel, reasonLabel, scopeLabel, statusLabel, typeLabel } from "../../perimeter/model";
import { buildQueue } from "../../perimeter/review";
import { fmtDay, type PerimeterView } from "./view";

/** Printed whatever the tab on screen: one section per perimeter item. */
export default function PrintSummary({ view }: { view: PerimeterView }) {
  const { lang, index, caseById, cases, complete } = view;
  const fr = lang === "fr";
  const { pkg } = usePerimeter();
  const lastReview = pkg.reviews.at(-1);
  const queue = buildQueue(pkg, cases);
  const pending = [...queue.open, ...queue.deferred];
  const day = (iso: string) => (iso ? fmtDay(iso, lang) : "");

  const table = (rows: FollowUp[]) => (
    <table className="data-table">
      <thead><tr><th>{fr ? "Cas" : "Case"}</th><th>{fr ? "Décision" : "Decision"}</th><th>{fr ? "Motif, mesure ou action" : "Reason, measure or action"}</th><th>{fr ? "Responsable" : "Owner"}</th><th>{fr ? "Date" : "Date"}</th><th>{fr ? "Échéance" : "Deadline"}</th></tr></thead>
      <tbody>{rows.map((f) => {
        const ref = caseById.get(f.case_key);
        return (
          <tr key={f.case_key}>
            <td>{ref?.summary ?? ""}<div>{ref?.reference ?? f.case_key}</div></td>
            <td>{statusLabel(f.status, lang)}</td>
            <td>{[reasonLabel(f.decision_reason, lang), f.control_measure, f.every_months ? periodLabel(f.every_months, lang) : f.frequency, f.ifs_ref && `IFS ${f.ifs_ref}`, f.comment].filter(Boolean).join(" · ")}</td>
            <td>{f.owner}</td>
            <td>{day(f.date_reviewed)}</td>
            <td>{day(f.status === "action_prevue" ? f.due_date : nextReview(f))}</td>
          </tr>
        );
      })}</tbody>
    </table>
  );

  const orphans = pkg.follow_up.filter((f) => !pkg.perimeter.some((i) => i.id === f.item_id));

  return (
    <div className="print-summary">
      <h2>{fr ? "Synthèse de surveillance — Food Risk Intelligence" : "Watch summary — Food Risk Intelligence"}</h2>
      <p>{[pkg.owner.company || "—", pkg.owner.site, pkg.owner.author].filter(Boolean).join(" · ")} — {fr ? "imprimé le " : "printed on "}{fmtDay(new Date().toISOString(), lang)}</p>
      <p>{fr ? "Données : " : "Data: "}FFN {fmtMonth(index.sources.ffn.latest, lang, "short")} · JRC {fmtMonth(index.sources.jrc.latest, lang, "short")} · IFS {fmtMonth(index.sources.ifs.latest, lang, "short")}
        {lastReview ? ` — ${fr ? "dernière revue close le " : "last review closed on "}${fmtDay(lastReview.closed_at, lang)}` : ` — ${fr ? "aucune revue close" : "no closed review"}`}</p>
      <p>{fr ? "Les cas sont des signaux publiés (suspicions, presse, rappels), pas des condamnations." : "Cases are published signals (suspicions, press, recalls), not convictions."}</p>
      {!complete && <p><strong>{fr ? "Attention : toutes les sources n'étaient pas chargées à l'impression." : "Warning: not every source was loaded when printing."}</strong></p>}
      {pkg.perimeter.map((i) => {
        const rows = pkg.follow_up.filter((f) => f.item_id === i.id).sort((a, b) => a.status.localeCompare(b.status) || b.decided_at.localeCompare(a.decided_at));
        const waiting = pending.filter((c) => c.item_ids.includes(i.id)).length;
        return (
          <section key={i.id}>
            <h3>{i.label} — {typeLabel(i.type, lang)} — {fr ? "criticité" : "criticality"} {criticalityLabel(i.criticality, lang).toLowerCase()}</h3>
            <p>{fr ? "Point de départ : " : "Starting point: "}{scopeLabel(i.history_scope, lang)}
              {i.history_skipped ? ` — ${i.history_skipped} ${fr ? "cas antérieurs, non examinés" : "earlier cases, not reviewed"}` : ""}
              {" — "}{waiting} {fr ? "cas restant à examiner" : "case(s) still to review"}{i.note ? ` — ${i.note}` : ""}</p>
            {rows.length ? table(rows) : <p>{fr ? "Aucune décision au registre." : "No decision in the register."}</p>}
          </section>
        );
      })}
      {orphans.length > 0 && <section><h3>{fr ? "Autres cas du registre" : "Other register cases"}</h3>{table(orphans)}</section>}
    </div>
  );
}
