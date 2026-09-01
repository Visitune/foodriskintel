import { useState, useEffect, useRef } from "react";
import { HashRouter, Routes, Route, NavLink } from "react-router-dom";
import type { Dataset, FfnDataset, CrossDataset } from "./types";
import { t } from "./i18n";
import type { Lang } from "./i18n";
import WorldMap from "./WorldMap";
import CountryDetail from "./CountryDetail";
import FraudExplorer from "./FraudExplorer";
import FfnExplorer from "./FfnExplorer";
import CrossView from "./CrossView";
import Sources from "./Sources";
import Overview from "./Overview";
import OnboardingModal from "./OnboardingModal";
import ScrollAssist from "./ScrollAssist";
import PageTitle from "./PageTitle";
import BottomNav from "./BottomNav";

export default function App() {
  const [data, setData] = useState<Dataset | null>(null);
  const [ffn, setFfn] = useState<FfnDataset | null>(null);
  const [cross, setCross] = useState<CrossDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem("fri-lang") as Lang | null) || "fr");
  const [theme, setTheme] = useState<"dark"|"light">(() => {
    const saved = localStorage.getItem("fri-theme") as "dark"|"light"|null;
    if (saved) return saved;
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  });
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const helpBtnRef = useRef<HTMLButtonElement>(null);
  useEffect(()=>{ document.documentElement.setAttribute("data-theme", theme); localStorage.setItem("fri-theme", theme); }, [theme]);
  useEffect(() => { localStorage.setItem("fri-lang", lang); }, [lang]);
  useEffect(() => {
    if (!localStorage.getItem("fri-onboarding-seen")) {
      setOnboardingOpen(true);
      localStorage.setItem("fri-onboarding-seen", "1");
    }
  }, []);
  const handleCloseOnboarding = () => {
    setOnboardingOpen(false);
    helpBtnRef.current?.focus();
  };

  useEffect(() => {
    Promise.all([
      fetch(`${import.meta.env.BASE_URL}dataset.json`).then(r=>{ if(!r.ok) throw new Error("IFS dataset"); return r.json(); }),
      fetch(`${import.meta.env.BASE_URL}dataset_ffn.json`).then(r=>{ if(!r.ok) throw new Error("FFN dataset"); return r.json(); }).catch(()=>null),
      fetch(`${import.meta.env.BASE_URL}dataset_cross.json`).then(r=>{ if(!r.ok) throw new Error("Cross dataset"); return r.json(); }).catch(()=>null),
    ])
      .then(([d, f, c]) => { setData(d); if(f) setFfn(f); if(c) setCross(c); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading dataset...</div>;
  if (error) return <div className="error">Error: {error}</div>;
  if (!data) return <div className="error">No data available</div>;

  const tr = t[lang];
  return (
    <HashRouter>
      {onboardingOpen && <OnboardingModal lang={lang} onClose={handleCloseOnboarding} />}
      <div className="topbar">
        <div className="topbar-inner">
          <button
            type="button"
            className="icon-btn nav-toggle"
            aria-label={navOpen ? tr.nav.menuClose : tr.nav.menuOpen}
            aria-expanded={navOpen}
            aria-controls="sidebar"
            onClick={() => setNavOpen((v) => !v)}
          >
            {navOpen ? (
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M2 5h16M2 10h16M2 15h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            )}
          </button>
          <div className="topbar-brand">
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <circle cx="13" cy="13" r="8" stroke="var(--accent)" strokeWidth="2" />
              <path d="M18.7 18.7L26 26" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M13 8.5L17.2 16H8.8L13 8.5Z" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
            <span className="topbar-title">Food Risk Intelligence</span>
          </div>
          <div className="topbar-actions">
            <button type="button" ref={helpBtnRef} className="icon-btn" aria-label={tr.onboarding.reopen} title={tr.onboarding.reopen} onClick={() => setOnboardingOpen(true)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.6" />
                <path d="M9.5 9a2.5 2.5 0 114.2 1.8c-.7.6-1.2 1-1.2 2.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                <circle cx="12" cy="17" r="0.9" fill="currentColor" />
              </svg>
            </button>
            <button type="button" className="icon-btn" aria-label={theme==="dark" ? tr.theme.light : tr.theme.dark} title={theme==="dark" ? "Passer en clair" : "Switch to dark"} onClick={()=>setTheme(v=>v==="dark"?"light":"dark")}>
              {theme==="dark" ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.6"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.38 18.38l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.38 5.62l1.42-1.42" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>}
            </button>
            <div className="lang-switch" role="group" aria-label={lang==="fr" ? "Langue" : "Language"}>
              <button type="button" className={lang==="fr" ? "active" : ""} aria-pressed={lang==="fr"} aria-label="Français" onClick={()=>setLang("fr")}>
                <svg width="18" height="13" viewBox="0 0 18 13" aria-hidden="true"><rect width="6" height="13" fill="#002395"/><rect x="6" width="6" height="13" fill="#fff"/><rect x="12" width="6" height="13" fill="#ED2939"/></svg> <span className="lang-code">FR</span>
              </button>
              <button type="button" className={lang==="en" ? "active" : ""} aria-pressed={lang==="en"} aria-label="English" onClick={()=>setLang("en")}>
                <svg width="18" height="13" viewBox="0 0 18 13" aria-hidden="true"><clipPath id="enClip"><rect width="18" height="13" rx="1"/></clipPath><g clipPath="url(#enClip)"><rect width="18" height="13" fill="#012169"/><path d="M0 0 L18 13 M18 0 L0 13" stroke="#fff" strokeWidth="2"/><path d="M0 0 L18 13 M18 0 L0 13" stroke="#C8102E" strokeWidth="1.1"/><rect x="7.5" width="3" height="13" fill="#fff"/><rect y="5" width="18" height="3" fill="#fff"/><rect x="8" width="2" height="13" fill="#C8102E"/><rect y="5.5" width="18" height="2" fill="#C8102E"/></g></svg> <span className="lang-code">EN</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="app">
        {navOpen && (
          <div className="nav-overlay" onClick={() => setNavOpen(false)} aria-hidden="true" />
        )}

        <nav id="sidebar" className={navOpen ? "sidebar open" : "sidebar"}>
          <PageTitle lang={lang} className="sidebar-page-label" />

          <div className="nav-links">
            <div className="nav-group-label">{tr.nav.groupAnalyze}</div>
            <NavLink to="/" end onClick={() => setNavOpen(false)}>{tr.nav.overview}</NavLink>
            <NavLink to="/cross" onClick={() => setNavOpen(false)}>{tr.nav.cross}</NavLink>
            <div className="nav-group-label">{tr.nav.groupExplore}</div>
            <NavLink to="/map" onClick={() => setNavOpen(false)}>{tr.nav.worldMap}</NavLink>
            <NavLink to="/fraud" onClick={() => setNavOpen(false)}>{tr.nav.ifsFraud}</NavLink>
            <NavLink to="/ffn" onClick={() => setNavOpen(false)}>{tr.nav.ffn}</NavLink>
            <div className="nav-group-label">{tr.nav.groupUnderstand}</div>
            <NavLink to="/sources" onClick={() => setNavOpen(false)}>{tr.nav.sources}</NavLink>
          </div>

          <div className="sidebar-footer">
            <div className="meta">IFS {data.summary.total_reports} · FFN {ffn?.summary.total_reports ?? "—"} reports</div>
            <div className="meta">{data.date_range.start} → {cross?.window.end ?? data.date_range.end}</div>
            <div className="source-disclaimer">
              {tr.overview.disc}
            </div>
            <a href="https://www.ifs-certification.com/" target="_blank" rel="noopener noreferrer">Source: IFS</a>
            <span style={{margin:"0 6px"}}>·</span>
            <a href="https://food.ec.europa.eu/food-safety/acn/ffn-monthly_en" target="_blank" rel="noopener noreferrer">FFN</a>
          </div>
        </nav>

        <main className="content">
          <Routes>
            <Route path="/" element={<Overview data={data} ffn={ffn} cross={cross} lang={lang} />} />
            <Route path="/cross" element={ffn && cross ? <CrossView ifs={data} ffn={ffn} cross={cross} lang={lang}/> : <div className="loading">Loading cross data…</div>} />
            <Route path="/map" element={<WorldMap data={data} lang={lang} />} />
            <Route path="/country/:country" element={<CountryDetail data={data} ffn={ffn} lang={lang} />} />
            <Route path="/fraud" element={<FraudExplorer data={data} lang={lang} />} />
            <Route path="/ffn" element={ffn ? <FfnExplorer data={ffn} lang={lang}/> : <div className="loading">Loading FFN…</div>} />
            <Route path="/sources" element={<Sources data={data} lang={lang} />} />
          </Routes>
        </main>
      </div>
      <ScrollAssist lang={lang} />
      <BottomNav lang={lang} />
    </HashRouter>
  );
}
