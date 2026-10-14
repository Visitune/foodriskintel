import { useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Lang } from "../i18n";
import type { RiskIndex, SearchTerm, Trend } from "../types";
import { GLOSSARY } from "../glossary";
import { fmtMonth, fmtNum } from "../format";

/** Inline glossary term: dotted underline, definition on hover / focus / tap. */
export function Term({ id, lang, children }: { id: keyof typeof GLOSSARY; lang: Lang; children?: React.ReactNode }) {
  const g = GLOSSARY[id];
  const tipId = useId();
  const [open, setOpen] = useState(false);
  return (
    <span className="term" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" className="term-btn" aria-describedby={tipId} aria-expanded={open}
        onClick={() => setOpen((v) => !v)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}>
        {children ?? g.term[lang]}
      </button>
      <span role="tooltip" id={tipId} className={open ? "term-tip open" : "term-tip"}>
        <strong>{g.term[lang]}</strong> — {g.def[lang]}
      </span>
    </span>
  );
}

/** Source badge, always the same colour per source. */
export function SourceTag({ src, lang }: { src: "ifs" | "jrc" | "ffn"; lang: Lang }) {
  const txt = {
    ifs: lang === "fr" ? "Rappels IFS" : "IFS recalls",
    jrc: lang === "fr" ? "Fraude presse (IFS/JRC)" : "Press fraud (IFS/JRC)",
    ffn: lang === "fr" ? "Suspicions UE (FFN)" : "EU suspicions (FFN)",
  }[src];
  return <span className={`src-tag ${src}`}>{txt}</span>;
}

export function TrendBadge({ trend, lang }: { trend: Trend; lang: Lang }) {
  const fr = lang === "fr";
  const map = {
    up: { cls: "up", txt: fr ? "En hausse" : "Rising", icon: "↗" },
    down: { cls: "down", txt: fr ? "En baisse" : "Falling", icon: "↘" },
    stable: { cls: "stable", txt: fr ? "Stable" : "Stable", icon: "→" },
    new: { cls: "up", txt: fr ? "Nouveau" : "New", icon: "↗" },
    insufficient: { cls: "na", txt: fr ? "Trop peu de cas" : "Too few cases", icon: "·" },
  }[trend.direction];
  const title = fr
    ? `${trend.last6} cas sur les 6 derniers mois publiés contre ${trend.prev6} sur les 6 précédents`
    : `${trend.last6} cases over the last 6 published months vs ${trend.prev6} over the previous 6`;
  return <span className={`trend-badge ${map.cls}`} title={title}><span aria-hidden="true">{map.icon}</span> {map.txt}</span>;
}

/** Monthly bars (SVG). Months with no value are drawn as gaps, never as zero when `missing` lists them. */
export function Sparkline({ months, values, lang, missing = [], height = 64, tone = "ffn" }: {
  months: string[]; values: Record<string, number>; lang: Lang; missing?: string[]; height?: number; tone?: "ffn" | "jrc" | "ifs";
}) {
  const max = Math.max(1, ...months.map((m) => values[m] || 0));
  const w = 100 / months.length;
  return (
    <div className="spark">
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" role="img"
        aria-label={months.map((m) => `${fmtMonth(m, lang, "short")}: ${missing.includes(m) ? "—" : values[m] || 0}`).join(", ")}>
        <line x1="0" x2="100" y1={height - 0.5} y2={height - 0.5} className="spark-axis" />
        {months.map((m, i) => {
          if (missing.includes(m)) {
            return <rect key={m} x={i * w + w * 0.15} y={height - 3} width={w * 0.7} height={3} className="spark-missing" />;
          }
          const v = values[m] || 0;
          const h = (v / max) * (height - 4);
          return <rect key={m} x={i * w + w * 0.15} y={height - h} width={w * 0.7} height={h} className={`spark-bar ${tone}`}><title>{`${fmtMonth(m, lang)} : ${v}`}</title></rect>;
        })}
      </svg>
      <div className="spark-scale"><span>{fmtMonth(months[0], lang, "short")}</span><span>max {fmtNum(max, lang)}</span><span>{fmtMonth(months[months.length - 1], lang, "short")}</span></div>
    </div>
  );
}

/** Horizontal bars; rows are buttons when `onPick` is given. */
export function BarList({ rows, onPick, tone = "ffn", lang, active }: {
  rows: [string, number, string?][]; onPick?: (key: string) => void; tone?: "ffn" | "jrc" | "ifs"; lang: Lang; active?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  if (!rows.length) return <p className="empty">{lang === "fr" ? "Aucun cas." : "No case."}</p>;
  return (
    <ul className="bars">
      {rows.map(([key, n, text]) => {
        const inner = (
          <>
            <span className="bars-label">{text ?? key}</span>
            <span className="bars-track"><span className={`bars-fill ${tone}`} style={{ width: `${(n / max) * 100}%` }} /></span>
            <span className="bars-value">{fmtNum(n, lang)}</span>
          </>
        );
        return (
          <li key={key}>
            {onPick
              ? <button type="button" className={active === key ? "bars-row active" : "bars-row"} onClick={() => onPick(key)}>{inner}</button>
              : <div className="bars-row">{inner}</div>}
          </li>
        );
      })}
    </ul>
  );
}

const TYPE_LABEL = {
  family: { fr: "Famille de matières", en: "Material family" },
  origin: { fr: "Pays d'origine", en: "Origin country" },
  substance: { fr: "Danger / substance", en: "Hazard / substance" },
  commodity: { fr: "Produit", en: "Product" },
};

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function termPath(t: SearchTerm): string {
  if (t.t === "family") return `/matiere/${t.id}`;
  if (t.t === "origin") return `/origine/${encodeURIComponent(t.id)}`;
  if (t.t === "substance") return `/matiere/${t.f}?danger=${encodeURIComponent(t.id)}`;
  return `/matiere/${t.f}?q=${encodeURIComponent(t.id)}`;
}

/** Search across families, origins, substances and products (accent-insensitive). */
export function SearchBox({ index, lang, autoFocus = false, big = false }: { index: RiskIndex; lang: Lang; autoFocus?: boolean; big?: boolean }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const fr = lang === "fr";

  const results = useMemo(() => {
    const nq = norm(q.trim());
    if (nq.length < 2) return [];
    const scored: { t: SearchTerm; score: number }[] = [];
    for (const t of index.search) {
      const names = [t.id, t.fr, t.en].filter(Boolean).map((x) => norm(x as string));
      const hit = names.find((n) => n.includes(nq));
      if (!hit) continue;
      const starts = names.some((n) => n.startsWith(nq) || n.includes(" " + nq));
      const typeBoost = t.t === "family" ? 3 : t.t === "origin" ? 2 : 1;
      scored.push({ t, score: (starts ? 1000 : 0) + typeBoost * 100 + Math.log(t.n + 1) * 10 });
    }
    return scored.sort((a, b) => b.score - a.score).slice(0, 8).map((s) => s.t);
  }, [q, index.search]);

  const go = (t: SearchTerm) => { setQ(""); navigate(termPath(t)); };
  const display = (t: SearchTerm) => (t.t === "family" ? (t[lang] as string) : t.id);

  return (
    <div className={big ? "search big" : "search"} role="search">
      <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.8" />
        <path d="M15.5 15.5L21 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <input ref={inputRef} type="search" value={q} autoFocus={autoFocus}
        placeholder={fr ? "Matière première, produit, pays d'origine ou substance… (ex. cumin, miel, Inde, sulfites)" : "Raw material, product, origin country or substance… (e.g. cumin, honey, India, sulphites)"}
        aria-label={fr ? "Rechercher" : "Search"} role="combobox" aria-expanded={results.length > 0} aria-controls={listId}
        aria-activedescendant={results.length ? `${listId}-${cursor}` : undefined}
        onChange={(e) => { setQ(e.target.value); setCursor(0); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, results.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
          else if (e.key === "Enter" && results[cursor]) { e.preventDefault(); go(results[cursor]); }
          else if (e.key === "Escape") setQ("");
        }} />
      {results.length > 0 && (
        <ul className="search-results" id={listId} role="listbox">
          {results.map((t, i) => (
            <li key={`${t.t}-${t.id}`} id={`${listId}-${i}`} role="option" aria-selected={i === cursor}
              className={i === cursor ? "active" : ""} onMouseDown={(e) => { e.preventDefault(); go(t); }} onMouseEnter={() => setCursor(i)}>
              <span className="sr-name">{display(t)}</span>
              <span className="sr-meta">
                {TYPE_LABEL[t.t][lang]}
                {t.f && t.t !== "family" ? ` · ${index.labels.families[t.f]?.[lang] ?? ""}` : ""}
                {` · ${fmtNum(t.n, lang)} ${fr ? "cas" : "cases"}`}
              </span>
            </li>
          ))}
        </ul>
      )}
      {q.trim().length >= 2 && results.length === 0 && (
        <div className="search-results empty-res">{fr ? "Aucun résultat dans les sources couvertes." : "No result in the covered sources."}</div>
      )}
    </div>
  );
}

export function Loading({ lang }: { lang: Lang }) {
  return <div className="loading" role="status">{lang === "fr" ? "Chargement des données…" : "Loading data…"}</div>;
}
