import type { Lang } from "../i18n";
import type { FfnCase, JrcIncident, RiskIndex } from "../types";
import { download } from "./io";
import type { CaseRef } from "./match";
import type { FollowUp, PerimeterItem } from "./model";
import { criticalityLabel, statusLabel, typeLabel } from "./model";

/** ─── Excel (.xlsx) export — SheetJS, write-only (no untrusted file parsing) ──
 *  Three sheets: Synthèse (header + traceability), Périmètre, Suivi.
 *  Loaded on demand (dynamic import) so it stays out of the main bundle.
 */

type Row = (string | number)[];

const stamp = (d = new Date()) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export async function exportPerimeterXlsx(opts: {
  pkg: { owner: { company: string; site: string; author: string }; created_at: string };
  index: RiskIndex;
  items: PerimeterItem[];
  followUps: FollowUp[];
  caseById: Map<string, CaseRef>;
  lang: Lang;
}) {
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
    [fr ? "Éléments suivis" : "Tracked items", opts.items.length],
    [fr ? "Cas suivis" : "Followed cases", opts.followUps.length],
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
    ],
    ...opts.items.map((i): Row => [
      typeLabel(i.type, opts.lang), i.label, criticalityLabel(i.criticality, opts.lang), i.note, i.added_at.slice(0, 10),
    ]),
  ]);
  wsItems["!cols"] = [{ wch: 18 }, { wch: 34 }, { wch: 11 }, { wch: 40 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsItems, fr ? "Périmètre" : "Perimeter");

  const head: Row = [
    fr ? "Référence" : "Reference",
    fr ? "Source" : "Source",
    fr ? "Élément du périmètre" : "Perimeter item",
    fr ? "Statut" : "Status",
    fr ? "Mesure de maîtrise" : "Control measure",
    fr ? "Fréquence" : "Frequency",
    fr ? "Responsable" : "Owner",
    fr ? "Date de revue" : "Review date",
    fr ? "Commentaire" : "Comment",
    fr ? "Lien source" : "Source link",
    fr ? "Exporté le" : "Exported on",
  ];
  const rows: Row[] = opts.followUps.map((f) => {
    const ref = opts.caseById.get(f.case_key);
    const item = opts.items.find((i) => i.id === f.item_id);
    return [
      ref?.reference ?? f.case_key,
      ref ? (fr ? { ffn: "FFN", jrc: "JRC", ifs: "IFS" }[f.source] : { ffn: "FFN", jrc: "JRC", ifs: "IFS" }[f.source]) : f.source.toUpperCase(),
      item?.label ?? "",
      statusLabel(f.status, opts.lang),
      f.control_measure,
      f.frequency,
      f.owner,
      f.date_reviewed,
      f.comment,
      f.url || ref?.url || "",
      when,
    ];
  });
  const wsFollow = XLSX.utils.aoa_to_sheet([head, ...rows]);
  wsFollow["!cols"] = [{ wch: 34 }, { wch: 10 }, { wch: 26 }, { wch: 13 }, { wch: 34 }, { wch: 12 }, { wch: 16 }, { wch: 12 }, { wch: 40 }, { wch: 46 }, { wch: 17 }];
  XLSX.utils.book_append_sheet(wb, wsFollow, fr ? "Suivi" : "Follow-up");

  const out = XLSX.write(wb, { bookType: "xlsx", type: "binary" }) as unknown as ArrayBuffer;
  const p = (n: number) => String(n).padStart(2, "0");
  const d = new Date();
  download(`perimetre-FRI-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.xlsx`, out as unknown as string, "application/octet-stream");
}

/** Case references for every item currently matching — used to build the map above. */
export const buildCaseIndex = (itemsRefs: CaseRef[]) => new Map(itemsRefs.map((c) => [c.key, c]));

/** Narrow helpers used by the follow-up table to label cases without keeping report text in the package. */
export const caseSummaryOf = (c: FfnCase | JrcIncident): string =>
  "issue" in c ? `${(c as FfnCase).commodity} — ${(c as FfnCase).issue}` : (c as JrcIncident).description;
