
(function () {
  "use strict";
  // Runtime opt-out flag: allow applications to explicitly disable this feature.
  if (globalThis.__WATANY_DISABLE_WORLD_CUP_RUNTIME__ === true) return;

  var MARK = "watany-v1-world-cup-nine-icons-v170";
  if (window[MARK]) return;
  window[MARK] = true;
  if (window.watanyPublicRuntimeScopeV1 && !window.watanyPublicRuntimeScopeV1.shouldRun(MARK)) return;

  var ITEMS = [
    { label: "جدول المباريات", icon: "📅" },
    { label: "مباريات اليوم", icon: "⚽" },
    { label: "النتائج", icon: "🏁" },
    { label: "المجموعات", icon: "🏆" },
    { label: "التوقعات", icon: "🔮" },
    { label: "المفضلة", icon: "⭐" },
    { label: "التنبيهات", icon: "🔔" },
    { label: "غرف المشجعين", icon: "💬" },
    { label: "البث والروابط", icon: "📺" }
  ];

  function norm(s) {
    return String(s || "")
      .replace(/[\u064B-\u065F\u0670]/g, "")
      .replace(/[أإآ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function containsAny(text, list) {
    var n = norm(text);
    return list.some(function (x) { return n.indexOf(norm(x)) >= 0; });
  }

  function topOffset() {
    var nodes = Array.prototype.slice.call(document.querySelectorAll("header,[class*='header' i],[class*='top' i],[class*='nav' i]"));
    var best = 62;
    nodes.forEach(function (el) {
      var cs = getComputedStyle(el);
      var r = el.getBoundingClientRect();
      if ((cs.position === "fixed" || cs.position === "sticky") && r.height > 20 && r.top <= 12) {
        best = Math.max(best, Math.min(130, Math.round(r.bottom + 4)));
      }
    });
    document.documentElement.style.setProperty("--watany-v1-wc-top", best + "px");
    return best;
  }

  function closePopup() {
    var a = document.getElementById("watany-v1-wc-backdrop");
    if (a) a.remove();
    var b = document.getElementById("watany-v1-wc-popup");
    if (b) b.remove();
  }

  function setFlags() {
    document.documentElement.setAttribute("data-watany-v1-world-cup-nine-ready", "true");
    try {
      localStorage.setItem("watany_v1_world_cup_nine_icons_ready", "true");
    } catch (e) {}
  }



  var WORLD_CUP_SECTION_ROUTES = [
    "/world-cup?section=schedule",
    "/world-cup?section=today",
    "/world-cup?section=results",
    "/world-cup?section=groups",
    "/world-cup?section=predictions",
    "/world-cup?section=favorites",
    "/notifications?topic=world-cup",
    "/community?topic=world-cup",
    "/world-cup?section=tv-links"
  ];

  var WORLD_CUP_SECTION_KEYS = [
    "schedule",
    "today",
    "results",
    "groups",
    "predictions",
    "favorites",
    "reminders",
    "fan-rooms",
    "tv-links"
  ];

  function getWorldCupItemRoute(item, index) {
    if (item && item.route) return item.route;
    if (index >= 0 && index < WORLD_CUP_SECTION_ROUTES.length) return WORLD_CUP_SECTION_ROUTES[index];
    return "/world-cup";
  }

  function getWorldCupItemKey(item, index) {
    if (item && item.key) return item.key;
    if (index >= 0 && index < WORLD_CUP_SECTION_KEYS.length) return WORLD_CUP_SECTION_KEYS[index];
    return "world-cup";
  }

  function navigateToWorldCupRoute(route) {
    if (!route) route = "/world-cup";
    closePopup();
    try {
      if (window.history && window.history.pushState) {
        window.history.pushState({}, "", route);
        try {
          window.dispatchEvent(new PopStateEvent("popstate", { state: {} }));
        } catch (e1) {
          window.dispatchEvent(new Event("popstate"));
        }
        return;
      }
    } catch (e2) {}
    window.location.href = route;
  }

  function showWorldCupNine() {
    topOffset();
    closePopup();

    var backdrop = document.createElement("div");
    backdrop.id = "watany-v1-wc-backdrop";
    backdrop.className = "watany-v1-wc-backdrop";
    backdrop.addEventListener("click", closePopup);

    var panel = document.createElement("section");
    panel.id = "watany-v1-wc-popup";
    panel.className = "watany-v1-wc-popup";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("dir", "rtl");

    var head = document.createElement("div");
    head.className = "watany-v1-wc-head";

    var title = document.createElement("h2");
    title.className = "watany-v1-wc-title";
    title.textContent = "كأس العالم";

    var close = document.createElement("button");
    close.type = "button";
    close.className = "watany-v1-wc-close";
    close.textContent = "×";
    close.setAttribute("aria-label", "إغلاق");
    close.addEventListener("click", closePopup);

    head.appendChild(title);
    head.appendChild(close);
    panel.appendChild(head);

    var grid = document.createElement("div");
    grid.className = "watany-v1-wc-grid";
    grid.setAttribute("data-world-cup-grid-count", "9");

    ITEMS.slice(0, 9).forEach(function (item, index) {
      var card = document.createElement("button");
      card.type = "button";
      card.className = "watany-v1-wc-card";
      card.setAttribute("dir", "rtl");
      var route = getWorldCupItemRoute(item, index);
      var sectionKey = getWorldCupItemKey(item, index);
      card.setAttribute("data-world-cup-section-route", route);
      card.setAttribute("data-world-cup-section-key", sectionKey);
      card.setAttribute("data-route", route);
      card.setAttribute("data-feature-key", "world-cup-" + sectionKey);
      var targetRoute = getWorldCupItemRoute(item, index);
      var sectionKey = WORLD_CUP_SECTION_KEYS[index] || ("section-" + index);
      card.setAttribute("data-route", targetRoute);
      card.setAttribute("data-href", targetRoute);
      card.setAttribute("data-feature-key", "world-cup");
      card.setAttribute("data-world-cup-section", sectionKey);
      card.setAttribute("data-watany-v1-world-cup-child-endpoint", "true");
      card.setAttribute("aria-label", item.label || sectionKey);
      card.setAttribute("title", item.label || sectionKey);

      var icon = document.createElement("span");
      icon.className = "watany-v1-wc-icon";
      icon.textContent = item.icon;

      var label = document.createElement("span");
      label.className = "watany-v1-wc-label";
      label.textContent = item.label;

      card.appendChild(icon);
      card.appendChild(label);
      card.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
        navigateToWorldCupRoute(targetRoute);
        return false;
      });
      card.setAttribute("data-watany-world-cup-child-endpoint-ready", "true");
      card.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
        navigateToWorldCupRoute(route);
        return false;
      });
      card.setAttribute("data-watany-world-cup-child-click-marker", "WATANY_WORLD_CUP_CHILD_ENDPOINT_CLICK_V3_2_3");
      grid.appendChild(card);
    });

    panel.appendChild(grid);

    var note = document.createElement("p");
    note.className = "watany-v1-wc-note";
    note.textContent = "تم ترتيب كأس العالم في ٩ أيقونات فقط مع تكبير الأيقونات لتكون أوضح على الهاتف.";
    panel.appendChild(note);

    document.body.appendChild(backdrop);
    document.body.appendChild(panel);
  }

  function isInteractive(el) {
    if (!el || !el.textContent) return false;
    var tag = (el.tagName || "").toLowerCase();
    return tag === "a" || tag === "button" || el.getAttribute("role") === "button" || /card|tile|item|nav|menu/i.test(el.className || "");
  }

  function nearestInteractive(start) {
    var el = start;
    var depth = 0;
    while (el && depth < 7 && el !== document.body) {
      if (isInteractive(el)) return el;
      el = el.parentElement;
      depth++;
    }
    return start;
  }

  function shouldIgnoreAgent5Navigation(target) {
    var el = target;
    var depth = 0;
    while (el && depth < 7 && el !== document.body) {
      var key = el.getAttribute && (el.getAttribute("data-feature-key") || el.getAttribute("data-route") || el.getAttribute("href"));
      if (key && /world|cup|كأس|kass|worldcup/i.test(key)) return false;
      if (el.classList && (el.classList.contains("kw-child-item") || el.classList.contains("kw-main-card"))) return true;
      el = el.parentElement;
      depth++;
    }
    return false;
  }

  function getRouteTarget(node) {
    if (!node || !node.closest) return null;
    return node.closest("a[href], button[data-route], [data-route], [data-href]");
  }

  function isLegacyLauncherNode(node) {
    return !!(node && node.closest && node.closest(".watany-drawer-page, .watany-drawer-phone, .watany-icon-grid, .watany-app-icon, .watany-mobile-shell__drawer-handle"));
  }

  function shouldIgnoreRouterOwnedNavigation(target) {
    var routeNode = getRouteTarget(target);
    var route = routeNode ? (routeNode.getAttribute("href") || routeNode.getAttribute("data-route") || routeNode.getAttribute("data-href") || "") : "";
    if (/(^|\/+)world-cup(?:[/?#]|$)/i.test(route)) return false;
    return false;
  }

  function wireTiles() {
    var nodes = Array.prototype.slice.call(document.querySelectorAll("a,button,[role='button'],[class*='tile' i],[class*='card' i]"));
    nodes.forEach(function (node) {
      if (shouldIgnoreRouterOwnedNavigation(node)) return;
      if (node.getAttribute("data-watany-v1-world-cup-wired") === "true") return;
      var text = node.textContent || "";
      if (containsAny(text, ["كأس العالم", "كاس العالم", "World Cup", "world cup"])) {
        node.setAttribute("data-watany-v1-world-cup-wired", "true");
        node.addEventListener("click", function (ev) {
          if (shouldIgnoreAgent5Navigation(ev.target)) return;
          ev.preventDefault();
          ev.stopPropagation();
          if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
          showWorldCupNine();
          return false;
        }, true);
      }
    });
  }

  function router(ev) {
    if (shouldIgnoreRouterOwnedNavigation(ev.target)) return;
    if (shouldIgnoreAgent5Navigation(ev.target)) return;
    var target = nearestInteractive(ev.target);
    var text = target && target.textContent ? target.textContent : "";
    if (containsAny(text, ["كأس العالم", "كاس العالم", "World Cup", "world cup"])) {
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      showWorldCupNine();
      return false;
    }
  }

  function init() {
    setFlags();
    topOffset();
    wireTiles();
    document.addEventListener("click", router, true);
    window.addEventListener("resize", topOffset);
    window.watanyV1ShowWorldCupNine = showWorldCupNine;
    window.watanyV1CloseWorldCupNine = closePopup;
    window.watanyV1WorldCupNineReady = true;
    var mo = new MutationObserver(function () {
      setFlags();
      topOffset();
      wireTiles();
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
