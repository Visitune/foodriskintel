import type { Lang } from "../../i18n";
import { usePerimeter } from "../../perimeter/PerimeterContext";

export default function OwnerFields({ lang }: { lang: Lang }) {
  const fr = lang === "fr";
  const P = usePerimeter();
  const labels = { company: fr ? "Entreprise" : "Company", site: "Site", author: fr ? "Auteur" : "Author" };
  return (
    <div className="owner-grid">
      {(["company", "site", "author"] as const).map((k) => (
        <label key={k}>{labels[k]}<input type="text" maxLength={500} value={P.pkg.owner[k]} onChange={(e) => P.setOwner(k, e.target.value)} /></label>
      ))}
    </div>
  );
}
