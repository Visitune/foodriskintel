import { useState } from "react";
import { fmtNum } from "../../format";
import { FamilyIcon } from "../../components/icons";
import { Flag } from "../../flags";
import { usePerimeter } from "../../perimeter/PerimeterContext";
import { confirmRemoveItem } from "../../perimeter/confirm";
import { searchTerms, termLabel } from "../../perimeter/search";
import { typeLabel, type ItemType } from "../../perimeter/model";
import type { PerimeterView } from "./view";

/** Choose materials, origins, hazards and products on a single screen. */
export default function Picker({ view }: { view: PerimeterView }) {
  const { lang, index } = view;
  const fr = lang === "fr";
  const P = usePerimeter();
  const [query, setQuery] = useState("");
  const results = searchTerms(index.search, query, 12);

  const toggle = (type: ItemType, ref: string, label: string) => {
    const existing = P.pkg.perimeter.find((i) => i.type === type && i.ref === ref);
    if (!existing) return P.add(type, ref, label);
    if (confirmRemoveItem(P.pkg, existing.id, lang)) P.remove(existing.id);
  };

  const chip = (type: ItemType, ref: string, label: string, icon: React.ReactNode, meta: string) => {
    const on = P.has(type, ref);
    return (
      <button key={`${type}-${ref}`} type="button" className={on ? "pick on" : "pick"} aria-pressed={on} onClick={() => toggle(type, ref, label)}>
        {icon}
        <span className="pick-text"><span className="pick-name">{label}</span><span className="pick-meta">{meta}</span></span>
        <span className="pick-mark" aria-hidden="true">{on ? "✓" : "+"}</span>
      </button>
    );
  };

  const cases = (n: number) => `${fmtNum(n, lang)} ${fr ? "cas publiés" : "published cases"}`;
  const families = Object.entries(index.families).filter(([id]) => id !== "other").sort((a, b) => a[1].label[lang].localeCompare(b[1].label[lang]));
  const origins = Object.entries(index.origins).sort((a, b) => b[1].ffn_cases - a[1].ffn_cases).slice(0, 12);

  return (
    <div className="picker">
      <label className="field picker-search">{fr ? "Rechercher une matière, une origine, un danger ou un produit" : "Search a material, origin, hazard or product"}
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={fr ? "ex. cumin, miel, Inde, sulfites" : "e.g. cumin, honey, India, sulphites"} />
      </label>

      {query.trim().length >= 2 ? (
        results.length ? (
          <div className="pick-grid">
            {results.map((t) => chip(t.t, t.id, termLabel(t, lang),
              t.t === "family" ? <FamilyIcon id={t.id} size={16} /> : t.t === "origin" ? <Flag country={t.id} /> : null,
              `${typeLabel(t.t, lang)} · ${cases(t.n)}`))}
          </div>
        ) : <p className="meta" role="status">{fr ? "Aucun résultat dans les sources couvertes." : "No result in the covered sources."}</p>
      ) : (
        <>
          <h4>{fr ? "Familles de matières" : "Material families"}</h4>
          <div className="pick-grid">
            {families.map(([id, f]) => chip("family", id, f.label[lang], <FamilyIcon id={id} size={16} />, cases(f.ffn_cases + f.fraud_cases)))}
          </div>
          <h4>{fr ? "Origines les plus signalées (suspicions UE)" : "Most reported origins (EU suspicions)"}</h4>
          <div className="pick-grid">
            {origins.map(([id, o]) => chip("origin", id, id, <Flag country={id} />, cases(o.ffn_cases + o.fraud_cases)))}
          </div>
        </>
      )}
    </div>
  );
}
