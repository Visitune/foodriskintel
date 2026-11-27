import type { Lang } from "../i18n";

/** ─── Package format "food-risk-intelligence/perimeter" (.vey) ────────────────
 *  A .vey file is plain JSON, UTF-8, readable in any text editor.
 *  It holds references (ids, urls, dates) and the user's own notes — never
 *  report content (IFS copyright). It is the user's single source of truth:
 *  the browser only keeps an unsaved draft.
 */

export const SCHEMA_VERSION = 2;
export const FORMAT = "food-risk-intelligence/perimeter";
export const EXTENSION = ".vey";
/** Hard size limit for an imported file. Sized so that the app can always
 *  reload what it wrote, even with every published case in the register. */
export const MAX_FILE_BYTES = 20_000_000;
/** Max length of free-text fields (keeps the file small and focused). */
export const MAX_TEXT = 500;

export type ItemType = "family" | "origin" | "substance" | "commodity";
export type Criticality = "haute" | "moyenne" | "faible";
export type CaseSource = "ffn" | "jrc" | "ifs";
export type FollowUpStatus = "a_evaluer" | "evalue" | "action_prevue" | "non_pertinent";
export type DecisionReason = "" | "produit_non_utilise" | "origine_non_concernee" | "autre";
/** Where an item's watch starts. "" = still to choose. "v1" = read from a v1 file,
 *  resolved once the datasets are loaded. "legacy" = already watched in v1. */
export type HistoryScope = "" | "v1" | "legacy" | "1m" | "3m" | "all" | "next";

export interface PerimeterItem {
  id: string;
  type: ItemType;
  /** Stable identifier in the app index (family id, country name, substance, commodity). */
  ref: string;
  label: string;
  criticality: Criticality;
  note: string;
  added_at: string;
  history_scope: HistoryScope;
  /** Cases older than the starting point: recorded as known, never as reviewed. */
  history_skipped: number;
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
  decision_reason: DecisionReason;
  /** YYYY-MM-DD, for planned actions. */
  due_date: string;
  /** ISO timestamp of the last decision. "" for v1 entries. */
  decided_at: string;
  /** Months between two reviews of a controlled case; 0 = none set. */
  every_months: number;
  /** Optional IFS requirement, typed by the user (never pre-filled). */
  ifs_ref: string;
}

export interface ReviewRecord {
  closed_at: string;
  discarded: number;
  controlled: number;
  actions: number;
  deferred: number;
  data: Baseline;
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
  reviews: ReviewRecord[];
  /** The company's usual control measures, offered while deciding. */
  measures: string[];
  history: HistoryEntry[];
}

export const DEFAULT_MEASURES = [
  "Analyse de laboratoire",
  "Audit fournisseur",
  "Certificat d'origine ou d'authenticité",
  "Spécification matière première",
  "Contrôle à réception",
];
export const MAX_MEASURES = 50;
export const MAX_HISTORY = 1000;

export const PERIODS = [0, 1, 3, 6, 12, 24];

export const periodLabel = (months: number, lang: Lang) => {
  if (!months) return lang === "fr" ? "Sans périodicité" : "No period";
  if (months === 12) return lang === "fr" ? "Tous les ans" : "Yearly";
  if (months === 1) return lang === "fr" ? "Tous les mois" : "Monthly";
  return lang === "fr" ? `Tous les ${months} mois` : `Every ${months} months`;
};

/** YYYY-MM-DD of the next review of a controlled case, "" when none applies. */
export function nextReview(f: Pick<FollowUp, "status" | "date_reviewed" | "every_months">): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(f.date_reviewed);
  if (f.status !== "evalue" || !f.every_months || !m) return "";
  const total = Number(m[1]) * 12 + Number(m[2]) - 1 + f.every_months;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  // 31 January + 1 month is the last day of February.
  const day = Math.min(Number(m[3]), new Date(Date.UTC(year, month, 0)).getUTCDate());
  const p = (n: number) => String(n).padStart(2, "0");
  return `${year}-${p(month)}-${p(day)}`;
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
  reviews: [],
  measures: [...DEFAULT_MEASURES],
  history: [],
});

export const CRITICALITIES: Criticality[] = ["haute", "moyenne", "faible"];
export const FOLLOWUP_STATUSES: FollowUpStatus[] = ["a_evaluer", "evalue", "action_prevue", "non_pertinent"];
export const DECISION_REASONS: Exclude<DecisionReason, "">[] = ["produit_non_utilise", "origine_non_concernee", "autre"];

export const reasonLabel = (r: DecisionReason, lang: Lang) =>
  r === "" ? "" : ({
    fr: { produit_non_utilise: "Produit non utilisé", origine_non_concernee: "Origine non concernée", autre: "Autre motif" },
    en: { produit_non_utilise: "Product not used", origine_non_concernee: "Origin not concerned", autre: "Other reason" },
  }[lang][r]);

export const scopeLabel = (s: HistoryScope, lang: Lang) =>
  ({
    fr: { "": "À choisir", v1: "—", legacy: "Suivi repris", "1m": "Dernier mois", "3m": "3 derniers mois", all: "Tout l'historique", next: "Prochaines publications" },
    en: { "": "To choose", v1: "—", legacy: "Carried over", "1m": "Last month", "3m": "Last 3 months", all: "Full history", next: "Next releases only" },
  }[lang][s]);

export const criticalityLabel = (c: Criticality, lang: Lang) =>
  ({ fr: { haute: "Haute", moyenne: "Moyenne", faible: "Faible" }, en: { haute: "High", moyenne: "Medium", faible: "Low" } }[lang][c]);

export const statusLabel = (s: FollowUpStatus, lang: Lang) =>
  ({
    fr: { a_evaluer: "À évaluer", evalue: "Maîtrisé (évalué)", action_prevue: "Action à prévoir", non_pertinent: "Non pertinent" },
    en: { a_evaluer: "To assess", evalue: "Controlled (assessed)", action_prevue: "Action planned", non_pertinent: "Not relevant" },
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
const count = (n: unknown) => (typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);
const SCOPES: HistoryScope[] = ["", "v1", "legacy", "1m", "3m", "all", "next"];

/** ─── Stable case keys ────────────────────────────────────────────────────────
 *  Built from the source content, never from a row position. Rows that are
 *  strictly identical in the source share one key (shown as "×n").
 *  The v1 builders are kept to carry old files over.
 */
const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const tidy = (s: string) => norm(s).replace(/\s+/g, " ").trim();

/** cyrb53 — small synchronous 53-bit string hash (not cryptographic). */
export function hashText(text: string): string {
  let a = 0xdeadbeef, b = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 2654435761);
    b = Math.imul(b ^ c, 1597334677);
  }
  a = Math.imul(a ^ (a >>> 16), 2246822507) ^ Math.imul(b ^ (b >>> 13), 3266489909);
  b = Math.imul(b ^ (b >>> 16), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909);
  return (4294967296 * (2097151 & b) + (a >>> 0)).toString(36);
}

export const ffnCaseKey = (c: { report_id: string; commodity: string; issue: string; origin_raw: string; notified_by_raw: string; classification: string; product_category: string }) =>
  `ffn|${c.report_id}|${hashText([c.commodity, c.issue, c.origin_raw, c.notified_by_raw, c.classification, c.product_category].map(tidy).join("\u0001"))}`;

export const ffnLegacyKey = (c: { report_id: string; commodity: string; issue: string; origin_normalized: string }) =>
  `ffn|${c.report_id}|${norm(c.commodity)}|${norm(c.issue).slice(0, 120)}|${c.origin_normalized}`;

export const jrcCaseKey = (c: { report_id: string; date: string | null; description: string; urls: string[] }) =>
  `jrc|${c.report_id}|${hashText([c.date ?? "", tidy(c.description), c.urls[0] ?? ""].join("\u0001"))}`;

export const jrcLegacyKey = (id: string) => `jrc|${id}`;

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
      history_scope: (p.schema_version as number) < 2
        ? "v1"
        : SCOPES.includes(it.history_scope as HistoryScope) ? (it.history_scope as HistoryScope) : "",
      history_skipped: count(it.history_skipped),
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
      decision_reason: (DECISION_REASONS as string[]).includes(f.decision_reason as string) ? (f.decision_reason as DecisionReason) : "",
      due_date: clip(f.due_date),
      decided_at: clip(f.decided_at),
      every_months: Math.min(count(f.every_months), 120),
      ifs_ref: clip(f.ifs_ref),
    });
  }

  const own = (p.owner ?? {}) as Record<string, unknown>;
  const baselineOf = (v: unknown): Baseline => {
    const base = (v ?? {}) as Record<string, unknown>;
    const text = (x: unknown) => (typeof x === "string" ? x : null);
    return { ffn_latest: text(base.ffn_latest), jrc_latest: text(base.jrc_latest), ifs_latest: text(base.ifs_latest), data_generated_at: text(base.data_generated_at) };
  };
  const reviews: ReviewRecord[] = Array.isArray(p.reviews)
    ? (p.reviews as Record<string, unknown>[]).filter((r) => r && typeof r.closed_at === "string").map((r) => ({
        closed_at: r.closed_at as string,
        discarded: count(r.discarded),
        controlled: count(r.controlled),
        actions: count(r.actions),
        deferred: count(r.deferred),
        data: baselineOf(r.data),
      }))
    : [];
  const pkg: PerimeterPackage = {
    format: FORMAT,
    schema_version: SCHEMA_VERSION, // fields missing from v1 are defaulted above
    app_version: clip(p.app_version),
    created_at: typeof p.created_at === "string" ? p.created_at : new Date().toISOString(),
    updated_at: typeof p.updated_at === "string" ? p.updated_at : new Date().toISOString(),
    owner: { company: clip(own.company), site: clip(own.site), author: clip(own.author) },
    baseline: baselineOf(p.baseline),
    perimeter,
    known_cases,
    follow_up,
    reviews,
    // An empty list is a choice; only a missing one gets the defaults.
    measures: Array.isArray(p.measures) ? [...new Set(list(p.measures).map(clip).filter(Boolean))].slice(0, MAX_MEASURES) : [...DEFAULT_MEASURES],
    history: Array.isArray(p.history)
      ? (p.history as Record<string, unknown>[]).slice(-MAX_HISTORY).map((h) => ({
          at: typeof h.at === "string" ? h.at : "",
          event: (["import", "export", "status_change", "edit"].includes(h.event as string) ? h.event : "edit") as HistoryEntry["event"],
          detail: clip(h.detail),
        }))
      : [],
  };
  return { ok: true, pkg };
}
