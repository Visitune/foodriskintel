import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { CaseSource, Criticality, FollowUp, FollowUpStatus, ItemType, PerimeterItem, PerimeterPackage } from "./model";
import { emptyPackage, newId, validatePackage } from "./model";
import { clearDraft, loadDraft, saveDraft } from "./io";
import type { CaseRef } from "./match";

/** ─── Perimeter state ─────────────────────────────────────────────────────────
 *  The React state holds the working copy ("draft"). The browser copy in
 *  localStorage is a convenience between sessions; the .vey file the user
 *  downloads is the single source of truth. `dirty` = unsaved changes.
 */

type Action =
  | { t: "add_item"; type: ItemType; ref: string; label: string }
  | { t: "remove_item"; id: string }
  | { t: "set_criticality"; id: string; value: Criticality }
  | { t: "set_note"; id: string; note: string }
  | { t: "set_owner"; field: "company" | "site" | "author"; value: string }
  | { t: "set_followup"; key: string; field: keyof Omit<FollowUp, "case_key" | "source" | "item_id">; value: string }
  | { t: "ensure_followup"; ref: CaseRef }
  | { t: "remove_followup"; key: string }
  | { t: "mark_seen"; keys: string[] }
  | { t: "replace"; pkg: PerimeterPackage }
  | { t: "history"; event: "import" | "export" | "status_change" | "edit"; detail: string };

export type { CaseSource, FollowUpStatus, Criticality, ItemType, FollowUp, PerimeterItem, PerimeterPackage };
export type { CaseRef };

const touch = (pkg: PerimeterPackage, a: Action): PerimeterPackage => {
  const history =
    a.t === "history"
      ? [...pkg.history, { at: new Date().toISOString(), event: a.event, detail: a.detail }].slice(-200)
      : pkg.history;
  return { ...pkg, updated_at: new Date().toISOString(), history };
};

function reducer(pkg: PerimeterPackage, a: Action): PerimeterPackage {
  switch (a.t) {
    case "add_item":
      if (pkg.perimeter.some((i) => i.type === a.type && i.ref === a.ref)) return pkg;
      return touch({ ...pkg, perimeter: [...pkg.perimeter, { id: newId(), type: a.type, ref: a.ref, label: a.label || a.ref, criticality: "moyenne", note: "", added_at: new Date().toISOString() }] }, a);
    case "remove_item": {
      const next = { ...pkg, perimeter: pkg.perimeter.filter((i) => i.id !== a.id), follow_up: pkg.follow_up.filter((f) => f.item_id !== a.id) };
      return touch(next, a);
    }
    case "set_criticality":
      return touch({ ...pkg, perimeter: pkg.perimeter.map((i) => (i.id === a.id ? { ...i, criticality: a.value } : i)) }, a);
    case "set_note":
      return touch({ ...pkg, perimeter: pkg.perimeter.map((i) => (i.id === a.id ? { ...i, note: a.note.slice(0, 500) } : i)) }, a);
    case "set_owner":
      return touch({ ...pkg, owner: { ...pkg.owner, [a.field]: a.value.slice(0, 500) } }, a);
    case "set_followup":
      return touch(
        { ...pkg, follow_up: pkg.follow_up.map((f) => (f.case_key === a.key ? { ...f, [a.field]: a.value.slice(0, 500) } : f)) },
        a.t === "set_followup" && a.field === "status" ? { t: "history", event: "status_change", detail: a.key } : a,
      );
    case "ensure_followup": {
      if (pkg.follow_up.some((f) => f.case_key === a.ref.key)) return pkg;
      const fu: FollowUp = {
        case_key: a.ref.key,
        source: a.ref.source,
        item_id: a.ref.item_id,
        status: "a_evaluer",
        control_measure: "",
        frequency: "",
        owner: "",
        date_reviewed: "",
        comment: "",
        url: a.ref.url,
      };
      return touch({ ...pkg, follow_up: [...pkg.follow_up, fu] }, a);
    }
    case "remove_followup":
      return touch({ ...pkg, follow_up: pkg.follow_up.filter((f) => f.case_key !== a.key) }, a);
    case "mark_seen": {
      const next = { ...pkg.known_cases };
      for (const k of a.keys) {
        const src = (k.startsWith("jrc|") ? "jrc" : k.startsWith("ifs|") ? "ifs" : "ffn") as CaseSource;
        if (!next[src].includes(k)) next[src] = [...next[src], k];
      }
      return touch({ ...pkg, known_cases: next }, a);
    }
    case "replace":
      return touch(a.pkg, a);
    case "history":
      return touch(pkg, a);
  }
}

interface Ctx {
  pkg: PerimeterPackage;
  dirty: boolean;
  add: (type: ItemType, ref: string, label: string) => void;
  remove: (id: string) => void;
  setCriticality: (id: string, v: Criticality) => void;
  setNote: (id: string, note: string) => void;
  setOwner: (field: "company" | "site" | "author", v: string) => void;
  setFollowUp: (key: string, field: keyof Omit<FollowUp, "case_key" | "source" | "item_id">, value: string) => void;
  ensureFollowUp: (ref: CaseRef) => void;
  removeFollowUp: (key: string) => void;
  replace: (pkg: PerimeterPackage) => void;
  exportDone: (keys: string[]) => void;
  markSeen: (keys: string[]) => void;
  has: (type: ItemType, ref: string) => boolean;
}

const PerimeterCtx = createContext<Ctx | null>(null);

export function PerimeterProvider({ appVersion, children }: { appVersion: string; children: React.ReactNode }) {
  const [pkg, dispatch] = useReducer(reducer, appVersion, (v) => emptyPackage(v));
  const [dirty, setDirty] = useState(false);
  const first = useRef(true);

  // Restore the draft once (a convenience between sessions).
  useEffect(() => {
    const d = loadDraft();
    if (d) dispatch({ t: "replace", pkg: d.pkg });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist the draft after every change.
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    saveDraft(pkg);
    setDirty(true);
  }, [pkg]);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const add = useCallback((type: ItemType, ref: string, label: string) => dispatch({ t: "add_item", type, ref, label }), []);
  const remove = useCallback((id: string) => dispatch({ t: "remove_item", id }), []);
  const setCriticality = useCallback((id: string, value: Criticality) => dispatch({ t: "set_criticality", id, value }), []);
  const setNote = useCallback((id: string, note: string) => dispatch({ t: "set_note", id, note }), []);
  const setOwner = useCallback((field: "company" | "site" | "author", value: string) => dispatch({ t: "set_owner", field, value }), []);
  const setFollowUp = useCallback((key: string, field: keyof Omit<FollowUp, "case_key" | "source" | "item_id">, value: string) => dispatch({ t: "set_followup", key, field, value }), []);
  const ensureFollowUp = useCallback((ref: CaseRef) => dispatch({ t: "ensure_followup", ref }), []);
  const removeFollowUp = useCallback((key: string) => dispatch({ t: "remove_followup", key }), []);
  const replace = useCallback((p: PerimeterPackage) => {
    const v = validatePackage(p);
    if (v.ok) dispatch({ t: "replace", pkg: v.pkg });
  }, []);
  const exportDone = useCallback((keys: string[]) => {
    dispatch({ t: "mark_seen", keys });
    dispatch({ t: "history", event: "export", detail: new Date().toISOString() });
    setDirty(false);
  }, []);
  const markSeen = useCallback((keys: string[]) => {
    // In-page "mark seen": still unsaved until a real .vey export happens.
    dispatch({ t: "mark_seen", keys });
  }, []);
  const has = useCallback((type: ItemType, ref: string) => pkg.perimeter.some((i) => i.type === type && i.ref === ref), [pkg]);

  const value = useMemo<Ctx>(() => ({
    pkg, dirty, add, remove, setCriticality, setNote, setOwner, setFollowUp, ensureFollowUp, removeFollowUp, replace, exportDone, markSeen, has,
  }), [pkg, dirty, add, remove, setCriticality, setNote, setOwner, setFollowUp, ensureFollowUp, removeFollowUp, replace, exportDone, markSeen, has]);

  return <PerimeterCtx.Provider value={value}>{children}</PerimeterCtx.Provider>;
}

export function usePerimeter(): Ctx {
  const c = useContext(PerimeterCtx);
  if (!c) throw new Error("usePerimeter outside provider");
  return c;
}

export { clearDraft };
