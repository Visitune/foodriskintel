import type { Lang } from "../../i18n";
import type { RiskIndex } from "../../types";
import type { PerimeterCase } from "../../perimeter/review";

/** What the tabs of "My perimeter" share. Computed once by the page. */
export interface PerimeterView {
  lang: Lang;
  index: RiskIndex;
  /** Unique cases matching the perimeter. */
  cases: PerimeterCase[];
  caseById: Map<string, PerimeterCase>;
  /** Matches per item id (a case can appear under several items). */
  matches: Record<string, PerimeterCase["key"][]>;
  latest: { ffn: string; jrc: string };
  /** FFN and JRC are both loaded: nothing is missing from the lists. */
  complete: boolean;
}

export const problemLabel = (v: Pick<PerimeterView, "index" | "lang">, source: string, problem: string) => {
  const labels = source === "jrc" ? v.index.labels.reasons : v.index.labels.groups;
  return labels[problem]?.[v.lang] ?? (v.lang === "fr" ? "Autre / non classé" : "Other / unclassified");
};

export const fmtDay = (iso: string, lang: Lang) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB");
};

/** Today as YYYY-MM-DD in local time. */
export const today = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
