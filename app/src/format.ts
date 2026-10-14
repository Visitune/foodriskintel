import type { Lang } from "./i18n";
import type { Label } from "./types";

const locale = (lang: Lang) => (lang === "fr" ? "fr-FR" : "en-GB");

export const fmtNum = (n: number, lang: Lang) => n.toLocaleString(locale(lang));

/** "2026-08" → "août 2026" / "Aug 2026" */
export function fmtMonth(ym: string | null | undefined, lang: Lang, style: "long" | "short" = "long"): string {
  if (!ym) return "—";
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Date(y, m - 1, 1).toLocaleDateString(locale(lang), { month: style, year: "numeric" });
}

export const label = (l: Label | undefined, lang: Lang, fallback = "") => (l ? l[lang] : fallback);

/** Sorted [key, value] pairs of a count record. */
export const entries = (r: Record<string, number> | undefined) =>
  Object.entries(r || {}).sort((a, b) => b[1] - a[1]);

/** Last `n` months ending at `end` (inclusive), as YYYY-MM. */
export function lastMonths(end: string, n: number): string[] {
  let [y, m] = end.split("-").map(Number);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.unshift(`${y}-${String(m).padStart(2, "0")}`);
    m -= 1;
    if (m === 0) { m = 12; y -= 1; }
  }
  return out;
}

/** Download rows as a UTF-8 CSV (Excel-friendly: BOM + semicolon in FR). */
export function downloadCsv(filename: string, rows: Record<string, string | number>[], lang: Lang) {
  if (!rows.length) return;
  const sep = lang === "fr" ? ";" : ",";
  const cols = Object.keys(rows[0]);
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[";,\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [cols.join(sep), ...rows.map((r) => cols.map((c) => esc(r[c])).join(sep))].join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
