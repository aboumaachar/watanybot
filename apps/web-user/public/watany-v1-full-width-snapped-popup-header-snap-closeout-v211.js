
(function () {
  "use strict";
  var MARK = "watany-v1-full-width-snapped-popup-header-snap-closeout-v211";
  if (window[MARK]) return;
  window[MARK] = true;

  function toNumber(value) {
    var n = parseFloat(String(value || "").replace("px", "").trim());
    return Number.isFinite(n) ? n : 0;
  }

  function px(value) {
    return Math.max(0, Math.round(Number(value) || 0)) + "px";
  }

  function visible(el) {
    if (!el || el.nodeType !== 1) return false;
    var cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") return false;
    var r = el.getBoundingClientRect();
    return r.width > 80 && r.height > 40;
  }

  function isHybridLauncher(el) {
    return !!(el && (el.matches('[data-sticky-hybrid-chat-launcher="true"]') || (el.closest && el.closest('[data-sticky-hybrid-chat-launcher="true"]'))));
  }

  function isRecoveryMenu(el) {
    return !!(el && (el.matches('[data-watany-recovery-menu-open="true"], [data-watany-recovery-menu="true"], .watany-recovery-menu-layer, .watany-recovery-menu-panel') || (el.closest && el.closest('[data-watany-recovery-menu-open="true"], [data-watany-recovery-menu="true"], .watany-recovery-menu-layer, .watany-recovery-menu-panel'))));
  }

  function clearHeaderSnap(el) {
    if (!el || !el.style) return;
    el.classList.remove("watany-v1-header-snap-closeout");
    el.removeAttribute("data-watany-v1-header-snap-closeout");
    el.removeAttribute("data-watany-v1-header-snap-closeout-index");
    [
      "--watany-v1-header-snap-top-px",
      "--watany-v1-header-snap-bottom-px",
      "--watany-v1-header-snap-width-px",
      "--watany-v1-header-snap-max-height-px",
      "position",
      "inset",
      "top",
      "bottom",
      "left",
      "right",
      "width",
      "max-width",
      "max-height",
      "height",
      "margin",
      "margin-top",
      "margin-bottom",
      "transform",
      "translate",
      "scale",
      "rotate",
      "box-sizing",
      "overflow",
      "overscroll-behavior",
      "z-index"
    ].forEach(function (name) {
      el.style.removeProperty(name);
    });
  }

  function getHeaderBottom() {
    var candidates = Array.prototype.slice.call(document.querySelectorAll(
      ".kw-top-header, .watany-top-header, header[style*='sticky'], header[style*='fixed'], [data-testid*='header' i], .sticky-header, .top-header, header"
    ));
    var bottom = 0;
    candidates.forEach(function (el) {
      if (!visible(el)) return;
      var cs = getComputedStyle(el);
      if (cs.position !== "sticky" && cs.position !== "fixed") return;
      var r = el.getBoundingClientRect();
      if (r.top > window.innerHeight * 0.45) return;
      bottom = Math.max(bottom, r.bottom);
    });
    return Math.min(Math.max(0, bottom), Math.floor(window.innerHeight * 0.46));
  }

  function getFooterGap() {
    var candidates = Array.prototype.slice.call(document.querySelectorAll(
      ".kw-bottom-nav, .kw-bottom-chat, .watany-bottom-chat, .watany-hybrid-chat, [data-testid*='bottom' i], [data-testid*='footer' i], footer, nav"
    ));
    var top = window.innerHeight;
    candidates.forEach(function (el) {
      if (!visible(el)) return;
      var cs = getComputedStyle(el);
      if (cs.position !== "sticky" && cs.position !== "fixed") return;
      var r = el.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.45) return;
      top = Math.min(top, r.top);
    });
    return Math.max(0, window.innerHeight - top);
  }

  function collect() {
    var nodes = Array.prototype.slice.call(document.querySelectorAll('[data-watany-v1-snapped-popup="true"], .watany-v1-snapped-popup-overlay'));
    return nodes.filter(function (el) {
      if (isHybridLauncher(el)) {
        clearHeaderSnap(el);
        return false;
      }
      if (isRecoveryMenu(el)) {
        clearHeaderSnap(el);
        return false;
      }
      return visible(el) && !el.closest('.popup-overlay') && !(el.closest && el.closest('[data-watany-universal-feature-menu]'));
    }).slice(0, 50);
  }

  function forceOne(el, idx) {
    if (el && el.id === "watany-form-viewer-root") return false;
    if (isHybridLauncher(el)) {
      clearHeaderSnap(el);
      return false;
    }
    if (isRecoveryMenu(el)) {
      clearHeaderSnap(el);
      return false;
    }
    if (!visible(el)) return false;

    var cs = getComputedStyle(el);
    var variableTop = toNumber(cs.getPropertyValue("--watany-v1-snap-top"));
    var variableBottom = toNumber(cs.getPropertyValue("--watany-v1-snap-bottom"));
    var headerTop = getHeaderBottom();
    var footerGap = getFooterGap();

    var top = Math.max(headerTop, variableTop, 0);
    var bottom = Math.max(footerGap, variableBottom, 0);
    var width = Math.min(window.innerWidth - 8, 430);
    var maxHeight = Math.max(160, window.innerHeight - top - bottom - 10);

    el.classList.add("watany-v1-header-snap-closeout");
    el.setAttribute("data-watany-v1-header-snap-closeout", "v2.1.1");
    el.setAttribute("data-watany-v1-header-snap-closeout-index", String(idx));

    el.style.setProperty("--watany-v1-header-snap-top-px", px(top), "important");
    el.style.setProperty("--watany-v1-header-snap-bottom-px", px(bottom), "important");
    el.style.setProperty("--watany-v1-header-snap-width-px", px(width), "important");
    el.style.setProperty("--watany-v1-header-snap-max-height-px", px(maxHeight), "important");

    el.style.setProperty("position", "fixed", "important");
    el.style.setProperty("inset", "auto", "important");
    el.style.setProperty("top", px(top), "important");
    el.style.setProperty("bottom", px(bottom), "important");
    el.style.setProperty("left", "50%", "important");
    el.style.setProperty("right", "auto", "important");
    el.style.setProperty("width", px(width), "important");
    el.style.setProperty("max-width", "calc(100vw - 8px)", "important");
    el.style.setProperty("max-height", px(maxHeight), "important");
    el.style.setProperty("height", "auto", "important");
    el.style.setProperty("margin", "0", "important");
    el.style.setProperty("margin-top", "0", "important");
    el.style.setProperty("margin-bottom", "0", "important");
    el.style.setProperty("transform", "translateX(-50%)", "important");
    el.style.setProperty("translate", "none", "important");
    el.style.setProperty("scale", "none", "important");
    el.style.setProperty("rotate", "none", "important");
    el.style.setProperty("box-sizing", "border-box", "important");
    el.style.setProperty("overflow", "auto", "important");
    el.style.setProperty("overscroll-behavior", "contain", "important");
    el.style.setProperty("z-index", el.id === "watany-form-viewer-root" ? "2147483060" : "2147482600", "important");

    return true;
  }

  function runCloseout() {
    if (typeof window.watanyV1RunSnappedPopupConsistencyAudit === "function") {
      try { window.watanyV1RunSnappedPopupConsistencyAudit(); } catch (e) {}
    }
    var nodes = collect();
    var applied = 0;
    nodes.forEach(function (el, idx) {
      if (forceOne(el, idx)) applied++;
    });

    document.documentElement.setAttribute("data-watany-v1-snapped-popup-header-closeout-ready", "true");
    document.documentElement.setAttribute("data-watany-v1-snapped-popup-header-closeout-version", "v2.1.1");
    document.documentElement.setAttribute("data-watany-v1-snapped-popup-header-closeout-count", String(applied));
    window.watanyV1SnappedPopupHeaderSnapCloseoutReady = true;
    window.watanyV1SnappedPopupHeaderSnapCloseoutVersion = "v2.1.1";
    window.watanyV1SnappedPopupHeaderSnapCloseoutCount = applied;
    return applied;
  }

  function init() {
    runCloseout();
    var pending = false;
    function schedule() {
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () {
        pending = false;
        runCloseout();
      });
    }

    window.addEventListener("resize", schedule, { passive: true });
    window.addEventListener("orientationchange", schedule, { passive: true });
    document.addEventListener("click", function () {
      setTimeout(schedule, 20);
      setTimeout(schedule, 90);
      setTimeout(schedule, 220);
      setTimeout(schedule, 650);
    }, true);

    var mo = new MutationObserver(schedule);
    mo.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "open", "aria-hidden"] });
    window.watanyV1RunSnappedPopupHeaderSnapCloseout = runCloseout;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
