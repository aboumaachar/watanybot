import React from "react";
import { WatanyFeatureIconTile, type WatanyFeatureTile } from "./WatanyUiPlatform";

const LOGO_SRC = '/logo.png';

const tiles: WatanyFeatureTile[] = [
  { id: "benefits", title: "ممكن يهمك", icon: "benefits", href: "/useful-links" },
  { id: "latest", title: "الأحدث", icon: "latest", href: "/news" },
  { id: "popular", title: "الأكثر طلبا", icon: "popular", href: "/services" },
  { id: "school", title: "مدارس", icon: "school", href: "/school-grants" },
  { id: "documents", title: "معاملات", icon: "documents", href: "/procedures" },
  { id: "salary", title: "المعاش", icon: "salary", href: "/salary" },
  { id: "taxi", title: "تاكسي", icon: "taxi", href: "/taxi" },
  { id: "market", title: "السوق", icon: "market", href: "/marketplace" },
  { id: "jobs", title: "وظائف", icon: "jobs", href: "/jobs" },
  { id: "health", title: "الصحة والرعاية", icon: "health", href: "/health" },
  { id: "community", title: "مجتمعي", icon: "community", href: "/community" },
  { id: "services", title: "كل الخدمات", icon: "services", href: "/services" },
];

export default function WatanyUiPlatformPreview() {
  return (
    <main className="watany-phone-shell" dir="rtl">
      <header className="watany-platform-topbar">
        <img className="watany-platform-logo" src={LOGO_SRC} alt="موطني" />
        <div className="watany-platform-ticker">
          <div className="watany-platform-ticker-track">
            <span>خدمة جديدة</span>
            <span>استعلام عن المعاملات</span>
            <span>تحديث جديد: دليل المعاشات العسكرية 2024</span>
          </div>
        </div>
        <button className="watany-platform-sign-button" type="button" aria-label="القائمة">☰</button>
      </header>

      <section className="watany-platform-section">
        <h1 className="watany-platform-heading">أيقونات القائمة الرئيسية</h1>
        <div className="watany-platform-grid">
          {tiles.map((tile) => <WatanyFeatureIconTile key={tile.id} tile={tile} />)}
        </div>
      </section>

      <nav className="watany-platform-bottom-bar" aria-label="التنقل السفلي">
        <button className="watany-platform-bottom-item" type="button">⌂<span>الرئيسية</span></button>
        <button className="watany-platform-bottom-item" type="button">🔔<span>الإشعارات</span></button>
        <button className="watany-platform-bottom-item" type="button">☆<span>المفضلة</span></button>
        <button className="watany-platform-bottom-item" type="button">●<span>حسابي</span></button>
        <button className="watany-platform-bottom-item" type="button">☷<span>المزيد</span></button>
      </nav>
    </main>
  );
}
