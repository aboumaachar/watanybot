import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/watanyApprovedHome.css";

type Tile = {
  id: string;
  img: string;
  label: string;
  href: string;
};

const TILES: Tile[] = [
  { id: "salary", img: "/watany-assets/after-reference-icons/salary.png", label: "المعاش", href: "/salary" },
  { id: "procedures", img: "/watany-assets/after-reference-icons/procedures.png", label: "المعاملات", href: "/procedures" },
  { id: "schools", img: "/watany-assets/after-reference-icons/schools.png", label: "مدارس", href: "/school-grants" },
  { id: "jobs", img: "/watany-assets/after-reference-icons/jobs.png", label: "وظائف", href: "/jobs" },
  { id: "market", img: "/watany-assets/after-reference-icons/market.png", label: "السوق", href: "/marketplace" },
  { id: "taxi", img: "/watany-assets/after-reference-icons/taxi.png", label: "تاكسي", href: "/taxi" },
  { id: "community", img: "/watany-assets/after-reference-icons/community.png", label: "مجتمعي", href: "/community" },
  { id: "laws", img: "/watany-assets/after-reference-icons/laws.png", label: "قوانين", href: "/legal" },
  { id: "popular", img: "/watany-assets/after-reference-icons/popular.png", label: "الاكثر طلبا", href: "/most-requested" },
  { id: "latest", img: "/watany-assets/after-reference-icons/latest.png", label: "الاحدث", href: "/latest" },
  { id: "important", img: "/watany-assets/after-reference-icons/important.png", label: "التعاميم", href: "/recruitment" },
  { id: "all", img: "/watany-assets/after-reference-icons/all.png", label: "الخدمات", href: "/services" },
];

export default function WatanyApprovedHome() {
  const navigate = useNavigate();

  useEffect(() => {
    try {
      // Signal to the rest of the app that a landing surface is mounted.
      globalThis.dispatchEvent?.(new CustomEvent("watany-landing-mounted"));
    } catch {
      // ignore
    }
  }, []);

  function go(path: string) {
    navigate(path);
  }

  return (
    <section className="watany-approved-home" aria-label="خدمات موطني">
      <div data-testid="wr-grid" className="watany-approved-grid">
        {TILES.map((tile) => (
          <button
            key={tile.id}
            type="button"
            className="watany-approved-tile after-reference-icons"
            onClick={() => go(tile.href)}
            aria-label={tile.label}
            data-route={tile.href}
          >
            <img
              className="wr-icon-unit after-reference-icons"
              src={tile.img}
              alt={tile.label}
              draggable={false}
            />
            <span className="sr-only">{tile.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
