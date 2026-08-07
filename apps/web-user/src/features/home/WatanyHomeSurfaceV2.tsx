import React from 'react';
import watanyFeatureCards from './watanyFeatureCards';

const LOGO_SRC = '/logo.png';

export default function WatanyHomeSurfaceV2() {
  return (
    <div className="watany-home-v2 watany-home-v2--desktop" dir="rtl">
      <div className="watany-home-v2__wrap">
        <header className="watany-top-header watany-top-header--v2">
          <div className="watany-top-header__logo">
            <a href="/" aria-label="شعار موطني" className="watany-top-header__logo-link">
              <img src={LOGO_SRC} className="watany-top-header__logo-img" alt="موطني" />
            </a>
          </div>
          <div className="watany-top-header__ticker">تحديث جديد • استعلام عن المعاملات • خدمة جديدة • تحديث الإجراءات</div>
          <div className="watany-top-header__burger">
            <button aria-label="القائمة" className="watany-top-header__burger-btn">≡</button>
          </div>
        </header>

        <main className="watany-home-v2__main">
          <section className="watany-home-v2__cards" role="list">
            {watanyFeatureCards.map((c) => (
              <a key={c.id} role="listitem" className="watany-home-v2__card" href={c.route} aria-label={c.titleAr}>
                <div className="watany-home-v2__card-tile">
                  <div className="watany-home-v2__card-icon">{(c as any).icon ?? '◎'}</div>
                </div>
                <div className="watany-home-v2__card-label">{c.titleAr}</div>
              </a>
            ))}
          </section>
        </main>

        <nav className="watany-bottom-bar watany-bottom-bar--v2" aria-hidden>
          <a className="watany-bottom-bar__item" href="/">الصفحة</a>
          <a className="watany-bottom-bar__item" href="/market">السوق</a>
          <a className="watany-bottom-bar__item" href="/chat">اسأل موطني</a>
        </nav>
      </div>
    </div>
  );
}
