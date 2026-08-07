(function () {
  if (window.__watanyFeatureCatalogRuntime) return;
  window.__watanyFeatureCatalogRuntime = { loaded: true, bound: 0, catalogCount: 0 };
  var catalogUrl = '/watany-feature-catalog.json';
  var allUrl = '/watany-all-features.html';
  function isHomePath() {
    var path = window.location.pathname || '/';
    return path === '/' || path === '/mobile-os' || path === '/mcp/' || path === '/mcp';
  }
  function shouldShowSupplementalCatalogLink() {
    if (!isHomePath()) return false;
    return document.documentElement.hasAttribute('data-watany-route-activation-opt-in');
  }
  function cleanupAllFeaturesLinks() {
    Array.prototype.slice.call(document.querySelectorAll('[data-watany-all-features-link="true"]')).forEach(function (node) {
      if (node && node.parentNode) node.parentNode.removeChild(node);
    });
  }
  function norm(value) { return String(value || '').trim().toLowerCase(); }
  function textOf(el) { return norm((el.innerText || el.textContent || '') + ' ' + (el.getAttribute('aria-label') || '') + ' ' + (el.getAttribute('data-feature-key') || '')); }
  function makeIcon(feature) {
    var span = document.createElement('span');
    span.setAttribute('data-watany-feature-icon', 'true');
    span.textContent = feature.icon || '*';
    span.style.display = 'inline-flex';
    span.style.alignItems = 'center';
    span.style.justifyContent = 'center';
    span.style.width = '34px';
    span.style.height = '34px';
    span.style.borderRadius = '14px';
    span.style.marginInlineEnd = '8px';
    span.style.fontWeight = '900';
    span.style.color = '#0f766e';
    span.style.background = 'linear-gradient(180deg,#fff,#eaf7f5)';
    span.style.border = '1px solid rgba(15,118,110,.2)';
    return span;
  }
  function addAllFeaturesLink() {
    if (!shouldShowSupplementalCatalogLink()) {
      cleanupAllFeaturesLinks();
      return;
    }
    if (document.querySelector('[data-watany-all-features-link="true"]')) return;
    var a = document.createElement('a');
    a.href = allUrl;
    a.textContent = 'كل الخدمات';
    a.setAttribute('data-watany-all-features-link', 'true');
    a.style.position = 'fixed';
    a.style.insetInlineStart = '14px';
    a.style.bottom = '82px';
    a.style.zIndex = '9999';
    a.style.padding = '10px 14px';
    a.style.borderRadius = '999px';
    a.style.textDecoration = 'none';
    a.style.fontWeight = '800';
    a.style.background = '#0f766e';
    a.style.color = '#fff';
    a.style.boxShadow = '0 10px 24px rgba(15,118,110,.28)';
    document.body.appendChild(a);
  }
  function bindCard(el, feature) {
    var route = feature.route || (allUrl + '#' + feature.key);
    if (!el.getAttribute('data-feature-key')) el.setAttribute('data-feature-key', feature.key);
    el.setAttribute('data-watany-feature-bound', 'true');
    el.setAttribute('data-watany-feature-route', route);
    if (!el.matches('a[href]')) {
      el.setAttribute('role', 'link');
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
      if (!el.__watanyFeatureClickBound) {
        el.__watanyFeatureClickBound = true;
        el.addEventListener('click', function (ev) {
          var interactive = ev.target && ev.target.closest && ev.target.closest('a,button,input,select,textarea');
          if (interactive && interactive !== el) return;
          window.location.href = route;
        });
        el.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); window.location.href = route; }
        });
      }
    }
    if (!el.querySelector('[data-watany-feature-icon="true"],svg,img,.icon,[class*="icon"]')) {
      el.insertBefore(makeIcon(feature), el.firstChild);
    }
  }
  function enhance(features) {
    if (!shouldShowSupplementalCatalogLink()) {
      cleanupAllFeaturesLinks();
      return;
    }
    addAllFeaturesLink();
    var candidates = Array.prototype.slice.call(document.querySelectorAll('[data-feature-key], .kw-main-card, .feature-card, .service-card, .home-card, [class*="card"]'));
    var bound = 0;
    candidates.forEach(function (el) {
      var key = norm(el.getAttribute('data-feature-key'));
      var t = textOf(el);
      var found = features.find(function (f) {
        return norm(f.key) === key || (f.labelAr && t.indexOf(norm(f.labelAr)) >= 0) || (f.labelEn && t.indexOf(norm(f.labelEn)) >= 0) || (f.key && t.indexOf(norm(f.key)) >= 0);
      });
      if (found) { bindCard(el, found); bound += 1; }
    });
    window.__watanyFeatureCatalogRuntime.bound = bound;
  }
  fetch(catalogUrl, { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (data) {
    var features = data.features || [];
    window.__watanyFeatureCatalogRuntime.catalogCount = features.length;
    enhance(features);
    setTimeout(function () { enhance(features); }, 750);
    setTimeout(function () { enhance(features); }, 2000);
  }).catch(function () { addAllFeaturesLink(); });
})();
