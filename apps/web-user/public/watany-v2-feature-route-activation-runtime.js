
(function () {
  var CATALOG_URL = '/watany-feature-catalog.json';
  var CATALOG_PAGE = '/watany-all-features.html';
  function isLegacyLauncherActive() {
    return !!document.querySelector('.watany-drawer-page .watany-icon-grid, .watany-drawer-phone .watany-app-icon');
  }
  function isHomePath() {
    var path = window.location.pathname || '/';
    return path === '/' || path === '/mobile-os' || path === '/mcp/' || path === '/mcp';
  }
  function shouldInjectSupplementalChrome() {
    if (isLegacyLauncherActive()) return false;
    if (!isHomePath()) return false;
    return document.documentElement.hasAttribute('data-watany-route-activation-opt-in');
  }
  function cleanupInjectedHomeGrid() {
    Array.prototype.slice.call(document.querySelectorAll('[data-watany-route-activation-panel="true"]')).forEach(function (node) {
      try {
        var parent = node && node.parentNode;
        if (parent && parent.contains(node)) parent.removeChild(node);
      } catch (e) {
        // ignore removal failures during HMR or rapid DOM mutations
      }
    });
    Array.prototype.slice.call(document.querySelectorAll('[data-watany-all-features-link="true"]')).forEach(function (node) {
      try {
        var parent = node.parentNode;
        if (!parent) return;
        if (parent.childNodes.length === 1 && parent.parentNode) {
          if (parent.parentNode.contains(parent)) parent.parentNode.removeChild(parent);
          return;
        }
        if (parent.contains(node)) parent.removeChild(node);
      } catch (e) {
        // ignore
      }
    });
  }
  function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }
  function safeText(value, fallback) {
    var text = String(value || '').trim();
    return text || fallback || '';
  }
  function normalizeFeatures(payload) {
    var list = [];
    if (payload && Array.isArray(payload.features)) list = payload.features;
    else if (Array.isArray(payload)) list = payload;
    return list.map(function (item, index) {
      var label = safeText(item.labelAr, safeText(item.labelEn, 'Feature ' + (index + 1)));
      var route = safeText(item.route, CATALOG_PAGE);
      return {
        key: safeText(item.key, 'feature-' + index),
        labelAr: safeText(item.labelAr, label),
        labelEn: safeText(item.labelEn, label),
        categoryAr: safeText(item.categoryAr, 'Watany'),
        route: route,
        icon: safeText(item.icon, label.charAt(0).toUpperCase()),
        status: safeText(item.status, 'catalog')
      };
    });
  }
  function injectStyles() {
    if (document.getElementById('watany-route-activation-style')) return;
    var css = '' +
      '.watany-route-activation-panel{direction:rtl;margin:14px auto;padding:14px;max-width:1120px;border:1px solid rgba(15,23,42,.10);border-radius:22px;background:rgba(255,255,255,.92);box-shadow:0 18px 42px rgba(15,23,42,.12);font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif}' +
      '.watany-route-activation-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}' +
      '.watany-route-activation-title{font-weight:900;font-size:18px;color:#102030}' +
      '.watany-route-activation-all{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;border-radius:999px;padding:10px 14px;background:#102030;color:#fff;font-weight:800}' +
      '.watany-route-activation-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}' +
      '.watany-route-activation-card{min-height:82px;text-decoration:none;color:#102030;border-radius:18px;background:linear-gradient(180deg,#fff,#f4f7fb);border:1px solid rgba(15,23,42,.09);box-shadow:0 10px 22px rgba(15,23,42,.10);display:flex;align-items:center;gap:10px;padding:10px}' +
      '.watany-route-activation-icon{width:42px;height:42px;border-radius:14px;display:inline-flex;align-items:center;justify-content:center;background:#eef4ff;color:#102030;font-weight:900;box-shadow:inset 0 1px 0 rgba(255,255,255,.8)}' +
      '.watany-route-activation-label{display:block;font-weight:900;font-size:14px;line-height:1.2}' +
      '.watany-route-activation-route{display:block;font-size:11px;opacity:.62;margin-top:3px;direction:ltr;text-align:right}' +
      '@media(max-width:560px){.watany-route-activation-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.watany-route-activation-card{min-height:76px;padding:8px;flex-direction:column;text-align:center}.watany-route-activation-icon{width:38px;height:38px}.watany-route-activation-route{display:none}}';
    // APEX V1.19.0.15: route chrome visuals are owned by the canonical static theme.
  }
  function buildCard(feature) {
    var a = document.createElement('a');
    a.className = 'watany-route-activation-card';
    a.href = feature.route || CATALOG_PAGE;
    a.setAttribute('data-watany-route-activation-card', 'true');
    a.setAttribute('data-feature-key', feature.key);
    a.setAttribute('data-feature-route', feature.route || CATALOG_PAGE);
    var icon = document.createElement('span');
    icon.className = 'watany-route-activation-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = feature.icon || 'W';
    var text = document.createElement('span');
    var label = document.createElement('span');
    label.className = 'watany-route-activation-label';
    label.textContent = feature.labelAr || feature.labelEn || feature.key;
    var route = document.createElement('span');
    route.className = 'watany-route-activation-route';
    route.textContent = feature.route || CATALOG_PAGE;
    text.appendChild(label);
    text.appendChild(route);
    a.appendChild(icon);
    a.appendChild(text);
    return a;
  }
  function ensureAllFeaturesLink() {
    if (!shouldInjectSupplementalChrome()) {
      cleanupInjectedHomeGrid();
      return;
    }
    if (document.querySelector('[data-watany-all-features-link="true"]')) return;
    var link = document.createElement('a');
    link.href = CATALOG_PAGE;
    link.textContent = 'كل الخدمات';
    link.className = 'watany-route-activation-all';
    link.setAttribute('data-watany-all-features-link', 'true');
    var target = document.querySelector('main') || document.body;
    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'direction:rtl;max-width:1120px;margin:10px auto;text-align:left;padding:0 10px';
    wrapper.appendChild(link);
    target.insertBefore(wrapper, target.firstChild || null);
  }
  function injectHomeGrid(features) {
    if (!shouldInjectSupplementalChrome()) {
      cleanupInjectedHomeGrid();
      return;
    }
    if (!features.length || document.querySelector('[data-watany-route-activation-grid="true"]')) return;
    var host = document.querySelector('main') || document.querySelector('#root') || document.body;
    var panel = document.createElement('section');
    panel.className = 'watany-route-activation-panel';
    panel.setAttribute('data-watany-route-activation-panel', 'true');
    var head = document.createElement('div');
    head.className = 'watany-route-activation-head';
    var title = document.createElement('div');
    title.className = 'watany-route-activation-title';
    title.textContent = 'خدمات موطني';
    var all = document.createElement('a');
    all.href = CATALOG_PAGE;
    all.className = 'watany-route-activation-all';
    all.setAttribute('data-watany-all-features-link', 'true');
    all.textContent = 'كل الخدمات';
    head.appendChild(title);
    head.appendChild(all);
    var grid = document.createElement('div');
    grid.className = 'watany-route-activation-grid';
    grid.setAttribute('data-watany-route-activation-grid', 'true');
    features.forEach(function (feature) { grid.appendChild(buildCard(feature)); });
    panel.appendChild(head);
    panel.appendChild(grid);
    host.insertBefore(panel, host.firstChild || null);
  }
  function bindExistingCards(features) {
    if (isLegacyLauncherActive()) return;
    var byKey = {};
    features.forEach(function (feature) { byKey[feature.key] = feature; });
    var nodes = Array.prototype.slice.call(document.querySelectorAll('[data-feature-key], .kw-main-card, .feature-card, button, [role="button"]'));
    nodes.forEach(function (node) {
      if (node.getAttribute && node.getAttribute('data-watany-route-activation-card') === 'true') return;
      var key = node.getAttribute ? safeText(node.getAttribute('data-feature-key'), '') : '';
      var feature = byKey[key] || features.find(function (f) {
        var text = safeText(node.textContent, '').toLowerCase();
        return text && (text.indexOf(String(f.labelAr || '').toLowerCase()) >= 0 || text.indexOf(String(f.labelEn || '').toLowerCase()) >= 0 || text.indexOf(String(f.key || '').toLowerCase()) >= 0);
      });
      if (!feature) return;
      var route = feature.route || CATALOG_PAGE;
      node.setAttribute('data-watany-feature-bound', 'true');
      node.setAttribute('data-feature-route', route);
      if (node.tagName && node.tagName.toLowerCase() === 'a') {
        if (!node.getAttribute('href') || node.getAttribute('href') === '#') node.setAttribute('href', route);
      } else {
        node.addEventListener('click', function () { window.location.href = route; });
      }
    });
  }
  function boot() {
    injectStyles();
    if (!shouldInjectSupplementalChrome()) {
      cleanupInjectedHomeGrid();
      window.__watanyFeatureRouteActivation = { ok: true, skipped: 'supplemental-chrome-disabled', catalogUrl: CATALOG_URL, catalogPage: CATALOG_PAGE };
      return;
    }
    fetch(CATALOG_URL, { cache: 'no-store' }).then(function (res) { return res.json(); }).then(function (payload) {
      var features = normalizeFeatures(payload);
      window.__watanyFeatureRouteActivation = { ok: true, featureCount: features.length, catalogUrl: CATALOG_URL, catalogPage: CATALOG_PAGE };
      ensureAllFeaturesLink();
      injectHomeGrid(features);
      bindExistingCards(features);
    }).catch(function (error) {
      window.__watanyFeatureRouteActivation = { ok: false, error: String(error && error.message || error) };
    });
  }
  onReady(boot);
})();
