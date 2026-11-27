import type { FfnCase, JrcIncident, RecallEntry, RiskIndex } from "../types";
import { caseOrigins } from "../pages/shared";
import type { PerimeterItem } from "./model";
import { ffnCaseKey, ffnLegacyKey, hashText, ifsRecallKey, jrcCaseKey, jrcLegacyKey } from "./model";

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export interface Datasets {
  ffn: FfnCase[];
  jrc: JrcIncident[];
  ifs: { recalls: RecallEntry[] };
}

/** All cases matching one perimeter item — same rules as the Material / Origin pages. */
export function matchesItem(item: PerimeterItem, d: Datasets): { ffn: FfnCase[]; jrc: JrcIncident[]; ifs: RecallEntry[] } {
  const ref = norm(item.ref);
  const ffn: FfnCase[] = [];
  const jrc: JrcIncident[] = [];
  const ifs: RecallEntry[] = [];
  switch (item.type) {
    case "family":
      for (const c of d.ffn) if (c.material_family === item.ref) ffn.push(c);
      for (const c of d.jrc) if (c.material_family === item.ref) jrc.push(c);
      break;
    case "origin":
      for (const c of d.ffn) if (caseOrigins(c).some((o) => norm(o) === ref)) ffn.push(c);
      for (const c of d.jrc) if (c.countries.some((o) => norm(o) === ref)) jrc.push(c);
      for (const r of d.ifs.recalls) if (norm(r.country_normalized) === ref) ifs.push(r);
      break;
    case "substance":
      for (const c of d.ffn) if ((c.substances || []).some((s) => norm(s) === ref)) ffn.push(c);
      break;
    case "commodity":
      for (const c of d.ffn) if (norm(c.commodity) === ref) ffn.push(c);
      break;
  }
  return { ffn, jrc, ifs };
}

/** Case keys + display info for one item. One entry per distinct key. */
export interface CaseRef {
  key: string;
  /** Key written by v1 files for this case. */
  legacy_key: string;
  source: "ffn" | "jrc" | "ifs";
  item_id: string;
  /** Stable human reference (audit trail): source + month + slug + suffix. */
  reference: string;
  date: string;
  /** YYYY-MM, used for the starting point. */
  month: string;
  summary: string;
  url: string;
  /** Grouping of the monthly review. */
  product: string;
  /** FFN classification group or JRC fraud reason key (labels come from the index). */
  problem: string;
  substance: string;
  origins: string[];
  /** Identical rows in the source. */
  rows: number;
}

const slug = (s: string) => norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);
const suffix = (key: string) => hashText(key).slice(-4);
const ym = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}`;

export function caseRefs(item: PerimeterItem, m: ReturnType<typeof matchesItem>): CaseRef[] {
  const out = new Map<string, CaseRef>();
  const push = (r: CaseRef) => {
    const seen = out.get(r.key);
    if (seen) seen.rows += 1;
    else out.set(r.key, r);
  };
  for (const c of m.ffn) {
    const key = ffnCaseKey(c);
    push({
      key,
      legacy_key: ffnLegacyKey(c),
      source: "ffn",
      item_id: item.id,
      reference: `FFN-${c.report_id}-${slug(c.commodity || c.product_category)}-${suffix(key)}`,
      date: c.publication_date || c.report_id,
      month: ym(c.year, c.month_num),
      summary: `${c.commodity || c.product_category} — ${c.issue}`,
      url: c.source_url,
      product: c.commodity || c.product_category,
      problem: c.classification_group || "unknown",
      substance: c.substances?.[0] ?? "",
      origins: caseOrigins(c),
      rows: 1,
    });
  }
  for (const c of m.jrc) {
    const key = jrcCaseKey(c);
    push({
      key,
      legacy_key: jrcLegacyKey(c.id),
      source: "jrc",
      item_id: item.id,
      reference: `JRC-${c.date || c.month}-${slug(c.description) || c.id}-${suffix(key)}`,
      date: c.date || c.month,
      month: c.month,
      summary: c.description || c.categories.join(" · "),
      url: c.urls[0] || c.pdf_url,
      product: c.categories.find((x) => !x.toLowerCase().startsWith("other food")) ?? c.categories[0] ?? "",
      problem: c.reasons[0] ?? "unknown",
      substance: "",
      origins: c.countries,
      rows: 1,
    });
  }
  // IFS publishes one count per sub-region (England / Scotland, FDA / USDA): add them up.
  const totals = new Map<string, { entry: RecallEntry; value: number }>();
  for (const r of m.ifs) {
    const key = ifsRecallKey(r.report_id, r.country_normalized);
    const t = totals.get(key);
    if (t) t.value += r.value;
    else totals.set(key, { entry: r, value: r.value });
  }
  for (const [key, { entry: r, value }] of totals)
    push({
      key,
      legacy_key: key,
      source: "ifs",
      item_id: item.id,
      reference: `IFS-${r.report_id}-${slug(r.country_normalized)}`,
      date: r.publication_date || r.report_id,
      month: ym(r.year, r.month_num),
      summary: `${r.country_normalized} — ${value} ${value === 1 ? "recall" : "recalls"} (${r.month} ${r.year})`,
      url: r.source_url,
      product: r.country_normalized,
      problem: "recall",
      substance: "",
      origins: [r.country_normalized],
      rows: 1,
    });
  return [...out.values()];
}

/** Build the datasets object from the app's lazy loaders' results. */
export const toDatasets = (ffn: { cases: FfnCase[] } | null, jrc: { incidents: JrcIncident[] } | null, ifs: { recalls: RecallEntry[] }): Datasets => ({
  ffn: ffn?.cases ?? [],
  jrc: jrc?.incidents ?? [],
  ifs,
});

/** Baseline labels for the status banner. */
export const baselineFromIndex = (index: RiskIndex) => ({
  ffn_latest: index.sources.ffn.latest,
  jrc_latest: index.sources.jrc.latest,
  ifs_latest: index.sources.ifs.latest,
  data_generated_at: index.generated_at,
});
