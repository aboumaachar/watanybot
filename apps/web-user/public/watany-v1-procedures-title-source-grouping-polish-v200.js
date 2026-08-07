
(function () {
  "use strict";
  var MARK = "watany-v1-procedures-title-source-grouping-polish-v200";
  if (window[MARK]) return;
  window[MARK] = true;
  if (window.watanyPublicRuntimeScopeV1 && !window.watanyPublicRuntimeScopeV1.shouldRun(MARK)) return;

  var SOURCES = [
    {
      key: "laf",
      title: "الجيش اللبناني",
      icon: "ph ph-shield-star",
      aliases: ["الجيش", "الجيش اللبناني", "قيادة الجيش", "وزارة الدفاع", "الدفاع"],
      fallback: ["معاملات التقاعد", "الإفادات العسكرية", "المساعدات المدرسية"]
    },
    {
      key: "isf",
      title: "قوى الأمن الداخلي",
      icon: "ph ph-police-car",
      aliases: ["قوى الأمن", "الامن الداخلي", "قوى الامن", "isf"],
      fallback: ["طلبات المنتسبين", "إفادات الخدمة", "المعاملات الإدارية"]
    },
    {
      key: "general-security",
      title: "الأمن العام",
      icon: "ph ph-identification-badge",
      aliases: ["الأمن العام", "الامن العام", "general security"],
      fallback: ["المراجعات الرسمية", "طلبات الإفادات", "مستندات المعاملة"]
    },
    {
      key: "state-security",
      title: "أمن الدولة",
      icon: "ph ph-lock-key",
      aliases: ["أمن الدولة", "امن الدولة", "state security"],
      fallback: ["متابعة المعاملات", "الإجراءات الإدارية"]
    },
    {
      key: "customs",
      title: "الجمارك",
      icon: "ph ph-stamp",
      aliases: ["الجمارك", "customs"],
      fallback: ["طلبات الجمارك", "مراجعات الإدارة"]
    },
    {
      key: "official",
      title: "خدمات رسمية أخرى",
      icon: "ph ph-buildings",
      aliases: ["وزارة", "مالية", "رسمية", "مختار", "بلدية", "moF", "وزارة المالية"],
      fallback: ["روابط مفيدة", "نماذج رسمية", "إجراءات عامة"]
    }
  ];

  function norm(value) {
    return String(value || "")
      .replace(/[\u064B-\u065F\u0670]/g, "")
      .replace(/[أإآ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function isProceduresRoute() {
    var p = norm(location.pathname + " " + location.hash);
    return p.indexOf("procedures") >= 0
      || p.indexOf("procedure") >= 0
      || p.indexOf("official-services") >= 0
      || p.indexOf("معاملات") >= 0
      || p.indexOf("اجراءات") >= 0;
  }

  function collectExistingProcedures() {
    var nodes = Array.prototype.slice.call(document.querySelectorAll("main a, main button, main [role='button'], main li, main article, main .card, main [class*='procedure' i], main [class*='service' i]"));
    var seen = {};
    var rows = [];
    nodes.forEach(function (node) {
      if (!node || node.closest("#watany-v1-procedures-source-grouping-polish")) return;
      var text = String(node.textContent || "").replace(/\s+/g, " ").trim();
      if (text.length < 4 || text.length > 120) return;
      var n = norm(text);
      if (seen[n]) return;
      seen[n] = true;
      var href = node.getAttribute && node.getAttribute("href");
      rows.push({ text: text, href: href || "", norm: n });
    });
    return rows.slice(0, 80);
  }

  function groupRows(rows) {
    var groups = {};
    SOURCES.forEach(function (s) { groups[s.key] = []; });

    rows.forEach(function (row) {
      var selected = null;
      SOURCES.forEach(function (source) {
        if (selected) return;
        if (source.aliases.some(function (a) { return row.norm.indexOf(norm(a)) >= 0; })) {
          selected = source.key;
        }
      });
      if (!selected) selected = "official";
      groups[selected].push(row);
    });

    SOURCES.forEach(function (source) {
      if (groups[source.key].length === 0) {
        source.fallback.forEach(function (label) {
          groups[source.key].push({ text: label, href: "", norm: norm(label), fallback: true });
        });
      }
      groups[source.key] = groups[source.key].slice(0, 6);
    });

    return groups;
  }

  function makeCard(row) {
    var card = document.createElement(row.href ? "a" : "button");
    if (row.href) card.href = row.href;
    else card.type = "button";
    card.className = "watany-procedures-polish-card";
    card.setAttribute("dir", "rtl");
    card.setAttribute("data-testid", "procedures-polish-card");
    if (row.fallback) card.setAttribute("data-fallback", "true");

    var label = document.createElement("span");
    label.className = "watany-procedures-polish-card-label";
    label.textContent = row.text;

    var hint = document.createElement("span");
    hint.className = "watany-procedures-polish-card-hint";
    hint.textContent = row.fallback ? "جاهز للتنظيم ضمن المصدر" : "افتح التفاصيل";

    card.appendChild(label);
    card.appendChild(hint);
    return card;
  }

  function build() {
    var existingRows = collectExistingProcedures();
    var grouped = groupRows(existingRows);

    var root = document.createElement("section");
    root.id = "watany-v1-procedures-source-grouping-polish";
    root.className = "watany-procedures-polish";
    root.setAttribute("dir", "rtl");
    root.setAttribute("data-testid", "procedures-source-grouping-polish");

    var hero = document.createElement("header");
    hero.className = "watany-procedures-polish-hero";

    var eyebrow = document.createElement("div");
    eyebrow.className = "watany-procedures-polish-eyebrow";
    eyebrow.textContent = "دليل المعاملات";

    var title = document.createElement("h1");
    title.className = "watany-procedures-polish-title";
    title.textContent = "المعاملات والإجراءات";

    var subtitle = document.createElement("p");
    subtitle.className = "watany-procedures-polish-subtitle";
    subtitle.textContent = "صفحة منظّمة حسب المصدر لتسهيل الوصول إلى الإجراء الصحيح بسرعة.";

    hero.appendChild(eyebrow);
    hero.appendChild(title);
    hero.appendChild(subtitle);

    var grid = document.createElement("div");
    grid.className = "watany-procedures-polish-source-grid";
    grid.setAttribute("data-testid", "procedures-source-grid");

    SOURCES.forEach(function (source) {
      var group = document.createElement("article");
      group.className = "watany-procedures-polish-source";
      group.setAttribute("data-source-key", source.key);
      group.setAttribute("data-testid", "procedures-source-group");

      var head = document.createElement("div");
      head.className = "watany-procedures-polish-source-head";

      var icon = document.createElement("i");
      icon.className = source.icon + " watany-app-icon";
      icon.setAttribute("aria-hidden", "true");

      var h = document.createElement("h2");
      h.textContent = source.title;

      head.appendChild(icon);
      head.appendChild(h);

      var cards = document.createElement("div");
      cards.className = "watany-procedures-polish-cards";

      grouped[source.key].forEach(function (row) {
        cards.appendChild(makeCard(row));
      });

      group.appendChild(head);
      group.appendChild(cards);
      grid.appendChild(group);
    });

    root.appendChild(hero);
    root.appendChild(grid);
    return root;
  }

  function hideLegacyHeader(root) {
    var selectors = ["main h1", "main .page-title", "main [class*='title' i]"];
    var hidden = 0;
    selectors.forEach(function (sel) {
      Array.prototype.slice.call(document.querySelectorAll(sel)).forEach(function (node) {
        if (!node || node.closest("#watany-v1-procedures-source-grouping-polish")) return;
        var text = norm(node.textContent);
        if (text.indexOf(norm("المعاملات")) >= 0 || text.indexOf(norm("الإجراءات")) >= 0 || text.indexOf("procedures") >= 0) {
          node.setAttribute("data-watany-procedures-old-title-hidden", "true");
          node.style.display = "none";
          hidden++;
        }
      });
    });
    document.documentElement.setAttribute("data-watany-v1-procedures-hidden-title-count", String(hidden));
  }

  function mount() {
    if (!isProceduresRoute()) return false;
    var main = document.querySelector("main") || document.querySelector("#root") || document.body;
    if (!main) return false;

    var root = document.getElementById("watany-v1-procedures-source-grouping-polish");
    if (!root) {
      root = build();
      if (main.firstChild) main.insertBefore(root, main.firstChild);
      else main.appendChild(root);
    }

    hideLegacyHeader(root);
    document.documentElement.setAttribute("data-watany-v1-procedures-polish-ready", "true");
    document.documentElement.setAttribute("data-watany-v1-procedures-polish-version", "v2.0.0");
    window.watanyV1ProceduresSourceGroupingPolishReady = true;
    window.watanyV1ProceduresSourceGroupingPolishVersion = "v2.0.0";
    return true;
  }

  function navigate() {
    try {
      history.pushState({}, "", "/procedures");
      window.dispatchEvent(new PopStateEvent("popstate"));
    } catch (e) {
      location.href = "/procedures";
      return;
    }
    setTimeout(mount, 80);
    setTimeout(mount, 300);
    setTimeout(mount, 900);
  }

  function wireEntrypoints() {
    var nodes = Array.prototype.slice.call(document.querySelectorAll("a,button,[role='button'],.kw-child-item,.kw-main-card,[data-feature-key]"));
    nodes.forEach(function (node) {
      if (node.getAttribute("data-watany-procedures-polish-wired") === "true") return;
      var text = norm(node.textContent);
      var key = norm(node.getAttribute("data-feature-key") || "");
      var href = norm(node.getAttribute("href") || "");
      if (text.indexOf(norm("المعاملات")) >= 0 || text.indexOf(norm("الإجراءات")) >= 0 || key.indexOf("procedures") >= 0 || href.indexOf("procedures") >= 0) {
        node.setAttribute("data-watany-procedures-polish-wired", "true");
        node.addEventListener("click", function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
          navigate();
        }, true);
      }
    });
  }

  function init() {
    mount();
    wireEntrypoints();
    window.watanyV1OpenProceduresSourceGroupingPolish = navigate;
    var mo = new MutationObserver(function () {
      mount();
      wireEntrypoints();
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
