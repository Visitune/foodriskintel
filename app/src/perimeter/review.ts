import type { CaseRef } from "./match";
import type { Criticality, FollowUp, HistoryScope, PerimeterItem, PerimeterPackage, ReviewRecord } from "./model";
import { nextReview } from "./model";

/** ─── Monthly review — pure functions ─────────────────────────────────────────
 *  Queue = FFN and JRC cases never decided, grouped into topics.
 *  IFS entries are monthly totals per country, not cases: shown as context only.
 */

const RANK: Record<Criticality, number> = { haute: 0, moyenne: 1, faible: 2 };

/** A case appears once, even when several perimeter items match it. */
export interface PerimeterCase extends CaseRef {
  /** Matching items, most critical first. `item_id` is the first one. */
  item_ids: string[];
}

export function uniqueCases(items: PerimeterItem[], perItem: Record<string, CaseRef[]>): PerimeterCase[] {
  const out = new Map<string, PerimeterCase>();
  const ordered = [...items].sort((a, b) => RANK[a.criticality] - RANK[b.criticality]);
  for (const item of ordered)
    for (const ref of perItem[item.id] ?? []) {
      const seen = out.get(ref.key);
      if (seen) seen.item_ids.push(item.id);
      else out.set(ref.key, { ...ref, item_ids: [item.id] });
    }
  return [...out.values()];
}

export const knownKeys = (pkg: PerimeterPackage) => new Set([...pkg.known_cases.ffn, ...pkg.known_cases.jrc, ...pkg.known_cases.ifs]);

/** Start of the current review: end of the last closed one. */
export const sessionStart = (pkg: PerimeterPackage) => pkg.reviews.at(-1)?.closed_at ?? "";

export interface Queue {
  /** Still to decide in this review. */
  open: PerimeterCase[];
  /** "Decide later" during this review. */
  deferred: PerimeterCase[];
}

export function buildQueue(pkg: PerimeterPackage, cases: PerimeterCase[]): Queue {
  const known = knownKeys(pkg);
  const byKey = new Map(pkg.follow_up.map((f) => [f.case_key, f]));
  const waiting = new Set(pkg.perimeter.filter((i) => i.history_scope === "" || i.history_scope === "v1").map((i) => i.id));
  const since = sessionStart(pkg);
  const open: PerimeterCase[] = [];
  const deferred: PerimeterCase[] = [];
  for (const c of cases) {
    if (c.source === "ifs") continue;
    const f = byKey.get(c.key);
    if (f) {
      if (f.status !== "a_evaluer") continue;
      (f.decided_at > since ? deferred : open).push(c);
    } else if (!known.has(c.key) && !c.item_ids.every((id) => waiting.has(id))) {
      open.push(c);
    }
  }
  return { open, deferred };
}

export interface Topic {
  id: string;
  item_id: string;
  source: CaseRef["source"];
  problem: string;
  criticality: Criticality;
  /** Sorted by product, newest first within a product. */
  cases: PerimeterCase[];
  /** Distinct product names, most cases first. */
  products: string[];
}

export const productKey = (name: string) => name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

/** Same item, same source, same kind of problem = one topic. Grouping by product
 *  as well leaves almost one topic per case on real data. */
export function groupTopics(cases: PerimeterCase[], items: PerimeterItem[]): Topic[] {
  const itemById = new Map(items.map((i) => [i.id, i]));
  const out = new Map<string, Topic>();
  for (const c of cases) {
    const id = [c.item_id, c.source, c.problem].join("|");
    const topic = out.get(id);
    if (topic) topic.cases.push(c);
    else out.set(id, {
      id, item_id: c.item_id, source: c.source, problem: c.problem,
      criticality: itemById.get(c.item_id)?.criticality ?? "moyenne", cases: [c], products: [],
    });
  }
  const topics = [...out.values()];
  for (const t of topics) {
    const count = new Map<string, { name: string; n: number }>();
    for (const c of t.cases) {
      const k = productKey(c.product);
      const entry = count.get(k);
      if (entry) entry.n += 1;
      else count.set(k, { name: c.product, n: 1 });
    }
    const ranked = [...count.entries()].sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0]));
    const order = new Map(ranked.map(([k], i) => [k, i]));
    t.products = ranked.map(([, v]) => v.name);
    t.cases.sort((a, b) => order.get(productKey(a.product))! - order.get(productKey(b.product))! || b.month.localeCompare(a.month) || b.date.localeCompare(a.date));
  }
  return topics.sort((a, b) =>
    RANK[a.criticality] - RANK[b.criticality] || b.cases.length - a.cases.length || a.id.localeCompare(b.id));
}

/** ─── Starting point ───────────────────────────────────────────────────────── */

export type StartScope = Extract<HistoryScope, "1m" | "3m" | "all" | "next">;

const monthIndex = (ym: string) => Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1;

/** Latest month published by each source (periods are measured from there, not from today). */
export function latestMonths(sources: { ffn: { month: string }[]; jrc: { month: string }[] }) {
  const max = (list: { month: string }[]) => list.reduce((m, c) => (c.month > m ? c.month : m), "");
  return { ffn: max(sources.ffn), jrc: max(sources.jrc) };
}

export function inScope(c: CaseRef, scope: StartScope, latest: { ffn: string; jrc: string }): boolean {
  if (scope === "all") return true;
  if (scope === "next" || c.source === "ifs") return false;
  const months = scope === "1m" ? 1 : 3;
  return monthIndex(latest[c.source]) - monthIndex(c.month) < months;
}

/** Cases concerned by the starting-point choice of the items still waiting for it. */
export function startCandidates(pkg: PerimeterPackage, cases: PerimeterCase[]): PerimeterCase[] {
  const waiting = new Set(pkg.perimeter.filter((i) => i.history_scope === "").map((i) => i.id));
  const known = knownKeys(pkg);
  const followed = new Set(pkg.follow_up.map((f) => f.case_key));
  // A case already watched through another item keeps its current state.
  return cases.filter((c) => c.item_ids.every((id) => waiting.has(id)) && !known.has(c.key) && !followed.has(c.key));
}

/** ─── Carrying v1 files over ───────────────────────────────────────────────── */

/** Rewrites v1 keys once the datasets are complete. Returns `pkg` when nothing changes.
 *  A v1 key could cover several rows; its decision goes to the row v1 displayed
 *  (the last one), the others are not given a decision nobody took. */
export function upgradeKeys(pkg: PerimeterPackage, cases: PerimeterCase[]): PerimeterPackage {
  const current = new Set(cases.map((c) => c.key));
  const byLegacy = new Map<string, string[]>();
  for (const c of cases) {
    if (c.legacy_key === c.key) continue;
    const list = byLegacy.get(c.legacy_key);
    if (list) list.push(c.key);
    else byLegacy.set(c.legacy_key, [c.key]);
  }
  let changed = false;

  const followed = new Set(pkg.follow_up.map((f) => f.case_key));
  const follow_up = pkg.follow_up.map((f) => {
    if (current.has(f.case_key)) return f;
    const target = byLegacy.get(f.case_key)?.at(-1);
    if (!target || followed.has(target)) return f;
    followed.add(target);
    changed = true;
    return { ...f, case_key: target };
  });

  const upgrade = (list: string[]) => {
    const next = new Set(list);
    for (const k of list) {
      const targets = byLegacy.get(k);
      if (!targets) continue;
      next.delete(k);
      for (const t of targets) next.add(t);
      changed = true;
    }
    return [...next];
  };
  const known_cases = { ffn: upgrade(pkg.known_cases.ffn), jrc: upgrade(pkg.known_cases.jrc), ifs: pkg.known_cases.ifs };

  const watched = new Set([...known_cases.ffn, ...known_cases.jrc, ...known_cases.ifs, ...follow_up.map((f) => f.case_key)]);
  const perimeter = pkg.perimeter.map((item) => {
    if (item.history_scope !== "v1") return item;
    changed = true;
    const started = cases.some((c) => c.item_ids.includes(item.id) && watched.has(c.key));
    return { ...item, history_scope: (started ? "legacy" : "") as HistoryScope };
  });

  return changed ? { ...pkg, perimeter, known_cases, follow_up } : pkg;
}

/** ─── Review summary and suggestions ───────────────────────────────────────── */

export function sessionSummary(pkg: PerimeterPackage): Pick<ReviewRecord, "discarded" | "controlled" | "actions" | "deferred"> {
  const since = sessionStart(pkg);
  const s = { discarded: 0, controlled: 0, actions: 0, deferred: 0 };
  for (const f of pkg.follow_up) {
    if (!f.decided_at || f.decided_at <= since) continue;
    if (f.status === "non_pertinent") s.discarded += 1;
    else if (f.status === "evalue") s.controlled += 1;
    else if (f.status === "action_prevue") s.actions += 1;
    else s.deferred += 1;
  }
  return s;
}

/** Controlled cases whose review date has passed, and planned actions past their due date. */
export function deadlines(pkg: PerimeterPackage, day: string) {
  const reviews = pkg.follow_up.filter((f) => { const next = nextReview(f); return !!next && next < day; });
  const actions = pkg.follow_up.filter((f) => f.status === "action_prevue" && !!f.due_date && f.due_date < day);
  return { reviews, actions };
}

/** Average new cases per month over the last 12 published months of each source (IFS excluded). */
export function monthlyVolume(cases: CaseRef[], latest: { ffn: string; jrc: string }): number {
  const n = cases.filter((c) => c.source !== "ifs" && monthIndex(latest[c.source]) - monthIndex(c.month) < 12).length;
  return n / 12;
}

/** Latest entry typed for this item with this kind of decision: offered, never applied by itself. */
export function lastEntry(pkg: PerimeterPackage, itemId: string, status: FollowUp["status"]): FollowUp | undefined {
  return pkg.follow_up
    .filter((f) => f.item_id === itemId && f.status === status && f.control_measure)
    .sort((a, b) => b.decided_at.localeCompare(a.decided_at))[0];
}
