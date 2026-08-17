import type { SVGProps } from "react";
import { WATANY_V4_ICONS, type WatanyV4IconName } from "./iconRegistry";

export type WatanyV4CompatProps = SVGProps<SVGSVGElement> & { size?: number | string; title?: string; icon?: unknown; primaryFill?: string; filled?: boolean; };

const pathBySemantic: Record<string, string> = {
  menu: "M4 7h16M4 12h16M4 17h16", home: "m3 11 9-7 9 7v9H6v-9M9 20v-6h6v6", user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M5 20c1-4 3-6 7-6s6 2 7 6", chat: "M4 5h16v11H9l-5 4V5M8 9h8M8 12h5", bell: "M6 17h12l-2-3V9a4 4 0 0 0-8 0v5l-2 3M10 20h4", close: "M5 5l14 14M19 5 5 19", back: "m15 5-7 7 7 7", search: "m20 20-4-4M10.5 17a6.5 6.5 0 1 1 0-13 6.5 6.5 0 0 1 0 13", filter: "M4 6h16l-6 7v5l-4 2v-7L4 6", check: "m5 12 4 4L19 6", warning: "M12 3 2 21h20L12 3M12 9v5M12 18h.01", add: "M12 5v14M5 12h14", folder: "M3 6h7l2 2h9v11H3V6", mic: "M12 4a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V7a3 3 0 0 1 3-3M5 11a7 7 0 0 0 14 0M12 18v3", stop: "M6 6h12v12H6z", volume: "M5 10h4l5-4v12l-5-4H5v-4M17 9c1 2 1 4 0 6M19 7c2 3 2 7 0 10", calendar: "M5 4v3M19 4v3M4 8h16v12H4V8M8 12h3M13 12h3M8 16h3M13 16h3", star: "m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3", document: "M6 3h8l4 4v14H6V3M14 3v5h4M9 12h6M9 16h6", people: "M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M15 11a3 3 0 1 0 0-6M2 20c1-4 3-6 7-6s6 2 7 6M17 14c3 1 4 3 5 6", globe: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18", video: "M4 6h11v12H4V6M15 10l5-3v10l-5-3", trophy: "M8 4h8v4c0 4-2 6-4 6s-4-2-4-6V4M8 6H4c0 4 2 6 5 6M16 6h4c0 4-2 6-5 6M12 14v4M8 21h8"
};

export function WatanyV4Glyph({ size = 24, title, className = "", icon: _icon, primaryFill: _primaryFill, filled: _filled, ...rest }: WatanyV4CompatProps & { semantic?: string; asset?: WatanyV4IconName }) {
  const semantic = String((rest as { semantic?: string }).semantic || "star");
  const asset = (rest as { asset?: WatanyV4IconName }).asset;
  const svgRest = { ...rest } as Record<string, unknown>;
  delete svgRest.semantic; delete svgRest.asset;
  return <svg {...(svgRest as SVGProps<SVGSVGElement>)} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={["watany-v4-control-icon", className].filter(Boolean).join(" ")} aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>{title ? <title>{title}</title> : null}{asset ? <image href={WATANY_V4_ICONS[asset]} x="0" y="0" width="24" height="24" preserveAspectRatio="xMidYMid meet" /> : <path d={pathBySemantic[semantic] || pathBySemantic.star} />}</svg>;
}
