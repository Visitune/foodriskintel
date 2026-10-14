import { useState, useEffect, useRef } from "react";
import { HashRouter, Routes, Route, NavLink, Navigate, useParams } from "react-router-dom";
import type { Dataset, RiskIndex } from "./types";
import { t } from "./i18n";
import type { Lang } from "./i18n";
import WorldMap from "./WorldMap";
import FraudExplorer from "./FraudExplorer";
import FfnExplorer from "./FfnExplorer";
import CrossView from "./CrossView";
import Sources from "./Sources";
import Overview from "./Overview";
import OnboardingModal from "./OnboardingModal";
import ScrollAssist from "./ScrollAssist";
import PageTitle from "./PageTitle";
import BottomNav from "./BottomNav";
import Watch from "./pages/Watch";
import Material from "./pages/Material";
import Origin from "./pages/Origin";
import Guide from "./pages/Guide";
import { Materials, Origins } from "./pages/Lists";
import { loadJson, useCross, useFfn } from "./data";
import { fmtMonth } from "./format";
import { Loading } from "./components/ui";

function CountryRedirect() {
  const { country = "" } = useParams();
  return <Navigate to={`/origine/${country}`} replace />;
}

// Source explorers need the large FFN / cross datasets: loaded on demand.
function WithFfn({ lang, render }: { lang: Lang; render: (ffn: NonNullable<ReturnType<typeof useFfn>["data"]>) => React.ReactNode }) {
  const { data, error } = useFfn();
  if (error) return <div className="error">{lang === "fr" ? "Données FFN indisponibles." : "FFN data unavailable."}</div>;
  return data ? <>{render(data)}</> : <Loading lang={lang} />;
}
function WithCross({ lang, render }: { lang: Lang; render: (c: NonNullable<ReturnType<typeof useCross>["data"]>) => React.ReactNode }) {
  const { data, error } = useCross();
  if (error) return <div className="error">{lang === "fr" ? "Données croisées indisponibles." : "Cross data unavailable."}</div>;
  return data ? <>{render(data)}</> : <Loading lang={lang} />;
}

export default function App() {
  const [data, setData] = useState<Dataset | null>(null);
  const [index, setIndex] = useState<RiskIndex | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem("fri-lang") as Lang | null) || "fr");
  const [theme, setTheme] = useState<"dark"|"light">(() => {
    let saved: "dark"|"light"|null = null;
    try { saved = localStorage.getItem("fri-theme") as "dark"|"light"|null; } catch { /* storage blocked */ }
    // Light by default: a working tool used in offices, printed and screenshotted
    return saved ?? "light";
  });
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const helpBtnRef = useRef<HTMLButtonElement>(null);
  useEffect(()=>{ document.documentElement.setAttribute("data-theme", theme); localStorage.setItem("fri-theme", theme); }, [theme]);
  useEffect(() => {
    localStorage.setItem("fri-lang", lang);
    document.documentElement.lang = lang;
    document.title = lang === "fr" ? "Food Risk Intelligence — veille matières premières" : "Food Risk Intelligence — raw material watch";
  }, [lang]);
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
    Promise.all([loadJson<Dataset>("dataset.json"), loadJson<RiskIndex>("index.json")])
      .then(([d, i]) => { setData(d); setIndex(i); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading lang={lang} />;
  if (error || !data || !index) return <div className="error">{lang === "fr" ? "Impossible de charger les données" : "Could not load data"} ({error})</div>;

  const tr = t[lang];
  return (
    <HashRouter>
      {onboardingOpen && <OnboardingModal lang={lang} onClose={handleCloseOnboarding} />}
      <div className="topbar">
        <div className="topbar-inner">
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
            <button type="button" className="icon-btn" aria-label={theme==="dark" ? tr.theme.light : tr.theme.dark} title={theme==="dark" ? tr.theme.light : tr.theme.dark} onClick={()=>setTheme(v=>v==="dark"?"light":"dark")}>
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
            <div className="nav-group-label">{tr.nav.groupWatch}</div>
            <NavLink to="/" end onClick={() => setNavOpen(false)}>{tr.nav.home}</NavLink>
            <NavLink to="/matieres" onClick={() => setNavOpen(false)}>{tr.nav.materials}</NavLink>
            <NavLink to="/origines" onClick={() => setNavOpen(false)}>{tr.nav.origins}</NavLink>
            <div className="nav-group-label">{tr.nav.groupExplore}</div>
            <NavLink to="/ffn" onClick={() => setNavOpen(false)}>{tr.nav.ffn}</NavLink>
            <NavLink to="/fraud" onClick={() => setNavOpen(false)}>{tr.nav.ifsFraud}</NavLink>
            <NavLink to="/map" onClick={() => setNavOpen(false)}>{tr.nav.worldMap}</NavLink>
            <NavLink to="/cross" onClick={() => setNavOpen(false)}>{tr.nav.cross}</NavLink>
            <NavLink to="/overview" onClick={() => setNavOpen(false)}>{tr.nav.overview}</NavLink>
            <div className="nav-group-label">{tr.nav.groupUnderstand}</div>
            <NavLink to="/comprendre" onClick={() => setNavOpen(false)}>{tr.nav.guide}</NavLink>
            <NavLink to="/sources" onClick={() => setNavOpen(false)}>{tr.nav.sources}</NavLink>
          </div>

          <div className="sidebar-footer">
            <div className="meta">{lang === "fr" ? "Données à jour :" : "Data up to:"}</div>
            <div className="meta">FFN {fmtMonth(index.sources.ffn.latest, lang, "short")} · IFS {fmtMonth(index.sources.ifs.latest, lang, "short")}</div>
            <div className="source-disclaimer">{tr.overview.disc}</div>
          </div>
        </nav>

        <main className="content">
          <Routes>
            <Route path="/" element={<Watch index={index} lang={lang} />} />
            <Route path="/matieres" element={<Materials index={index} lang={lang} />} />
            <Route path="/matiere/:id" element={<Material index={index} lang={lang} />} />
            <Route path="/origines" element={<Origins index={index} lang={lang} />} />
            <Route path="/origine/:country" element={<Origin ifs={data} index={index} lang={lang} />} />
            <Route path="/country/:country" element={<CountryRedirect />} />
            <Route path="/comprendre" element={<Guide index={index} lang={lang} />} />
            <Route path="/overview" element={<WithFfn lang={lang} render={(ffn) => <WithCross lang={lang} render={(cross) => <Overview data={data} ffn={ffn} cross={cross} lang={lang} />} />} />} />
            <Route path="/cross" element={<WithFfn lang={lang} render={(ffn) => <WithCross lang={lang} render={(cross) => <CrossView ifs={data} ffn={ffn} cross={cross} lang={lang} />} />} />} />
            <Route path="/map" element={<WorldMap data={data} lang={lang} />} />
            <Route path="/fraud" element={<FraudExplorer index={index} lang={lang} />} />
            <Route path="/ffn" element={<WithFfn lang={lang} render={(ffn) => <FfnExplorer data={ffn} index={index} lang={lang} />} />} />
            <Route path="/sources" element={<Sources data={data} lang={lang} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
      <ScrollAssist lang={lang} />
      <BottomNav lang={lang} moreOpen={navOpen} onToggleMore={() => setNavOpen((v) => !v)} />
    </HashRouter>
  );
}
