
(function () {
  "use strict";
  var MARK = "watany-v1-procedures-source-polish-v190";
  if (window[MARK]) return;
  window[MARK] = true;
  if (window.watanyPublicRuntimeScopeV1 && !window.watanyPublicRuntimeScopeV1.shouldRun(MARK)) return;

  var SOURCE_RULES = [
    { name: "الجيش اللبناني", rx: /(الجيش|قيادة الجيش|LAF|Lebanese Armed Forces|وزارة الدفاع|الدفاع)/i },
    { name: "قوى الأمن الداخلي", rx: /(قوى الأمن|قوى الامن|الأمن الداخلي|الامن الداخلي|ISF|Internal Security)/i },
    { name: "الأمن العام", rx: /(الأمن العام|الامن العام|General Security|General Directorate)/i },
    { name: "أمن الدولة", rx: /(أمن الدولة|امن الدولة|State Security)/i },
    { name: "الجمارك", rx: /(الجمارك|Customs)/i },
    { name: "شرطة مجلس النواب", rx: /(شرطة مجلس النواب|مجلس النواب|Parliament Police)/i },
    { name: "وزارة المالية", rx: /(وزارة المالية|المالية|Finance|MOF)/i },
    { name: "الصندوق والتعاضد", rx: /(الصندوق|تعاضد|تعاونية|Cooperative|Fund)/i }
  ];

  var PROCEDURE_HINTS = [
    "الإجراءات", "الاجراءات", "المعاملات", "معاملاتي", "المراجع", "النماذج", "طلبات",
    "Procedures", "Official Services", "Transactions"
  ];

  function norm(s) {
    return String(s || "")
      .replace(/[\u064B-\u065F\u0670]/g, "")
      .replace(/[أإآ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/\s+/g, " ")
      .trim();
  }

  function includesAny(text, list) {
    var n = norm(text).toLowerCase();
    return list.some(function (x) { return n.indexOf(norm(x).toLowerCase()) >= 0; });
  }

  function getSource(text) {
    for (var i = 0; i < SOURCE_RULES.length; i += 1) {
      if (SOURCE_RULES[i].rx.test(text || "")) return SOURCE_RULES[i].name;
    }
    return "مصادر عامة";
  }

  function isProceduresPage() {
    var path = location.pathname.toLowerCase();
    if (/procedure|procedures|official|services|transactions|forms|معامل|اجراء/.test(path)) return true;
    var bodyText = document.body ? document.body.innerText || "" : "";
    return includesAny(bodyText.slice(0, 5000), PROCEDURE_HINTS);
  }

  function mainRoot() {
    return document.querySelector("main,[role='main'],#root") || document.body;
  }

  function topOffset() {
    var nodes = Array.prototype.slice.call(document.querySelectorAll("header,[class*='header' i],[class*='top' i],[class*='nav' i]"));
    var best = 62;
    nodes.forEach(function (el) {
      var cs = getComputedStyle(el);
      var r = el.getBoundingClientRect();
      if ((cs.position === "fixed" || cs.position === "sticky") && r.height > 20 && r.top <= 12) {
        best = Math.max(best, Math.min(132, Math.round(r.bottom + 4)));
      }
    });
    document.documentElement.style.setProperty("--watany-v1-procedures-top", best + "px");
    return best;
  }

  function findTitle(root) {
    var headings = Array.prototype.slice.call(root.querySelectorAll("h1,h2,.page-title,[class*='title' i]"));
    for (var i = 0; i < headings.length; i += 1) {
      var t = headings[i].textContent || "";
      if (includesAny(t, PROCEDURE_HINTS)) return headings[i];
    }
    var firstH = headings.find(function (h) { return (h.textContent || "").trim().length > 2; });
    return firstH || null;
  }

  function ensureTitle(root) {
    var title = findTitle(root);
    if (title) {
      title.classList.add("watany-v1-procedures-title-polished");
      if (!includesAny(title.textContent || "", PROCEDURE_HINTS)) {
        title.setAttribute("data-watany-v1-procedures-title-original", title.textContent || "");
      }
      return title;
    }
    var h = document.createElement("h1");
    h.className = "watany-v1-procedures-title-polished";
    h.textContent = "الإجراءات والمعاملات";
    var target = root === document.body ? document.body.firstChild : root.firstChild;
    root.insertBefore(h, target);
    return h;
  }

  function candidateElements(root) {
    var selectors = [
      "article", "li", "tr",
      "a[href]", "button",
      "[role='button']",
      "[class*='card' i]",
      "[class*='item' i]",
      "[class*='procedure' i]",
      "[class*='service' i]",
      "[class*='form' i]"
    ];
    var nodes = Array.prototype.slice.call(root.querySelectorAll(selectors.join(",")));
    var seen = new Set();
    var items = [];
    nodes.forEach(function (el) {
      if (!el || seen.has(el)) return;
      seen.add(el);
      if (el.closest(".watany-v1-procedures-group-panel")) return;
      var text = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
      if (text.length < 8 || text.length > 260) return;
      if (/تحميل|مشاركة|طباعة|تكبير|تصغير|إغلاق/.test(text)) return;
      var score = 0;
      if (SOURCE_RULES.some(function (r) { return r.rx.test(text); })) score += 3;
      if (/(إفادة|طلب|معاملة|نموذج|مستند|تصريح|رخصة|راتب|تعويض|مساعدة|وفاة|طبابة|مدرسية|استفادة|استمارة|procedure|form|service|request)/i.test(text)) score += 2;
      if (el.matches("a[href],button,[role='button']")) score += 1;
      if (score <= 0) return;
      items.push({ el: el, text: text, source: getSource(text), score: score });
    });

    items.sort(function (a, b) { return b.score - a.score; });

    var unique = [];
    var texts = new Set();
    items.forEach(function (item) {
      var key = norm(item.text).slice(0, 90);
      if (texts.has(key)) return;
      texts.add(key);
      unique.push(item);
    });
    return unique.slice(0, 80);
  }

  function addBadges(items) {
    items.forEach(function (item) {
      if (!item.el || item.el.getAttribute("data-watany-v1-procedures-badged") === "true") return;
      item.el.setAttribute("data-watany-v1-procedures-badged", "true");
      var badge = document.createElement("span");
      badge.className = "watany-v1-procedures-source-badge";
      badge.textContent = item.source;
      var target = item.el.querySelector("h2,h3,h4,.title,[class*='title' i]") || item.el;
      try {
        target.appendChild(badge);
      } catch (err) {}
    });
  }

  function activateItem(item) {
    var el = item.el;
    if (!el) return;
    var a = el.matches && el.matches("a[href]") ? el : el.querySelector && el.querySelector("a[href]");
    if (a && a.href) {
      window.location.href = a.href;
      return;
    }
    var btn = el.matches && (el.matches("button,[role='button']")) ? el : el.querySelector && el.querySelector("button,[role='button']");
    if (btn) {
      btn.click();
      return;
    }
    try { el.click(); } catch (err) {}
  }

  function buildPanel(root, items) {
    var existing = document.getElementById("watany-v1-procedures-group-panel");
    if (existing) existing.remove();

    var groups = {};
    items.forEach(function (item) {
      if (!groups[item.source]) groups[item.source] = [];
      groups[item.source].push(item);
    });

    var names = Object.keys(groups).sort(function (a, b) {
      if (a === "مصادر عامة") return 1;
      if (b === "مصادر عامة") return -1;
      return a.localeCompare(b, "ar");
    });

    if (names.length < 1 || items.length < 2) {
      document.documentElement.setAttribute("data-watany-v1-procedures-groups", "0");
      return null;
    }

    var panel = document.createElement("section");
    panel.id = "watany-v1-procedures-group-panel";
    panel.className = "watany-v1-procedures-group-panel";
    panel.setAttribute("dir", "rtl");
    panel.setAttribute("data-testid", "watany-procedures-source-groups");

    var title = document.createElement("h2");
    title.className = "watany-v1-procedures-group-panel-title";
    title.textContent = "الإجراءات مجمّعة حسب المصدر";
    panel.appendChild(title);

    var subtitle = document.createElement("p");
    subtitle.className = "watany-v1-procedures-group-panel-subtitle";
    subtitle.textContent = "اختر المصدر أولاً لتصل بسرعة إلى المعاملة أو النموذج المطلوب.";
    panel.appendChild(subtitle);

    names.forEach(function (name, index) {
      var details = document.createElement("details");
      details.className = "watany-v1-procedures-source-group";
      if (index < 3) details.open = true;
      details.setAttribute("data-procedure-source", name);

      var summary = document.createElement("summary");
      summary.className = "watany-v1-procedures-source-summary";
      var label = document.createElement("span");
      label.textContent = name;
      var count = document.createElement("span");
      count.className = "watany-v1-procedures-source-count";
      count.textContent = String(groups[name].length);
      summary.appendChild(label);
      summary.appendChild(count);

      var list = document.createElement("div");
      list.className = "watany-v1-procedures-item-list";

      groups[name].slice(0, 12).forEach(function (item) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = "watany-v1-procedures-item";
        button.setAttribute("data-procedure-source", name);
        var cleanText = item.text.replace(name, "").replace(/\s+/g, " ").trim();
        if (!cleanText) cleanText = item.text;
        button.textContent = cleanText;
        button.addEventListener("click", function () { activateItem(item); });
        list.appendChild(button);
      });

      details.appendChild(summary);
      details.appendChild(list);
      panel.appendChild(details);
    });

    var titleEl = root.querySelector(".watany-v1-procedures-title-polished");
    if (titleEl && titleEl.parentNode) {
      titleEl.insertAdjacentElement("afterend", panel);
    } else {
      root.insertBefore(panel, root.firstChild);
    }

    document.documentElement.setAttribute("data-watany-v1-procedures-groups", String(names.length));
    document.documentElement.setAttribute("data-watany-v1-procedures-items", String(items.length));
    return panel;
  }

  function applyPolish() {
    topOffset();
    if (!isProceduresPage()) return false;
    var root = mainRoot();
    document.body.classList.add("watany-v1-procedures-polish-active");
    ensureTitle(root);
    var items = candidateElements(root);
    addBadges(items);
    buildPanel(root, items);
    document.documentElement.setAttribute("data-watany-v1-procedures-polish-ready", "true");
    window.watanyV1ProceduresPolishReady = true;
    window.watanyV1ProceduresPolishItemCount = items.length;
    return true;
  }

  function scheduleApply() {
    window.clearTimeout(scheduleApply._t);
    scheduleApply._t = window.setTimeout(applyPolish, 220);
  }

  function init() {
    topOffset();
    window.watanyV1ApplyProceduresPolish = applyPolish;
    scheduleApply();
    window.addEventListener("resize", topOffset);
    window.addEventListener("hashchange", scheduleApply);
    window.addEventListener("popstate", scheduleApply);
    var lastPath = location.pathname + location.search + location.hash;
    window.setInterval(function () {
      var now = location.pathname + location.search + location.hash;
      if (now !== lastPath) {
        lastPath = now;
        scheduleApply();
      }
    }, 650);
    var mo = new MutationObserver(function () {
      if (document.body && document.body.classList.contains("watany-v1-procedures-polish-active")) scheduleApply();
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
