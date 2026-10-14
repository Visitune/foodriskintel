import { useMemo } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { Lang } from "../i18n";
import type { RiskIndex } from "../types";
import { useFfn, useJrc } from "../data";
import { fmtMonth, fmtNum, lastMonths } from "../format";
import { BarList, Loading, SourceTag, Sparkline, Term, TrendBadge } from "../components/ui";
import { Card, FfnCaseTable, FraudCaseTable, caseOrigins, countBy } from "./shared";

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Commodity cells cut by the PDF table layout ("(ingredient", "cephalopods and") — same rule as build_index.py */
const isFragment = (s: string) => {
  const t = s.trim();
  return t.length < 3 || "(,;-".includes(t[0]) || /( and| or|,|\(|-| of)$/.test(t) || (t.match(/\(/g) || []).length !== (t.match(/\)/g) || []).length;
};

export default function Material({ index, lang }: { index: RiskIndex; lang: Lang }) {
  const fr = lang === "fr";
  const { id = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const q = params.get("q") || "";
  const danger = params.get("danger") || "";
  const origin = params.get("origine") || "";
  const { data: ffn, error } = useFfn();
  const { data: jrc } = useJrc();
  const fam = index.families[id];
  const famLabel = index.labels.families[id]?.[lang] ?? id;

  const setParam = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v); else p.delete(k);
    setParams(p, { replace: true });
  };

  const ffnCases = useMemo(() => {
    if (!ffn) return [];
    const nq = norm(q);
    return ffn.cases.filter((c) =>
      c.material_family === id &&
      (!nq || norm(c.commodity).includes(nq)) &&
      (!danger || (c.substances || []).includes(danger)) &&
      (!origin || caseOrigins(c).includes(origin)));
  }, [ffn, id, q, danger, origin]);

  const fraudCases = useMemo(() => {
    const nq = norm(q);
    if (danger) return [];  // substances only exist in FFN
    return (jrc?.incidents ?? []).filter((c) =>
      c.material_family === id &&
      (!nq || norm(c.description).includes(nq) || c.categories.some((x) => norm(x).includes(nq))) &&
      (!origin || c.countries.includes(origin)));
  }, [jrc, id, q, danger, origin]);

  if (!fam) {
    return (
      <div className="page">
        <h2>{fr ? "Matière inconnue" : "Unknown material"}</h2>
        <p><Link to="/matieres">{fr ? "Voir toutes les familles de matières" : "See all material families"}</Link></p>
      </div>
    );
  }

  const months = lastMonths(index.sources.ffn.latest, 24);
  const ffnByMonth = Object.fromEntries(countBy(ffnCases, (c) => c.report_id));
  const fraudMonths = lastMonths(index.sources.jrc.latest, 24);
  const fraudByMonth = Object.fromEntries(countBy(fraudCases, (c) => c.month));
  const fraudGaps = fraudMonths.filter((m) => !index.sources.jrc.months_covered.includes(m));
  const groups = countBy(ffnCases, (c) => c.classification_group || "unknown");
  const subs = countBy(ffnCases, (c) => c.substances || []);
  const origins = countBy(ffnCases, caseOrigins);
  const commodities = countBy(ffnCases, (c) => (isFragment(c.commodity) ? undefined : c.commodity.toLowerCase()));
  const reasons = countBy(fraudCases, (c) => c.reasons);
  const fraudCountries = countBy(fraudCases, (c) => c.countries);
  const filtered = Boolean(q || danger || origin);
  const topGroup = groups[0] ? index.labels.groups[groups[0][0]]?.[lang] : null;
  const subject = q ? `« ${q} »` : famLabel.toLowerCase();

  return (
    <div className="page">
      <nav className="crumbs" aria-label={fr ? "Fil d'Ariane" : "Breadcrumb"}>
        <Link to="/">{fr ? "Ma veille" : "My watch"}</Link> › <Link to="/matieres">{fr ? "Matières" : "Materials"}</Link> › <span>{famLabel}</span>
      </nav>
      <header className="page-header">
        <h2>{q ? <>{q} <span className="h-sub">— {famLabel}</span></> : famLabel}</h2>
        <div className="tag-row">
          <SourceTag src="ffn" lang={lang} /> <SourceTag src="jrc" lang={lang} />
        </div>
      </header>

      {filtered && (
        <div className="chip-row" aria-label={fr ? "Filtres actifs" : "Active filters"}>
          {q && <button type="button" className="chip" onClick={() => setParam("q", "")}>{fr ? "Produit" : "Product"} : {q} <span aria-hidden="true">×</span></button>}
          {danger && <button type="button" className="chip" onClick={() => setParam("danger", "")}>{fr ? "Danger" : "Hazard"} : {danger} <span aria-hidden="true">×</span></button>}
          {origin && <button type="button" className="chip" onClick={() => setParam("origine", "")}>{fr ? "Origine" : "Origin"} : {origin} <span aria-hidden="true">×</span></button>}
          <button type="button" className="chip ghost" onClick={() => setParams({}, { replace: true })}>{fr ? "Toute la famille" : "Whole family"}</button>
        </div>
      )}

      {error && <p className="notice warn">{fr ? "Les suspicions UE n'ont pas pu être chargées." : "EU suspicions could not be loaded."}</p>}
      {(!ffn || !jrc) && !error ? <Loading lang={lang} /> : (
        <>
          <section className="summary" aria-live="polite">
            <h3 className="visually-hidden">{fr ? "En bref" : "In short"}</h3>
            <p>
              {fr ? <>Sur la période couverte ({fmtMonth(index.sources.ffn.first, lang)} → {fmtMonth(index.sources.ffn.latest, lang)}), </> : <>Over the covered period ({fmtMonth(index.sources.ffn.first, lang)} → {fmtMonth(index.sources.ffn.latest, lang)}), </>}
              <strong>{fmtNum(ffnCases.length, lang)}</strong> {fr ? <><Term id="ffn" lang={lang}>suspicions officielles UE</Term> et </> : <><Term id="ffn" lang={lang}>official EU suspicions</Term> and </>}
              <strong>{fmtNum(fraudCases.length, lang)}</strong> {fr ? <><Term id="jrc" lang={lang}>incidents de fraude rapportés par la presse</Term> concernent {subject}.</> : <><Term id="jrc" lang={lang}>press-reported fraud incidents</Term> concern {subject}.</>}
              {topGroup && (fr ? <> Le problème le plus fréquent est <strong>{topGroup.toLowerCase()}</strong>.</> : <> The most frequent issue is <strong>{topGroup.toLowerCase()}</strong>.</>)}
              {origins[0] && (fr ? <> Origines les plus citées : {origins.slice(0, 3).map(([o]) => o).join(", ")}.</> : <> Most cited origins: {origins.slice(0, 3).map(([o]) => o).join(", ")}.</>)}
            </p>
            {!filtered && (
              <p className="trend-line">
                <span>{fr ? "Suspicions UE" : "EU suspicions"} <TrendBadge trend={fam.ffn_trend} lang={lang} /></span>
                <span>{fr ? "Fraude presse" : "Press fraud"} <TrendBadge trend={fam.fraud_trend} lang={lang} /></span>
              </p>
            )}
          </section>

          <div className="grid-2">
            <Card title={fr ? "Ce qui est signalé" : "What is reported"} aside={<SourceTag src="ffn" lang={lang} />}>
              <BarList lang={lang} rows={groups.slice(0, 8).map(([g, n]) => [g, n, index.labels.groups[g]?.[lang] ?? g])} />
              {subs.length > 0 && <>
                <h4 className="sub-h">{fr ? "Dangers et substances nommés (cliquer pour filtrer)" : "Named hazards and substances (click to filter)"}</h4>
                <BarList lang={lang} rows={subs.slice(0, 8)} onPick={(s) => setParam("danger", danger === s ? "" : s)} active={danger} />
              </>}
            </Card>
            <Card title={fr ? "D'où viennent les produits signalés" : "Where flagged products come from"} aside={<Term id="origin" lang={lang}>?</Term>}>
              <BarList lang={lang} rows={origins.slice(0, 10)} onPick={(o) => setParam("origine", origin === o ? "" : o)} active={origin} />
              <p className="meta">{fr ? "Cliquer filtre cette page ; " : "Click filters this page; "}<Link to={origins[0] ? `/origine/${encodeURIComponent(origins[0][0])}` : "/origines"}>{fr ? "voir la fiche pays" : "see the country page"}</Link>.</p>
            </Card>
          </div>

          <div className="grid-2">
            <Card title={fr ? "Évolution — suspicions UE (24 mois)" : "Trend — EU suspicions (24 months)"} aside={<SourceTag src="ffn" lang={lang} />}>
              <Sparkline months={months} values={ffnByMonth} lang={lang} tone="ffn" />
            </Card>
            <Card title={fr ? "Évolution — fraude presse (24 mois)" : "Trend — press fraud (24 months)"} aside={<SourceTag src="jrc" lang={lang} />}>
              <Sparkline months={fraudMonths} values={fraudByMonth} lang={lang} tone="jrc" missing={fraudGaps} />
              <p className="meta">{fr ? "Trait gris = mois sans rapport JRC lisible (rapport publié en image ou pas encore paru) : absence de données, pas zéro." : "Grey dash = month without a readable JRC report (image-only or not yet published): no data, not zero."}</p>
            </Card>
          </div>

          {!q && commodities.length > 1 && (
            <Card title={fr ? "Produits les plus cités" : "Most cited products"}>
              <div className="chip-row">
                {commodities.slice(0, 18).map(([c, n]) => (
                  <button type="button" key={c} className="chip" onClick={() => setParam("q", c)}>{c} <span className="chip-n">{n}</span></button>
                ))}
              </div>
            </Card>
          )}

          {fraudCases.length > 0 && (
            <div className="grid-2">
              <Card title={fr ? "Types de fraude rapportés" : "Reported fraud types"} aside={<SourceTag src="jrc" lang={lang} />}>
                <BarList lang={lang} tone="jrc" rows={reasons.slice(0, 8).map(([r, n]) => [r, n, index.labels.reasons[r]?.[lang] ?? r])} />
              </Card>
              <Card title={fr ? "Pays des cas de fraude" : "Fraud case countries"} aside={<SourceTag src="jrc" lang={lang} />}>
                <BarList lang={lang} tone="jrc" rows={fraudCountries.slice(0, 8)} onPick={(o) => navigate(`/origine/${encodeURIComponent(o)}`)} />
              </Card>
            </div>
          )}

          <Card id="vaccp" title={fr ? "Pour votre évaluation de vulnérabilité à la fraude" : "For your food fraud vulnerability assessment"}>
            <div className="vaccp">
              <p>{fr
                ? <>L'<Term id="vaccp" lang={lang}>évaluation de vulnérabilité</Term> exigée par IFS Food v8 doit s'appuyer sur des informations historiques et actuelles. Cette page vous donne des faits datés et sourcés :</>
                : <>The <Term id="vaccp" lang={lang}>vulnerability assessment</Term> required by IFS Food v8 must rely on historical and current information. This page gives you dated, sourced facts:</>}</p>
              <ol>
                <li>{fr ? "Exportez les cas ci-dessous (CSV) et joignez-les à votre dossier, avec la date de consultation." : "Export the cases below (CSV) and attach them to your file, with the consultation date."}</li>
                <li>{fr ? "Vérifiez si vos origines et fournisseurs figurent dans les pays cités ; filtrez par origine." : "Check whether your origins and suppliers appear among the cited countries; filter by origin."}</li>
                <li>{fr ? "Notez les types de fraude récurrents (substitution, dilution, fausse origine…) : ce sont vos scénarios à évaluer." : "Note the recurring fraud types (substitution, dilution, false origin…): these are your scenarios to assess."}</li>
                <li>{fr ? "Reliez chaque scénario à une mesure de maîtrise (analyse, audit fournisseur, certificat d'origine) et à une fréquence." : "Link each scenario to a control measure (testing, supplier audit, certificate of origin) and a frequency."}</li>
              </ol>
              <p className="meta">{fr
                ? "Ces données sont des signaux publiés (suspicions et presse), pas des condamnations ni une liste exhaustive. Consultez toujours le document source via les liens."
                : "These are published signals (suspicions and press), not convictions nor an exhaustive list. Always check the source document through the links."}</p>
            </div>
          </Card>

          <Card title={fr ? "Suspicions officielles UE — détail" : "Official EU suspicions — detail"} aside={<SourceTag src="ffn" lang={lang} />}>
            <FfnCaseTable cases={ffnCases} index={index} lang={lang} filename={`suspicions-UE-${id}${q ? "-" + q : ""}.csv`} />
          </Card>
          {!danger && (
            <Card title={fr ? "Fraude rapportée par la presse (JRC) — détail" : "Press-reported fraud (JRC) — detail"} aside={<SourceTag src="jrc" lang={lang} />}>
              <FraudCaseTable cases={fraudCases} index={index} lang={lang} filename={`fraude-presse-${id}${q ? "-" + q : ""}.csv`} />
            </Card>
          )}
        </>
      )}
    </div>
  );
}
