import { NavLink, useLocation } from "react-router-dom";
import { t } from "./i18n";
import type { Lang } from "./i18n";

export default function BottomNav({
  lang,
  moreOpen,
  onToggleMore,
}: {
  lang: Lang;
  moreOpen: boolean;
  onToggleMore: () => void;
}) {
  const tr = t[lang];
  const { pathname } = useLocation();

  const items = [
    {
      to: "/",
      end: true,
      label: tr.nav.home,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="3" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
          <rect x="13" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
          <rect x="3" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
          <rect x="13" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      ),
    },
    {
      to: "/matieres",
      end: false,
      label: lang === "fr" ? "Matières" : "Materials",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="9" cy="12" r="6.5" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="15" cy="12" r="6.5" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      ),
    },
    {
      to: "/origines",
      end: false,
      label: lang === "fr" ? "Origines" : "Origins",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
          <path d="M3 12h18M12 3c2.5 2.5 2.5 15.5 0 18M12 3c-2.5 2.5-2.5 15.5 0 18" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      ),
    },
    {
      to: "/comprendre",
      end: false,
      label: lang === "fr" ? "Comprendre" : "Guide",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="10" cy="10" r="6" stroke="currentColor" strokeWidth="1.6" />
          <path d="M14.5 14.5L20 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      ),
    },
  ];

  const knownPrefixes = ["/", "/matiere", "/origine", "/comprendre"];
  const onKnownTab = knownPrefixes.some((p) => (p === "/" ? pathname === "/" : pathname.startsWith(p)));
  const moreIsActive = moreOpen || !onKnownTab;

  return (
    <nav className="bottom-nav" aria-label={lang === "fr" ? "Navigation principale" : "Main navigation"}>
      {items.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? "active" : "")}>
          {item.icon}
          <span>{item.label}</span>
        </NavLink>
      ))}
      <button
        type="button"
        className={moreIsActive ? "active" : ""}
        aria-expanded={moreOpen}
        aria-controls="sidebar"
        aria-label={moreOpen ? tr.nav.menuClose : tr.nav.menuOpen}
        onClick={onToggleMore}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="5" cy="12" r="1.6" fill="currentColor" />
          <circle cx="12" cy="12" r="1.6" fill="currentColor" />
          <circle cx="19" cy="12" r="1.6" fill="currentColor" />
        </svg>
        <span>{tr.nav.more}</span>
      </button>
    </nav>
  );
}
