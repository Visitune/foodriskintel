import { usePerimeter } from "./PerimeterContext";
import { confirmRemoveItem } from "./confirm";
import type { ItemType } from "./model";
import type { Lang } from "../i18n";

/** "Add to my perimeter" toggle, used on the Material / Origin sheets. */
export function AddToPerimeterButton({ type, refId, label, lang }: { type: ItemType; refId: string; label: string; lang: Lang }) {
  const P = usePerimeter();
  const fr = lang === "fr";
  const inPerimeter = P.has(type, refId);
  return (
    <button
      type="button"
      className={inPerimeter ? "btn in-perimeter" : "btn"}
      aria-pressed={inPerimeter}
      title={inPerimeter
        ? fr ? "Présent dans votre périmètre — page Mon périmètre" : "In your perimeter — My perimeter page"
        : fr ? "Suivre cette donnée dans votre veille mensuelle" : "Track this in your monthly watch"}
      onClick={() => {
        if (!inPerimeter) return P.add(type, refId, label);
        const id = P.pkg.perimeter.find((i) => i.type === type && i.ref === refId)!.id;
        if (confirmRemoveItem(P.pkg, id, lang)) P.remove(id);
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        {inPerimeter
          ? <path d="M4 12.5l5 5L20 6.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          : <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />}
      </svg>
      {inPerimeter ? (fr ? "Dans mon périmètre" : "In my perimeter") : (fr ? "Ajouter à mon périmètre" : "Add to my perimeter")}
    </button>
  );
}
