(() => {
  'use strict';
  const CLIENT = 'ca-pub-6562406855952870';
  const SLOT = '5372868255';
  const RUNTIME = 'feature-v11-display-bottom-fail-open-5372868255';
  const ROUTES = new Map([
    ['/procedures','procedures'], ['/school-grants','school-grants'], ['/jobs','jobs'],
    ['/jobs/ainelhafeh','jobs']
  ]);
  const SCRIPT_ID = 'watany-adsense-script';
  const ADS_SRC = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + CLIENT;
  const isSalary = () => /(^|\/)salary(\/|$)/.test(location.pathname);
  const routeFeature = () => {
    if (isSalary()) return null;
    const path = location.pathname.replace(/\/$/, '') || '/';
    return ROUTES.get(path) || null;
  };
  const ensureScript = () => {
    if (document.getElementById(SCRIPT_ID) || document.querySelector('script[src^="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]')) return;
    const s = document.createElement('script');
    s.id = SCRIPT_ID; s.async = true; s.crossOrigin = 'anonymous'; s.src = ADS_SRC;
    document.head.appendChild(s);
  };
  const removeRuntimeAds = () => {
    document.querySelectorAll('[data-watany-ad-runtime]').forEach((el) => el.remove());
  };
  const target = () => document.querySelector('.watany-mobile-shell, main, #root') || document.body;
  const mountBottom = () => {
    const feature = routeFeature();
    if (!feature) { removeRuntimeAds(); return; }
    document.querySelectorAll('[data-watany-ad-runtime][data-watany-ad-placement!="bottom"]').forEach((el) => el.remove());
    const existing = document.querySelector('[data-watany-ad-runtime][data-watany-ad-placement="bottom"]');
    if (existing) return;
    const host = target(); if (!host) return;
    const aside = document.createElement('aside');
    aside.setAttribute('dir','rtl');
    aside.dataset.watanyAdRuntime = RUNTIME;
    aside.dataset.watanyAdPlacement = 'bottom';
    aside.dataset.adSlot = SLOT;
    aside.dataset.feature = feature;
    aside.style.cssText = 'margin:14px 10px calc(var(--wmo-dock-height,78px) + 20px);padding:0 2px;min-height:100px;overflow:hidden;border-radius:14px;';
    aside.innerHTML = '<div style="margin:0 4px 6px;color:#88948f;font-size:10px;line-height:1.4">إعلان</div><ins class="adsbygoogle" style="display:block;width:100%" data-ad-client="' + CLIENT + '" data-ad-slot="' + SLOT + '" data-ad-format="auto" data-full-width-responsive="true"></ins>';
    host.appendChild(aside);
    window.setTimeout(() => {
      try { ensureScript(); (window.adsbygoogle = window.adsbygoogle || []).push({}); }
      catch (e) { aside.dataset.adsensePushError = 'true'; }
    }, 900);
  };
  const run = () => { try { if (isSalary()) { removeRuntimeAds(); return; } mountBottom(); } catch (_) {} };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(run, 600), { once: true });
  else setTimeout(run, 600);
  window.addEventListener('pageshow', () => setTimeout(run, 600), { passive: true });
  window.addEventListener('popstate', () => setTimeout(run, 600), { passive: true });
})();
