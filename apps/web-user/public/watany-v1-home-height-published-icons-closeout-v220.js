
(function () {
  "use strict";
  var MARK = "watany-v1-home-height-published-icons-closeout-v220";
  if (window[MARK]) return;
  window[MARK] = true;

  var ROOT_SELECTORS = [
    ".kw-home-main",
    ".kw-home-page",
    ".kw-main-grid",
    ".kw-main-card-grid",
    ".kw-dashboard-grid",
    "[data-testid='home-grid']",
    "[data-watany-home-grid='true']"
  ];

  var CARD_SELECTORS = [
    ".kw-main-card",
    ".kw-feature-card",
    "[data-feature-key]"
  ];

  function isHomeRoute() {
    var path = window.location.pathname || "/";
    return path === "/" || path === "/mcp" || path === "/mcp/";
  }

  function clearRootHeight(root) {
    if (!root || root.nodeType !== 1) return;
    root.style.removeProperty("--watany-v1-home-published-icons-height");
    root.style.removeProperty("--watany-v1-home-published-icons-card-count");
    root.style.removeProperty("height");
    root.style.removeProperty("min-height");
    root.style.removeProperty("max-height");
    root.style.removeProperty("overflow");
    root.style.removeProperty("box-sizing");
    root.style.removeProperty("margin-bottom");
    root.style.removeProperty("padding-bottom");
    root.removeAttribute("data-watany-v1-home-height-published-icons");

    var parent = root.parentElement;
    var guard = 0;
    while (parent && parent !== document.body && guard < 4) {
      parent.style.removeProperty("min-height");
      parent.style.removeProperty("height");
      parent.style.removeProperty("padding-bottom");
      parent.style.removeProperty("margin-bottom");
      parent = parent.parentElement;
      guard += 1;
    }
  }

  function clearAllPublishedHeights() {
    Array.prototype.slice.call(document.querySelectorAll(".watany-v1-home-height-published-icons-root, [data-watany-v1-home-height-published-icons]")).forEach(clearRootHeight);
    document.documentElement.removeAttribute("data-watany-v1-home-height-ready");
    document.documentElement.removeAttribute("data-watany-v1-home-height-version");
    document.documentElement.removeAttribute("data-watany-v1-home-height-card-count");
  }

  function isVisible(el) {
    if (!el || el.nodeType !== 1) return false;
    var cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0") return false;
    var r = el.getBoundingClientRect();
    return r.width > 24 && r.height > 24;
  }

  function isOverlayOrPopup(el) {
    if (!el || !el.closest) return false;
    return !!el.closest(
      '[data-sticky-hybrid-chat-launcher="true"],[data-watany-recovery-menu-open="true"],[data-watany-recovery-menu="true"],[data-watany-v1-snapped-popup="true"],[data-watany-v1-body-portal-snap-closeout="v2.1.2"],.watany-v1-snapped-popup-overlay,.watany-v1-body-portal-snap-closeout,#watany-form-viewer-root,[role="dialog"]'
    );
  }

  function findCards() {
    var all = [];
    CARD_SELECTORS.forEach(function (selector) {
      Array.prototype.slice.call(document.querySelectorAll(selector)).forEach(function (el) {
        if (all.indexOf(el) < 0 && isVisible(el) && !isOverlayOrPopup(el)) {
          var key = el.getAttribute("data-feature-key") || "";
          if (key && key.indexOf("admin") >= 0) return;
          all.push(el);
        }
      });
    });
    return all.filter(function (el) {
      var r = el.getBoundingClientRect();
      return r.top < window.innerHeight * 1.4;
    }).slice(0, 80);
  }

  function chooseRoot(cards) {
    for (var i = 0; i < ROOT_SELECTORS.length; i++) {
      var el = document.querySelector(ROOT_SELECTORS[i]);
      if (isVisible(el) && !isOverlayOrPopup(el)) return el;
    }

    var best = null;
    var bestScore = -1;
    Array.prototype.slice.call(document.querySelectorAll("main, section, div")).forEach(function (el) {
      if (!isVisible(el) || isOverlayOrPopup(el)) return;
      var contained = cards.filter(function (card) { return el !== card && el.contains(card); }).length;
      if (contained < 3) return;
      var r = el.getBoundingClientRect();
      var score = contained * 1000 - Math.abs(r.width - Math.min(window.innerWidth, 430));
      if (score > bestScore) {
        bestScore = score;
        best = el;
      }
    });

    return best;
  }

  function bounds(cards) {
    var top = Infinity;
    var bottom = -Infinity;
    var left = Infinity;
    var right = -Infinity;
    cards.forEach(function (el) {
      var r = el.getBoundingClientRect();
      top = Math.min(top, r.top);
      bottom = Math.max(bottom, r.bottom);
      left = Math.min(left, r.left);
      right = Math.max(right, r.right);
    });
    if (!Number.isFinite(top) || !Number.isFinite(bottom)) {
      return null;
    }
    return { top: top, bottom: bottom, left: left, right: right, height: bottom - top, width: right - left };
  }

  function getHeaderBottom() {
    var bottom = 0;
    Array.prototype.slice.call(document.querySelectorAll(".kw-top-header,.watany-top-header,header,.sticky-header,.top-header,[data-testid*='header' i]")).forEach(function (el) {
      if (!isVisible(el)) return;
      var cs = getComputedStyle(el);
      if (cs.position !== "fixed" && cs.position !== "sticky") return;
      var r = el.getBoundingClientRect();
      if (r.top > window.innerHeight * 0.45) return;
      bottom = Math.max(bottom, r.bottom);
    });
    return Math.max(0, Math.round(bottom));
  }

  function getFooterTop() {
    var top = window.innerHeight;
    Array.prototype.slice.call(document.querySelectorAll(".kw-bottom-chat,.watany-bottom-chat,.kw-bottom-nav,footer,nav,[data-testid*='bottom' i],[data-testid*='footer' i]")).forEach(function (el) {
      if (!isVisible(el)) return;
      var cs = getComputedStyle(el);
      if (cs.position !== "fixed" && cs.position !== "sticky") return;
      var r = el.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.45) return;
      top = Math.min(top, r.top);
    });
    return Math.round(top);
  }

  function applyHeight() {
    if (!isHomeRoute()) {
      clearAllPublishedHeights();
      window.watanyV1HomeHeightPublishedIconsCloseoutReady = false;
      window.watanyV1HomeHeightPublishedIconsCloseoutVersion = "v2.2.0";
      window.watanyV1HomeHeightPublishedIconsCloseoutMetrics = { ok: false, reason: "non-home-route" };
      return false;
    }

    var cards = findCards();
    var root = chooseRoot(cards);
    var gridBounds = bounds(cards);
    if (!root || !gridBounds || cards.length < 3) {
      document.documentElement.setAttribute("data-watany-v1-home-height-ready", "partial");
      window.watanyV1HomeHeightPublishedIconsCloseoutReady = true;
      window.watanyV1HomeHeightPublishedIconsCloseoutVersion = "v2.2.0";
      window.watanyV1HomeHeightPublishedIconsCloseoutMetrics = { ok: false, reason: "root-or-cards-not-found", cards: cards.length };
      return false;
    }

    var rootRect = root.getBoundingClientRect();
    var topPadding = Math.max(0, gridBounds.top - rootRect.top);
    var strictHeight = Math.ceil(topPadding + gridBounds.height + 14);
    var maxAllowed = Math.max(220, getFooterTop() - Math.max(getHeaderBottom(), rootRect.top) - 4);
    var finalHeight = Math.max(220, Math.min(strictHeight, maxAllowed));

    root.classList.add("watany-v1-home-height-published-icons-root");
    root.setAttribute("data-watany-v1-home-height-published-icons", "v2.2.0");
    root.style.setProperty("--watany-v1-home-published-icons-height", finalHeight + "px", "important");
    root.style.setProperty("--watany-v1-home-published-icons-card-count", String(cards.length), "important");
    root.style.setProperty("height", finalHeight + "px", "important");
    root.style.setProperty("min-height", finalHeight + "px", "important");
    root.style.setProperty("max-height", finalHeight + "px", "important");
    root.style.setProperty("overflow", "visible", "important");
    root.style.setProperty("box-sizing", "border-box", "important");
    root.style.setProperty("margin-bottom", "0px", "important");
    root.style.setProperty("padding-bottom", "8px", "important");

    var parent = root.parentElement;
    var guard = 0;
    while (parent && parent !== document.body && guard < 4) {
      parent.classList.add("watany-v1-home-height-published-icons-parent");
      parent.style.setProperty("min-height", "0px", "important");
      parent.style.setProperty("height", "auto", "important");
      parent.style.setProperty("padding-bottom", "0px", "important");
      parent.style.setProperty("margin-bottom", "0px", "important");
      parent = parent.parentElement;
      guard += 1;
    }

    document.documentElement.setAttribute("data-watany-v1-home-height-ready", "true");
    document.documentElement.setAttribute("data-watany-v1-home-height-version", "v2.2.0");
    document.documentElement.setAttribute("data-watany-v1-home-height-card-count", String(cards.length));
    window.watanyV1HomeHeightPublishedIconsCloseoutReady = true;
    window.watanyV1HomeHeightPublishedIconsCloseoutVersion = "v2.2.0";
    window.watanyV1HomeHeightPublishedIconsCloseoutMetrics = {
      ok: true,
      cardCount: cards.length,
      strictHeight: strictHeight,
      finalHeight: finalHeight,
      maxAllowed: maxAllowed,
      rootTop: Math.round(rootRect.top),
      gridTop: Math.round(gridBounds.top),
      gridBottom: Math.round(gridBounds.bottom),
      gridHeight: Math.round(gridBounds.height),
      headerBottom: getHeaderBottom(),
      footerTop: getFooterTop()
    };
    return true;
  }

  function init() {
    applyHeight();
    var pending = false;
    function schedule() {
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () {
        pending = false;
        applyHeight();
      });
    }
    window.addEventListener("resize", schedule, { passive: true });
    window.addEventListener("orientationchange", schedule, { passive: true });
    document.addEventListener("click", function () {
      setTimeout(schedule, 50);
      setTimeout(schedule, 250);
      setTimeout(schedule, 700);
    }, true);
    var mo = new MutationObserver(schedule);
    mo.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "hidden", "aria-hidden"] });
    window.watanyV1RunHomeHeightPublishedIconsCloseout = applyHeight;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
