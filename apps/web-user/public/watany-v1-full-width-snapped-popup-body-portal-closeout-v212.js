
(function () {
  "use strict";
  var MARK = "watany-v1-full-width-snapped-popup-body-portal-closeout-v212";
  if (window[MARK]) return;
  window[MARK] = true;

  function num(value) {
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

  function isSafeChat(el) {
    return !!(el && (el.matches('[data-watany-safe-chat="true"]') || (el.closest && el.closest('[data-watany-safe-chat="true"]'))));
  }

  function isRecoveryMenu(el) {
    return !!(el && (el.matches('[data-watany-recovery-menu-open="true"], [data-watany-recovery-menu="true"], .watany-recovery-menu-layer, .watany-recovery-menu-panel') || (el.closest && el.closest('[data-watany-recovery-menu-open="true"], [data-watany-recovery-menu="true"], .watany-recovery-menu-layer, .watany-recovery-menu-panel'))));
  }

  function clearForcedSnap(el) {
    if (!el || !el.style) return;
    el.classList.remove("watany-v1-body-portal-snap-closeout");
    el.removeAttribute("data-watany-v1-body-portal-snap-closeout");
    el.removeAttribute("data-watany-v1-body-portal-snap-index");
    [
      "--watany-v1-body-portal-top-px",
      "--watany-v1-body-portal-bottom-px",
      "--watany-v1-body-portal-width-px",
      "--watany-v1-body-portal-max-height-px",
      "top",
      "bottom",
      "left",
      "right",
      "width",
      "max-width",
      "height",
      "max-height",
      "margin",
      "margin-top",
      "margin-right",
      "margin-bottom",
      "margin-left",
      "overflow",
      "overscroll-behavior",
      "-webkit-overflow-scrolling",
      "z-index"
    ].forEach(function (name) {
      el.style.removeProperty(name);
    });
  }

  function headerBottom() {
    var selectors = ".kw-top-header, .watany-top-header, header[style*='sticky'], header[style*='fixed'], [data-testid*='header' i], .sticky-header, .top-header, header";
    var bottom = 0;
    Array.prototype.slice.call(document.querySelectorAll(selectors)).forEach(function (el) {
      if (!visible(el)) return;
      var cs = getComputedStyle(el);
      if (cs.position !== "sticky" && cs.position !== "fixed") return;
      var r = el.getBoundingClientRect();
      if (r.top > window.innerHeight * 0.45) return;
      bottom = Math.max(bottom, r.bottom);
    });
    return Math.min(Math.max(0, bottom), Math.floor(window.innerHeight * 0.46));
  }

  function footerGap() {
    var selectors = ".kw-bottom-nav, .kw-bottom-chat, .watany-bottom-chat, .watany-hybrid-chat, [data-testid*='bottom' i], [data-testid*='footer' i], footer, nav";
    var top = window.innerHeight;
    Array.prototype.slice.call(document.querySelectorAll(selectors)).forEach(function (el) {
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
    var list = Array.prototype.slice.call(document.querySelectorAll(
      '[data-watany-v1-header-snap-closeout="v2.1.1"], [data-watany-v1-snapped-popup="true"], .watany-v1-snapped-popup-overlay, .kw-group-sheet, .kw-bottom-sheet, .kw-feature-sheet, [role="dialog"]'
    ));
    var out = [];
    list.forEach(function (el) {
      if (isSafeChat(el)) {
        clearForcedSnap(el);
        return;
      }
      if (isHybridLauncher(el)) {
        clearForcedSnap(el);
        return;
      }
      if (isRecoveryMenu(el)) {
        clearForcedSnap(el);
        return;
      }
      if (out.indexOf(el) < 0 && visible(el) && el.id !== "root" && !el.closest('.popup-overlay') && !(el.closest && el.closest('[data-watany-universal-feature-menu]'))) out.push(el);
    });
    return out.slice(0, 50);
  }

  function shouldKeepInReactTree(el) {
    if (!el || !el.classList) return false;
    if (el.classList.contains("market-commerce-sheet")) return true;
    return !!(el.closest && el.closest("#root"));
  }

  function moveToBody(el) {
    if (!el || el.parentNode === document.body) return false;
    if (el.closest && el.closest('.popup-overlay')) return false;
    if (el.closest && el.closest('[data-watany-universal-feature-menu]')) return false;
    if (shouldKeepInReactTree(el)) return false;
    el.setAttribute("data-watany-v1-original-parent", el.parentNode && (el.parentNode.id || el.parentNode.className || el.parentNode.tagName) || "");
    document.body.appendChild(el);
    el.setAttribute("data-watany-v1-body-portal", "v2.1.2");
    return true;
  }

  function forceSnap(el, idx) {
    if (el && el.id === "watany-form-viewer-root") return false;
    if (isSafeChat(el)) {
      clearForcedSnap(el);
      return false;
    }
    if (isHybridLauncher(el)) {
      clearForcedSnap(el);
      return false;
    }
    if (isRecoveryMenu(el)) {
      clearForcedSnap(el);
      return false;
    }
    if (!visible(el)) return false;

    if (typeof window.watanyV1RunSnappedPopupConsistencyAudit === "function") {
      try { window.watanyV1RunSnappedPopupConsistencyAudit(); } catch (e) {}
    }

    var cs0 = getComputedStyle(el);
    var expectedTop0 = Math.max(headerBottom(), num(cs0.getPropertyValue("--watany-v1-header-snap-top-px")), num(cs0.getPropertyValue("--watany-v1-snap-top")), 0);
    var rect0 = el.getBoundingClientRect();

    if (rect0.top < expectedTop0 - 2 || el.parentNode !== document.body) {
      moveToBody(el);
    }

    var cs = getComputedStyle(el);
    var top = Math.max(headerBottom(), num(cs.getPropertyValue("--watany-v1-header-snap-top-px")), num(cs.getPropertyValue("--watany-v1-snap-top")), 0);
    var bottom = Math.max(footerGap(), num(cs.getPropertyValue("--watany-v1-header-snap-bottom-px")), num(cs.getPropertyValue("--watany-v1-snap-bottom")), 0);
    var width = Math.min(window.innerWidth - 8, 430);
    var maxHeight = Math.max(160, window.innerHeight - top - bottom - 10);

    el.classList.add("watany-v1-body-portal-snap-closeout");
    el.setAttribute("data-watany-v1-body-portal-snap-closeout", "v2.1.2");
    el.setAttribute("data-watany-v1-body-portal-snap-index", String(idx));

    el.style.setProperty("--watany-v1-body-portal-top-px", px(top), "important");
    el.style.setProperty("--watany-v1-body-portal-bottom-px", px(bottom), "important");
    el.style.setProperty("--watany-v1-body-portal-width-px", px(width), "important");
    el.style.setProperty("--watany-v1-body-portal-max-height-px", px(maxHeight), "important");

    el.style.setProperty("position", "fixed", "important");
    el.style.setProperty("inset", "auto", "important");
    el.style.setProperty("top", px(top), "important");
    el.style.setProperty("bottom", px(bottom), "important");
    el.style.setProperty("left", "50%", "important");
    el.style.setProperty("right", "auto", "important");
    el.style.setProperty("width", px(width), "important");
    el.style.setProperty("max-width", "calc(100vw - 8px)", "important");
    el.style.setProperty("height", el.id === "watany-form-viewer-root" ? px(maxHeight) : "auto", "important");
    el.style.setProperty("max-height", px(maxHeight), "important");
    el.style.setProperty("margin", "0", "important");
    el.style.setProperty("margin-top", "0", "important");
    el.style.setProperty("margin-right", "0", "important");
    el.style.setProperty("margin-bottom", "0", "important");
    el.style.setProperty("margin-left", "0", "important");
    el.style.setProperty("transform", "translateX(-50%)", "important");
    el.style.setProperty("translate", "none", "important");
    el.style.setProperty("scale", "none", "important");
    el.style.setProperty("rotate", "none", "important");
    el.style.setProperty("box-sizing", "border-box", "important");
    el.style.setProperty("overflow", "auto", "important");
    el.style.setProperty("overscroll-behavior", "contain", "important");
    el.style.setProperty("-webkit-overflow-scrolling", "touch", "important");
    el.style.setProperty("z-index", el.id === "watany-form-viewer-root" ? "2147483060" : "2147482700", "important");

    return true;
  }

  function runCloseout() {
    if (typeof window.watanyV1RunSnappedPopupHeaderSnapCloseout === "function") {
      try { window.watanyV1RunSnappedPopupHeaderSnapCloseout(); } catch (e) {}
    }
    var overlays = collect();
    var count = 0;
    overlays.forEach(function (el, idx) {
      if (forceSnap(el, idx)) count++;
    });
    document.documentElement.setAttribute("data-watany-v1-snapped-popup-body-portal-ready", "true");
    document.documentElement.setAttribute("data-watany-v1-snapped-popup-body-portal-version", "v2.1.2");
    document.documentElement.setAttribute("data-watany-v1-snapped-popup-body-portal-count", String(count));
    window.watanyV1SnappedPopupBodyPortalCloseoutReady = true;
    window.watanyV1SnappedPopupBodyPortalCloseoutVersion = "v2.1.2";
    window.watanyV1SnappedPopupBodyPortalCloseoutCount = count;
    return count;
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
      setTimeout(schedule, 700);
    }, true);
    var mo = new MutationObserver(schedule);
    mo.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "open", "aria-hidden"] });
    window.watanyV1RunSnappedPopupBodyPortalCloseout = runCloseout;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
