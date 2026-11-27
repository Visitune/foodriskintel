import type { PerimeterPackage } from "./model";
import { MAX_FILE_BYTES, SCHEMA_VERSION, validatePackage } from "./model";

/** ─── File I/O for .vey packages (plain JSON, UTF-8, no network) ───────────── */

export type ReadResult =
  | { ok: true; pkg: PerimeterPackage }
  | { ok: false; reason: "too_big" | "not_json" | "not_object" | "bad_format" | "bad_version" | "future_version" | "bad_perimeter" | "bad_followup" | "read_error" };

export async function readPackageFile(file: File): Promise<ReadResult> {
  if (file.size > MAX_FILE_BYTES) return { ok: false, reason: "too_big" };
  let text: string;
  try {
    text = await file.text();
  } catch {
    return { ok: false, reason: "read_error" };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: "not_json" };
  }
  const v = validatePackage(raw);
  return v.ok ? { ok: true, pkg: v.pkg } : { ok: false, reason: v.reason as Exclude<ReadResult, { ok: true }> extends { ok: false; reason: infer R } ? R : never };
}

/** Client-side migration hook: currently v1 only, older versions migrate here. */
export function migrate(pkg: PerimeterPackage): PerimeterPackage {
  // schema_version < SCHEMA_VERSION would be upgraded here, field by field.
  return { ...pkg, schema_version: SCHEMA_VERSION };
}

export const download = (filename: string, content: string, mime = "application/json;charset=utf-8") => {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

export const packageFilename = (d = new Date()) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `perimetre-FRI-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.vey`;
};

export const serialize = (pkg: PerimeterPackage) => JSON.stringify(pkg, null, 2);

/** Draft persistence (browser only — a convenience, never the source of truth). */
const DRAFT_KEY = "fri-perimetre-draft";

export function saveDraft(pkg: PerimeterPackage) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ saved_at: new Date().toISOString(), pkg }));
  } catch { /* storage blocked — the .vey file remains the source of truth */ }
}

export function loadDraft(): { saved_at: string; pkg: PerimeterPackage } | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const v = validatePackage(parsed?.pkg);
    return v.ok ? { saved_at: String(parsed.saved_at ?? ""), pkg: migrate(v.pkg) } : null;
  } catch {
    return null;
  }
}

export function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
}
