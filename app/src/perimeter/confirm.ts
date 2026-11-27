import type { Lang } from "../i18n";
import type { PerimeterPackage } from "./model";

/** Asked before an item is removed together with its follow-up. */
export function confirmRemoveItem(pkg: PerimeterPackage, id: string, lang: Lang): boolean {
  const n = pkg.follow_up.filter((f) => f.item_id === id).length;
  return !n || window.confirm(lang === "fr"
    ? `Retirer cet élément supprime aussi ${n} cas du registre. Continuer ?`
    : `Removing this item also deletes ${n} case(s) from the register. Continue?`);
}
