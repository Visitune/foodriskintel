import type { PerimeterPackage } from "./model";
import { MAX_FILE_BYTES, validatePackage } from "./model";

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

export const download = (filename: string, content: BlobPart, mime = "application/json;charset=utf-8") => {
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

/** `false` when the browser refused to keep the copy (storage full or blocked). */
export function saveDraft(pkg: PerimeterPackage, dirty: boolean): boolean {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ saved_at: new Date().toISOString(), dirty, pkg }));
    return true;
  } catch {
    return false;
  }
}

export function loadDraft(): { dirty: boolean; pkg: PerimeterPackage } | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const v = validatePackage(parsed?.pkg);
    // v1 drafts do not say whether a file holds them: assume not.
    return v.ok ? { dirty: parsed.dirty !== false, pkg: v.pkg } : null;
  } catch {
    return null;
  }
}
