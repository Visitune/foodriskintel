import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { t } from "./i18n";
import type { Lang } from "./i18n";

export default function ScrollAssist({ lang }: { lang: Lang }) {
  const tr = t[lang];
  const location = useLocation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);

    const check = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      setVisible(scrollable > 120 && window.scrollY < 24);
    };
    check();
    const settle = window.setTimeout(check, 300);

    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      window.clearTimeout(settle);
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, [location.pathname]);

  if (!visible) return null;

  const scrollMore = () => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollBy({ top: window.innerHeight * 0.7, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <button type="button" className="scroll-hint" onClick={scrollMore}>
      <span>{tr.common.scrollHint}</span>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M3 6l5 5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
