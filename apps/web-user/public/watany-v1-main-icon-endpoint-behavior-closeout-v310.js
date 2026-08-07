(function () {
  'use strict';
  var VERSION = 'v3.1.0';
  if (window.__watanyV1MainIconEndpointBehaviorCloseout310) return;
  window.__watanyV1MainIconEndpointBehaviorCloseout310 = true;

  function addStableClasses() {
    try {
      document.documentElement.classList.add('watany-v1-boot', 'watany-home-grid-order-enabled', 'watany-safe-mobile-landing', 'watany-has-sticky-top-header', 'watany-v1-endpoint-closeout-active');
      if (document.body) document.body.classList.add('koudama-agent5-active');
      var root = document.getElementById('root');
      if (root) root.classList.add('watany-v1-home-height-published-icons-root');
    } catch (err) {}
  }

  addStableClasses();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addStableClasses, { once: true });
  }
  setTimeout(addStableClasses, 0);
  setTimeout(addStableClasses, 250);
  setTimeout(addStableClasses, 1000);

  if (!window.__watanyV1SafeRemoveChildGuard310 && window.Node && Node.prototype && Node.prototype.removeChild) {
    window.__watanyV1SafeRemoveChildGuard310 = true;
    var originalRemoveChild = Node.prototype.removeChild;
    Node.prototype.removeChild = function watanyV1SafeRemoveChild(child) {
      if (child && child.parentNode !== this) {
        try {
          if (child.parentNode) return originalRemoveChild.call(child.parentNode, child);
        } catch (err) {}
        return child;
      }
      return originalRemoveChild.call(this, child);
    };
  }

  function basePrefix() {
    return window.location.pathname.indexOf('/mcp') === 0 ? '/mcp' : '';
  }

  function cleanText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function navigateTo(path) {
    var target = basePrefix() + path;
    if (window.location.pathname + window.location.search + window.location.hash === target) return;
    try {
      window.history.pushState({ watanyV1EndpointCloseout: VERSION, path: path }, '', target);
      try { window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state })); }
      catch (err) { window.dispatchEvent(new Event('popstate')); }
      setTimeout(function () {
        if (window.location.pathname + window.location.search + window.location.hash !== target) {
          window.location.assign(target);
        }
      }, 80);
    } catch (err) {
      window.location.assign(target);
    }
  }

  var worldCupRoutes = [
    { key: 'schedule', path: '/world-cup?section=schedule', tests: [/\u062c\u062f\u0648\u0644/, /schedule/i, /fixtures/i] },
    { key: 'today', path: '/world-cup?section=today', tests: [/\u0645\u0628\u0627\u0631\u064a\u0627\u062a\s+\u0627\u0644\u064a\u0648\u0645/, /today/i] },
    { key: 'results', path: '/world-cup?section=results', tests: [/\u0627\u0644\u0646\u062a\u0627\u0626\u062c/, /results/i] },
    { key: 'groups', path: '/world-cup?section=groups', tests: [/\u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0627\u062a/, /groups/i] },
    { key: 'predictions', path: '/world-cup?section=predictions', tests: [/\u0627\u0644\u062a\u0648\u0642\u0639\u0627\u062a/, /predictions/i] },
    { key: 'favorites', path: '/world-cup?section=favorites', tests: [/\u0627\u0644\u0645\u0641\u0636\u0644\u0629/, /favorites/i] },
    { key: 'reminders', path: '/world-cup?section=reminders', tests: [/\u0627\u0644\u062a\u0646\u0628\u064a\u0647\u0627\u062a/, /reminders/i, /notifications/i] },
    { key: 'fan-rooms', path: '/world-cup?section=fan-rooms', tests: [/\u063a\u0631\u0641\s+\u0627\u0644\u0645\u0634\u062c\u0639\u064a\u0646/, /fan/i, /rooms/i] },
    { key: 'tv-links', path: '/world-cup?section=tv-links', tests: [/\u0627\u0644\u0628\u062b/, /\u0627\u0644\u0631\u0648\u0627\u0628\u0637/, /tv/i, /links/i] }
  ];

  function matchWorldCupRoute(text) {
    for (var i = 0; i < worldCupRoutes.length; i++) {
      var row = worldCupRoutes[i];
      for (var j = 0; j < row.tests.length; j++) {
        if (row.tests[j].test(text)) return row;
      }
    }
    return null;
  }

  function isCloseText(text) {
    return /^(x|X|\u00d7|\u0625\u063a\u0644\u0627\u0642|\u0627\u063a\u0644\u0627\u0642|close)$/i.test(cleanText(text));
  }

  function isRouterOwnedWorldCupNode(node) {
    if (!node || !node.closest) return false;
    if (node.closest('.watany-drawer-page, .watany-drawer-phone, .watany-icon-grid, .watany-app-icon')) return true;
    var owner = node.closest('a[href], [data-route], [data-href]');
    if (!owner) return false;
    var route = owner.getAttribute('href') || owner.getAttribute('data-route') || owner.getAttribute('data-href') || '';
    return /(^|\/+)world-cup(?:[/?#]|$)/i.test(route);
  }

  document.addEventListener('click', function (event) {
    var target = event.target;
    if (!target || !target.closest) return;
    if (isRouterOwnedWorldCupNode(target)) return;
    var clickable = target.closest('a[href], button, [role="button"], [onclick], [data-route], [data-href], [data-feature-key]');
    if (!clickable) return;

    var popup = clickable.closest('.watany-v1-wc-popup, [data-watany-world-cup-popup], [data-feature-key="world-cup-root"]');
    var text = cleanText([clickable.getAttribute('aria-label'), clickable.getAttribute('title'), clickable.getAttribute('data-route'), clickable.getAttribute('data-href'), clickable.textContent].filter(Boolean).join(' '));
    if (!popup && !/\u0643\u0623\u0633\s+\u0627\u0644\u0639\u0627\u0644\u0645|world\s*cup/i.test(cleanText(document.body && document.body.textContent))) return;
    if (isCloseText(text)) return;

    var route = matchWorldCupRoute(text);
    if (!route) return;
    try { event.preventDefault(); } catch (err) {}
    try { event.stopImmediatePropagation(); } catch (err) {}
    try { event.stopPropagation(); } catch (err) {}
    navigateTo(route.path);
  }, true);

  document.documentElement.setAttribute('data-watany-v1-main-icon-endpoint-closeout', VERSION);
})();