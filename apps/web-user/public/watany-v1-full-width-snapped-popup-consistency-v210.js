
(function () {
  "use strict";
  var MARK = "watany-v1-full-width-snapped-popup-consistency-audit-v210-rewrite";
  if (window[MARK]) return;
  window[MARK] = true;

  var SELECTORS = [
    ".kw-group-sheet",
    ".kw-group-panel",
    ".kw-feature-sheet",
    ".kw-bottom-sheet",
    ".kw-modal",
    ".modal",
    "[role='dialog']",
    "#watany-v1-public-popup",
    "#watany-v1-jm-popup",
    "#watany-v1-going-now-popup",
    ".watany-clean-settings-sheet",
    ".watany-procedures-polish-sheet",
    ".watany-v1-popup",
    ".watany-mobile-popup",
    ".watany-card-popup",
    ".watany-sheet",
    ".watany-overlay-card"
  ];

  function px(value) {
    return Math.max(0, Math.round(Number(value) || 0)) + "px";
  }

  function isVisible(el) {
    if (!el || el.nodeType !== 1) return false;
    var cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity || "1") === 0) return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function isHybridLauncher(el) {
    return !!(el && (el.matches('[data-sticky-hybrid-chat-launcher="true"]') || (el.closest && el.closest('[data-sticky-hybrid-chat-launcher="true"]'))));
  }

  function isRecoveryMenu(el) {
    return !!(el && (el.matches('[data-watany-recovery-menu-open="true"], [data-watany-recovery-menu="true"], .watany-recovery-menu-layer, .watany-recovery-menu-panel') || (el.closest && el.closest('[data-watany-recovery-menu-open="true"], [data-watany-recovery-menu="true"], .watany-recovery-menu-layer, .watany-recovery-menu-panel'))));
  }

  function clearOverlayStyles(el) {
    if (!el || !el.style) return;
    el.classList.remove("watany-v1-snapped-popup-overlay");
    el.removeAttribute("data-watany-v1-snapped-popup");
    el.removeAttribute("data-watany-v1-snapped-popup-index");
    [
      "--watany-v1-snap-top",
      "--watany-v1-snap-bottom",
      "--watany-v1-snap-host-top",
      "--watany-v1-snap-host-bottom",
      "--watany-v1-snap-width",
      "--watany-v1-snap-max-height",
      "position",
      "left",
      "right",
      "top",
      "bottom",
      "transform",
      "width",
      "max-width",
      "max-height",
      "overflow",
      "box-sizing",
      "z-index"
    ].forEach(function (name) {
      el.style.removeProperty(name);
    });
  }

  function getHeaderBottom() {
    var selectors = ".kw-top-header,.watany-top-header,.sticky-header,.top-header,header,[data-testid*='header' i]";
    var candidates = Array.prototype.slice.call(document.querySelectorAll(selectors));
    var bottom = 0;
    candidates.forEach(function (el) {
      if (!isVisible(el)) return;
      var cs = getComputedStyle(el);
      var pos = cs.position;
      if (pos !== "sticky" && pos !== "fixed") return;
      var r = el.getBoundingClientRect();
      if (r.width < 120 || r.height < 20 || r.height > 180) return;
      if (r.top > window.innerHeight * 0.45) return;
      bottom = Math.max(bottom, r.bottom);
    });
    if (bottom < 48) bottom = 0;
    return Math.min(bottom, Math.floor(window.innerHeight * 0.42));
  }

  function getFooterGap() {
    var selectors = ".kw-bottom-nav,.kw-bottom-chat,.watany-bottom-chat,.watany-hybrid-chat,footer,nav,[data-testid*='bottom' i],[data-testid*='footer' i]";
    var candidates = Array.prototype.slice.call(document.querySelectorAll(selectors));
    var gap = 0;
    candidates.forEach(function (el) {
      if (!isVisible(el)) return;
      var cs = getComputedStyle(el);
      var pos = cs.position;
      if (pos !== "sticky" && pos !== "fixed") return;
      var r = el.getBoundingClientRect();
      if (r.width < 120 || r.height < 24 || r.height > 180) return;
      if (r.top < window.innerHeight * 0.45) return;
      gap = Math.max(gap, window.innerHeight - r.top);
    });
    return Math.min(gap, Math.floor(window.innerHeight * 0.35));
  }

  function getTopLayerHostOffset(el) {
    var host = el && el.closest ? el.closest("dialog[open], .kw-profile-sheet") : null;
    if (!host) return { top: 0, bottom: 0 };
    var r = host.getBoundingClientRect();
    if (r.height <= 0) return { top: 0, bottom: 0 };
    return {
      top: r.top < 0 ? Math.round(-r.top) : 0,
      bottom: r.bottom > window.innerHeight ? Math.round(r.bottom - window.innerHeight) : 0
    };
  }

  function isKnownSelector(el) {
    return SELECTORS.some(function (selector) {
      try { return el.matches(selector); } catch (err) { return false; }
    });
  }

  function shouldSkip(el) {
    if (!el || el.nodeType !== 1) return true;
    if (isHybridLauncher(el)) {
      clearOverlayStyles(el);
      return true;
    }
    if (isRecoveryMenu(el)) {
      clearOverlayStyles(el);
      return true;
    }
    if (el.closest && el.closest("svg,script,style")) return true;
    if (el.closest && el.closest(".popup-overlay")) return true;
    if (el.closest && el.closest("[data-watany-universal-feature-menu]")) return true;
    if (el.id === "root") return true;
    var id = el.id || "";
    var cls = String(el.className || "");
    if (id.indexOf("watany-form-viewer") >= 0 || cls.indexOf("watany-form-viewer") >= 0) return true;
    if (id.indexOf("watany-v1-procedures-source-grouping-polish") >= 0) return true;
    if (id.indexOf("watany-v1-clean-settings-single-template") >= 0) return true;
    return false;
  }

  function looksLikeOverlay(el) {
    if (shouldSkip(el) || !isVisible(el)) return false;
    var r = el.getBoundingClientRect();
    var cs = getComputedStyle(el);
    var text = String(el.textContent || "").trim();
    if (r.width < 80 && r.height < 45 && text.length < 2) return false;
    if (isKnownSelector(el)) return true;
    if (cs.position === "fixed" && r.width >= 160 && r.height >= 80) return true;
    return false;
  }

  function collectOverlays() {
    var overlays = [];
    SELECTORS.forEach(function (selector) {
      try {
        Array.prototype.slice.call(document.querySelectorAll(selector)).forEach(function (el) {
          if (overlays.indexOf(el) < 0 && looksLikeOverlay(el)) overlays.push(el);
        });
      } catch (err) {}
    });
    Array.prototype.slice.call(document.querySelectorAll("body *")).forEach(function (el) {
      if (overlays.indexOf(el) < 0 && looksLikeOverlay(el)) overlays.push(el);
    });
    return overlays.slice(0, 40);
  }

  function applyToOverlay(el, index) {
    if (!looksLikeOverlay(el)) return false;
    var headerBottom = getHeaderBottom();
    var footerGap = getFooterGap();
    var hostOffset = getTopLayerHostOffset(el);
    var top = Math.max(0, headerBottom);
    var bottom = Math.max(0, footerGap);
    var appliedTop = Math.max(0, top + hostOffset.top);
    var appliedBottom = Math.max(0, bottom + hostOffset.bottom);
    var shellWidth = Math.min(window.innerWidth - 8, 430);
    var maxHeight = Math.max(180, window.innerHeight - appliedTop - appliedBottom - 10);

    el.classList.add("watany-v1-snapped-popup-overlay");
    el.setAttribute("data-watany-v1-snapped-popup", "true");
    el.setAttribute("data-watany-v1-snapped-popup-index", String(index));
    el.style.setProperty("--watany-v1-snap-top", px(top), "important");
    el.style.setProperty("--watany-v1-snap-bottom", px(bottom), "important");
    el.style.setProperty("--watany-v1-snap-host-top", px(hostOffset.top), "important");
    el.style.setProperty("--watany-v1-snap-host-bottom", px(hostOffset.bottom), "important");
    el.style.setProperty("--watany-v1-snap-width", px(shellWidth), "important");
    el.style.setProperty("--watany-v1-snap-max-height", px(maxHeight), "important");
    el.style.setProperty("position", "fixed", "important");
    el.style.setProperty("left", "50%", "important");
    el.style.setProperty("right", "auto", "important");
    el.style.setProperty("top", "calc(var(--watany-v1-snap-top) + var(--watany-v1-snap-host-top, 0px))", "important");
    el.style.setProperty("bottom", "calc(var(--watany-v1-snap-bottom) + var(--watany-v1-snap-host-bottom, 0px))", "important");
    el.style.setProperty("transform", "translateX(-50%)", "important");
    el.style.setProperty("width", "var(--watany-v1-snap-width)", "important");
    el.style.setProperty("max-width", "calc(100vw - 8px)", "important");
    el.style.setProperty("max-height", "var(--watany-v1-snap-max-height)", "important");
    el.style.setProperty("overflow", "auto", "important");
    el.style.setProperty("box-sizing", "border-box", "important");
    el.style.setProperty("z-index", "2147482500", "important");
    return true;
  }

  function runAudit() {
    var overlays = collectOverlays();
    var applied = 0;
    overlays.forEach(function (el, index) {
      if (applyToOverlay(el, index)) applied += 1;
    });
    document.documentElement.setAttribute("data-watany-v1-snapped-popup-ready", "true");
    document.documentElement.setAttribute("data-watany-v1-snapped-popup-version", "v2.1.0");
    document.documentElement.setAttribute("data-watany-v1-snapped-popup-count", String(applied));
    window.watanyV1SnappedPopupConsistencyReady = true;
    window.watanyV1SnappedPopupConsistencyVersion = "v2.1.0";
    window.watanyV1SnappedPopupLastCount = applied;
    return applied;
  }

  function scheduleFactory() {
    var scheduled = false;
    return function schedule() {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(function () {
        scheduled = false;
        runAudit();
      });
    };
  }

  function init() {
    var schedule = scheduleFactory();
    runAudit();
    window.addEventListener("resize", schedule, { passive: true });
    window.addEventListener("orientationchange", schedule, { passive: true });
    document.addEventListener("click", function () {
      setTimeout(schedule, 40);
      setTimeout(schedule, 180);
      setTimeout(schedule, 520);
    }, true);
    var mo = new MutationObserver(schedule);
    mo.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "open", "aria-hidden"] });
    window.watanyV1RunSnappedPopupConsistencyAudit = runAudit;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
