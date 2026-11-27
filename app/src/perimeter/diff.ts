import type { PerimeterPackage } from "./model";
import type { CaseRef } from "./match";
import { knownKeys } from "./review";

/** ─── Update logic ────────────────────────────────────────────────────────────
 *  "New" = a case matching the perimeter that is neither known nor followed.
 *  "Disappeared" = a follow-up case no longer visible in the current source
 *  (re-extraction can remove a case) — never deleted, only flagged.
 */
export function diffAgainstPackage(pkg: PerimeterPackage, current: CaseRef[]) {
  const known = knownKeys(pkg);
  const followed = new Set(pkg.follow_up.map((f) => f.case_key));
  const currentKeys = new Set<string>();
  const newCases: CaseRef[] = [];
  for (const c of current) {
    if (currentKeys.has(c.key)) continue;
    currentKeys.add(c.key);
    if (!known.has(c.key) && !followed.has(c.key)) newCases.push(c);
  }
  const disappeared = [...followed].filter((k) => !currentKeys.has(k));
  return { newCases, disappeared };
}
