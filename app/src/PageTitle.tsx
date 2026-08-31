import { useLocation } from "react-router-dom";
import { t } from "./i18n";
import type { Lang } from "./i18n";

export default function PageTitle({ lang }: { lang: Lang }) {
  const tr = t[lang];
  const { pathname } = useLocation();

  let label: string = tr.nav.overview;
  if (pathname === "/") label = tr.nav.overview;
  else if (pathname.startsWith("/cross")) label = tr.nav.cross;
  else if (pathname.startsWith("/map")) label = tr.nav.worldMap;
  else if (pathname.startsWith("/fraud")) label = tr.nav.ifsFraud;
  else if (pathname.startsWith("/ffn")) label = tr.nav.ffn;
  else if (pathname.startsWith("/sources")) label = tr.nav.sources;
  else if (pathname.startsWith("/country/")) {
    const raw = pathname.replace("/country/", "");
    try { label = decodeURIComponent(raw); } catch { label = raw; }
  }

  return <span className="topbar-title">{label}</span>;
}
