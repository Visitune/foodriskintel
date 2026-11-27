import type { PerimeterPackage } from "./model";
import type { CaseRef } from "./match";

/** ─── Update logic ────────────────────────────────────────────────────────────
 *  "New" = a case matching the perimeter that is not in known_cases.
 *  "Disappeared" = a follow-up case no longer visible in the current source
 *  (re-extraction can remove a case) — never deleted, only flagged.
 */

export interface DiffResult {
  newCases: CaseRef[];
  /** follow_up case_keys absent from the current source. */
  disappeared: string[];
  counts: { ffn: number; jrc: number; ifs: number };
}

export function diffAgainstPackage(pkg: PerimeterPackage, current: CaseRef[]): DiffResult {
  const known = new Set([...pkg.known_cases.ffn, ...pkg.known_cases.jrc, ...pkg.known_cases.ifs]);
  const seen = pkg.follow_up.map((f) => f.case_key);
  const newCases: CaseRef[] = [];
  const counts = { ffn: 0, jrc: 0, ifs: 0 };
  for (const c of current) {
    if (known.has(c.key) || seen.includes(c.key)) continue;
    counts[c.source] += 1;
    newCases.push(c);
  }
  const currentKeys = new Set(current.map((c) => c.key));
  const disappeared = pkg.follow_up.map((f) => f.case_key).filter((k) => !currentKeys.has(k));
  return { newCases, disappeared: [...new Set(disappeared)], counts };
}

/** Human-readable merge preview, shown before an import is accepted. */
export interface ImportPreview {
  items: number;
  followUps: number;
  newCases: number;
  disappeared: number;
  baselineChanges: string[];
}

export function previewImport(pkg: PerimeterPackage, current: CaseRef[], baselineNow: PerimeterPackage["baseline"], lang: "fr" | "en"): ImportPreview {
  const d = diffAgainstPackage(pkg, current);
  const changes: string[] = [];
  const pairs: ["ffn" | "jrc" | "ifs", string | null, string | null][] = [
    ["ffn", pkg.baseline.ffn_latest, baselineNow.ffn_latest],
    ["jrc", pkg.baseline.jrc_latest, baselineNow.jrc_latest],
    ["ifs", pkg.baseline.ifs_latest, baselineNow.ifs_latest],
  ];
  const srcName = { ffn: "FFN", jrc: "JRC", ifs: "IFS" };
  for (const [s, was, now] of pairs) {
    if (was && now && was !== now) changes.push(lang === "fr" ? `${srcName[s]} : ${was} → ${now}` : `${srcName[s]}: ${was} → ${now}`);
  }
  return {
    items: pkg.perimeter.length,
    followUps: pkg.follow_up.length,
    newCases: d.newCases.length,
    disappeared: d.disappeared.length,
    baselineChanges: changes,
  };
}
