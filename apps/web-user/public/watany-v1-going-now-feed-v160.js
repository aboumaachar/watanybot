
(function () {
  "use strict";
  var MARK = "watany-v1-going-now-feed-v160";
  if (window[MARK]) return;
  window[MARK] = true;
  if (window.watanyPublicRuntimeScopeV1 && !window.watanyPublicRuntimeScopeV1.shouldRun(MARK)) return;

  var NOW_ITEMS = [
    { key: "market", label: "السوق", icon: "🛒", detail: "إعلانات بيع وشراء وخدمات جديدة", badge: "قابل للتصفح الآن" },
    { key: "jobs", label: "الوظائف", icon: "💼", detail: "فرص مدنية وعمل حر وتطوع", badge: "فرص اليوم" },
    { key: "deaths", label: "الوفيات", icon: "🕊️", detail: "آخر بيانات الوفيات الرسمية المتاحة", badge: "تحديثات رسمية" },
    { key: "announcements", label: "التعاميم", icon: "📢", detail: "تعاميم وإعلانات إدارية مهمة", badge: "مهم" },
    { key: "ads", label: "الإعلانات", icon: "📣", detail: "إعلانات المجتمع والخدمات العامة", badge: "جديد" },
    { key: "help", label: "طلبات المساعدة", icon: "🤝", detail: "طلبات ومبادرات تحتاج متابعة", badge: "مجتمعي" }
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

  function isAgent5Node(node) {
    return !!(
      node &&
      node.closest &&
      node.closest('.kw-agent5-root, .kw-profile-sheet, .kw-group-sheet, .kw-child-grid, .kw-child-item')
    );
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
    document.documentElement.style.setProperty("--watany-v1-now-top", best + "px");
    return best;
  }

  function closePopup() {
    var a = document.getElementById("watany-v1-now-backdrop");
    if (a) a.remove();
    var b = document.getElementById("watany-v1-now-popup");
    if (b) b.remove();
  }

  function setFlags() {
    document.documentElement.setAttribute("data-watany-v1-going-now-ready", "true");
    try {
      localStorage.setItem("watany_v1_going_now_ready", "true");
    } catch (e) {}
  }

  function showGoingNow() {
    topOffset();
    closePopup();

    var backdrop = document.createElement("div");
    backdrop.id = "watany-v1-now-backdrop";
    backdrop.className = "watany-v1-now-backdrop";
    backdrop.addEventListener("click", closePopup);

    var panel = document.createElement("section");
    panel.id = "watany-v1-now-popup";
    panel.className = "watany-v1-now-popup";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("dir", "rtl");

    var head = document.createElement("div");
    head.className = "watany-v1-now-head";

    var title = document.createElement("h2");
    title.className = "watany-v1-now-title";
    title.textContent = "يجري الآن";

    var close = document.createElement("button");
    close.type = "button";
    close.className = "watany-v1-now-close";
    close.textContent = "×";
    close.setAttribute("aria-label", "إغلاق");
    close.addEventListener("click", closePopup);

    head.appendChild(title);
    head.appendChild(close);
    panel.appendChild(head);

    var summary = document.createElement("p");
    summary.className = "watany-v1-now-summary";
    summary.textContent = "ملخص سريع لما يحدث الآن داخل الوظائف، السوق، الوفيات، التعاميم، الإعلانات، وطلبات المساعدة.";
    panel.appendChild(summary);

    var list = document.createElement("div");
    list.className = "watany-v1-now-list";

    NOW_ITEMS.forEach(function (item) {
      var row = document.createElement("article");
      row.className = "watany-v1-now-item";
      row.setAttribute("data-now-key", item.key);
      row.setAttribute("dir", "rtl");

      var icon = document.createElement("span");
      icon.className = "watany-v1-now-icon";
      icon.textContent = item.icon;

      var main = document.createElement("span");
      main.className = "watany-v1-now-main";

      var label = document.createElement("span");
      label.className = "watany-v1-now-label";
      label.textContent = item.label;

      var detail = document.createElement("span");
      detail.className = "watany-v1-now-detail";
      detail.textContent = item.detail;

      var badge = document.createElement("span");
      badge.className = "watany-v1-now-badge";
      badge.textContent = item.badge;

      main.appendChild(label);
      main.appendChild(detail);
      main.appendChild(badge);

      row.appendChild(icon);
      row.appendChild(main);
      list.appendChild(row);
    });

    panel.appendChild(list);
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

  function wireTiles() {
    var nodes = Array.prototype.slice.call(document.querySelectorAll("a,button,[role='button'],[class*='tile' i],[class*='card' i]"));
    nodes.forEach(function (node) {
      if (isAgent5Node(node)) return;
      if (node.getAttribute("data-watany-v1-going-now-wired") === "true") return;
      var text = node.textContent || "";
      if (containsAny(text, ["يجري الآن", "يجري الان", "Going now", "going now", "now"])) {
        node.setAttribute("data-watany-v1-going-now-wired", "true");
        node.addEventListener("click", function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
          showGoingNow();
          return false;
        }, true);
      }
    });
  }

  function router(ev) {
    var target = nearestInteractive(ev.target);
    if (isAgent5Node(target)) return;
    var text = target && target.textContent ? target.textContent : "";
    if (containsAny(text, ["يجري الآن", "يجري الان", "Going now", "going now"])) {
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      showGoingNow();
      return false;
    }
  }

  function init() {
    setFlags();
    topOffset();
    wireTiles();
    document.addEventListener("click", router, true);
    window.addEventListener("resize", topOffset);
    window.watanyV1ShowGoingNow = showGoingNow;
    window.watanyV1CloseGoingNow = closePopup;
    window.watanyV1GoingNowReady = true;
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
