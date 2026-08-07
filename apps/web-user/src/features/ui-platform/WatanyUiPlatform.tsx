import React from "react";

export type WatanyFeatureIconName =
  | "benefits"
  | "latest"
  | "popular"
  | "school"
  | "documents"
  | "salary"
  | "taxi"
  | "market"
  | "jobs"
  | "health"
  | "community"
  | "services"
  | "forms"
  | "laws"
  | "questions"
  | "settings"
  | "alerts"
  | "news";

export type WatanyFeatureTile = {
  id: string;
  title: string;
  href?: string;
  icon: WatanyFeatureIconName;
};

const common = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function WatanyFeatureIcon({ name }: { name: WatanyFeatureIconName }) {
  const gold = "#d6a72a";
  const green = "#0b3f2f";

  if (name === "school") {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M8 24 32 12l24 12-24 12L8 24Z" fill={green} stroke={gold} strokeWidth="2.8" />
        <path d="M18 32v10c8 6 20 6 28 0V32" fill={green} stroke={gold} strokeWidth="2.4" />
        <path d="M50 27v15" stroke={gold} strokeWidth="3" strokeLinecap="round" />
        <circle cx="50" cy="45" r="3.6" fill={gold} />
        <path d="M18 48h28" stroke={gold} strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    );
  }

  if (name === "salary") {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <rect x="10" y="18" width="44" height="30" rx="6" fill={green} stroke={gold} strokeWidth="2.8" />
        <path d="M17 28h14M17 38h8" stroke={gold} strokeWidth="3" strokeLinecap="round" />
        <circle cx="45" cy="33" r="5" fill={gold} />
      </svg>
    );
  }

  if (name === "market") {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M15 20h38l-5 25H21L15 20Z" fill={green} stroke={gold} strokeWidth="2.8" />
        <path d="M15 20l-3-8H7" stroke={gold} strokeWidth="3" strokeLinecap="round" />
        <circle cx="25" cy="51" r="4" fill={gold} />
        <circle cx="45" cy="51" r="4" fill={gold} />
      </svg>
    );
  }

  if (name === "jobs") {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <rect x="11" y="22" width="42" height="28" rx="6" fill={green} stroke={gold} strokeWidth="2.8" />
        <path d="M24 22v-6h16v6M11 33h42" stroke={gold} strokeWidth="2.8" />
        <rect x="28" y="30" width="8" height="7" rx="2" fill={gold} />
      </svg>
    );
  }

  if (name === "health") {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M32 52S12 41 12 25c0-8 6-13 13-13 4 0 7 2 7 5 0-3 3-5 7-5 7 0 13 5 13 13 0 16-20 27-20 27Z" fill={green} stroke={gold} strokeWidth="2.8" />
        <path d="M20 33h8l4-8 5 14 3-6h5" stroke={gold} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (name === "documents" || name === "forms" || name === "news") {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M18 10h22l8 8v36H18V10Z" fill="#fff8e6" stroke={gold} strokeWidth="2.8" />
        <path d="M40 10v10h10" stroke={green} strokeWidth="2.5" />
        <path d="M24 30h20M24 38h18M24 46h12" stroke={green} strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }

  if (name === "community") {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="22" r="8" fill={green} stroke={gold} strokeWidth="2.6" />
        <circle cx="18" cy="30" r="6" fill={green} stroke={gold} strokeWidth="2.2" />
        <circle cx="46" cy="30" r="6" fill={green} stroke={gold} strokeWidth="2.2" />
        <path d="M16 50c2-10 30-10 32 0" fill={green} stroke={gold} strokeWidth="2.8" />
      </svg>
    );
  }

  if (name === "latest") {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <rect x="12" y="18" width="40" height="28" rx="7" fill={green} stroke={gold} strokeWidth="2.8" />
        <text x="32" y="38" textAnchor="middle" fontSize="14" fontWeight="900" fill={gold}>NEW</text>
      </svg>
    );
  }

  if (name === "popular") {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M32 9l7 15 16 2-12 11 3 16-14-8-14 8 3-16L9 26l16-2 7-15Z" fill={green} stroke={gold} strokeWidth="2.8" />
      </svg>
    );
  }

  if (name === "questions") {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M25 24c1-8 16-8 17 0 1 9-10 9-10 17" {...common} stroke={green} />
        <circle cx="32" cy="51" r="3" fill={gold} />
      </svg>
    );
  }

  if (name === "taxi") {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M12 36l5-13h30l5 13v10H12V36Z" fill="#f2c23a" stroke={green} strokeWidth="2.6" />
        <circle cx="22" cy="48" r="4" fill={green} />
        <circle cx="44" cy="48" r="4" fill={green} />
        <path d="M25 18h14" stroke={gold} strokeWidth="4" strokeLinecap="round" />
      </svg>
    );
  }

  if (name === "laws") {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M32 12v38M18 22h28M18 22l-8 16h16l-8-16ZM46 22l-8 16h16l-8-16Z" {...common} stroke={gold} />
        <path d="M24 52h16" stroke={green} strokeWidth="4" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <rect x="14" y="14" width="36" height="36" rx="9" fill={green} stroke={gold} strokeWidth="2.8" />
      <path d="M23 33l6 6 13-15" stroke={gold} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function WatanyFeatureIconTile({ tile }: { tile: WatanyFeatureTile }) {
  const content = (
    <>
      <span className="watany-feature-icon-frame">
        <WatanyFeatureIcon name={tile.icon} />
      </span>
      <span className="watany-feature-title">{tile.title}</span>
    </>
  );

  if (tile.href) {
    return (
      <a className="watany-feature-tile" href={tile.href}>
        {content}
      </a>
    );
  }

  return <div className="watany-feature-tile">{content}</div>;
}
