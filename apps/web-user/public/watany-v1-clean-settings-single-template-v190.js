
(function () {
  "use strict";
  var MARK = "watany-v1-clean-settings-single-template-v190";
  if (window[MARK]) return;
  window[MARK] = true;
  if (window.watanyPublicRuntimeScopeV1 && !window.watanyPublicRuntimeScopeV1.shouldRun(MARK)) return;

  var APPROVED = [
    {
      key: "display",
      title: "العرض",
      icon: "ph ph-sun-dim",
      items: ["الوضع الفاتح / الداكن", "حجم الخط", "التباين"]
    },
    {
      key: "language",
      title: "اللغة والإدخال",
      icon: "ph ph-translate",
      items: ["العربية", "Arabizi", "تصحيح لوحة المفاتيح"]
    },
    {
      key: "notifications",
      title: "الإشعارات",
      icon: "ph ph-bell-ringing",
      items: ["التعاميم", "الوفيات", "التنبيهات المهمة"]
    },
    {
      key: "account",
      title: "الحساب",
      icon: "ph ph-user-circle",
      items: ["الملف الشخصي", "تسجيل الدخول", "تحديث البيانات"]
    },
    {
      key: "privacy",
      title: "الخصوصية",
      icon: "ph ph-shield-check",
      items: ["إدارة الجلسة", "مسح البيانات المحلية", "التحكم بالظهور"]
    },
    {
      key: "accessibility",
      title: "سهولة الاستخدام",
      icon: "ph ph-person-simple",
      items: ["أزرار أكبر", "قراءة أوضح", "وضع كبار السن"]
    }
  ];

  var BLOCKED_TEXT = [
    "debug",
    "experimental",
    "developer",
    "theme lab",
    "koudama demo",
    "legacy settings",
    "old settings",
    "raw flags",
    "feature flags",
    "admin flags"
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

  function isSettingsRoute() {
    var path = norm(location.pathname);
    var hash = norm(location.hash);
    return path.indexOf("settings") >= 0
      || path.indexOf("setting") >= 0
      || path.indexOf("اعدادات") >= 0
      || path.indexOf("الاعدادات") >= 0
      || hash.indexOf("settings") >= 0;
  }

  function shouldHideLegacyNode(node) {
    if (!node || node.id === "watany-v1-clean-settings-single-template") return false;
    if (node.closest && node.closest("#watany-v1-clean-settings-single-template")) return false;
    var text = norm(node.textContent);
    if (!text) return false;
    if (BLOCKED_TEXT.some(function (b) { return text.indexOf(norm(b)) >= 0; })) return true;
    var cls = norm(node.className || "");
    if (cls.indexOf("settings") >= 0 && text.length > 20) return true;
    return false;
  }

  function createButton(item) {
    var card = document.createElement("button");
    card.type = "button";
    card.className = "watany-clean-settings-card";
    card.setAttribute("data-settings-key", item.key);
    card.setAttribute("data-testid", "clean-settings-card-" + item.key);
    card.setAttribute("dir", "rtl");

    var top = document.createElement("span");
    top.className = "watany-clean-settings-card-top";

    var icon = document.createElement("i");
    icon.className = item.icon + " watany-app-icon";
    icon.setAttribute("aria-hidden", "true");

    var title = document.createElement("strong");
    title.textContent = item.title;

    top.appendChild(icon);
    top.appendChild(title);

    var list = document.createElement("span");
    list.className = "watany-clean-settings-card-items";
    list.textContent = item.items.join(" · ");

    card.appendChild(top);
    card.appendChild(list);

    card.addEventListener("click", function () {
      openSheet(item);
    });

    return card;
  }

  function sheetId(item) {
    return "watany-clean-settings-sheet-" + item.key;
  }

  function removeSheets() {
    Array.prototype.slice.call(document.querySelectorAll(".watany-clean-settings-sheet-backdrop,.watany-clean-settings-sheet")).forEach(function (x) { x.remove(); });
  }

  function openSheet(item) {
    removeSheets();

    var backdrop = document.createElement("div");
    backdrop.className = "watany-clean-settings-sheet-backdrop";
    backdrop.addEventListener("click", removeSheets);

    var sheet = document.createElement("section");
    sheet.className = "watany-clean-settings-sheet";
    sheet.id = sheetId(item);
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-modal", "true");
    sheet.setAttribute("dir", "rtl");
    sheet.setAttribute("data-testid", "clean-settings-sheet");

    var header = document.createElement("div");
    header.className = "watany-clean-settings-sheet-header";

    var label = document.createElement("strong");
    label.textContent = item.title;

    var close = document.createElement("button");
    close.type = "button";
    close.className = "watany-clean-settings-close";
    close.setAttribute("data-testid", "clean-settings-close");
    close.innerHTML = '<i class="ph ph-x watany-app-icon" aria-hidden="true"></i><span>إغلاق</span>';
    close.addEventListener("click", removeSheets);

    header.appendChild(label);
    header.appendChild(close);

    var body = document.createElement("div");
    body.className = "watany-clean-settings-sheet-body";

    item.items.forEach(function (text, idx) {
      var row = document.createElement("div");
      row.className = "watany-clean-settings-row";
      row.setAttribute("data-testid", "clean-settings-row");
      row.innerHTML = '<span>' + text + '</span><span class="watany-clean-settings-status">' + (idx === 0 ? "متاح" : "قريباً") + '</span>';
      body.appendChild(row);
    });

    sheet.appendChild(header);
    sheet.appendChild(body);

    document.body.appendChild(backdrop);
    document.body.appendChild(sheet);
  }

  function buildTemplate() {
    var root = document.createElement("section");
    root.id = "watany-v1-clean-settings-single-template";
    root.className = "watany-clean-settings-template";
    root.setAttribute("dir", "rtl");
    root.setAttribute("data-testid", "watany-clean-settings-single-template");
    root.setAttribute("aria-label", "الإعدادات");

    var header = document.createElement("div");
    header.className = "watany-clean-settings-head";

    var title = document.createElement("h1");
    title.textContent = "الإعدادات";

    var subtitle = document.createElement("p");
    subtitle.textContent = "نسخة موحّدة ونظيفة للإعدادات الأساسية فقط.";

    header.appendChild(title);
    header.appendChild(subtitle);

    var grid = document.createElement("div");
    grid.className = "watany-clean-settings-grid";
    grid.setAttribute("data-testid", "clean-settings-grid");

    APPROVED.forEach(function (item) {
      grid.appendChild(createButton(item));
    });

    root.appendChild(header);
    root.appendChild(grid);
    return root;
  }

  function hideLegacySettings(root) {
    var hidden = 0;
    var candidates = Array.prototype.slice.call(document.querySelectorAll("main section, main article, main form, main [class*='setting' i], #root [class*='setting' i]"));
    candidates.forEach(function (node) {
      if (!node || node === root || (node.contains && node.contains(root))) return;
      if (node.closest && node.closest("#watany-v1-clean-settings-single-template")) return;
      if (shouldHideLegacyNode(node)) {
        node.setAttribute("data-watany-clean-settings-hidden", "true");
        node.style.display = "none";
        hidden++;
      }
    });
    document.documentElement.setAttribute("data-watany-clean-settings-hidden-count", String(hidden));
  }

  function mount() {
    if (!isSettingsRoute()) return false;

    var existing = document.getElementById("watany-v1-clean-settings-single-template");
    var main = document.querySelector("main") || document.querySelector("#root") || document.body;
    if (!main) return false;

    if (!existing) {
      existing = buildTemplate();
      if (main.firstChild) main.insertBefore(existing, main.firstChild);
      else main.appendChild(existing);
    }

    hideLegacySettings(existing);
    document.documentElement.setAttribute("data-watany-v1-clean-settings-ready", "true");
    document.documentElement.setAttribute("data-watany-v1-clean-settings-version", "v1.9.0");
    window.watanyV1CleanSettingsSingleTemplateReady = true;
    window.watanyV1CleanSettingsSingleTemplateVersion = "v1.9.0";
    return true;
  }

  function navigateToSettings() {
    if (isSettingsRoute()) {
      mount();
      return;
    }
    try {
      history.pushState({}, "", "/settings");
      window.dispatchEvent(new PopStateEvent("popstate"));
    } catch (e) {
      location.href = "/settings";
      return;
    }
    setTimeout(mount, 100);
    setTimeout(mount, 350);
    setTimeout(mount, 900);
  }

  function wireSettingsEntrypoints() {
    var nodes = Array.prototype.slice.call(document.querySelectorAll("a,button,[role='button'],.kw-child-item,.kw-main-card,[data-feature-key]"));
    nodes.forEach(function (node) {
      if (node.getAttribute("data-watany-clean-settings-wired") === "true") return;
      var text = norm(node.textContent);
      var key = norm(node.getAttribute("data-feature-key") || "");
      var href = norm(node.getAttribute("href") || "");
      if (text.indexOf(norm("الإعدادات")) >= 0 || text.indexOf(norm("اعدادات")) >= 0 || key.indexOf("settings") >= 0 || href.indexOf("settings") >= 0) {
        node.setAttribute("data-watany-clean-settings-wired", "true");
        node.addEventListener("click", function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
          navigateToSettings();
        }, true);
      }
    });
  }

  function init() {
    mount();
    wireSettingsEntrypoints();
    var mo = new MutationObserver(function () {
      mount();
      wireSettingsEntrypoints();
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
    window.watanyV1OpenCleanSettings = navigateToSettings;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
