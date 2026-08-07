
(function () {
  "use strict";
  var MARK = "watany-v1-tools-schools-public-access-v144";
  if (window[MARK]) return;
  window[MARK] = true;
  if (window.watanyPublicRuntimeScopeV1 && !window.watanyPublicRuntimeScopeV1.shouldRun(MARK)) return;

  var TOOL_ITEMS = [
    { label: "روابط مفيدة", icon: "🔗", kind: "useful" },
    { label: "القرارات المرضية", icon: "🏥", kind: "tool" },
    { label: "أوضاع المساعدات", icon: "🤝", kind: "tool" },
    { label: "أوضاع المراسيم", icon: "📜", kind: "tool" },
    { label: "حاسبة المعاش", icon: "🧮", kind: "tool" },
    { label: "القوانين", icon: "⚖️", kind: "tool" }
  ];

  var USEFUL_LINKS = [
    { label: "قيادة الجيش اللبناني", icon: "🛡️" },
    { label: "قوى الأمن الداخلي", icon: "🚓" },
    { label: "الأمن العام", icon: "🛂" },
    { label: "أمن الدولة", icon: "🏛️" },
    { label: "الجمارك اللبنانية", icon: "📦" },
    { label: "وزارة المالية", icon: "💰" }
  ];

  var SCHOOL_FORMS = [
    { label: "طلب المساعدة المدرسية", icon: "📝", previewUrl: "/school-aids/forms/school-aid-application.html", downloadUrl: "/school-aids/forms/school-aid-application.html" },
    { label: "الأوراق والشروط", icon: "📋", previewUrl: "/school-aids/forms/school-aid-papers-conditions.html", downloadUrl: "/school-aids/forms/school-aid-papers-conditions.html" },
    { label: "افادة انهاء", icon: "📄", previewUrl: "/school-aids/forms/annex-z.pdf", downloadUrl: "/school-aids/forms/annex-z.pdf" },
    { label: "مدرسة", icon: "📄", previewUrl: "/school-aids/forms/annex-j.pdf", downloadUrl: "/school-aids/forms/annex-j.pdf" },
    { label: "جامعة", icon: "🎓", previewUrl: "/school-aids/forms/school-year-completion-certificate.pdf", downloadUrl: "/school-aids/forms/school-year-completion-certificate.pdf" }
  ];

  var REMOVE_FROM_TOOLS = ["إفادة الراتب", "افادة الراتب", "أداة العنوان", "اداة العنوان", "المستندات"];

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
  function toAbsoluteUrl(url) {
    return /^https?:/i.test(String(url || "")) ? String(url) : new URL(String(url || ""), window.location.origin).toString();
  }
  function isHtmlLike(url) {
    return /\.html?(?:$|[?#])/i.test(String(url || ""));
  }
  function toFileName(url, fallbackLabel) {
    try {
      var pathname = new URL(url, window.location.origin).pathname;
      var parts = pathname.split("/").filter(Boolean);
      return parts.length ? parts[parts.length - 1] : String(fallbackLabel || "watany-form.html");
    } catch (e) {
      return String(fallbackLabel || "watany-form.html");
    }
  }
  function openDirect(url) {
    window.open(url, "_blank", "allow-new-tab");
  }
  function openSchoolFormItem(item) {
    var previewUrl = toAbsoluteUrl(item.previewUrl || "");
    var downloadUrl = toAbsoluteUrl(item.downloadUrl || item.previewUrl || "");
    var viewer = window.watanyUniversalFormViewer;
    var loadingHtml = '<article class="watany-form-viewer-page" dir="rtl"><h1>' + String(item.label || "النموذج") + '</h1><p>جارٍ تحميل النموذج داخل العارض الموحد...</p><div class="form-row"><span class="form-label">ملاحظة</span><span class="form-value">يمكنك استخدام أزرار التحميل أو المشاركة من الشريط العلوي.</span></div></article>';
    var errorHtml = '<article class="watany-form-viewer-page" dir="rtl"><h1>' + String(item.label || "النموذج") + '</h1><p>تعذر تحميل المعاينة الآن. يمكنك استخدام التحميل أو المشاركة من الشريط العلوي.</p><div class="form-row"><span class="form-label">ملاحظة</span><span class="form-value">إذا تعذر العرض، استخدم التحميل من الشريط العلوي.</span></div></article>';

    if (!viewer || !isHtmlLike(previewUrl)) {
      closePopup();
      openDirect(previewUrl);
      return;
    }

    closePopup();
    viewer.open({
      title: item.label,
      fileTitle: item.label,
      fileName: toFileName(downloadUrl, item.label),
      fileUrl: downloadUrl,
      shareUrl: previewUrl,
      formHtml: loadingHtml
    });

    fetch(previewUrl, { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) throw new Error("preview fetch failed");
        return response.text();
      })
      .then(function (formHtml) {
        viewer.open({
          title: item.label,
          fileTitle: item.label,
          fileName: toFileName(downloadUrl, item.label),
          fileUrl: downloadUrl,
          shareUrl: previewUrl,
          formHtml: formHtml
        });
      })
      .catch(function () {
        viewer.open({
          title: item.label,
          fileTitle: item.label,
          fileName: toFileName(downloadUrl, item.label),
          fileUrl: downloadUrl,
          shareUrl: previewUrl,
          formHtml: errorHtml
        });
      });
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
    document.documentElement.style.setProperty("--watany-v1-popup-top", best + "px");
    return best;
  }
  function setPublicAccessFlags() {
    document.documentElement.setAttribute("data-watany-v1-public-access", "true");
    try {
      localStorage.setItem("watany_v1_public_access", "true");
      localStorage.setItem("watany_demo_public_access", "true");
      localStorage.setItem("watany_public_demo_access", "true");
    } catch (e) {}
  }
  function closePopup() {
    var a = document.getElementById("watany-v1-public-popup-backdrop");
    if (a) a.remove();
    var b = document.getElementById("watany-v1-public-popup");
    if (b) b.remove();
  }
  function popup(title, bodyBuilder) {
    topOffset();
    closePopup();
    var backdrop = document.createElement("div");
    backdrop.id = "watany-v1-public-popup-backdrop";
    backdrop.className = "watany-v1-popup-backdrop";
    backdrop.addEventListener("click", closePopup);
    var panel = document.createElement("section");
    panel.id = "watany-v1-public-popup";
    panel.className = "watany-v1-fullwidth-popup";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("dir", "rtl");
    var head = document.createElement("div");
    head.className = "watany-v1-popup-head";
    var h = document.createElement("h2");
    h.className = "watany-v1-popup-title";
    h.textContent = title;
    var close = document.createElement("button");
    close.className = "watany-v1-popup-close";
    close.type = "button";
    close.textContent = "×";
    close.setAttribute("aria-label", "إغلاق");
    close.addEventListener("click", closePopup);
    head.appendChild(h);
    head.appendChild(close);
    panel.appendChild(head);
    bodyBuilder(panel);
    document.body.appendChild(backdrop);
    document.body.appendChild(panel);
  }
  function makeCard(className, item, onClick) {
    var el = document.createElement("button");
    el.type = "button";
    el.className = className;
    el.setAttribute("dir", "rtl");
    var iconClass = className.indexOf("school") >= 0 ? "watany-v1-school-icon" : className.indexOf("useful") >= 0 ? "watany-v1-useful-link-icon" : "watany-v1-tool-icon";
    var icon = document.createElement("span");
    icon.className = iconClass;
    icon.textContent = item.icon;
    var label = document.createElement("span");
    label.className = "watany-v1-card-label";
    label.textContent = item.label;
    el.appendChild(icon);
    el.appendChild(label);
    el.addEventListener("click", function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      if (onClick) onClick(item);
    });
    return el;
  }
  function showUsefulLinks() {
    popup("روابط مفيدة", function (panel) {
      var grid = document.createElement("div");
      grid.className = "watany-v1-useful-links-grid";
      USEFUL_LINKS.forEach(function (item) { grid.appendChild(makeCard("watany-v1-useful-link-card", item, function () {})); });
      panel.appendChild(grid);
    });
  }
  function showTools() {
    popup("أدوات", function (panel) {
      var grid = document.createElement("div");
      grid.className = "watany-v1-tools-grid";
      TOOL_ITEMS.forEach(function (item) {
        grid.appendChild(makeCard("watany-v1-tool-card", item, function (clicked) {
          if (clicked.kind === "useful") showUsefulLinks();
        }));
      });
      panel.appendChild(grid);
    });
  }
  function showSchoolForms() {
    popup("المساعدات المدرسية", function (panel) {
      var grid = document.createElement("div");
      grid.className = "watany-v1-school-grid";
      SCHOOL_FORMS.forEach(function (item) { grid.appendChild(makeCard("watany-v1-school-card", item, openSchoolFormItem)); });
      panel.appendChild(grid);
    });
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
  function hideRemovedToolLabels() {
    var nodes = Array.prototype.slice.call(document.querySelectorAll("a,button,[role='button'],li"));
    nodes.forEach(function (el) {
      if (isAgent5Node(el)) return;
      var text = el.textContent || "";
      if (containsAny(text, REMOVE_FROM_TOOLS)) {
        el.setAttribute("data-watany-v1-tools-removed", "true");
        el.style.display = "none";
      }
    });
  }
  function wireDirectTileHandlers() {
    var nodes = Array.prototype.slice.call(document.querySelectorAll("a,button,[role='button'],[class*='tile' i],[class*='card' i]"));
    nodes.forEach(function (node) {
      if (isAgent5Node(node)) return;
      if (node.getAttribute("data-watany-v1-tools-schools-wired") === "true") return;
      var text = node.textContent || "";
      if (containsAny(text, ["أدوات", "ادوات", "Tools"])) {
        node.setAttribute("data-watany-v1-tools-schools-wired", "true");
        node.addEventListener("click", function (ev) { ev.preventDefault(); ev.stopPropagation(); if (ev.stopImmediatePropagation) ev.stopImmediatePropagation(); showTools(); return false; }, true);
      }
      if (containsAny(text, ["روابط مفيدة", "Useful Links"])) {
        node.setAttribute("data-watany-v1-tools-schools-wired", "true");
        node.addEventListener("click", function (ev) { ev.preventDefault(); ev.stopPropagation(); if (ev.stopImmediatePropagation) ev.stopImmediatePropagation(); showUsefulLinks(); return false; }, true);
      }
      if (containsAny(text, ["مدرس", "المساعدات المدرسية", "School", "school grants"])) {
        if (shouldBypassSchoolIntercept(node)) return;
        node.setAttribute("data-watany-v1-tools-schools-wired", "true");
        node.addEventListener("click", function (ev) { ev.preventDefault(); ev.stopPropagation(); if (ev.stopImmediatePropagation) ev.stopImmediatePropagation(); showSchoolForms(); return false; }, true);
      }
    });
  }
  function shouldBypassSchoolIntercept(node) {
    if (!node || !node.closest) return false;
    if (node.closest(".school-aids-required-panel, .school-aid-item-card, .school-grants-top-shortcuts, .school-grants-page")) return true;
    return window.location && /^\/school-grants(?:$|[?#/])/.test(window.location.pathname || "");
  }
  function clickRouter(ev) {
    var target = nearestInteractive(ev.target);
    if (isAgent5Node(target)) return;
    var text = target && target.textContent ? target.textContent : "";
    if (containsAny(text, ["أدوات", "ادوات", "Tools"])) {
      ev.preventDefault(); ev.stopPropagation(); if (ev.stopImmediatePropagation) ev.stopImmediatePropagation(); showTools(); return false;
    }
    if (containsAny(text, ["روابط مفيدة", "Useful Links"])) {
      ev.preventDefault(); ev.stopPropagation(); if (ev.stopImmediatePropagation) ev.stopImmediatePropagation(); showUsefulLinks(); return false;
    }
    if (containsAny(text, ["مدرس", "المساعدات المدرسية", "School", "school grants"])) {
      if (shouldBypassSchoolIntercept(target)) return;
      ev.preventDefault(); ev.stopPropagation(); if (ev.stopImmediatePropagation) ev.stopImmediatePropagation(); showSchoolForms(); return false;
    }
  }
  function init() {
    setPublicAccessFlags();
    topOffset();
    hideRemovedToolLabels();
    wireDirectTileHandlers();
    document.addEventListener("click", clickRouter, true);
    window.addEventListener("resize", topOffset);
    window.watanyV1ShowTools = showTools;
    window.watanyV1ShowUsefulLinks = showUsefulLinks;
    window.watanyV1ShowSchoolForms = showSchoolForms;
    window.watanyV1ClosePublicPopup = closePopup;
    window.watanyV1ToolsPublicAccessReady = true;
    var mo = new MutationObserver(function () {
      setPublicAccessFlags();
      topOffset();
      hideRemovedToolLabels();
      wireDirectTileHandlers();
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
