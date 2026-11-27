import type { FfnCase, JrcIncident, RecallEntry, RiskIndex } from "../types";
import { caseOrigins } from "../pages/shared";
import type { PerimeterItem } from "./model";
import { ffnCaseKey, ifsRecallKey, jrcCaseKey } from "./model";

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

/** Case keys + display info for one item, for the New cases list and the follow-up table. */
export interface CaseRef {
  key: string;
  source: "ffn" | "jrc" | "ifs";
  item_id: string;
  /** Stable human reference (audit trail): source short code + month + slug. */
  reference: string;
  date: string;
  summary: string;
  url: string;
}

const slug = (s: string) => norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

export function caseRefs(item: PerimeterItem, m: ReturnType<typeof matchesItem>): CaseRef[] {
  const out: CaseRef[] = [];
  for (const c of m.ffn)
    out.push({
      key: ffnCaseKey(c),
      source: "ffn",
      item_id: item.id,
      reference: `FFN-${c.report_id}-${slug(c.commodity || c.product_category)}`,
      date: c.publication_date || c.report_id,
      summary: `${c.commodity || c.product_category} — ${c.issue}`,
      url: c.source_url,
    });
  for (const c of m.jrc)
    out.push({
      key: jrcCaseKey(c.id),
      source: "jrc",
      item_id: item.id,
      reference: `JRC-${c.date || c.month}-${slug(c.description).slice(0, 30) || c.id}`,
      date: c.date || c.month,
      summary: c.description || c.categories.join(" · "),
      url: c.urls[0] || c.pdf_url,
    });
  for (const r of m.ifs)
    out.push({
      key: ifsRecallKey(r.report_id, r.country_normalized),
      source: "ifs",
      item_id: item.id,
      reference: `IFS-${r.report_id}-${slug(r.country_normalized)}`,
      date: r.publication_date || r.report_id,
      summary: `${r.country_normalized} — ${r.value} ${r.value === 1 ? "recall" : "recalls"} (${r.month} ${r.year})`,
      url: r.source_url,
    });
  return out;
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
