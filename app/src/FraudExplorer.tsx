import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { Dataset, RiskIndex } from "./types";
import type { Lang } from "./i18n";
import { t } from "./i18n";
import { fmtMonth } from "./format";
import { BarList, SourceTag, Sparkline, Term } from "./components/ui";
import { Card, FraudCaseTable, countBy } from "./pages/shared";

/** IFS/JRC press fraud cases. Filters live in the URL so a view can be shared. */
export default function FraudExplorer({ data, index, lang }: { data: Dataset; index: RiskIndex; lang: Lang }) {
  const tr = t[lang];
  const fr = lang === "fr";
  const [params, setParams] = useSearchParams();
  const family = params.get("famille") || "";
  const reason = params.get("type") || "";
  const country = params.get("pays") || "";
  const set = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v); else p.delete(k);
    setParams(p, { replace: true });
  };

  const filtered = useMemo(() => data.food_fraud.filter((c) =>
    (!family || c.material_family === family) &&
    (!reason || (c.reasons || []).includes(reason)) &&
    (!country || (c.countries || [c.country_normalized]).includes(country))), [data, family, reason, country]);

  const months = data.reports.map((r) => r.publication_date);
  const notPublished = data.reports.filter((r) => r.food_fraud_status === "not_published").map((r) => r.publication_date);
  const byFamily = countBy(filtered, (c) => c.material_family || "other");
  const byReason = countBy(filtered, (c) => c.reasons || []);
  const byCountry = countBy(filtered, (c) => c.countries || [c.country_normalized]);
  const allFamilies = countBy(data.food_fraud, (c) => c.material_family || "other");
  const allReasons = countBy(data.food_fraud, (c) => c.reasons || []);
  const allCountries = countBy(data.food_fraud, (c) => c.countries || [c.country_normalized]);

  return (
    <div className="page">
      <header className="page-header">
        <h2>{tr.nav.ifsFraud}</h2>
        <p className="subtitle">{fr
          ? <>Cas de fraude parus dans la presse mondiale, sélectionnés par le <Term id="jrc" lang={lang}>JRC</Term> et repris chaque mois dans le <Term id="trendRisk" lang={lang}>rapport IFS Trend Risk</Term>. Chaque cas renvoie à l'article d'origine.</>
          : <>Fraud cases reported in the world press, selected by the <Term id="jrc" lang={lang}>JRC</Term> and republished monthly in the <Term id="trendRisk" lang={lang}>IFS Trend Risk Report</Term>. Each case links to the original article.</>}</p>
        <SourceTag src="jrc" lang={lang} />
      </header>

      <div className="controls">
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
        {(family || reason || country) && <button type="button" className="btn" onClick={() => setParams({}, { replace: true })}>{tr.common.reset}</button>}
      </div>

      <Card title={fr ? "Cas par rapport mensuel" : "Cases per monthly report"}>
        <Sparkline months={months} values={Object.fromEntries(countBy(filtered, (c) => c.publication_date))} lang={lang} tone="jrc" missing={notPublished} />
        <p className="meta">{fr
          ? `Trait gris : l'IFS n'a pas publié de tableau de fraude (${notPublished.map((m) => fmtMonth(m, lang, "short")).join(", ")}). Ce n'est pas « zéro cas ».`
          : `Grey dash: IFS published no fraud table (${notPublished.map((m) => fmtMonth(m, lang, "short")).join(", ")}). It does not mean "zero cases".`}</p>
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

      <Card title={fr ? "Détail des cas" : "Case detail"}>
        <FraudCaseTable cases={filtered} index={index} lang={lang} filename="fraude-presse-ifs-jrc.csv" />
      </Card>
    </div>
  );
}
