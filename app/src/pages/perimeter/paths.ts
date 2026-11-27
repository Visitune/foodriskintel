import type { PerimeterItem } from "../../perimeter/model";

export function itemPath(item: PerimeterItem): string {
  if (item.type === "family") return `/matiere/${item.ref}`;
  if (item.type === "origin") return `/origine/${encodeURIComponent(item.ref)}`;
  return "/matieres";
}
