import { useEffect, useRef } from "react";
import { t } from "./i18n";
import type { Lang } from "./i18n";

export default function OnboardingModal({ lang, onClose }: { lang: Lang; onClose: () => void }) {
  const tr = t[lang];
  const panelRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeBtnRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "Tab" && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll<HTMLElement>("button, a[href]");
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="onboarding-title" ref={panelRef}>
        <button type="button" ref={closeBtnRef} className="icon-btn modal-close" aria-label={tr.onboarding.close} onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
        <h2 id="onboarding-title">{tr.onboarding.title}</h2>
        <p>{tr.onboarding.intro}</p>
        <ul className="onboarding-list">
          <li>{tr.onboarding.feature1}</li>
          <li>{tr.onboarding.feature2}</li>
          <li>{tr.onboarding.feature3}</li>
          <li>{tr.onboarding.feature4}</li>
          <li>{tr.onboarding.feature5}</li>
        </ul>
        <p className="onboarding-disclaimer">{tr.onboarding.disclaimer}</p>
        <button type="button" className="btn-mini" onClick={onClose}>{tr.onboarding.dismiss}</button>
      </div>
    </>
  );
}
