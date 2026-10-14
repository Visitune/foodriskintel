import { useLocation } from "react-router-dom";
import { t } from "./i18n";
import type { Lang } from "./i18n";

const decode = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };

export default function PageTitle({ lang, className = "topbar-title" }: { lang: Lang; className?: string }) {
  const nav = t[lang].nav;
  const { pathname } = useLocation();

  const routes: [string, string][] = [
    ["/matieres", nav.materials], ["/matiere/", nav.materials], ["/origines", nav.origins],
    ["/cross", nav.cross], ["/map", nav.worldMap], ["/fraud", nav.ifsFraud], ["/ffn", nav.ffn],
    ["/overview", nav.overview], ["/comprendre", nav.guide], ["/sources", nav.sources],
  ];
  let label: string = nav.home;
  if (pathname.startsWith("/origine/")) label = decode(pathname.replace("/origine/", ""));
  else label = routes.find(([p]) => pathname.startsWith(p))?.[1] ?? nav.home;

  return <span className={className}>{label}</span>;
}
