import React from "react";
import { WatanyFeatureGridV1 } from "./WatanyUiPlatformV1";
import "../../styles/watany-ui-platform.css";

const LOGO_SRC = '/logo.png';

export default function WatanyUiPlatformPreviewV1() {
  return (
    <main className="watany-ui-platform" dir="rtl">
      <header className="watany-topbar-v1">
        <img className="watany-topbar-v1__logo" src={LOGO_SRC} alt="Watany" />
        <div className="watany-topbar-v1__ticker" aria-label="Watany updates">
          <div className="watany-topbar-v1__ticker-track">
            <span>خدمة جديدة</span>
            <span>استعلام عن المعاملات</span>
            <span>تحديث جديد: تم إضافة دليل المعاشات العسكرية 2024</span>
          </div>
        </div>
        <button className="watany-topbar-v1__burger" type="button" aria-label="القائمة">☰</button>
      </header>
      <h1 className="watany-section-title">بطاقات الميزات في موطني</h1>
      <WatanyFeatureGridV1 />
      <nav className="watany-bottom-v1" aria-label="التنقل السفلي">
        <a className="watany-bottom-v1__item" href="/"><span className="watany-bottom-v1__sign">⌂</span><span>الرئيسية</span></a>
        <a className="watany-bottom-v1__item" href="/notifications"><span className="watany-bottom-v1__sign">♢</span><span>الإشعارات</span></a>
        <a className="watany-bottom-v1__item" href="/favorites"><span className="watany-bottom-v1__sign">☆</span><span>المفضلة</span></a>
        <a className="watany-bottom-v1__item" href="/profile"><span className="watany-bottom-v1__sign">○</span><span>حسابي</span></a>
        <a className="watany-bottom-v1__item" href="/more"><span className="watany-bottom-v1__sign">☷</span><span>المزيد</span></a>
      </nav>
    </main>
  );
}
