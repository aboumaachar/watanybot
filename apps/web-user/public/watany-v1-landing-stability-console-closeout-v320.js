(function () {
  'use strict';
  var VERSION = 'v3.2.0';
  var html = document.documentElement;
  var readyTimer = null;

  function addClass(name) {
    if (html && !html.classList.contains(name)) html.classList.add(name);
  }

  function removeClass(name) {
    if (html && html.classList.contains(name)) html.classList.remove(name);
  }

  function countMainCards() {
    return document.querySelectorAll('[data-feature-key], .kw-main-card, .main-card, .feature-card, .service-card, .home-card, .watany-card').length;
  }

  function markReady(reason) {
    if (readyTimer) return;
    readyTimer = window.setTimeout(function () {
      removeClass('watany-v1-first-paint-stabilizing');
      addClass('watany-v1-first-paint-ready');
      html.setAttribute('data-watany-v1-first-paint-ready', reason || 'ready');
      window.setTimeout(function () {
        removeClass('watany-no-theme-transitions');
      }, 450);
    }, 120);
  }

  addClass('watany-v1-landing-stability-v320-active');
  addClass('watany-no-theme-transitions');

  if (!window.__WATANY_V1_LANDING_STABILITY_V320__) {
    window.__WATANY_V1_LANDING_STABILITY_V320__ = {
      version: VERSION,
      startedAt: new Date().toISOString(),
      firstPaintReady: false,
      apiFailures: []
    };
  }

  var originalFetch = window.fetch;
  if (typeof originalFetch === 'function' && !originalFetch.__watanyV1LandingStabilityWrapped) {
    var wrappedFetch = function () {
      var args = arguments;
      return originalFetch.apply(this, args).then(function (response) {
        try {
          if (response && response.status >= 500) {
            window.__WATANY_V1_LANDING_STABILITY_V320__.apiFailures.push({
              status: response.status,
              url: response.url || String(args[0] || ''),
              at: new Date().toISOString()
            });
          }
        } catch (_) {}
        return response;
      });
    };
    wrappedFetch.__watanyV1LandingStabilityWrapped = true;
    window.fetch = wrappedFetch;
  }

  function maybeReady() {
    var root = document.getElementById('root');
    var hasMain = !!document.querySelector('main, [data-feature-key], .kw-main-card');
    var cardCount = countMainCards();
    if (root && root.children.length > 0 && (hasMain || cardCount >= 8)) {
      window.__WATANY_V1_LANDING_STABILITY_V320__.firstPaintReady = true;
      window.__WATANY_V1_LANDING_STABILITY_V320__.readyCardCount = cardCount;
      markReady('app-hydrated');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', maybeReady, { once: true });
  } else {
    maybeReady();
  }

  var attempts = 0;
  var interval = window.setInterval(function () {
    attempts += 1;
    maybeReady();
    if (window.__WATANY_V1_LANDING_STABILITY_V320__.firstPaintReady || attempts >= 30) {
      window.clearInterval(interval);
      if (!window.__WATANY_V1_LANDING_STABILITY_V320__.firstPaintReady) {
        markReady('timeout');
      }
    }
  }, 100);
})();
