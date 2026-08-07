import React from "react";
import "./watany-ui-platform.css";

export type WatanyIconKey =
  | "help"
  | "latest"
  | "popular"
  | "schools"
  | "procedures"
  | "salary"
  | "taxi"
  | "market"
  | "jobs"
  | "health"
  | "laws"
  | "community"
  | "all";

export type WatanyFeatureItem = {
  key: WatanyIconKey;
  label: string;
  href: string;
};

const green = "#0b3d2a";
const light = "#fff8e6";

function BaseSvg({ children }: { children: React.ReactNode }) {
  return (
    <svg className="watany-feature-icon-v1" viewBox="0 0 64 64" role="img" aria-hidden="true">
      <defs>
        <linearGradient id="watanyGoldV1" x1="0" x2="1">
          <stop offset="0" stopColor="#fff1c7" />
          <stop offset="0.5" stopColor="#d6a72a" />
          <stop offset="1" stopColor="#a56b10" />
        </linearGradient>
        <linearGradient id="watanyGreenV1" x1="0" x2="1">
          <stop offset="0" stopColor="#1b6848" />
          <stop offset="1" stopColor="#062719" />
        </linearGradient>
      </defs>
      {children}
    </svg>
  );
}

export function WatanyFeatureIcon({ icon }: { icon: WatanyIconKey }) {
  if (icon === "schools") {
    return (
      <BaseSvg>
        <path d="M10 22 32 11l22 11-22 11Z" fill="url(#watanyGreenV1)" stroke="url(#watanyGoldV1)" strokeWidth="2.2" />
        <path d="M21 31v11c0 4 22 4 22 0V31" fill="url(#watanyGreenV1)" stroke="#0b3d2a" strokeWidth="2" />
        <path d="M44 25v14" stroke="url(#watanyGoldV1)" strokeWidth="3" strokeLinecap="round" />
        <circle cx="44" cy="42" r="4" fill="url(#watanyGoldV1)" />
        <path d="M13 45c10-5 20-5 30 0" stroke="url(#watanyGoldV1)" strokeWidth="4" strokeLinecap="round" />
      </BaseSvg>
    );
  }

  const map: Record<WatanyIconKey, React.ReactNode> = {
    help: <path d="M16 34 28 46 50 18" fill="none" stroke="url(#watanyGreenV1)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />,
    latest: <><rect x="12" y="18" width="40" height="28" rx="8" fill="url(#watanyGreenV1)" stroke="url(#watanyGoldV1)" strokeWidth="2" /><text x="32" y="37" textAnchor="middle" fontSize="15" fontWeight="900" fill={light}>NEW</text></>,
    popular: <path d="M32 9 39 25h17L42 35l5 17-15-10-15 10 5-17L8 25h17Z" fill="url(#watanyGreenV1)" stroke="url(#watanyGoldV1)" strokeWidth="3" />,
    procedures: <><path d="M18 9h22l8 8v38H18Z" fill={light} stroke="url(#watanyGoldV1)" strokeWidth="3" /><path d="M40 9v10h10" fill="none" stroke="url(#watanyGoldV1)" strokeWidth="3" /><path d="M25 29h18M25 38h18M25 47h12" stroke={green} strokeWidth="3" strokeLinecap="round" /></>,
    schools: <><path d="M18 9h22l8 8v38H18Z" fill={light} stroke="url(#watanyGoldV1)" strokeWidth="3" /><path d="M40 9v10h10" fill="none" stroke="url(#watanyGoldV1)" strokeWidth="3" /><path d="M25 29h18M25 38h18M25 47h12" stroke={green} strokeWidth="3" strokeLinecap="round" /></>,
    salary: <><rect x="9" y="20" width="46" height="28" rx="6" fill="url(#watanyGreenV1)" stroke="url(#watanyGoldV1)" strokeWidth="3" /><path d="M15 28h13M38 36h10" stroke="url(#watanyGoldV1)" strokeWidth="4" strokeLinecap="round" /><circle cx="22" cy="39" r="4" fill="url(#watanyGoldV1)" /></>,
    taxi: <><path d="M13 32h38l4 9v9H9v-9Z" fill="#f4c02c" stroke="url(#watanyGoldV1)" strokeWidth="2" /><circle cx="19" cy="51" r="5" fill={green} /><circle cx="45" cy="51" r="5" fill={green} /><path d="M24 24h16l5 8H19Z" fill="#fff1c7" stroke={green} strokeWidth="2" /></>,
    market: <><path d="M16 20h39l-5 23H22Z" fill="none" stroke="url(#watanyGoldV1)" strokeWidth="4" strokeLinejoin="round" /><path d="M10 14h8l4 29" stroke={green} strokeWidth="4" strokeLinecap="round" /><circle cx="25" cy="51" r="4" fill={green} /><circle cx="46" cy="51" r="4" fill={green} /></>,
    jobs: <><rect x="13" y="22" width="38" height="29" rx="5" fill="url(#watanyGreenV1)" stroke="url(#watanyGoldV1)" strokeWidth="3" /><path d="M24 22v-5h16v5" fill="none" stroke="url(#watanyGoldV1)" strokeWidth="3" /><rect x="27" y="34" width="10" height="7" rx="2" fill="url(#watanyGoldV1)" /></>,
    health: <><path d="M32 52S11 39 13 24c1-8 11-11 19-2 8-9 18-6 19 2 2 15-19 28-19 28Z" fill="url(#watanyGreenV1)" stroke="url(#watanyGoldV1)" strokeWidth="3" /><path d="M21 35h7l4-8 5 15 4-7h6" fill="none" stroke="url(#watanyGoldV1)" strokeWidth="3" strokeLinecap="round" /></>,
    laws: <><path d="M16 46h32" stroke="url(#watanyGoldV1)" strokeWidth="4" strokeLinecap="round" /><path d="M32 13v33M18 21h28" stroke={green} strokeWidth="4" strokeLinecap="round" /><path d="M19 21 11 37h16Zm26 0-8 16h16Z" fill={light} stroke="url(#watanyGoldV1)" strokeWidth="2" /></>,
    community: <><circle cx="32" cy="22" r="9" fill="url(#watanyGreenV1)" stroke="url(#watanyGoldV1)" strokeWidth="2" /><circle cx="18" cy="32" r="7" fill="url(#watanyGreenV1)" /><circle cx="46" cy="32" r="7" fill="url(#watanyGreenV1)" /><path d="M11 53c3-12 39-12 42 0Z" fill="url(#watanyGreenV1)" stroke="url(#watanyGoldV1)" strokeWidth="2" /></>,
    all: <><rect x="12" y="12" width="16" height="16" rx="3" fill="url(#watanyGreenV1)" stroke="url(#watanyGoldV1)" strokeWidth="2" /><rect x="36" y="12" width="16" height="16" rx="3" fill="url(#watanyGreenV1)" stroke="url(#watanyGoldV1)" strokeWidth="2" /><rect x="12" y="36" width="16" height="16" rx="3" fill="url(#watanyGreenV1)" stroke="url(#watanyGoldV1)" strokeWidth="2" /><rect x="36" y="36" width="16" height="16" rx="3" fill="url(#watanyGreenV1)" stroke="url(#watanyGoldV1)" strokeWidth="2" /></>
  };

  return <BaseSvg>{map[icon]}</BaseSvg>;
}

export const watanyDefaultFeatureItems: WatanyFeatureItem[] = [
  { key: "salary", label: "المعاش", href: "/salary" },
  { key: "procedures", label: "معاملات", href: "/procedures" },
  { key: "schools", label: "مدارس", href: "/school-grants" },
  { key: "popular", label: "الاكثر طلبا", href: "/popular" },
  { key: "latest", label: "الحدث", href: "/news" },
  { key: "help", label: "ممكن يهمك", href: "/help" },
  { key: "all", label: "كل الخدمات", href: "/services" },
  { key: "community", label: "مجتمعي", href: "/community" },
  { key: "laws", label: "القوانين والانظمة", href: "/laws" },
  { key: "health", label: "الصحة والرعاية", href: "/health" },
  { key: "jobs", label: "وظائف", href: "/jobs" },
  { key: "market", label: "السوق", href: "/marketplace" },
  { key: "taxi", label: "تاكسي", href: "/taxi" }
];

export function WatanyFeatureGridV1({ items = watanyDefaultFeatureItems }: { items?: WatanyFeatureItem[] }) {
  return (
    <div className="watany-feature-grid-v1" data-watany-ui-platform="feature-grid">
      {items.map((item) => (
        <a className="watany-feature-tile-v1" href={item.href} key={item.key}>
          <span className="watany-feature-icon-frame-v1">
            <WatanyFeatureIcon icon={item.key} />
          </span>
          <span className="watany-feature-label-v1">{item.label}</span>
        </a>
      ))}
    </div>
  );
}
