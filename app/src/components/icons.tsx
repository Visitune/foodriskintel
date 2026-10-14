/** Line icons (24 px grid, stroke = currentColor). No icon library: a few paths each. */
type P = { size?: number };
const svg = (size: number, children: React.ReactNode) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);

const FAMILY_PATHS: Record<string, React.ReactNode> = {
  // ham / drumstick
  meat: <><path d="M14.5 4.5a5.5 5.5 0 0 1 3.9 9.4l-3.5 3.5a5.5 5.5 0 0 1-7.8-7.8l3.5-3.5a5.5 5.5 0 0 1 3.9-1.6z" /><path d="M7.1 17.1 4 20.2" /><circle cx="3.5" cy="20.5" r="1.2" /></>,
  fish: <><path d="M3 12c3-4.5 9-6 14-2.5L21 7v10l-4-2.5C12 18 6 16.5 3 12z" /><circle cx="8" cy="11" r="0.8" fill="currentColor" /></>,
  dairy: <><path d="M8 3h8v3l2 3v12H6V9l2-3z" /><path d="M6 13h12" /></>,
  eggs: <><path d="M12 3c3.5 0 6 6 6 10a6 6 0 0 1-12 0c0-4 2.5-10 6-10z" /></>,
  oils: <><path d="M10 3h4v3l2 3v12H8V9l2-3z" /><path d="M12 12c1.2 1.6 1.8 2.6 1.8 3.4a1.8 1.8 0 0 1-3.6 0c0-.8.6-1.8 1.8-3.4z" /></>,
  alcohol: <><path d="M7 3h10l-1 7a4 4 0 0 1-8 0z" /><path d="M12 14v6M8.5 21h7M7.5 7h9" /></>,
  beverages: <><path d="M6 6h12l-1.5 15h-9z" /><path d="M10 6 9 2M6.5 11h11" /></>,
  honey: <><path d="M12 3l7 4v8l-7 4-7-4V7z" /><path d="M12 9v4M9.5 11.5 12 13l2.5-1.5" /></>,
  cocoa_coffee_tea: <><path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" /><path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17M8 3c0 1.5 1 1.5 1 3M12 3c0 1.5 1 1.5 1 3" /></>,
  confectionery: <><path d="M8.5 8.5l7 7" /><circle cx="12" cy="12" r="4.5" /><path d="M5.5 5.5 3 4l1 2.5L3 9l2.5-1M18.5 18.5 21 20l-1-2.5 1-2.5-2.5 1" /></>,
  cereals: <><path d="M12 21V8" /><path d="M12 8c-2-1-3-3-3-5 2 0 3 1.5 3 3M12 8c2-1 3-3 3-5-2 0-3 1.5-3 3M12 13c-2.5-.5-4-2.5-4-4.5 2.2 0 4 1.5 4 4.5zM12 13c2.5-.5 4-2.5 4-4.5-2.2 0-4 1.5-4 4.5zM12 18c-2.5-.5-4-2.5-4-4.5 2.2 0 4 1.5 4 4.5zM12 18c2.5-.5 4-2.5 4-4.5-2.2 0-4 1.5-4 4.5z" /></>,
  fruits_veg: <><path d="M12 7c-4-2-8 1-7 6s4 8 7 7c3 1 6-2 7-7s-3-8-7-6z" /><path d="M12 7c0-2 1-4 3-4" /></>,
  nuts_seeds: <><path d="M12 4c4 0 7 3.5 7 8s-3 8-7 8-7-3.5-7-8 3-8 7-8z" /><path d="M12 4v16M8 9c2 1 6 1 8 0" /></>,
  spices: <><path d="M9 3h6v3H9z" /><path d="M8 6h8l1 3v12H7V9z" /><circle cx="10.5" cy="14" r=".7" fill="currentColor" /><circle cx="13.5" cy="16.5" r=".7" fill="currentColor" /><circle cx="12" cy="12" r=".7" fill="currentColor" /></>,
  supplements: <><rect x="3.5" y="8.5" width="17" height="7" rx="3.5" transform="rotate(-45 12 12)" /><path d="M9.5 9.5l5 5" /></>,
  additives: <><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3" /><path d="M7.5 15h9" /></>,
  sauces_prepared: <><path d="M3 11h18a9 9 0 0 1-18 0z" /><path d="M8 7c0-1.5 1-1.5 1-3M12 7c0-1.5 1-1.5 1-3M16 7c0-1.5 1-1.5 1-3" /></>,
  feed: <><path d="M4 14h16l-1.5 6h-13z" /><path d="M7 14c0-3 2-5 5-5s5 2 5 5M12 9V6" /></>,
  fcm: <><path d="M4 8l8-4 8 4v8l-8 4-8-4z" /><path d="M4 8l8 4 8-4M12 12v8" /></>,
  live_animals: <><path d="M5 10c0-2 1.5-4 4-4h6c2.5 0 4 2 4 4v3c0 3-3 6-7 6s-7-3-7-6z" /><path d="M5 9 3 6M19 9l2-3" /><circle cx="9.5" cy="12" r=".8" fill="currentColor" /><circle cx="14.5" cy="12" r=".8" fill="currentColor" /></>,
  other: <><circle cx="6" cy="12" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="18" cy="12" r="1.3" /></>,
};

/** Soft colour per family (pastille background / icon colour), from the VisiPilot palette family. */
export const FAMILY_HUE: Record<string, string> = {
  meat: "#c2410c", fish: "#0e7490", dairy: "#4f7cc4", eggs: "#b7791f", oils: "#6b8e23", alcohol: "#8e2b8c",
  beverages: "#1f9e98", honey: "#c88a00", cocoa_coffee_tea: "#7c4a2d", confectionery: "#c03d8f", cereals: "#a16207",
  fruits_veg: "#2f8f3a", nuts_seeds: "#8a5a2b", spices: "#b42318", supplements: "#5b4fc4", additives: "#4b5f80",
  sauces_prepared: "#b45309", feed: "#5c7a3a", fcm: "#55607a", live_animals: "#7a5c3a", other: "#6b7280",
};

export function FamilyIcon({ id, size = 20, badge = true }: { id: string; size?: number; badge?: boolean }) {
  const hue = FAMILY_HUE[id] ?? FAMILY_HUE.other;
  const icon = svg(size, FAMILY_PATHS[id] ?? FAMILY_PATHS.other);
  if (!badge) return <span className="fam-icon bare" style={{ color: hue }}>{icon}</span>;
  return <span className="fam-icon" style={{ color: hue, background: `color-mix(in srgb, ${hue} 14%, transparent)` }}>{icon}</span>;
}

/** Source icons: EU network (stars), press (newspaper), recalls (box with return arrow). */
export function SourceIcon({ src, size = 14 }: { src: "ffn" | "jrc" | "ifs" } & P) {
  if (src === "ffn") {
    return svg(size, <><circle cx="12" cy="12" r="9" /><path d="M12 6.5l.9 1.8 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3z" fill="currentColor" stroke="none" /><path d="M8 16.5h8" /></>);
  }
  if (src === "jrc") {
    return svg(size, <><path d="M4 5h13v14H6a2 2 0 0 1-2-2z" /><path d="M17 9h3v8a2 2 0 0 1-2 2M7 9h7M7 12h7M7 15h4" /></>);
  }
  return svg(size, <><path d="M3 8l9-4 9 4v8l-9 4-9-4z" /><path d="M15 11h-5l1.5-1.5M10 11l1.5 1.5" /></>);
}

export const IconCalendar = ({ size = 16 }: P) => svg(size, <><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>);
export const IconTrend = ({ size = 16 }: P) => svg(size, <><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></>);
export const IconGlobe = ({ size = 16 }: P) => svg(size, <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 2.5 15.5 0 18M12 3c-2.5 2.5-2.5 15.5 0 18" /></>);
export const IconAlert = ({ size = 16 }: P) => svg(size, <><path d="M12 3l9.5 17h-19z" /><path d="M12 10v4M12 17.5v.01" /></>);
export const IconShield = ({ size = 16 }: P) => svg(size, <><path d="M12 3l8 3v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V6z" /><path d="M8.5 12l2.5 2.5 4.5-5" /></>);
