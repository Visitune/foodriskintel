import type { Lang } from "../i18n";
import type { RiskIndex } from "../types";
import { download } from "./io";
import type { CaseRef } from "./match";
import type { PerimeterPackage } from "./model";
import { criticalityLabel, nextReview, periodLabel, reasonLabel, scopeLabel, statusLabel, typeLabel } from "./model";

/** ─── Excel (.xlsx) export — SheetJS, write-only (no untrusted file parsing) ──
 *  Five sheets: Synthèse (header + traceability), Périmètre, Suivi, Revues,
 *  Historique. SheetJS community edition cannot write cell styles, hence
 *  filters rather than colours.
 *  Loaded on demand (dynamic import) so it stays out of the main bundle.
 */

type Row = (string | number)[];

const stamp = (d = new Date()) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export async function exportPerimeterXlsx(opts: {
  pkg: PerimeterPackage;
  index: RiskIndex;
  caseById: Map<string, CaseRef>;
  lang: Lang;
}) {
  const { perimeter: items, follow_up: followUps, reviews, history } = opts.pkg;
  const XLSX = await import("xlsx");
  const fr = opts.lang === "fr";
  const wb = XLSX.utils.book_new();
  const when = stamp();

  const meta: Row[] = [
    [fr ? "Food Risk Intelligence — Mon périmètre" : "Food Risk Intelligence — My perimeter"],
    [fr ? "Entreprise" : "Company", opts.pkg.owner.company],
    [fr ? "Site" : "Site", opts.pkg.owner.site],
    [fr ? "Auteur" : "Author", opts.pkg.owner.author],
    [fr ? "Date d'export" : "Export date", when],
    [fr ? "Package créé le" : "Package created", opts.pkg.created_at],
    [fr ? "Données : FFN jusqu'à" : "Data: FFN up to", opts.index.sources.ffn.latest],
    [fr ? "Données : JRC jusqu'à" : "Data: JRC up to", opts.index.sources.jrc.latest],
    [fr ? "Données : IFS jusqu'à" : "Data: IFS up to", opts.index.sources.ifs.latest],
    [fr ? "Éléments suivis" : "Tracked items", items.length],
    [fr ? "Cas au registre" : "Cases in register", followUps.length],
    [fr ? "Avertissement" : "Disclaimer", fr
      ? "Signaux publiés (suspicions, presse, rappels) — pas des condamnations. Sources officielles : IFS, DG SANTE (FFN), JRC."
      : "Published signals (suspicions, press, recalls) — not convictions. Official sources: IFS, DG SANTE (FFN), JRC."],
  ];
  const wsMeta = XLSX.utils.aoa_to_sheet(meta);
  wsMeta["!cols"] = [{ wch: 26 }, { wch: 70 }];
  XLSX.utils.book_append_sheet(wb, wsMeta, fr ? "Synthèse" : "Summary");

  const wsItems = XLSX.utils.aoa_to_sheet([
    [
      fr ? "Type" : "Type",
      fr ? "Libellé" : "Label",
      fr ? "Criticité" : "Criticality",
      fr ? "Note" : "Note",
      fr ? "Ajouté le" : "Added on",
      fr ? "Point de départ" : "Starting point",
      fr ? "Cas antérieurs au démarrage, non examinés" : "Cases before the start, not reviewed",
    ],
    ...items.map((i): Row => [
      typeLabel(i.type, opts.lang), i.label, criticalityLabel(i.criticality, opts.lang), i.note, i.added_at.slice(0, 10), scopeLabel(i.history_scope, opts.lang), i.history_skipped,
    ]),
  ]);
  wsItems["!cols"] = [{ wch: 18 }, { wch: 34 }, { wch: 11 }, { wch: 40 }, { wch: 12 }, { wch: 22 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsItems, fr ? "Périmètre" : "Perimeter");

  const head: Row = [
    fr ? "Référence" : "Reference",
    fr ? "Source" : "Source",
    fr ? "Élément du périmètre" : "Perimeter item",
    fr ? "Statut" : "Status",
    fr ? "Mesure de maîtrise" : "Control measure",
    fr ? "Périodicité" : "Period",
    fr ? "Responsable" : "Owner",
    fr ? "Date de revue" : "Review date",
    fr ? "Commentaire" : "Comment",
    fr ? "Lien source" : "Source link",
    fr ? "Exporté le" : "Exported on",
    fr ? "Motif" : "Reason",
    fr ? "Échéance" : "Due date",
    fr ? "Décidé le" : "Decided on",
    fr ? "Prochaine revue" : "Next review",
    fr ? "Exigence IFS" : "IFS requirement",
  ];
  const rows: Row[] = followUps.map((f) => {
    const ref = opts.caseById.get(f.case_key);
    const item = items.find((i) => i.id === f.item_id);
    return [
      ref?.reference ?? f.case_key,
      f.source.toUpperCase(),
      item?.label ?? "",
      statusLabel(f.status, opts.lang),
      f.control_measure,
      f.every_months ? periodLabel(f.every_months, opts.lang) : f.frequency,
      f.owner,
      f.date_reviewed,
      f.comment,
      f.url || ref?.url || "",
      when,
      reasonLabel(f.decision_reason, opts.lang),
      f.due_date,
      f.decided_at.slice(0, 10),
      nextReview(f),
      f.ifs_ref,
    ];
  });
  const wsFollow = XLSX.utils.aoa_to_sheet([head, ...rows]);
  wsFollow["!cols"] = [{ wch: 34 }, { wch: 10 }, { wch: 26 }, { wch: 13 }, { wch: 34 }, { wch: 12 }, { wch: 16 }, { wch: 12 }, { wch: 40 }, { wch: 46 }, { wch: 17 }, { wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 18 }];
  wsFollow["!autofilter"] = { ref: wsFollow["!ref"]! };
  XLSX.utils.book_append_sheet(wb, wsFollow, fr ? "Suivi" : "Follow-up");

  const wsReviews = XLSX.utils.aoa_to_sheet([
    fr ? ["Revue close le", "Non pertinents", "Maîtrisés", "Actions à prévoir", "Reportés"] : ["Review closed on", "Not relevant", "Controlled", "Actions planned", "Deferred"],
    ...reviews.map((r): Row => [r.closed_at.slice(0, 10), r.discarded, r.controlled, r.actions, r.deferred]),
  ]);
  wsReviews["!cols"] = [{ wch: 18 }, { wch: 16 }, { wch: 12 }, { wch: 18 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsReviews, fr ? "Revues" : "Reviews");

  // A working log kept in an editable file: useful, but not a tamper-proof audit trail.
  const events = fr
    ? { import: "Chargement", export: "Enregistrement", status_change: "Décision", edit: "Modification" }
    : { import: "Load", export: "Save", status_change: "Decision", edit: "Change" };
  const wsHistory = XLSX.utils.aoa_to_sheet([
    fr ? ["Date et heure", "Événement", "Détail"] : ["Date and time", "Event", "Detail"],
    ...history.map((h): Row => [h.at.slice(0, 19).replace("T", " ") + " UTC", events[h.event], h.detail]),
  ]);
  wsHistory["!cols"] = [{ wch: 24 }, { wch: 18 }, { wch: 90 }];
  wsHistory["!autofilter"] = { ref: wsHistory["!ref"]! };
  XLSX.utils.book_append_sheet(wb, wsHistory, fr ? "Historique" : "History");

  const out: ArrayBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const p = (n: number) => String(n).padStart(2, "0");
  const d = new Date();
  download(`perimetre-FRI-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.xlsx`, out, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}
