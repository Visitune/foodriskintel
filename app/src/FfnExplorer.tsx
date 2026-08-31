import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { geoNaturalEarth1, geoPath, geoGraticule } from "d3-geo";
import * as topojson from "topojson-client";
import type { FeatureCollection, GeoJsonProperties } from "geojson";
import type { FfnDataset, FfnCase } from "./types";
import { t } from "./i18n";
import type { Lang } from "./i18n";

const SVG_W = 960, SVG_H = 500;
type Mode = "single" | "all" | "range";

function reverseNormalize(g: string){ const m:Record<string,string>={"United States of America":"United States","Czech Republic":"Czechia"}; return m[g]||g; }
const caseOrigins = (c: FfnCase) => c.origins_list && c.origins_list.length ? c.origins_list : [c.origin_normalized];

function groupClassification(raw: string): string {
  const s = raw.toLowerCase().replace(/[^a-z ]/g," ").replace(/\s+/g," ").trim();
  if(s.includes("food ingredient not authorised") || s.includes("not authorised in the eu")) return "Food / ingredient not authorised (EU)";
  if(s.includes("residues of pesticides") || s.includes("residue of pesticide") || s.includes("mrl")) {
    if(s.includes("veterinary")) return "Residues — veterinary medicines (MRL)";
    return "Residues — pesticides (MRL)";
  }
  if(s.includes("unauthorised origin") || s.includes("unauthorised operator") || s.includes("illegal trade") || s.includes("illegal import")) return "Unauthorised origin / operator / illegal import";
  if(s.includes("adulteration") || s.includes("ingredient substitution") || s.includes("species substitution") || s.includes("ingredient dilution")) return "Adulteration / substitution / dilution";
  if(s.includes("unapproved process") || s.includes("undeclared process") || s.includes("concealment") || s.includes("enhancement")) return "Unapproved / undeclared process";
  if(s.includes("additives not compliant") || s.includes("food additives") || s.includes("mls") || s.includes("flavourings") || s.includes("mix of food additives")) return "Additives / flavourings non-compliant";
  if(s.includes("fcm") || s.includes("food contact")) return "Food contact materials";
  if(s.includes("feed additives")) return "Feed additives";
  if(s.includes("eu protected designation") || s.includes("protected designation")) return "EU protected designation";
  if(s.includes("nutrition and health") || s.includes("dietary claims") || s.includes("organic claims") || s.includes("product attribute") || s.includes("claim violation") || s.includes("other non")) return "Labelling / claims violations";
  if(s.includes("record tampering") || s.includes("others") || s.includes("counterfeit")) return "Record tampering / other";
  if(s.trim()==="unknown" || s==="") return "Unknown / to verify";
  return raw.slice(0,60); // fallback keeps original but truncated
}

export default function FfnExplorer({ data, lang }: { data: FfnDataset; lang: Lang }) {
  const tr = t[lang];
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("single");
  const [selectedReport, setSelectedReport] = useState(data.reports[data.reports.length - 1]?.id || "");
  const [searchParams] = useSearchParams();
  const urlReport = searchParams.get("report");
  const forcedReport = useMemo(() => (urlReport && data.reports.some(x => x.id === urlReport)) ? urlReport : null, [urlReport, data.reports]);
  const [consumedForced, setConsumedForced] = useState<string | null>(null);
  const activeForced = forcedReport && forcedReport !== consumedForced ? forcedReport : null;
  const selReport = activeForced ?? selectedReport;
  const effMode: Mode = activeForced ? "single" : mode;
  const clearForced = () => { if (forcedReport) setConsumedForced(forcedReport); };
  const [rangeFrom, setRangeFrom] = useState(data.reports[0]?.id || "");
  const [rangeTo, setRangeTo] = useState(data.reports[data.reports.length-1]?.id || "");

  const [classificationFilter, setClassificationFilter] = useState("all");
  const [originFilter, setOriginFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [sortCol, setSortCol] = useState<keyof FfnCase>("month_num");
  const [sortDir, setSortDir] = useState<"asc"|"desc">("desc");

  const [geoJSON, setGeoJSON] = useState<FeatureCollection | null>(null);
  const [hovered, setHovered] = useState<string|null>(null);
  const [tooltipPos, setTooltipPos] = useState({x:0,y:0});
  const [mapMetric, setMapMetric] = useState<"origin"|"notified">("origin");

  useEffect(()=>{ fetch(`${import.meta.env.BASE_URL}countries-110m.json`).then(r=>r.json()).then(t=> setGeoJSON(topojson.feature(t, t.objects.countries) as unknown as FeatureCollection)); },[]);

  const grouped = useMemo(()=> data.cases.map(c=> ({...c, group: groupClassification(c.classification)})), [data.cases]);
  const classificationGroups = useMemo(()=> Array.from(new Set(grouped.map(c=>c.group))).sort(), [grouped]);
  const classifications = useMemo(()=> Array.from(new Set(data.cases.map(c => c.classification))).sort(), [data]);
  const origins = useMemo(()=>{ const s=new Set<string>(); data.cases.forEach(c=>caseOrigins(c).forEach(o=>s.add(o))); return [...s].sort(); }, [data]);
  const products = useMemo(()=> Array.from(new Set(data.cases.map(c => c.product_category))).sort(), [data]);

  // Period-filtered cases (with group)
  const periodFiltered = useMemo(()=>{
    const base = grouped;
    if(effMode==="all") return base;
    if(effMode==="single") return base.filter(c=>c.report_id===selReport);
    const idxFrom=data.reports.findIndex(r=>r.id===rangeFrom);
    const idxTo=data.reports.findIndex(r=>r.id===rangeTo);
    if(idxFrom===-1||idxTo===-1) return [];
    const start=Math.min(idxFrom,idxTo), end=Math.max(idxFrom,idxTo);
    const ids=new Set(data.reports.slice(start,end+1).map(r=>r.id));
    return base.filter(c=>ids.has(c.report_id));
  }, [grouped, data.reports, effMode, selReport, rangeFrom, rangeTo]);

  const filtered = useMemo(()=>{
    let r=periodFiltered as (FfnCase & {group:string})[];
    if(classificationFilter!=="all") r=r.filter(c=>c.group===classificationFilter);
    if(originFilter!=="all") r=r.filter(c=>caseOrigins(c).includes(originFilter));
    if(productFilter!=="all") r=r.filter(c=>c.product_category===productFilter);
    return [...r].sort((a,b)=>{
      const va=a[sortCol], vb=b[sortCol];
      if(typeof va==="string" && typeof vb==="string") return sortDir==="asc"? va.localeCompare(vb): vb.localeCompare(va);
      return sortDir==="asc"? Number(va)-Number(vb): Number(vb)-Number(va);
    });
  }, [periodFiltered, classificationFilter, originFilter, productFilter, sortCol, sortDir]);

  const toggleSort=(col:keyof FfnCase)=>{ if(sortCol===col) setSortDir(d=>d==="asc"?"desc":"asc"); else { setSortCol(col); setSortDir("desc"); } };

  const byProduct = useMemo(()=>{ const m:Record<string,number>={}; filtered.forEach(c=>m[c.product_category]=(m[c.product_category]||0)+1); return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,12); }, [filtered]);
  const byClassification = useMemo(()=>{ const m:Record<string,number>={}; filtered.forEach(c=>m[(c as any).group]=(m[(c as any).group]||0)+1); return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,10); }, [filtered]);

  // Map aggregation
  const mapCounts = useMemo(()=>{
    const m:Record<string,number>={};
    filtered.forEach(c=>{
      if (mapMetric==="origin") caseOrigins(c).forEach(o=>{ m[o]=(m[o]||0)+1; });
      else { const key=c.notified_by_normalized; m[key]=(m[key]||0)+1; }
    });
    // also add aliases for geo matching
    const expanded:Record<string,number>={...m};
    for(const [k,v] of Object.entries(m)){
      if(k==="Turkey") { expanded["Turkey"]=v; }
      if(k==="Czechia") { expanded["Czech Republic"]=v; expanded["Czechia"]=v; }
      if(k==="United States") expanded["United States of America"]=v;
      if(k==="North Macedonia") expanded["Macedonia"]=v;
      if(k==="Dominican Republic") expanded["Dominican Rep."]=v;
      if(k==="Congo DR") expanded["Dem. Rep. Congo"]=v;
      if(k==="Falkland Islands") expanded["Falkland Is."]=v;
    }
    return expanded;
  }, [filtered, mapMetric]);

  const maxMap = useMemo(()=> Math.max(1, ...Object.values(mapCounts)), [mapCounts]);

  const projection = useMemo(()=> geoNaturalEarth1().fitSize([SVG_W,SVG_H], {type:"FeatureCollection", features: geoJSON?.features||[]} as any), [geoJSON]);
  const pathGen = useMemo(()=> geoPath(projection), [projection]);
  const graticule=useMemo(()=> geoGraticule()(), []);
  const graticulePath=useMemo(()=> pathGen(graticule), [pathGen, graticule]);

  const getValue=useCallback((geoName:string)=>{
    if(mapCounts[geoName]!==undefined) return mapCounts[geoName];
    const norm=reverseNormalize(geoName);
    if(mapCounts[norm]!==undefined) return mapCounts[norm];
    for(const [k,v] of Object.entries(mapCounts)){
      if(k.toLowerCase()===geoName.toLowerCase()|| geoName.toLowerCase().includes(k.toLowerCase())|| k.toLowerCase().includes(geoName.toLowerCase())) return v;
    }
    return 0;
  }, [mapCounts]);

  const getColor=useCallback((v:number)=>{
    if(v===0) return "var(--fill-empty)";
    const t=v/maxMap;
    if(t<0.15) return "#1e4d2b";
    if(t<0.35) return "#2d7a3e";
    if(t<0.55) return "#6fa832";
    if(t<0.75) return "#d4a017";
    return "#cc3311";
  }, [maxMap]);

  const selectedReportObj = data.reports.find(r=>r.id===selReport);
  const subtitle = effMode==="all" ? `${tr.ffn.allReports} (${data.reports.length}, ${data.date_range.start} → ${data.date_range.end})`
    : effMode==="range" ? `${tr.worldMap.range} ${rangeFrom} → ${rangeTo} (${periodFiltered.length} ${tr.ffn.casesFiltered})`
    : selectedReportObj ? `${selectedReportObj.month} ${selectedReportObj.year} — ${selectedReportObj.total_suspicions} ${lang==="fr"?"suspicions":"suspicions"}, ${selectedReportObj.cases_count} ${lang==="fr"?"cas détaillés":"detailed cases"}` : "";

  return (
    <div className="page">
      <div className="page-header">
        <h2>{tr.ffn.title}</h2>
        <p className="subtitle">{subtitle} — {filtered.length.toLocaleString()} {lang==="fr"?"cas filtrés":"filtered cases"} | {data.summary.countries_origin} origines</p>
      </div>

      <div className="source-banner" style={{flexDirection:'column', alignItems:'flex-start', gap:6}}>
        <span><strong>{lang==="fr" ? "Source : EU FFN Mensuel — DG SANTE" : "Source: EU FFN Monthly — DG SANTE"}</strong> — {tr.ffn.banner1} <a href="https://food.ec.europa.eu/food-safety/acn/ffn-monthly_en" target="_blank" rel="noopener noreferrer">{lang==="fr"?"Page officielle FFN":"Official FFN page"}</a></span>
        <details className="source-toggle"><summary>{lang==="fr"?"ACN = RASFF + AAC + FFN — pourquoi « cross-border » ?":"ACN = RASFF + AAC + FFN — why \"cross-border\"?"}</summary><span style={{fontSize:12, opacity:0.9}}>
          {tr.ffn.banner2} {tr.ffn.vsIfs}
        </span></details>
      </div>

      <div className="filter-bar">
        <div className="controls">
          <div className="mode-tabs">
            <button className={effMode==="single"?"active":""} onClick={()=>{clearForced();setMode("single");}}>{t[lang].worldMap.single}</button>
            <button className={effMode==="range"?"active":""} onClick={()=>{clearForced();setMode("range");}}>{t[lang].worldMap.range}</button>
            <button className={effMode==="all"?"active":""} onClick={()=>{clearForced();setMode("all");}}>{t[lang].worldMap.all}</button>
          </div>
        </div>

        {effMode==="single" && (
          <div className="controls"><select value={selReport} onChange={e=>{clearForced();setSelectedReport(e.target.value);}}>{data.reports.map(r=><option key={r.id} value={r.id}>{r.month} {r.year} — {r.total_suspicions} susp.</option>)}</select>
            {selectedReportObj && <a href={selectedReportObj.source_url} target="_blank" rel="noopener noreferrer" className="pdf-link" style={{display:'inline-flex', alignItems:'center', gap:6, padding:'8px 14px', minHeight:40, boxSizing:'border-box', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', background:'var(--bg-card)'}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="1.6"/><path d="M14 2v6h6M10 13H8m8 4H8m8-8H8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg> {tr.common.pdf} {selectedReportObj.id}</a>}
          </div>
        )}
        {effMode==="range" && (
          <div className="controls range-controls"><span>{lang==="fr"?"De":"From"}</span><select value={rangeFrom} onChange={e=>setRangeFrom(e.target.value)}>{data.reports.map(r=><option key={r.id} value={r.id}>{r.month} {r.year}</option>)}</select><span>{lang==="fr"?"à":"to"}</span><select value={rangeTo} onChange={e=>setRangeTo(e.target.value)}>{data.reports.map(r=><option key={r.id} value={r.id}>{r.month} {r.year}</option>)}</select></div>
        )}

        <div className="controls">
          <select value={classificationFilter} onChange={e=>setClassificationFilter(e.target.value)}><option value="all">{lang==="fr"?`Tous groupes (${classificationGroups.length})`:`All groups (${classificationGroups.length})`}</option>{classificationGroups.map(c=><option key={c} value={c}>{c}</option>)}</select>
          <select value={productFilter} onChange={e=>setProductFilter(e.target.value)}><option value="all">{lang==="fr"?"Toutes catégories produit":"All product categories"}</option>{products.map(c=><option key={c} value={c}>{c}</option>)}</select>
          <select value={originFilter} onChange={e=>setOriginFilter(e.target.value)}><option value="all">{lang==="fr"?"Toutes origines":"All origins"}</option>{origins.map(c=><option key={c} value={c}>{c}</option>)}</select>
          <select value={mapMetric} onChange={e=>setMapMetric(e.target.value as any)}><option value="origin">{tr.ffn.mapOrigin}</option><option value="notified">{tr.ffn.mapNotified}</option></select>
        </div>
      </div>

      {(classificationFilter!=="all"||productFilter!=="all"||originFilter!=="all"||effMode!=="single") && (
        <div className="chip-row">
          <span className="meta">{lang==="fr"?"Filtres actifs :":"Active filters:"}</span>
          {effMode!=="single" && <span className="chip"><b>{effMode==="all"?tr.ffn.allReports:`${tr.worldMap.range} ${rangeFrom}→${rangeTo}`}</b><button className="chip-x" aria-label={lang==="fr"?"Retirer le filtre période":"Remove period filter"} onClick={()=>{clearForced();setMode("single");}}>✕</button></span>}
          {classificationFilter!=="all" && <span className="chip"><b>{classificationFilter}</b><button className="chip-x" aria-label={lang==="fr"?"Retirer le filtre groupe":"Remove group filter"} onClick={()=>setClassificationFilter("all")}>✕</button></span>}
          {productFilter!=="all" && <span className="chip"><b>{productFilter}</b><button className="chip-x" aria-label={lang==="fr"?"Retirer le filtre produit":"Remove product filter"} onClick={()=>setProductFilter("all")}>✕</button></span>}
          {originFilter!=="all" && <span className="chip"><b>{originFilter}</b><button className="chip-x" aria-label={lang==="fr"?"Retirer le filtre origine":"Remove origin filter"} onClick={()=>setOriginFilter("all")}>✕</button></span>}
          <button className="btn-mini" onClick={()=>{setClassificationFilter("all");setProductFilter("all");setOriginFilter("all");setMapMetric("origin");}}>{lang==="fr"?"✕ Réinitialiser les filtres":"✕ Reset filters"}</button>
        </div>
      )}
      <div className="meta" style={{marginBottom:8}}>{lang==="fr"
        ? `70 classifications sources regroupées en ${classificationGroups.length} groupes lisibles — cliquez une barre ou utilisez le menu pour filtrer.`
        : `70 source classifications grouped into ${classificationGroups.length} readable groups — click a bar or use the menu to filter.`} <span title={classifications.join(" • ")}>{lang==="fr"?"Voir détail brut au survol":"Hover for raw detail"}</span></div>

      {geoJSON && (
        <div className="map-container">
          <div className="map-legend"><span className="legend-label">0</span><div className="legend-gradient"/><span className="legend-label">{maxMap}</span><span className="legend-info">({mapMetric==="origin"? tr.ffn.mapOrigin : tr.ffn.mapNotified} — {filtered.length} {tr.ffn.casesFiltered}) · {tr.common.mapClickHelp}</span></div>
          <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="world-svg" onMouseMove={e=>setTooltipPos({x:e.clientX,y:e.clientY})} role="img" aria-label="FFN map">
            <rect width={SVG_W} height={SVG_H} rx={8} style={{fill:"var(--map-bg)"}}/>
            <path d={graticulePath||""} fill="none" style={{stroke:"var(--map-graticule)"}} strokeWidth={0.5}/>
            {geoJSON.features.map((f,i)=>{
              const name=(f.properties as GeoJsonProperties)?.name||""; const v=getValue(name); const d=pathGen(f as any); const hov=hovered===name;
              return <path key={i} d={d||""} style={{cursor: v? "pointer":"default", fill:getColor(v), stroke: hov? "var(--map-stroke-hover)":"var(--map-stroke)", strokeWidth: hov?1.5:0.4}} onMouseEnter={()=>setHovered(name)} onMouseLeave={()=>setHovered(null)} onClick={()=>{
                if(!v) return;
                const norm=reverseNormalize(name);
                navigate(`/country/${encodeURIComponent(norm)}`);
              }}><title>{reverseNormalize(name)} — {getValue(name)} {lang==="fr"?"cas":"cases"}</title></path>;
            })}
          </svg>
          {hovered && <div className="map-tooltip" style={{left:tooltipPos.x+12, top:tooltipPos.y-40}}><strong>{reverseNormalize(hovered)}</strong>: {getValue(hovered)} {tr.ffn.casesWord} ({mapMetric==="origin" ? tr.cross.origin : tr.cross.notifiedBy})</div>}
        </div>
      )}

      <div className="grid-2">
        <div className="card"><h3>{tr.ffn.byProduct}</h3><div className="bar-list">{byProduct.map(([p,c])=>(
          <div key={p} className="bar-row" style={{cursor:"pointer"}} onClick={()=>setProductFilter(productFilter===p?"all":p)}><span className="bar-label" title={p}>{p}</span><div className="bar-track"><div className="bar-fill warn" style={{width:`${(c/(byProduct[0]?.[1]||1))*100}%`, opacity: productFilter===p?1:0.85}}/></div><span className="bar-value">{c}</span></div>
        ))}</div><div className="meta" style={{marginTop:6}}>{tr.ffn.clickBarFilter} {lang==="fr"?`${byProduct.length} principales catégories affichées`:`${byProduct.length} top categories shown`}</div></div>
        <div className="card"><h3>{tr.ffn.byClassif} ({lang==="fr"?"groupés":"grouped"})</h3><div className="bar-list">{byClassification.map(([k,c])=>(
          <div key={k} className="bar-row" style={{cursor:"pointer"}} onClick={()=>setClassificationFilter(classificationFilter===k?"all":k)}><span className="bar-label" title={k}>{k}</span><div className="bar-track"><div className="bar-fill" style={{width:`${(c/(byClassification[0]?.[1]||1))*100}%`, opacity: classificationFilter===k?1:0.85}}/></div><span className="bar-value">{c}</span></div>
        ))}</div><div className="meta" style={{marginTop:6}}>{tr.ffn.clickBarFilter} 70 {lang==="fr"?"libellés bruts →":"raw labels →"} {classificationGroups.length} {tr.ffn.groupsLabel}</div></div>
      </div>

      <div className="card">
        <h3>{lang==="fr" ? "Rapports — sources PDF (période sélectionnée)" : "Reports — PDF sources (selected period)"}</h3>
        <div className="table-scroll"><table><thead><tr><th>{lang==="fr"?"Mois":"Month"}</th><th>{lang==="fr"?"Suspicions":"Suspicions"}</th><th>{lang==="fr"?"Cas détaillés":"Detailed cases"}</th><th>{lang==="fr"?"Top produit":"Top product"}</th><th>PDF</th></tr></thead><tbody>
          {(effMode==="all" ? data.reports : effMode==="single" ? data.reports.filter(r=>r.id===selReport) : data.reports.filter(r=>{
            const a=data.reports.findIndex(x=>x.id===rangeFrom), b=data.reports.findIndex(x=>x.id===rangeTo);
            const s=Math.min(a,b), e=Math.max(a,b); const idx=data.reports.findIndex(x=>x.id===r.id); return idx>=s && idx<=e;
          })).map(r=>(
            <tr key={r.id}><td className="mono">{r.id}</td><td>{r.total_suspicions}</td><td>{r.cases_count}</td><td>{Object.entries(r.by_product_category).sort((a,b)=>b[1]-a[1])[0]?.[0]?.slice(0,30) || "—"}</td><td><a href={r.source_url} target="_blank" rel="noopener noreferrer" className="pdf-link" style={{display:'inline-flex',alignItems:'center',gap:4}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="1.6"/><path d="M14 2v6h6" stroke="currentColor" strokeWidth="1.4"/></svg> {r.filename.slice(0,22)}</a></td></tr>
          ))}
        </tbody></table></div>
      </div>

      <div className="card">
        <h3>{lang==="fr" ? `Cas détaillés (${filtered.length}) — liens PDF` : `Detailed cases (${filtered.length}) — PDF links`}</h3>
        <div className="table-scroll"><table><thead><tr>
          {(
            [
              ["year", tr.common.year],
              ["month_num", tr.common.month],
              ["product_category", tr.common.product],
              ["classification", tr.common.classification],
              ["origin_normalized", tr.common.origin],
              ["notified_by_normalized", tr.common.notified],
            ] as [keyof FfnCase, string][]
          ).map(([col, label])=>(
            <th key={col} className="sortable" aria-sort={sortCol===col ? (sortDir==="asc"?"ascending":"descending") : "none"}><button type="button" onClick={()=>toggleSort(col)}>{label} {sortCol===col? (sortDir==="asc"?"↑":"↓"):""}</button></th>
          ))}<th>{tr.common.commodity}</th><th>{tr.common.issue}</th><th>PDF</th>
        </tr></thead><tbody>
          {filtered.slice(0,500).map((c,i)=>(
            <tr key={i}><td className="mono">{c.year}</td><td>{c.month}</td><td>{c.product_category}</td><td><span className="tag" title={c.classification}>{(c as any).group}</span></td><td title={caseOrigins(c).join(", ")+"\n"+(c.origin_raw||"")}>{c.origin_normalized}{caseOrigins(c).length>1 && <span style={{opacity:0.6}}> +{caseOrigins(c).length-1}</span>}</td><td>{c.notified_by_normalized}</td><td title={c.commodity}>{c.commodity.slice(0,42)}</td><td title={c.issue}>{c.issue.slice(0,50)}</td><td><a href={c.source_url} target="_blank" rel="noopener noreferrer" title={c.source_url} aria-label="PDF" style={{display:'inline-flex'}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="1.6"/><path d="M14 2v6h6" stroke="currentColor" strokeWidth="1.4"/></svg></a></td></tr>
          ))}
        </tbody></table>{filtered.length>500 && <div className="meta">{lang==="fr" ? `Affichage 500/${filtered.length} — affinez les filtres` : `Showing 500/${filtered.length} — refine filters`}</div>}</div>
      </div>
    </div>
  );
}
