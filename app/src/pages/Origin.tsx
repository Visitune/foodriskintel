import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { Lang } from "../i18n";
import type { Dataset, RiskIndex } from "../types";
import { useFfn, useJrc } from "../data";
import { fmtMonth, fmtNum, lastMonths } from "../format";
import { BarList, Loading, SourceTag, Sparkline, Term, TrendBadge } from "../components/ui";
import { Card, FfnCaseTable, FraudCaseTable, caseOrigins, countBy } from "./shared";

export default function Origin({ ifs, index, lang }: { ifs: Dataset; index: RiskIndex; lang: Lang }) {
  const fr = lang === "fr";
  const { country: raw = "" } = useParams();
  const country = decodeURIComponent(raw);
  const navigate = useNavigate();
  const { data: ffn, error } = useFfn();
  const { data: jrc } = useJrc();
  const idx = index.origins[country];

  const asOrigin = useMemo(() => (ffn ? ffn.cases.filter((c) => caseOrigins(c).includes(country)) : []), [ffn, country]);
  const asNotifier = useMemo(() => (ffn ? ffn.cases.filter((c) => c.notified_by_normalized === country) : []), [ffn, country]);
  const fraud = useMemo(() => (jrc?.incidents ?? []).filter((c) => c.countries.includes(country)), [jrc, country]);
  // IFS recall maps: one value per publishing authority; England + Scotland are summed for the UK
  const recallByMonth = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of ifs.recalls) if (r.country_normalized === country) m[r.publication_date] = (m[r.publication_date] || 0) + r.value;
    return m;
  }, [ifs, country]);
  const recallTotal = Object.values(recallByMonth).reduce((a, b) => a + b, 0);

  const months = lastMonths(index.sources.ffn.latest, 24);
  const ifsMonths = lastMonths(index.sources.ifs.latest, 24);
  const families = countBy(asOrigin, (c) => c.material_family || "other");
  const groups = countBy(asOrigin, (c) => c.classification_group || "unknown");
  const subs = countBy(asOrigin, (c) => c.substances || []);
  const notifiers = countBy(asOrigin, (c) => (c.notified_by_normalized !== "Unknown" ? c.notified_by_normalized : undefined));
  const fraudFamilies = countBy(fraud, (c) => c.material_family || "other");

  if (!idx && !recallTotal && ffn && !asNotifier.length) {
    return (
      <div className="page">
        <h2>{country}</h2>
        <p>{fr ? "Aucune donnée pour ce pays dans les sources couvertes." : "No data for this country in the covered sources."} <Link to="/origines">{fr ? "Voir tous les pays" : "See all countries"}</Link></p>
      </div>
    );
  }

  return (
    <div className="page">
      <nav className="crumbs" aria-label={fr ? "Fil d'Ariane" : "Breadcrumb"}>
        <Link to="/">{fr ? "Ma veille" : "My watch"}</Link> › <Link to="/origines">{fr ? "Origines" : "Origins"}</Link> › <span>{country}</span>
      </nav>
      <header className="page-header">
        <h2>{country}</h2>
        <p className="subtitle">{fr ? "Ce que les sources signalent sur les produits originaires de ce pays." : "What the sources report about products originating from this country."}</p>
      </header>

      {error && <p className="notice warn">{fr ? "Les suspicions UE n'ont pas pu être chargées." : "EU suspicions could not be loaded."}</p>}
      {(!ffn || !jrc) && !error ? <Loading lang={lang} /> : (
        <>
          <div className="stat-row">
            <div className="stat"><span className="stat-n">{fmtNum(asOrigin.length, lang)}</span><span className="stat-l">{fr ? "suspicions UE sur des produits de cette " : "EU suspicions on products of this "}<Term id="origin" lang={lang}>{fr ? "origine" : "origin"}</Term></span><SourceTag src="ffn" lang={lang} /></div>
            <div className="stat"><span className="stat-n">{fmtNum(fraud.length, lang)}</span><span className="stat-l">{fr ? "incidents de fraude rapportés par la presse dans ce pays" : "press-reported fraud incidents in this country"}</span><SourceTag src="jrc" lang={lang} /></div>
            <div className="stat"><span className="stat-n">{fmtNum(asNotifier.length, lang)}</span><span className="stat-l">{fr ? "cas signalés par ce pays au réseau UE (" : "cases reported by this country to the EU network ("}<Term id="notifier" lang={lang}>{fr ? "notifiant" : "notifier"}</Term>)</span><SourceTag src="ffn" lang={lang} /></div>
            {recallTotal > 0 && <div className="stat"><span className="stat-n">{fmtNum(recallTotal, lang)}</span><span className="stat-l">{fr ? "rappels publiés par les autorités de ce pays (tous produits, toutes origines)" : "recalls published by this country's authorities (all products, all origins)"}</span><SourceTag src="ifs" lang={lang} /></div>}
          </div>

          {idx && (
            <p className="trend-line">
              <span>{fr ? "Suspicions UE (origine)" : "EU suspicions (origin)"} <TrendBadge trend={idx.ffn_trend} lang={lang} /></span>
            </p>
          )}

          <div className="grid-2">
            <Card title={fr ? "Matières concernées" : "Materials concerned"} aside={<SourceTag src="ffn" lang={lang} />}>
              <BarList lang={lang} rows={families.slice(0, 10).map(([f, n]) => [f, n, index.labels.families[f]?.[lang] ?? f])}
                onPick={(f) => navigate(`/matiere/${f}?origine=${encodeURIComponent(country)}`)} />
              <p className="meta">{fr ? "Cliquer ouvre la matière filtrée sur cette origine." : "Click opens the material filtered on this origin."}</p>
            </Card>
            <Card title={fr ? "Types de problèmes" : "Types of issues"} aside={<SourceTag src="ffn" lang={lang} />}>
              <BarList lang={lang} rows={groups.slice(0, 8).map(([g, n]) => [g, n, index.labels.groups[g]?.[lang] ?? g])} />
              {subs.length > 0 && <><h4 className="sub-h">{fr ? "Substances nommées" : "Named substances"}</h4><BarList lang={lang} rows={subs.slice(0, 6)} /></>}
            </Card>
          </div>

          <div className="grid-2">
            <Card title={fr ? "Évolution — suspicions UE (24 mois)" : "Trend — EU suspicions (24 months)"} aside={<SourceTag src="ffn" lang={lang} />}>
              <Sparkline months={months} values={Object.fromEntries(countBy(asOrigin, (c) => c.report_id))} lang={lang} />
            </Card>
            <Card title={fr ? "Qui signale ces produits ?" : "Who reports these products?"} aside={<SourceTag src="ffn" lang={lang} />}>
              <BarList lang={lang} rows={notifiers.slice(0, 6)} />
            </Card>
          </div>

          {fraud.length > 0 && (
            <Card title={fr ? "Fraude rapportée par la presse — matières" : "Press-reported fraud — materials"} aside={<SourceTag src="jrc" lang={lang} />}>
              <BarList lang={lang} tone="jrc" rows={fraudFamilies.map(([f, n]) => [f, n, index.labels.families[f]?.[lang] ?? f])}
                onPick={(f) => navigate(`/matiere/${f}?origine=${encodeURIComponent(country)}`)} />
            </Card>
          )}

          {recallTotal > 0 && (
            <Card title={fr ? "Rappels publiés par les autorités de ce pays" : "Recalls published by this country's authorities"} aside={<SourceTag src="ifs" lang={lang} />}>
              <p className="meta">{fr
                ? <>Chiffres relevés sur les cartes des <Term id="trendRisk" lang={lang}>rapports IFS Trend Risk</Term>. Ils mesurent l'activité de rappel du pays (tous produits vendus sur son marché), <strong>pas</strong> la qualité des produits qui en sont originaires.</>
                : <>Figures read on the <Term id="trendRisk" lang={lang}>IFS Trend Risk Report</Term> maps. They measure the country's recall activity (all products sold on its market), <strong>not</strong> the quality of products originating from it.</>}</p>
              <Sparkline months={ifsMonths} values={recallByMonth} lang={lang} tone="ifs"
                missing={ifsMonths.filter((m) => !ifs.reports.some((r) => r.publication_date === m))} />
            </Card>
          )}

          {fraud.length > 0 && (
            <Card title={fr ? "Fraude rapportée par la presse (JRC) — détail" : "Press-reported fraud (JRC) — detail"} aside={<SourceTag src="jrc" lang={lang} />}>
              <FraudCaseTable cases={fraud} index={index} lang={lang} filename={`fraude-presse-${country}.csv`} />
            </Card>
          )}
          <Card title={fr ? `Suspicions UE — produits originaires de ${country}` : `EU suspicions — products from ${country}`} aside={<SourceTag src="ffn" lang={lang} />}>
            <FfnCaseTable cases={asOrigin} index={index} lang={lang} filename={`suspicions-UE-origine-${country}.csv`} />
          </Card>
          <p className="meta">{fr ? `Données jusqu'à ${fmtMonth(index.sources.ffn.latest, lang)} (FFN) et ${fmtMonth(index.sources.ifs.latest, lang)} (IFS).` : `Data up to ${fmtMonth(index.sources.ffn.latest, lang)} (FFN) and ${fmtMonth(index.sources.ifs.latest, lang)} (IFS).`}</p>
        </>
      )}
    </div>
  );
}
