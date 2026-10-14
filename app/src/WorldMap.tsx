import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { geoNaturalEarth1, geoPath, geoGraticule } from "d3-geo";
import * as topojson from "topojson-client";
import type { FeatureCollection, GeoJsonProperties } from "geojson";
import type { Dataset } from "./types";
import { t } from "./i18n";
import type { Lang } from "./i18n";

const SVG_W = 960;
const SVG_H = 500;

function reverseNormalize(geoName: string): string {
  const map: Record<string, string> = {
    "United States of America": "United States",
    "Czech Republic": "Czechia",
    "Dominican Republic": "Dominican Republic",
  };
  return map[geoName] || geoName;
}

type SelectionMode = "single" | "all" | "range";

export default function WorldMap({ data, lang }: { data: Dataset; lang: Lang }) {
  const navigate = useNavigate();
  const [geoJSON, setGeoJSON] = useState<FeatureCollection | null>(null);
  const [mode, setMode] = useState<SelectionMode>("single");
  const [selectedReport, setSelectedReport] = useState(
    data.reports[data.reports.length - 1]?.id || ""
  );
  const [rangeFrom, setRangeFrom] = useState(data.reports[0]?.id || "");
  const [rangeTo, setRangeTo] = useState(
    data.reports[data.reports.length - 1]?.id || ""
  );
  const [hovered, setHovered] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const [searchParams] = useSearchParams();

  const urlReport = searchParams.get("month");
  const forcedReport = useMemo(() => {
    if (!urlReport) return null;
    const rep = data.reports.find(r => r.publication_date === urlReport || r.id === urlReport);
    return rep?.id ?? null;
  }, [urlReport, data.reports]);
  const [consumedForced, setConsumedForced] = useState<string | null>(null);
  const activeForced = forcedReport && forcedReport !== consumedForced ? forcedReport : null;
  const selReport = activeForced ?? selectedReport;
  const effMode: SelectionMode = activeForced ? "single" : mode;
  const clearForced = () => { if (forcedReport) setConsumedForced(forcedReport); };

  const report = data.reports.find((r) => r.id === selReport);

  // Aggregate recalls based on mode
  const reportData = useMemo(() => {
    if (effMode === "single") {
      return report?.recalls || {};
    }

    if (effMode === "all") {
      // Sum ALL reports
      const merged: Record<string, number> = {};
      data.reports.forEach((r) => {
        Object.entries(r.recalls).forEach(([country, val]) => {
          merged[country] = (merged[country] || 0) + val;
        });
      });
      return merged;
    }

    // range mode: sum reports between from and to (inclusive)
    const fromIdx = data.reports.findIndex((r) => r.id === rangeFrom);
    const toIdx = data.reports.findIndex((r) => r.id === rangeTo);
    if (fromIdx === -1 || toIdx === -1) return {};

    const start = Math.min(fromIdx, toIdx);
    const end = Math.max(fromIdx, toIdx);
    const merged: Record<string, number> = {};
    data.reports.slice(start, end + 1).forEach((r) => {
      Object.entries(r.recalls).forEach(([country, val]) => {
        merged[country] = (merged[country] || 0) + val;
      });
    });
    return merged;
  }, [effMode, report, data.reports, rangeFrom, rangeTo]);

  // Count reports in current selection
  const reportsInSelection = useMemo(() => {
    if (effMode === "single") return 1;
    if (effMode === "all") return data.reports.length;
    const fromIdx = data.reports.findIndex((r) => r.id === rangeFrom);
    const toIdx = data.reports.findIndex((r) => r.id === rangeTo);
    if (fromIdx === -1 || toIdx === -1) return 0;
    return Math.abs(toIdx - fromIdx) + 1;
  }, [effMode, data.reports, rangeFrom, rangeTo]);

  const maxVal = useMemo(
    () => Math.max(1, ...Object.values(reportData)),
    [reportData]
  );

  // Build country lookup
  const countryLookup = useMemo(() => {
    const lookup: Record<string, number> = {};
    for (const [key, value] of Object.entries(reportData)) {
      lookup[key] = value;
      if (key === "USA (FDA)" || key === "USA (USDA)") {
        lookup["United States"] = (lookup["United States"] || 0) + value;
      }
      if (key === "England" || key === "Scotland") {
        lookup["United Kingdom"] = (lookup["United Kingdom"] || 0) + value;
      }
      if (key === "Czech Rep.") {
        lookup["Czech Republic"] = value;
        lookup["Czechia"] = value;
      }
      if (key === "Viet Nam") lookup["Vietnam"] = value;
      if (key === "Finnland") lookup["Finland"] = value;
      if (key === "Türkiye") lookup["Turkey"] = value;
    }
    return lookup;
  }, [reportData]);

  const getValue = useCallback(
    (geoName: string): number => {
      if (countryLookup[geoName] !== undefined) return countryLookup[geoName];
      const norm = reverseNormalize(geoName);
      if (countryLookup[norm] !== undefined) return countryLookup[norm];
      for (const [key, val] of Object.entries(countryLookup)) {
        if (
          key.toLowerCase() === geoName.toLowerCase() ||
          geoName.toLowerCase().includes(key.toLowerCase()) ||
          key.toLowerCase().includes(geoName.toLowerCase())
        )
          return val;
      }
      return 0;
    },
    [countryLookup]
  );

  const getColor = useCallback(
    (val: number): string => {
      if (val === 0) return "var(--fill-empty)";
      const t = val / maxVal;
      if (t < 0.15) return "var(--map-1)";
      if (t < 0.35) return "var(--map-2)";
      if (t < 0.55) return "var(--map-3)";
      if (t < 0.75) return "var(--map-4)";
      return "var(--map-5)";
    },
    [maxVal]
  );

  // Load GeoJSON
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}countries-110m.json`)
      .then((r) => r.json())
      .then((topology) => {
        const geo = topojson.feature(topology, topology.objects.countries);
        setGeoJSON(geo as unknown as FeatureCollection);
      });
  }, []);

  const projection = useMemo(
    () =>
      geoNaturalEarth1().fitSize([SVG_W, SVG_H], {
        type: "FeatureCollection",
        features: geoJSON?.features || [],
      } as any),
    [geoJSON]
  );

  const pathGenerator = useMemo(() => geoPath(projection), [projection]);
  const graticule = useMemo(() => geoGraticule()(), []);
  const graticulePath = useMemo(
    () => pathGenerator(graticule),
    [pathGenerator, graticule]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      setTooltipPos({ x: e.clientX, y: e.clientY });
    },
    []
  );

  const tr = t[lang];
  // Build subtitle text
  const subtitleText = useMemo(() => {
    if (effMode === "all") {
      return tr.worldMap.subtitleAll(data.reports.length, data.date_range.start, data.date_range.end);
    }
    if (effMode === "range") {
      const from = data.reports.find((r) => r.id === rangeFrom);
      const to = data.reports.find((r) => r.id === rangeTo);
      if (from && to) {
        return tr.worldMap.subtitleRange(`${from.month} ${from.year}`, `${to.month} ${to.year}`, reportsInSelection);
      }
    }
    return report
      ? tr.worldMap.subtitleSingle(report.month, report.year)
      : "—";
  }, [effMode, report, data.reports, data.date_range, rangeFrom, rangeTo, reportsInSelection, tr]);

  if (!geoJSON) {
    return (
      <div className="page">
        <div className="loading">Loading map data...</div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>{tr.worldMap.title}</h2>
        <p className="subtitle">{subtitleText}</p>
      </div>

      <div className="source-banner" style={{flexDirection:'column', alignItems:'flex-start', gap:4}}>
        <span><strong>{lang==="fr" ? "Source : IFS Trend Risk — Rappels uniquement" : "Source: IFS Trend Risk — Recalls only"}</strong> — {tr.worldMap.banner} <a href="https://www.ifs-certification.com/" target="_blank" rel="noopener noreferrer">{lang==="fr"?"Rapports IFS officiels":"Official IFS reports"}</a></span>
        <span style={{fontSize:12, opacity:0.9}}>{lang==="fr" ? "Chaque valeur = nombre affiché sur la carte IFS du mois. Aucune répartition de cumul." : "Each value = number shown on IFS map. No allocation of cumulative months."}</span>
      </div>

      <div className="filter-bar">
        <div className="controls">
          <div className="mode-tabs">
            <button
              className={effMode === "single" ? "active" : ""}
              onClick={() => { clearForced(); setMode("single"); }}
            >
              {tr.worldMap.single}
            </button>
            <button
              className={effMode === "range" ? "active" : ""}
              onClick={() => { clearForced(); setMode("range"); }}
            >
              {tr.worldMap.range}
            </button>
            <button
              className={effMode === "all" ? "active" : ""}
              onClick={() => { clearForced(); setMode("all"); }}
            >
              {tr.worldMap.all}
            </button>
          </div>

          {effMode === "single" && (
            <select
              value={selReport}
              onChange={(e) => { clearForced(); setSelectedReport(e.target.value); }}
            >
              {data.reports.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.month} {r.year}
                </option>
              ))}
            </select>
          )}

          {effMode === "range" && (
            <span className="range-controls">
              <span className="range-label">{lang === "fr" ? "De" : "From"}</span>
              <select
                value={rangeFrom}
                onChange={(e) => setRangeFrom(e.target.value)}
              >
                {data.reports.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.month} {r.year}
                  </option>
                ))}
              </select>
              <span className="range-label">{lang === "fr" ? "à" : "to"}</span>
              <select
                value={rangeTo}
                onChange={(e) => setRangeTo(e.target.value)}
              >
                {data.reports.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.month} {r.year}
                  </option>
                ))}
              </select>
            </span>
          )}
        </div>
      </div>

      <div className="map-container">
        <div className="map-legend">
          <span className="legend-label">0</span>
          <div className="legend-gradient" />
          <span className="legend-label">{maxVal}</span>
          {effMode !== "single" && (
            <span className="legend-info">
              {tr.worldMap.cumulativeInfo(reportsInSelection)}
            </span>
          )}
        </div>

        <svg
          ref={svgRef}
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className="world-svg"
          onMouseMove={handleMouseMove}
          role="img"
          aria-label={tr.worldMap.ariaLabel}
        >
          <rect width={SVG_W} height={SVG_H} rx={8} style={{ fill: "var(--map-bg)" }} />
          <path
            d={graticulePath || ""}
            fill="none"
            style={{ stroke: "var(--map-graticule)" }}
            strokeWidth={0.5}
          />
          {geoJSON.features.map((feature, i) => {
            const geoName =
              (feature.properties as GeoJsonProperties)?.name || "";
            const val = getValue(geoName);
            const d = pathGenerator(feature as any);
            const isHovered = hovered === geoName;
            return (
              <path
                key={i}
                d={d || ""}
                style={{ fill: getColor(val), cursor: "pointer", transition: "fill 0.2s", stroke: isHovered ? "var(--map-stroke-hover)" : "var(--map-stroke)", strokeWidth: isHovered ? 1.5 : 0.4 }}
                onMouseEnter={() => setHovered(geoName)}
                onMouseLeave={() => setHovered(null)}
                onClick={() =>
                  navigate(
                    `/origine/${encodeURIComponent(reverseNormalize(geoName))}`
                  )
                }
              >
                <title>{reverseNormalize(geoName)}</title>
              </path>
            );
          })}
        </svg>

        {hovered && (
          <div
            className="map-tooltip"
            style={{
              left: tooltipPos.x + 12,
              top: tooltipPos.y - 40,
            }}
          >
            <strong>{reverseNormalize(hovered)}</strong>:{" "}
            {getValue(hovered)} {tr.worldMap.legend}
          </div>
        )}
      </div>

      <div className="card">
        <h3>{tr.worldMap.modesTitle}</h3>
        <ul>
          <li>
            <strong>{tr.worldMap.single}</strong> — {tr.worldMap.modeSingleDesc}
          </li>
          <li>
            <strong>{tr.worldMap.range}</strong> — {tr.worldMap.modeRangeDesc}
          </li>
          <li>
            <strong>{tr.worldMap.all}</strong> — {tr.worldMap.modeAllDesc(data.reports.length)}
          </li>
        </ul>
      </div>
    </div>
  );
}
