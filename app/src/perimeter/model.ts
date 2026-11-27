import type { Lang } from "../i18n";

/** ─── Package format "food-risk-intelligence/perimeter" (.vey) ────────────────
 *  A .vey file is plain JSON, UTF-8, readable in any text editor.
 *  It holds references (ids, urls, dates) and the user's own notes — never
 *  report content (IFS copyright). It is the user's single source of truth:
 *  the browser only keeps an unsaved draft.
 */

export const SCHEMA_VERSION = 1;
export const FORMAT = "food-risk-intelligence/perimeter";
export const EXTENSION = ".vey";
/** Hard size limit for an imported file. */
export const MAX_FILE_BYTES = 2_000_000;
/** Max length of free-text fields (keeps the file small and focused). */
export const MAX_TEXT = 500;

export type ItemType = "family" | "origin" | "substance" | "commodity";
export type Criticality = "haute" | "moyenne" | "faible";
export type CaseSource = "ffn" | "jrc" | "ifs";
export type FollowUpStatus = "a_evaluer" | "evalue" | "non_pertinent";

export interface PerimeterItem {
  id: string;
  type: ItemType;
  /** Stable identifier in the app index (family id, country name, substance, commodity). */
  ref: string;
  label: string;
  criticality: Criticality;
  note: string;
  added_at: string;
}

export interface FollowUp {
  case_key: string;
  source: CaseSource;
  item_id: string;
  status: FollowUpStatus;
  control_measure: string;
  frequency: string;
  owner: string;
  date_reviewed: string;
  comment: string;
  url: string;
}

export interface Baseline {
  ffn_latest: string | null;
  jrc_latest: string | null;
  ifs_latest: string | null;
  data_generated_at: string | null;
}

export interface HistoryEntry {
  at: string;
  event: "import" | "export" | "status_change" | "edit";
  detail: string;
}

export interface PerimeterPackage {
  format: string;
  schema_version: number;
  app_version: string;
  created_at: string;
  updated_at: string;
  owner: { company: string; site: string; author: string };
  baseline: Baseline;
  perimeter: PerimeterItem[];
  known_cases: { ffn: string[]; jrc: string[]; ifs: string[] };
  follow_up: FollowUp[];
  history: HistoryEntry[];
}

export const emptyPackage = (appVersion: string): PerimeterPackage => ({
  format: FORMAT,
  schema_version: SCHEMA_VERSION,
  app_version: appVersion,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  owner: { company: "", site: "", author: "" },
  baseline: { ffn_latest: null, jrc_latest: null, ifs_latest: null, data_generated_at: null },
  perimeter: [],
  known_cases: { ffn: [], jrc: [], ifs: [] },
  follow_up: [],
  history: [],
});

export const CRITICALITIES: Criticality[] = ["haute", "moyenne", "faible"];
export const FOLLOWUP_STATUSES: FollowUpStatus[] = ["a_evaluer", "evalue", "non_pertinent"];

export const criticalityLabel = (c: Criticality, lang: Lang) =>
  ({ fr: { haute: "Haute", moyenne: "Moyenne", faible: "Faible" }, en: { haute: "High", moyenne: "Medium", faible: "Low" } }[lang][c]);

export const statusLabel = (s: FollowUpStatus, lang: Lang) =>
  ({
    fr: { a_evaluer: "À évaluer", evalue: "Évalué", non_pertinent: "Non pertinent" },
    en: { a_evaluer: "To assess", evalue: "Assessed", non_pertinent: "Not relevant" },
  }[lang][s]);

export const typeLabel = (t: ItemType, lang: Lang) =>
  ({
    fr: { family: "Matière", origin: "Origine", substance: "Danger / substance", commodity: "Produit" },
    en: { family: "Material", origin: "Origin", substance: "Hazard / substance", commodity: "Product" },
  }[lang][t]);

export const sourceLabel = (s: CaseSource, lang: Lang) =>
  ({
    fr: { ffn: "Suspicions UE (FFN)", jrc: "Fraude presse (JRC)", ifs: "Rappels IFS" },
    en: { ffn: "EU suspicions (FFN)", jrc: "Press fraud (JRC)", ifs: "IFS recalls" },
  }[lang][s]);

export const newId = () =>
  (crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

const clip = (s: unknown) => (typeof s === "string" ? s.slice(0, MAX_TEXT) : "");

/** ─── Stable case keys ────────────────────────────────────────────────────────
 *  Deterministic from the source data (no random ids): a case keeps its key
 *  across pipeline rebuilds as long as its content does not change.
 */
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export const ffnCaseKey = (c: { report_id: string; commodity: string; issue: string; origin_normalized: string }) =>
  `ffn|${c.report_id}|${norm(c.commodity)}|${norm(c.issue).slice(0, 120)}|${c.origin_normalized}`;

export const jrcCaseKey = (id: string) => `jrc|${id}`;

export const ifsRecallKey = (reportId: string, country: string) => `ifs|${reportId}|${country}`;

export const parseCaseKey = (key: string): { source: CaseSource } => {
  const head = key.split("|", 1)[0];
  return { source: head === "jrc" ? "jrc" : head === "ifs" ? "ifs" : "ffn" };
};

/** Basic shape validation + sanitisation of text fields. Never trusts the file. */
export function validatePackage(raw: unknown): { ok: true; pkg: PerimeterPackage } | { ok: false; reason: string } {
  if (!raw || typeof raw !== "object") return { ok: false, reason: "not_object" };
  const p = raw as Record<string, unknown>;
  if (p.format !== FORMAT) return { ok: false, reason: "bad_format" };
  if (typeof p.schema_version !== "number") return { ok: false, reason: "bad_version" };
  if (p.schema_version > SCHEMA_VERSION) return { ok: false, reason: "future_version" };
  if (!Array.isArray(p.perimeter)) return { ok: false, reason: "bad_perimeter" };
  if (!Array.isArray(p.follow_up)) return { ok: false, reason: "bad_followup" };

  const perimeter: PerimeterItem[] = [];
  for (const it of p.perimeter as Record<string, unknown>[]) {
    if (!it || typeof it !== "object") continue;
    if (typeof it.type !== "string" || !["family", "origin", "substance", "commodity"].includes(it.type)) continue;
    if (typeof it.ref !== "string" || !it.ref) continue;
    perimeter.push({
      id: typeof it.id === "string" && it.id ? it.id : newId(),
      type: it.type as ItemType,
      ref: it.ref,
      label: clip(it.label) || String(it.ref),
      criticality: (["haute", "moyenne", "faible"].includes(it.criticality as string) ? it.criticality : "moyenne") as Criticality,
      note: clip(it.note),
      added_at: typeof it.added_at === "string" ? it.added_at : new Date().toISOString(),
    });
  }

  const knownIn = (p.known_cases ?? {}) as Record<string, unknown>;
  const list = (v: unknown) => (Array.isArray(v) ? (v as unknown[]).filter((x): x is string => typeof x === "string") : []);
  const known_cases = { ffn: list(knownIn.ffn), jrc: list(knownIn.jrc), ifs: list(knownIn.ifs) };

  const follow_up: FollowUp[] = [];
  for (const f of p.follow_up as Record<string, unknown>[]) {
    if (!f || typeof f !== "object") continue;
    if (typeof f.case_key !== "string" || !f.case_key) continue;
    follow_up.push({
      case_key: f.case_key,
      source: (["ffn", "jrc", "ifs"].includes(f.source as string) ? f.source : "ffn") as CaseSource,
      item_id: typeof f.item_id === "string" ? f.item_id : "",
      status: (FOLLOWUP_STATUSES.includes(f.status as FollowUpStatus) ? f.status : "a_evaluer") as FollowUpStatus,
      control_measure: clip(f.control_measure),
      frequency: clip(f.frequency),
      owner: clip(f.owner),
      date_reviewed: clip(f.date_reviewed),
      comment: clip(f.comment),
      url: clip(f.url),
    });
  }

  const own = (p.owner ?? {}) as Record<string, unknown>;
  const base = (p.baseline ?? {}) as Record<string, unknown>;
  const pkg: PerimeterPackage = {
    format: FORMAT,
    schema_version: SCHEMA_VERSION, // migrations applied by io.ts before validation
    app_version: clip(p.app_version),
    created_at: typeof p.created_at === "string" ? p.created_at : new Date().toISOString(),
    updated_at: typeof p.updated_at === "string" ? p.updated_at : new Date().toISOString(),
    owner: { company: clip(own.company), site: clip(own.site), author: clip(own.author) },
    baseline: {
      ffn_latest: typeof base.ffn_latest === "string" ? base.ffn_latest : null,
      jrc_latest: typeof base.jrc_latest === "string" ? base.jrc_latest : null,
      ifs_latest: typeof base.ifs_latest === "string" ? base.ifs_latest : null,
      data_generated_at: typeof base.data_generated_at === "string" ? base.data_generated_at : null,
    },
    perimeter,
    known_cases,
    follow_up,
    history: Array.isArray(p.history)
      ? (p.history as Record<string, unknown>[]).slice(-200).map((h) => ({
          at: typeof h.at === "string" ? h.at : "",
          event: (["import", "export", "status_change", "edit"].includes(h.event as string) ? h.event : "edit") as HistoryEntry["event"],
          detail: clip(h.detail),
        }))
      : [],
  };
  return { ok: true, pkg };
}
