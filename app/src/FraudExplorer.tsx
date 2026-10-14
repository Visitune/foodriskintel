import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { RiskIndex } from "./types";
import type { Lang } from "./i18n";
import { t } from "./i18n";
import { useJrc } from "./data";
import { fmtMonth, lastMonths } from "./format";
import { BarList, Loading, SourceTag, Sparkline, Term } from "./components/ui";
import { Card, FraudCaseTable, countBy } from "./pages/shared";

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** JRC Food Fraud Monthly incidents. Filters live in the URL so a view can be shared. */
export default function FraudExplorer({ index, lang }: { index: RiskIndex; lang: Lang }) {
  const tr = t[lang];
  const fr = lang === "fr";
  const { data: jrc, error } = useJrc();
  const [params, setParams] = useSearchParams();
  const family = params.get("famille") || "";
  const reason = params.get("type") || "";
  const country = params.get("pays") || "";
  const q = params.get("q") || "";
  const set = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v); else p.delete(k);
    setParams(p, { replace: true });
  };

  const all = useMemo(() => jrc?.incidents ?? [], [jrc]);
  const filtered = useMemo(() => {
    const nq = norm(q);
    return all.filter((c) =>
      (!family || c.material_family === family) &&
      (!reason || c.reasons.includes(reason)) &&
      (!country || c.countries.includes(country)) &&
      (!nq || norm(c.description).includes(nq)));
  }, [all, family, reason, country, q]);

  if (error) return <div className="error">{fr ? "Données JRC indisponibles." : "JRC data unavailable."}</div>;
  if (!jrc) return <Loading lang={lang} />;

  const months = lastMonths(jrc.date_range.end, 30).filter((m) => m >= jrc.date_range.start);
  const gaps = months.filter((m) => !jrc.summary.months_covered.includes(m));
  const byFamily = countBy(filtered, (c) => c.material_family);
  const byReason = countBy(filtered, (c) => c.reasons);
  const byCountry = countBy(filtered, (c) => c.countries);
  const allFamilies = countBy(all, (c) => c.material_family);
  const allReasons = countBy(all, (c) => c.reasons);
  const allCountries = countBy(all, (c) => c.countries);

  return (
    <div className="page">
      <header className="page-header">
        <h2>{tr.nav.ifsFraud}</h2>
        <p className="subtitle">{fr
          ? <>Incidents de fraude parus dans la presse mondiale, recensés chaque mois par le <Term id="jrc" lang={lang}>JRC</Term> (Commission européenne). Chaque incident renvoie aux articles d'origine et au rapport JRC.</>
          : <>Fraud incidents reported in the world press, compiled monthly by the <Term id="jrc" lang={lang}>JRC</Term> (European Commission). Each incident links to the original articles and the JRC report.</>}</p>
        <SourceTag src="jrc" lang={lang} />
      </header>

      <div className="controls">
        <input className="input" type="search" value={q} onChange={(e) => set("q", e.target.value)}
          placeholder={fr ? "Mot-clé (ex. olive, saffron, honey)…" : "Keyword (e.g. olive, saffron, honey)…"} aria-label={fr ? "Mot-clé" : "Keyword"} />
        <select value={family} onChange={(e) => set("famille", e.target.value)} aria-label={fr ? "Matière" : "Material"}>
          <option value="">{fr ? "Toutes les matières" : "All materials"}</option>
          {allFamilies.map(([f, n]) => <option key={f} value={f}>{index.labels.families[f]?.[lang] ?? f} ({n})</option>)}
        </select>
        <select value={reason} onChange={(e) => set("type", e.target.value)} aria-label={fr ? "Type de fraude" : "Fraud type"}>
          <option value="">{fr ? "Tous types de fraude" : "All fraud types"}</option>
          {allReasons.map(([r, n]) => <option key={r} value={r}>{index.labels.reasons[r]?.[lang] ?? r} ({n})</option>)}
        </select>
        <select value={country} onChange={(e) => set("pays", e.target.value)} aria-label={fr ? "Pays" : "Country"}>
          <option value="">{fr ? "Tous pays" : "All countries"}</option>
          {allCountries.map(([c, n]) => <option key={c} value={c}>{c} ({n})</option>)}
        </select>
        {(family || reason || country || q) && <button type="button" className="btn" onClick={() => setParams({}, { replace: true })}>{tr.common.reset}</button>}
      </div>

      <Card title={fr ? "Incidents par mois" : "Incidents per month"}>
        <Sparkline months={months} values={Object.fromEntries(countBy(filtered, (c) => c.month))} lang={lang} tone="jrc" missing={gaps} />
        <p className="meta">{fr
          ? `Trait gris : rapport JRC publié uniquement en image, non lisible (${jrc.summary.months_no_text.map((m) => fmtMonth(m, lang, "short")).join(", ")}). Ce n'est pas « zéro incident ».`
          : `Grey dash: JRC report published as an image only, not readable (${jrc.summary.months_no_text.map((m) => fmtMonth(m, lang, "short")).join(", ")}). It does not mean "zero incidents".`}</p>
      </Card>

      <div className="grid-3">
        <Card title={fr ? "Matières" : "Materials"}>
          <BarList lang={lang} tone="jrc" rows={byFamily.slice(0, 10).map(([f, n]) => [f, n, index.labels.families[f]?.[lang] ?? f])} onPick={(f) => set("famille", family === f ? "" : f)} active={family} />
        </Card>
        <Card title={fr ? "Types de fraude" : "Fraud types"}>
          <BarList lang={lang} tone="jrc" rows={byReason.slice(0, 10).map(([r, n]) => [r, n, index.labels.reasons[r]?.[lang] ?? r])} onPick={(r) => set("type", reason === r ? "" : r)} active={reason} />
        </Card>
        <Card title={fr ? "Pays" : "Countries"}>
          <BarList lang={lang} tone="jrc" rows={byCountry.slice(0, 10)} onPick={(c) => set("pays", country === c ? "" : c)} active={country} />
        </Card>
      </div>

      <Card title={fr ? "Détail des incidents" : "Incident detail"}>
        <FraudCaseTable cases={filtered} index={index} lang={lang} filename="fraude-presse-jrc.csv" />
      </Card>
    </div>
  );
}
