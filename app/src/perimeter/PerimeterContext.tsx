import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState } from "react";
import type { Baseline, CaseSource, Criticality, DecisionReason, FollowUp, FollowUpStatus, HistoryEntry, ItemType, PerimeterItem, PerimeterPackage, ReviewRecord } from "./model";
import { emptyPackage, MAX_HISTORY, MAX_MEASURES, newId, validatePackage } from "./model";
import { loadDraft, saveDraft } from "./io";
import type { CaseRef } from "./match";
import type { StartScope } from "./review";

/** ─── Perimeter state ─────────────────────────────────────────────────────────
 *  The React state holds the working copy ("draft"). The browser copy in
 *  localStorage is a convenience between sessions; the .vey file the user
 *  downloads is the single source of truth. `dirty` = changes not in a file yet.
 */

export type Decision = {
  status: FollowUpStatus;
  decision_reason: DecisionReason;
  control_measure: string;
  frequency: string;
  owner: string;
  due_date: string;
  date_reviewed: string;
  comment: string;
  every_months: number;
  ifs_ref: string;
};

export type EditableField = "status" | "control_measure" | "frequency" | "owner" | "date_reviewed" | "due_date" | "comment" | "ifs_ref";
/** Fields that can be applied to several register entries at once. */
export type BulkPatch = Partial<Pick<Decision, "control_measure" | "owner" | "every_months" | "date_reviewed" | "due_date" | "ifs_ref">>;
export type UndoKind = { kind: "decision" | "item" | "case" | "bulk"; count: number };

type Action =
  | { t: "add_item"; type: ItemType; ref: string; label: string }
  | { t: "remove_item"; id: string }
  | { t: "set_criticality"; id: string; value: Criticality }
  | { t: "set_note"; id: string; note: string }
  | { t: "set_owner"; field: "company" | "site" | "author"; value: string }
  | { t: "set_followup"; key: string; field: EditableField; value: string }
  | { t: "remove_followup"; key: string }
  | { t: "decide"; cases: CaseRef[]; decision: Decision }
  | { t: "set_start"; scope: StartScope; itemIds: string[]; skipped: CaseRef[] }
  | { t: "bulk"; keys: string[]; patch: BulkPatch }
  | { t: "set_every"; key: string; months: number }
  | { t: "set_measures"; measures: string[] }
  | { t: "close_review"; record: ReviewRecord }
  | { t: "upgrade"; upgrade: (pkg: PerimeterPackage) => PerimeterPackage }
  | { t: "restore"; pkg: PerimeterPackage }
  | { t: "replace"; pkg: PerimeterPackage }
  | { t: "saved"; rev: number; baseline: Baseline; at: string };

export type { CaseSource, FollowUpStatus, Criticality, ItemType, FollowUp, PerimeterItem, PerimeterPackage };
export type { CaseRef };

interface State {
  pkg: PerimeterPackage;
  dirty: boolean;
  /** Bumped by every change: tells whether a file written a moment ago is still current. */
  rev: number;
}

const logged = (pkg: PerimeterPackage, event: HistoryEntry["event"], detail: string, at = new Date().toISOString()): PerimeterPackage => ({
  ...pkg,
  history: [...pkg.history, { at, event, detail }].slice(-MAX_HISTORY),
});

/** The package exactly as it is written to the file. */
export const asSaved = (pkg: PerimeterPackage, baseline: Baseline, at: string): PerimeterPackage =>
  logged({ ...pkg, baseline, updated_at: at }, "export", ".vey", at);

const addKnown = (pkg: PerimeterPackage, cases: CaseRef[]): PerimeterPackage["known_cases"] => {
  const next = { ffn: new Set(pkg.known_cases.ffn), jrc: new Set(pkg.known_cases.jrc), ifs: new Set(pkg.known_cases.ifs) };
  for (const c of cases) next[c.source].add(c.key);
  return { ffn: [...next.ffn], jrc: [...next.jrc], ifs: [...next.ifs] };
};

function edit(pkg: PerimeterPackage, a: Action): PerimeterPackage {
  switch (a.t) {
    case "add_item":
      if (pkg.perimeter.some((i) => i.type === a.type && i.ref === a.ref)) return pkg;
      return { ...pkg, perimeter: [...pkg.perimeter, { id: newId(), type: a.type, ref: a.ref, label: a.label || a.ref, criticality: "moyenne", note: "", added_at: new Date().toISOString(), history_scope: "", history_skipped: 0 }] };
    case "remove_item":
      return { ...pkg, perimeter: pkg.perimeter.filter((i) => i.id !== a.id), follow_up: pkg.follow_up.filter((f) => f.item_id !== a.id) };
    case "set_criticality":
      return { ...pkg, perimeter: pkg.perimeter.map((i) => (i.id === a.id ? { ...i, criticality: a.value } : i)) };
    case "set_note":
      return { ...pkg, perimeter: pkg.perimeter.map((i) => (i.id === a.id ? { ...i, note: a.note.slice(0, 500) } : i)) };
    case "set_owner":
      return { ...pkg, owner: { ...pkg.owner, [a.field]: a.value.slice(0, 500) } };
    case "set_followup": {
      const before = pkg.follow_up.find((f) => f.case_key === a.key);
      if (!before) return pkg;
      const value = a.value.slice(0, 500);
      const after: FollowUp = a.field === "status"
        ? { ...before, status: value as FollowUpStatus, decided_at: new Date().toISOString(), decision_reason: value === "non_pertinent" ? before.decision_reason : "" }
        : { ...before, [a.field]: value };
      const next = { ...pkg, follow_up: pkg.follow_up.map((f) => (f.case_key === a.key ? after : f)) };
      return a.field === "status" ? logged(next, "status_change", `${a.key} : ${before.status} → ${value}`) : next;
    }
    case "remove_followup":
      // The key stays known: removing an entry must not bring the case back as new.
      return { ...pkg, follow_up: pkg.follow_up.filter((f) => f.case_key !== a.key) };
    case "decide": {
      const at = new Date().toISOString();
      const byKey = new Map(pkg.follow_up.map((f) => [f.case_key, f]));
      for (const c of a.cases) {
        const before = byKey.get(c.key);
        byKey.set(c.key, { case_key: c.key, source: c.source, item_id: before?.item_id ?? c.item_id, url: c.url, ...a.decision, decided_at: at });
      }
      return logged({ ...pkg, follow_up: [...byKey.values()], known_cases: addKnown(pkg, a.cases) }, "status_change", `${a.cases.length} → ${a.decision.status}`);
    }
    case "set_start": {
      const ids = new Set(a.itemIds);
      return logged({
        ...pkg,
        known_cases: addKnown(pkg, a.skipped),
        perimeter: pkg.perimeter.map((i) => ids.has(i.id)
          ? { ...i, history_scope: a.scope, history_skipped: a.skipped.filter((c) => c.item_id === i.id).length }
          : i),
      }, "edit", `start ${a.scope}: ${a.skipped.length} older cases not reviewed`);
    }
    case "bulk": {
      const keys = new Set(a.keys);
      const patch = Object.fromEntries(Object.entries(a.patch).map(([k, v]) => [k, typeof v === "string" ? v.slice(0, 500) : v]));
      return logged({ ...pkg, follow_up: pkg.follow_up.map((f) => (keys.has(f.case_key) ? { ...f, ...patch } : f)) },
        "edit", `${keys.size} : ${Object.keys(patch).join(", ")}`);
    }
    case "set_every":
      return { ...pkg, follow_up: pkg.follow_up.map((f) => (f.case_key === a.key ? { ...f, every_months: a.months } : f)) };
    case "set_measures":
      return { ...pkg, measures: [...new Set(a.measures.map((m) => m.slice(0, 500)).filter(Boolean))].slice(0, MAX_MEASURES) };
    case "close_review":
      return { ...pkg, reviews: [...pkg.reviews, a.record] };
    case "upgrade":
      return a.upgrade(pkg);
    default:
      return pkg;
  }
}

function reducer(state: State, a: Action): State {
  const rev = state.rev + 1;
  if (a.t === "replace") return { pkg: logged(a.pkg, "import", `${a.pkg.perimeter.length} / ${a.pkg.follow_up.length}`), dirty: false, rev };
  if (a.t === "restore") return { pkg: a.pkg, dirty: true, rev };
  if (a.t === "saved")
    return { pkg: asSaved(state.pkg, a.baseline, a.at), dirty: state.rev !== a.rev, rev };
  const next = edit(state.pkg, a);
  return next === state.pkg ? state : { pkg: { ...next, updated_at: new Date().toISOString() }, dirty: true, rev };
}

const initialState = (appVersion: string): State => {
  const draft = loadDraft();
  return { ...(draft ?? { pkg: emptyPackage(appVersion), dirty: false }), rev: 0 };
};

interface Ctx {
  pkg: PerimeterPackage;
  dirty: boolean;
  /** The browser refused to keep the working copy. */
  draftFailed: boolean;
  rev: number;
  add: (type: ItemType, ref: string, label: string) => void;
  remove: (id: string) => void;
  setCriticality: (id: string, v: Criticality) => void;
  setNote: (id: string, note: string) => void;
  setOwner: (field: "company" | "site" | "author", v: string) => void;
  setFollowUp: (key: string, field: EditableField, value: string) => void;
  removeFollowUp: (key: string) => void;
  decide: (cases: CaseRef[], decision: Decision) => void;
  /** Reverts the last decision or removal (available until anything else changes). */
  undo: () => void;
  undoable: UndoKind | null;
  bulk: (keys: string[], patch: BulkPatch) => void;
  setEvery: (key: string, months: number) => void;
  setMeasures: (measures: string[]) => void;
  setStart: (scope: StartScope, itemIds: string[], skipped: CaseRef[]) => void;
  closeReview: (record: ReviewRecord) => void;
  upgrade: (fn: (pkg: PerimeterPackage) => PerimeterPackage) => void;
  replace: (pkg: PerimeterPackage) => void;
  /** `rev` is the revision that went into the file. */
  saved: (rev: number, baseline: Baseline, at: string) => void;
  has: (type: ItemType, ref: string) => boolean;
}

const PerimeterCtx = createContext<Ctx | null>(null);

export function PerimeterProvider({ appVersion, children }: { appVersion: string; children: React.ReactNode }) {
  const [{ pkg, dirty, rev }, dispatch] = useReducer(reducer, appVersion, initialState);
  const [draftFailed, setDraftFailed] = useState(false);
  // Snapshot before the last decision or removal; `after` is filled in once it is applied.
  const [undoState, setUndoState] = useState<{ before: PerimeterPackage; after: PerimeterPackage | null; what: UndoKind } | null>(null);

  // Persist the draft after every change.
  useEffect(() => {
    if (!dirty && !pkg.perimeter.length) return;
    setDraftFailed(!saveDraft(pkg, dirty));
  }, [pkg, dirty]);

  if (undoState && undoState.after === null && pkg !== undoState.before) setUndoState({ ...undoState, after: pkg });
  const undoable = undoState && undoState.after === pkg ? undoState.what : null;

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const add = useCallback((type: ItemType, ref: string, label: string) => dispatch({ t: "add_item", type, ref, label }), []);
  const remove = useCallback((id: string) => {
    setUndoState({ before: pkg, after: null, what: { kind: "item", count: pkg.follow_up.filter((f) => f.item_id === id).length } });
    dispatch({ t: "remove_item", id });
  }, [pkg]);
  const setCriticality = useCallback((id: string, value: Criticality) => dispatch({ t: "set_criticality", id, value }), []);
  const setNote = useCallback((id: string, note: string) => dispatch({ t: "set_note", id, note }), []);
  const setOwner = useCallback((field: "company" | "site" | "author", value: string) => dispatch({ t: "set_owner", field, value }), []);
  const setFollowUp = useCallback((key: string, field: EditableField, value: string) => dispatch({ t: "set_followup", key, field, value }), []);
  const removeFollowUp = useCallback((key: string) => {
    setUndoState({ before: pkg, after: null, what: { kind: "case", count: 1 } });
    dispatch({ t: "remove_followup", key });
  }, [pkg]);
  const bulk = useCallback((keys: string[], patch: BulkPatch) => {
    setUndoState({ before: pkg, after: null, what: { kind: "bulk", count: keys.length } });
    dispatch({ t: "bulk", keys, patch });
  }, [pkg]);
  const setEvery = useCallback((key: string, months: number) => dispatch({ t: "set_every", key, months }), []);
  const setMeasures = useCallback((measures: string[]) => dispatch({ t: "set_measures", measures }), []);
  const decide = useCallback((cases: CaseRef[], decision: Decision) => {
    setUndoState({ before: pkg, after: null, what: { kind: "decision", count: cases.length } });
    dispatch({ t: "decide", cases, decision });
  }, [pkg]);
  const undo = useCallback(() => {
    if (!undoState) return;
    dispatch({ t: "restore", pkg: undoState.before });
    setUndoState(null);
  }, [undoState]);
  const setStart = useCallback((scope: StartScope, itemIds: string[], skipped: CaseRef[]) => dispatch({ t: "set_start", scope, itemIds, skipped }), []);
  const closeReview = useCallback((record: ReviewRecord) => dispatch({ t: "close_review", record }), []);
  const upgrade = useCallback((fn: (p: PerimeterPackage) => PerimeterPackage) => dispatch({ t: "upgrade", upgrade: fn }), []);
  const replace = useCallback((p: PerimeterPackage) => {
    const v = validatePackage(p);
    if (v.ok) dispatch({ t: "replace", pkg: p });
  }, []);
  const saved = useCallback((savedRev: number, baseline: Baseline, at: string) => dispatch({ t: "saved", rev: savedRev, baseline, at }), []);
  const has = useCallback((type: ItemType, ref: string) => pkg.perimeter.some((i) => i.type === type && i.ref === ref), [pkg]);

  const value = useMemo<Ctx>(() => ({
    pkg, dirty, draftFailed, rev, add, remove, setCriticality, setNote, setOwner, setFollowUp, removeFollowUp, decide, undo, undoable, bulk, setEvery, setMeasures, setStart, closeReview, upgrade, replace, saved, has,
  }), [pkg, dirty, draftFailed, rev, add, remove, setCriticality, setNote, setOwner, setFollowUp, removeFollowUp, decide, undo, undoable, bulk, setEvery, setMeasures, setStart, closeReview, upgrade, replace, saved, has]);

  return <PerimeterCtx.Provider value={value}>{children}</PerimeterCtx.Provider>;
}

export function usePerimeter(): Ctx {
  const c = useContext(PerimeterCtx);
  if (!c) throw new Error("usePerimeter outside provider");
  return c;
}
