
(function () {
  "use strict";
  var MARK = "watany-v1-school-forms-universal-viewer-bridge-v184";
  if (window[MARK]) return;
  window[MARK] = true;

  var FORMS = [
    {
      key: "application",
      title: "طلب مساعدة مدرسية",
      labels: ["طلب مساعدة", "طلب المساعدة", "الطلب"],
      fileName: "school-aid-application.html",
      html: '<article class="watany-form-viewer-page" dir="rtl"><h1>طلب مساعدة مدرسية</h1><p>نموذج طلب المساعدة المدرسية.</p><div class="form-row"><span class="form-label">اسم صاحب العلاقة</span><span class="form-value">........................</span></div><div class="form-row"><span class="form-label">رقم الملف</span><span class="form-value">........................</span></div><div class="form-row"><span class="form-label">اسم الطالب</span><span class="form-value">........................</span></div><div class="form-row"><span class="form-label">المدرسة</span><span class="form-value">........................</span></div><div class="form-row"><span class="form-label">العام الدراسي</span><span class="form-value">........................</span></div></article>'
    },
    {
      key: "papers",
      title: "الأوراق والشروط",
      labels: ["الأوراق والشروط", "الاوراق والشروط", "الأوراق", "الشروط"],
      fileName: "school-aid-papers-conditions.html",
      html: '<article class="watany-form-viewer-page" dir="rtl"><h1>الأوراق والشروط</h1><p>لائحة الأوراق والشروط المطلوبة للمساعدة المدرسية.</p><div class="form-row"><span class="form-label">إفادة مدرسية</span><span class="form-value">مطلوبة</span></div><div class="form-row"><span class="form-label">هوية صاحب العلاقة</span><span class="form-value">مطلوبة</span></div><div class="form-row"><span class="form-label">إيصالات الدفع</span><span class="form-value">عند الحاجة</span></div></article>'
    },
    {
      key: "annexZ",
      title: "ملحق ز",
      labels: ["ملحق ز", "ملحق زاء"],
      fileName: "school-aid-annex-z.html",
      html: '<article class="watany-form-viewer-page" dir="rtl"><h1>ملحق ز</h1><p>نموذج ملحق ز الخاص بالمساعدة المدرسية.</p><div class="form-row"><span class="form-label">الاسم</span><span class="form-value">........................</span></div><div class="form-row"><span class="form-label">رقم الملف</span><span class="form-value">........................</span></div><div class="form-row"><span class="form-label">التوقيع</span><span class="form-value">........................</span></div></article>'
    },
    {
      key: "annexC",
      title: "ملحق ج",
      labels: ["ملحق ج", "ملحق جيم"],
      fileName: "school-aid-annex-c.html",
      html: '<article class="watany-form-viewer-page" dir="rtl"><h1>ملحق ج</h1><p>نموذج ملحق ج الخاص بالمساعدة المدرسية.</p><div class="form-row"><span class="form-label">الاسم</span><span class="form-value">........................</span></div><div class="form-row"><span class="form-label">رقم الملف</span><span class="form-value">........................</span></div><div class="form-row"><span class="form-label">التوقيع</span><span class="form-value">........................</span></div></article>'
    },
    {
      key: "yearEnd",
      title: "إفادة إنهاء العام",
      labels: ["إفادة إنهاء العام", "افادة انهاء العام", "إنهاء العام", "انهاء العام"],
      fileName: "school-aid-year-end-certificate.html",
      html: '<article class="watany-form-viewer-page" dir="rtl"><h1>إفادة إنهاء العام</h1><p>نموذج إفادة إنهاء العام الدراسي.</p><div class="form-row"><span class="form-label">اسم الطالب</span><span class="form-value">........................</span></div><div class="form-row"><span class="form-label">المدرسة</span><span class="form-value">........................</span></div><div class="form-row"><span class="form-label">العام الدراسي</span><span class="form-value">........................</span></div></article>'
    }
  ];

  function norm(value) {
    return String(value || "")
      .replace(/[\u064B-\u065F\u0670]/g, "")
      .replace(/[أإآ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/\s+/g, " ")
      .trim();
  }

  function hasText(el, form) {
    var text = norm(el && el.textContent);
    return form.labels.some(function (label) { return text.indexOf(norm(label)) >= 0; });
  }

  function isSchoolArea() {
    var path = norm(location.pathname);
    var bodyText = norm(document.body && document.body.textContent);
    return path.indexOf("school") >= 0
      || path.indexOf("grant") >= 0
      || bodyText.indexOf(norm("مساعدة مدرسية")) >= 0
      || bodyText.indexOf(norm("المساعدات المدرسية")) >= 0
      || bodyText.indexOf(norm("طلب مساعدة")) >= 0;
  }

  function openFormByKey(key) {
    var form = FORMS.find(function (x) { return x.key === key; }) || FORMS[0];
    if (window.watanyUniversalFormViewer && typeof window.watanyUniversalFormViewer.open === "function") {
      window.watanyUniversalFormViewer.open({
        fileName: form.fileName,
        shareUrl: location.href,
        formHtml: form.html
      });
      return true;
    }
    var blob = new Blob(['<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><body>' + form.html + '</body></html>'], { type: "text/html;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
    return false;
  }

  function openForm(form, event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    }
    return openFormByKey(form.key);
  }

  function buttonFor(form) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "watany-school-form-bridge-card";
    b.setAttribute("data-watany-school-form-key", form.key);
    b.setAttribute("data-testid", "school-form-universal-" + form.key);
    b.setAttribute("dir", "rtl");
    b.innerHTML = '<span class="watany-school-form-bridge-icon"><i class="ph ph-file-text watany-app-icon" aria-hidden="true"></i></span><span class="watany-school-form-bridge-label">' + form.title + '</span>';
    b.addEventListener("click", function (ev) { openForm(form, ev); }, true);
    return b;
  }

  function ensureBridgePanel() {
    if (!isSchoolArea()) return;
    if (document.getElementById("watany-school-forms-universal-bridge-panel")) return;
    var host = document.querySelector("main") || document.querySelector("#root") || document.body;
    if (!host) return;
    var panel = document.createElement("section");
    panel.id = "watany-school-forms-universal-bridge-panel";
    panel.className = "watany-school-form-bridge-panel";
    panel.setAttribute("dir", "rtl");
    panel.setAttribute("data-testid", "school-forms-universal-bridge-panel");
    var title = document.createElement("h2");
    title.textContent = "نماذج المساعدات المدرسية";
    title.className = "watany-school-form-bridge-title";
    var grid = document.createElement("div");
    grid.className = "watany-school-form-bridge-grid";
    FORMS.forEach(function (form) { grid.appendChild(buttonFor(form)); });
    panel.appendChild(title);
    panel.appendChild(grid);
    if (host.firstChild) host.insertBefore(panel, host.firstChild);
    else host.appendChild(panel);
  }

  function wireExistingNodes() {
    var nodes = Array.prototype.slice.call(document.querySelectorAll("a,button,[role='button'],.kw-child-item,.kw-main-card,.school-aid-form-card,.required-form-card,[class*='form' i],[class*='card' i]"));
    nodes.forEach(function (node) {
      if (node.getAttribute("data-watany-school-form-bridge-wired") === "true") return;
      var form = FORMS.find(function (candidate) { return hasText(node, candidate); });
      if (!form) return;
      node.setAttribute("data-watany-school-form-bridge-wired", "true");
      node.setAttribute("data-watany-school-form-key", form.key);
      node.addEventListener("click", function (ev) { openForm(form, ev); }, true);
    });
  }

  function globalClick(ev) {
    var node = ev.target;
    var depth = 0;
    while (node && node !== document.body && depth < 8) {
      var key = node.getAttribute && node.getAttribute("data-watany-school-form-key");
      if (key) {
        var form = FORMS.find(function (x) { return x.key === key; });
        if (form) return openForm(form, ev);
      }
      var matched = FORMS.find(function (candidate) { return hasText(node, candidate); });
      if (matched && isSchoolArea()) return openForm(matched, ev);
      node = node.parentElement;
      depth++;
    }
  }

  function init() {
    document.documentElement.setAttribute("data-watany-v1-school-forms-universal-bridge-ready", "true");
    window.watanyV1SchoolFormsUniversalViewerBridgeReady = true;
    window.watanyV1OpenSchoolAidFormUniversal = openFormByKey;
    ensureBridgePanel();
    wireExistingNodes();
    document.addEventListener("click", globalClick, true);
    var mo = new MutationObserver(function () {
      ensureBridgePanel();
      wireExistingNodes();
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
