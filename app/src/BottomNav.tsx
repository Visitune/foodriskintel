import { NavLink } from "react-router-dom";
import { t } from "./i18n";
import type { Lang } from "./i18n";

export default function BottomNav({ lang }: { lang: Lang }) {
  const tr = t[lang];

  const items = [
    {
      to: "/",
      end: true,
      label: tr.nav.overview,
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
      to: "/cross",
      end: false,
      label: tr.nav.cross,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="9" cy="12" r="6.5" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="15" cy="12" r="6.5" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      ),
    },
    {
      to: "/map",
      end: false,
      label: tr.nav.worldMap,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
          <path d="M3 12h18M12 3c2.5 2.5 2.5 15.5 0 18M12 3c-2.5 2.5-2.5 15.5 0 18" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      ),
    },
    {
      to: "/ffn",
      end: false,
      label: tr.nav.ffn,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="10" cy="10" r="6" stroke="currentColor" strokeWidth="1.6" />
          <path d="M14.5 14.5L20 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      to: "/sources",
      end: false,
      label: tr.nav.sources,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.6" />
          <path d="M15 3v4h4" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      ),
    },
  ];

  return (
    <nav className="bottom-nav" aria-label={lang === "fr" ? "Navigation principale" : "Main navigation"}>
      {items.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? "active" : "")}>
          {item.icon}
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
