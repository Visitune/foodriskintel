import type { Lang } from "../i18n";
import type { SearchTerm } from "../types";

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Families, origins, substances and products matching a query (accent-insensitive). */
export function searchTerms(terms: SearchTerm[], query: string, limit = 8): SearchTerm[] {
  const nq = norm(query.trim());
  if (nq.length < 2) return [];
  const scored: { t: SearchTerm; score: number }[] = [];
  for (const t of terms) {
    const names = [t.id, t.fr, t.en].filter(Boolean).map((x) => norm(x as string));
    if (!names.some((n) => n.includes(nq))) continue;
    const starts = names.some((n) => n.startsWith(nq) || n.includes(" " + nq));
    const typeBoost = t.t === "family" ? 3 : t.t === "origin" ? 2 : 1;
    scored.push({ t, score: (starts ? 1000 : 0) + typeBoost * 100 + Math.log(t.n + 1) * 10 });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((s) => s.t);
}

export const termLabel = (t: SearchTerm, lang: Lang) => (t.t === "family" ? (t[lang] as string) : t.id);
