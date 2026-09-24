(() => {
  'use strict';
  const CLIENT = 'ca-pub-6562406855952870';
  const SLOT = '9426086926';
  const RUNTIME = 'feature-v6';
  const ROUTES = new Map([
    ['/for-you','for-you'], ['/latest','latest'], ['/popular','popular'],
    ['/most-requested','most-requested'], ['/tools','tools'], ['/designs','designs'],
    ['/procedures','procedures'], ['/school-grants','school-grants'], ['/jobs','jobs'],
    ['/marketplace','marketplace'], ['/documents','documents'], ['/legal','legal'],
    ['/news','news'], ['/fake-fact','fake-fact'], ['/fake-news','fake-fact'], ['/forms','forms'], ['/vote','vote'],
    ['/faq','faq'], ['/deaths','deaths'], ['/community','community'],
    ['/taxi','taxi'], ['/network','network'], ['/circulars','circulars'], ['/children','children'],
    ['/sports','sports'], ['/ads','ads'], ['/services/official','official-services'],
    ['/world-cup','world-cup'],
  ]);
  const LISTINGS = new Map([
    ['for-you', [['.watany-listing-surface__grid','.watany-listing-card']]],
    ['latest', [['.watany-listing-surface__grid','.watany-listing-card']]],
    ['popular', [['.watany-listing-surface__grid','.watany-listing-card']]],
    ['most-requested', [['.watany-listing-surface__grid','.watany-listing-card']]],
    ['documents', [['.unified-pillar__grid','.unified-pillar__card']]],
    ['legal', [['.legal-library-result-list','.legal-library-result-card']]],
    ['procedures', [['.procedures-browser__items','.procedures-browser__item']]],
    ['jobs', [['.mj-job-listings','.mj-job-card']]],
    ['marketplace', [['.mj-market-rails','.mj-market-rail']]],
    ['news', [['.news-page__list','.news-card']]],
    ['fake-fact', [['.fake-news-page__list','.fake-news-card']]],
    ['forms', [
      ['.forms-match-list','.forms-item-row'],
      ['.forms-source-section__body','.forms-item-row'],
      ['.forms-item-list','.forms-source-section'],
    ]],
    ['vote', [['.survey-grid','.survey-poll-card']]],
    ['faq', [['.procedures-browser__items','.procedures-browser__item']]],
    ['deaths', [['.wafiyat-list','.wafiyat-card']]],
    ['community', [['.community-group-list','.community-group-list__item']]],
    ['circulars', [['.jobs-grid','.jobs-card']]],
    ['ads', [['.official-services-grid','.official-service-card']]],
    ['official-services', [['.official-services-grid','.official-service-card']]],
  ]);
  const NATIVE_LISTINGS = new Set([
    'for-you', 'latest', 'most-requested', 'deaths', 'circulars',
  ]);
  const pathKey = () => location.pathname.replace(/\/+$/, '') || '/';
  const featureForPath = () => ROUTES.get(pathKey()) || '';
  function ensureLoader() {
    const selector = 'script[src^="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]';
    if (document.getElementById('watany-adsense-script') || document.querySelector(selector)) return;
    const script = document.createElement('script');
    script.id = 'watany-adsense-script';
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT}`;
    document.head.appendChild(script);
  }
  function requestAd() {
    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
    } catch (_) {}
  }
  function nativeAd(feature, placement) {
    return document.querySelector(`[data-feature-key="feature.adsense.${feature}.${placement}"]:not([data-watany-ad-runtime])`);
  }
  function runtimeAd(placement) {
    return document.querySelector(`[data-watany-ad-runtime][data-watany-ad-placement="${placement}"]`);
  }
  function removeRuntime(placement) {
    document.querySelectorAll(`[data-watany-ad-runtime][data-watany-ad-placement="${placement}"]`).forEach((node) => node.remove());
  }
  function buildAd(feature, placement, host) {
    const narrow = matchMedia('(max-width: 375px)').matches;
    const mobile = matchMedia('(max-width: 640px)').matches;
    const width = narrow ? 300 : 320;
    const wrap = placement === 'listing' && host?.matches('ul,ol')
      ? document.createElement('li')
      : document.createElement('div');
    wrap.dataset.featureKey = `feature.adsense.${feature}.${placement}`;
    wrap.dataset.watanyAdRuntime = RUNTIME;
    wrap.dataset.watanyAdPlacement = placement;
    wrap.setAttribute('aria-label', 'إعلان');
    wrap.style.cssText = 'width:100%;box-sizing:border-box;grid-column:1/-1;list-style:none;';
    const aside = document.createElement('aside');
    aside.style.cssText = placement === 'bottom'
      ? 'margin:16px auto 24px;padding:0 2px;width:100%;box-sizing:border-box;'
      : 'margin:18px auto;padding:0 2px;width:100%;box-sizing:border-box;clear:both;';
    const label = document.createElement('div');
    label.textContent = 'إعلان';
    label.style.cssText = 'margin:0 4px 6px;color:#88948f;font-size:10px;line-height:1.4;text-align:right;';
    const frame = document.createElement('div');
    frame.style.cssText = mobile
      ? `width:100%;max-width:${width}px;height:100px;margin:0 auto;overflow:hidden;border-radius:14px;`
      : 'width:100%;min-height:100px;margin:0 auto;overflow:hidden;border-radius:14px;';
    const ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.style.cssText = mobile
      ? `display:inline-block;width:${width}px;height:100px;`
      : 'display:block;width:100%;';
    ins.dataset.adClient = CLIENT;
    ins.dataset.adSlot = SLOT;
    if (!mobile) {
      ins.dataset.adFormat = 'auto';
      ins.dataset.fullWidthResponsive = 'true';
    }
    frame.appendChild(ins);
    aside.append(label, frame);
    wrap.appendChild(aside);
    return wrap;
  }
  function isVisible(el) {
    if (!(el instanceof HTMLElement)) return false;
    const style = getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && el.getClientRects().length > 0;
  }
  function visibleChildren(root) {
    return [...root.children].filter((el) => {
      if (!(el instanceof HTMLElement) || !isVisible(el)) return false;
      if (el.matches('script,style,[data-watany-ad-runtime],[data-feature-key^="feature.adsense."]')) return false;
      if (el.matches('.popup-overlay,[role="dialog"]')) return false;
      return true;
    });
  }
  function inlineRoot(main) {
    let root = document.querySelector('[data-watany-feature-template="true"] .watany-feature-template__content')
      || document.querySelector('[data-watany-feature-route]')
      || main.firstElementChild;
    if (!(root instanceof HTMLElement)) return null;
    for (let i = 0; i < 2; i += 1) {
      const children = visibleChildren(root);
      if (children.length !== 1) break;
      const nested = visibleChildren(children[0]);
      if (nested.length < 2) break;
      root = children[0];
    }
    return root;
  }
  function listingTarget(feature) {
    const configs = LISTINGS.get(feature) || [];
    for (const [rootSelector, itemSelector] of configs) {
      for (const root of document.querySelectorAll(rootSelector)) {
        if (!(root instanceof HTMLElement) || !isVisible(root)) continue;
        const items = [...root.querySelectorAll(`:scope > ${itemSelector}`)].filter(isVisible);
        if (items.length) return { root, items };
      }
    }
    return null;
  }
  function activate(ad) {
    ensureLoader();
    requestAd();
    return ad;
  }
  function mountListing(feature) {
    removeRuntime('inline');
    const target = listingTarget(feature);
    const existing = runtimeAd('listing');
    if (!target) { if (existing) existing.remove(); return false; }
    const { root, items } = target;
    const anchor = items[Math.min(2, items.length - 1)];
    if (existing && existing.parentElement !== root) existing.remove();
    const current = runtimeAd('listing');
    if (current) {
      if (anchor.nextElementSibling !== current) anchor.after(current);
      return;
    }
    const ad = buildAd(feature, 'listing', root);
    anchor.after(ad);
    activate(ad);
    return true;
  }
  function mountInline(feature, main) {
    removeRuntime('listing');
    if (feature === 'school-grants') { removeRuntime('inline'); return; }
    const existing = runtimeAd('inline');
    if (nativeAd(feature, 'inline')) { if (existing) existing.remove(); return; }
    if (existing && existing.dataset.featureKey !== `feature.adsense.${feature}.inline`) existing.remove();
    if (runtimeAd('inline')) return;
    const root = inlineRoot(main);
    if (!root) return;
    const kids = visibleChildren(root);
    const ad = buildAd(feature, 'inline', root);
    if (kids.length >= 2) root.insertBefore(ad, kids[Math.max(1, Math.floor(kids.length / 2))]);
    else root.appendChild(ad);
    activate(ad);
  }
  function mountBottom(feature, main) {
    const existing = runtimeAd('bottom');
    if (nativeAd(feature, 'bottom')) { if (existing) existing.remove(); return; }
    if (existing && existing.dataset.featureKey !== `feature.adsense.${feature}.bottom`) existing.remove();
    if (runtimeAd('bottom')) return;
    const ad = buildAd(feature, 'bottom', main);
    main.appendChild(ad);
    activate(ad);
  }
  let timer = 0;
  function mountAll() {
    const feature = featureForPath();
    if (!feature || document.querySelector('[data-watany-page="unavailable"]')) {
      removeRuntime('inline'); removeRuntime('listing'); removeRuntime('bottom');
      return;
    }
    const main = document.querySelector('main[data-watany-route-surface="true"]');
    if (!main || !main.firstElementChild) return;
    if (NATIVE_LISTINGS.has(feature)) {
      removeRuntime('inline');
      removeRuntime('listing');
    } else if (LISTINGS.has(feature)) {
      removeRuntime('inline');
      mountListing(feature);
    } else {
      mountInline(feature, main);
    }
    mountBottom(feature, main);
  }
  function schedule(delay = 80) {
    clearTimeout(timer);
    timer = setTimeout(mountAll, delay);
  }
  for (const name of ['pushState', 'replaceState']) {
    const original = history[name];
    history[name] = function (...args) {
      const result = original.apply(this, args);
      settleMounts();
      return result;
    };
  }
  function settleMounts() {
    for (const delay of [120, 450, 1000, 2200, 4500]) {
      setTimeout(mountAll, delay);
    }
  }
  addEventListener('popstate', settleMounts);
  addEventListener('resize', () => schedule(180));
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', settleMounts, { once: true });
  } else {
    settleMounts();
  }
})();
