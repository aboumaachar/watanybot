
(function () {
  "use strict";
  var MARK = "watany-v1-universal-form-viewer-v182";
  if (window[MARK]) return;
  window[MARK] = true;

  var DEFAULT_FORM_HTML = ''
    + '<article class="watany-form-viewer-page" dir="rtl">'
    + '<h1>نموذج موحّد</h1>'
    + '<p>هذا مثال عن قالب عرض النماذج داخل التطبيق.</p>'
    + '<div class="form-row"><span class="form-label">الاسم</span><span class="form-value">........................</span></div>'
    + '<div class="form-row"><span class="form-label">رقم الملف</span><span class="form-value">........................</span></div>'
    + '<div class="form-row"><span class="form-label">الموضوع</span><span class="form-value">........................</span></div>'
    + '<div class="form-row"><span class="form-label">التاريخ</span><span class="form-value">........................</span></div>'
    + '<p>يعرض العارض كامل امتداد النموذج افتراضياً داخل مساحة الهاتف بين الهيدر والفوتر.</p>'
    + '</article>';

  function getNumber(value, fallback) {
    var n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function getCssVarNumber(name, fallback) {
    return getNumber(getComputedStyle(document.documentElement).getPropertyValue(name), fallback);
  }

  function measureStickyEdges() {
    var defaultTop = getCssVarNumber("--watany-form-viewer-top", 64);
    var defaultBottom = getCssVarNumber("--watany-form-viewer-bottom", 64);
    var top = 0;
    var bottom = window.innerHeight;
    var nodes = Array.prototype.slice.call(document.querySelectorAll("header,footer,[class*='header' i],[class*='footer' i],[class*='top' i],[class*='bottom' i],[class*='nav' i],.watany-mobile-shell__topbar,.watany-mobile-shell__dock,.watany-mobile-shell__chatbar,.watany-mobile-shell__chrome-top,.watany-mobile-shell__chrome-bottom,[data-sticky-feature-rail]"));
    nodes.forEach(function (el) {
      var cs = getComputedStyle(el);
      var r = el.getBoundingClientRect();
      if ((cs.position === "fixed" || cs.position === "sticky") && r.height > 20) {
        if (r.top <= 16 && r.bottom > top) top = Math.min(window.innerHeight - 120, Math.max(top, r.bottom));
        if (r.bottom >= window.innerHeight - 16 && r.top < bottom) bottom = Math.max(120, Math.min(bottom, r.top));
      }
    });

    var cssTop = getCssVarNumber("--watany-sticky-header-height", 0);
    var cssBottom = getCssVarNumber("--watany-sticky-footer-height", 0);
    if (cssTop > 20) top = Math.max(top, cssTop);
    if (cssBottom > 20) bottom = Math.min(bottom, window.innerHeight - cssBottom);

    top = Math.max(defaultTop, Math.round(top));
    var bottomGap = Math.max(0, Math.round(window.innerHeight - bottom));
    if (bottomGap < 20) bottomGap = defaultBottom;
    document.documentElement.style.setProperty("--watany-form-viewer-top", top + "px");
    document.documentElement.style.setProperty("--watany-form-viewer-bottom", bottomGap + "px");
    return { top: top, bottomGap: bottomGap, availableHeight: Math.max(120, window.innerHeight - top - bottomGap) };
  }

  function removeExisting() {
    var a = document.getElementById("watany-form-viewer-backdrop");
    var b = document.getElementById("watany-form-viewer-root");
    // Hide composited fixed layers before removal so backdrop-filter cannot linger until the next input.
    if (a) {
      a.style.setProperty("display", "none", "important");
      a.style.setProperty("pointer-events", "none", "important");
    }
    if (b) {
      b.style.setProperty("display", "none", "important");
      b.style.setProperty("pointer-events", "none", "important");
    }
    if (a) a.remove();
    if (b) b.remove();
    if (a || b) {
      try { window.dispatchEvent(new CustomEvent("watany-universal-form-viewer-closed")); } catch (e) {}
      void document.documentElement.offsetHeight;
      window.requestAnimationFrame(function () { void document.documentElement.offsetHeight; });
    }
  }

  function showToast(root, message) {
    var toast = root.querySelector(".watany-form-viewer-toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.setTimeout(function () { toast.classList.remove("is-visible"); }, 1600);
  }

  function escapeText(s) {
    return String(s || "").replace(/[&<>"']/g, function (ch) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch];
    });
  }

  function normalizePageHtml(html) {
    html = String(html || DEFAULT_FORM_HTML);
    if (html.indexOf("watany-form-viewer-page") >= 0) return html;
    return '<article class="watany-form-viewer-page" dir="rtl">' + html + '</article>';
  }

  function fitFullForm(root) {
    measureStickyEdges();
    var body = root.querySelector(".watany-form-viewer-body");
    var scaleNode = root.querySelector(".watany-form-viewer-page-scale");
    var page = root.querySelector(".watany-form-viewer-page");
    if (!body || !scaleNode || !page) return;

    var originalZoom = Number(root.getAttribute("data-zoom") || "1") || 1;
    root.style.setProperty("--watany-form-viewer-zoom", "1");
    root.style.setProperty("--watany-form-viewer-fit", "1");

    var pageWidth = page.offsetWidth || 794;
    var pageHeight = page.scrollHeight || 1123;
    var availableWidth = Math.max(250, body.clientWidth);
    // Keep readable scale on mobile: fit to width only and allow vertical scrolling.
    var fit = Math.min(availableWidth / pageWidth, 1);
    fit = Math.max(0.5, fit);
    if (fit > 0.96) fit = 1;

    root.style.setProperty("--watany-form-viewer-fit", String(fit));
    root.style.setProperty("--watany-form-viewer-zoom", String(originalZoom));
    var total = fit * originalZoom;
    scaleNode.style.height = Math.ceil(pageHeight * total) + "px";
    scaleNode.style.width = pageWidth + "px";
  }

  function createDownloadBlob(options, html) {
    var fullHtml = '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>'
      + escapeText(options.title || "نموذج")
      + '</title></head><body>' + html + '</body></html>';
    return new Blob([fullHtml], { type: "text/html;charset=utf-8" });
  }

  function downloadFile(options, html, root) {
    if (options.fileUrl) {
      var direct = document.createElement("a");
      direct.href = options.fileUrl;
      direct.download = options.fileName || "";
      document.body.appendChild(direct);
      direct.click();
      direct.remove();
      showToast(root, "بدأ التحميل");
      return;
    }
    var blob = createDownloadBlob(options, html);
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = options.fileName || "watany-form.html";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
    showToast(root, "تم تجهيز النموذج للتحميل");
  }

  function shareForm(options, root) {
    var payload = {
      title: options.title || "نموذج موطني",
      text: options.shareText || "نموذج من تطبيق موطني",
      url: options.shareUrl || options.fileUrl || window.location.href
    };
    if (navigator.share) {
      navigator.share(payload).then(function () { showToast(root, "تم فتح المشاركة"); }).catch(function () { showToast(root, "تم إلغاء المشاركة"); });
      return;
    }
    var text = payload.title + " - " + payload.url;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { showToast(root, "تم نسخ رابط المشاركة"); }).catch(function () { showToast(root, text); });
    } else {
      showToast(root, text);
    }
  }

  function printHtml(options, html) {
    var win = window.open("", "_blank", "noopener,noreferrer,width=900,height=1000");
    if (!win) { window.print(); return; }
    win.document.open();
    win.document.write('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>'
      + escapeText(options.title || "نموذج")
      + '</title><style>body{font-family:Arial,Tahoma,sans-serif;direction:rtl;margin:24px}.watany-form-viewer-page{box-shadow:none!important;border:0!important;width:auto!important;min-height:auto!important;padding:0!important}</style></head><body>'
      + html + '</body></html>');
    win.document.close();
    win.focus();
    window.setTimeout(function () { try { win.print(); } catch (e) {} }, 250);
  }

  function iconClass(action) {
    var map = {
      download: "ph ph-download-simple",
      share: "ph ph-share-network",
      print: "ph ph-printer",
      "zoom-in": "ph ph-magnifying-glass-plus",
      "zoom-out": "ph ph-magnifying-glass-minus",
      close: "ph ph-x"
    };
    return map[action] || "ph ph-circle";
  }

  function button(label, action, testId) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "watany-form-viewer-button";
    b.setAttribute("data-form-viewer-action", action);
    b.setAttribute("data-testid", testId || ("form-viewer-" + action));
    var i = document.createElement("i");
    i.className = iconClass(action) + " watany-app-icon";
    i.setAttribute("aria-hidden", "true");
    var l = document.createElement("span");
    l.textContent = label;
    b.appendChild(i);
    b.appendChild(l);
    return b;
  }

  function setZoom(root, next) {
    var mobileMinZoom = window.innerWidth <= 430 ? 1 : 0.7;
    next = Math.max(mobileMinZoom, Math.min(1.8, Math.round(next * 100) / 100));
    root.setAttribute("data-zoom", String(next));
    root.style.setProperty("--watany-form-viewer-zoom", String(next));
    fitFullForm(root);
    showToast(root, "حجم العرض: " + Math.round(next * 100) + "%");
  }

  function revealAfterFirstPaint(root, body) {
    var revealed = false;
    function reveal() {
      if (revealed) return;
      if (!root || !root.isConnected) return;
      revealed = true;
      root.removeAttribute("data-pending-paint");
      body.style.visibility = "";
      body.style.opacity = "";
    }

    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(reveal);
    });
    window.setTimeout(reveal, 180);
  }

  function openViewer(options) {
    options = options || {};
    measureStickyEdges();
    removeExisting();

    var html = normalizePageHtml(options.formHtml || options.html || DEFAULT_FORM_HTML);

    var backdrop = document.createElement("div");
    backdrop.id = "watany-form-viewer-backdrop";
    backdrop.className = "watany-form-viewer-backdrop";
    backdrop.addEventListener("click", removeExisting);

    var root = document.createElement("section");
    root.id = "watany-form-viewer-root";
    root.className = "watany-form-viewer";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", options.title || options.fileTitle || "عارض النموذج");
    root.setAttribute("dir", "rtl");
    root.setAttribute("data-testid", "watany-universal-form-viewer");
    root.setAttribute("data-zoom", "1");
    root.setAttribute("data-pending-paint", "true");

    var toolbar = document.createElement("div");
    toolbar.className = "watany-form-viewer-toolbar";
    toolbar.setAttribute("data-testid", "form-viewer-top-toolbar");

    var download = button("تحميل", "download", "form-viewer-download");
    var share = button("مشاركة", "share", "form-viewer-share");
    var print = button("طباعة", "print", "form-viewer-print");
    var zoomIn = button("تكبير", "zoom-in", "form-viewer-zoom-in");
    var zoomOut = button("تصغير", "zoom-out", "form-viewer-zoom-out");
    var close = button("إغلاق", "close", "form-viewer-close");

    toolbar.appendChild(download);
    toolbar.appendChild(share);
    toolbar.appendChild(print);
    toolbar.appendChild(zoomIn);
    toolbar.appendChild(zoomOut);
    toolbar.appendChild(close);

    var body = document.createElement("div");
    body.className = "watany-form-viewer-body";
    body.style.visibility = "hidden";
    body.style.opacity = "0";
    var holder = document.createElement("div");
    holder.className = "watany-form-viewer-page-holder";
    var scale = document.createElement("div");
    scale.className = "watany-form-viewer-page-scale";
    scale.innerHTML = html;
    holder.appendChild(scale);
    body.appendChild(holder);

    var toast = document.createElement("div");
    toast.className = "watany-form-viewer-toast";
    toast.setAttribute("aria-live", "polite");

    root.appendChild(toolbar);
    root.appendChild(body);
    root.appendChild(toast);

    download.addEventListener("click", function () { downloadFile(options, html, root); });
    share.addEventListener("click", function () { shareForm(options, root); });
    print.addEventListener("click", function () { printHtml(options, html); });
    zoomIn.addEventListener("click", function () { setZoom(root, (Number(root.getAttribute("data-zoom") || "1") || 1) + 0.15); });
    zoomOut.addEventListener("click", function () { setZoom(root, (Number(root.getAttribute("data-zoom") || "1") || 1) - 0.15); });
    close.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopImmediatePropagation();
      removeExisting();
      window.setTimeout(function () {
        var staleBackdrop = document.getElementById("watany-form-viewer-backdrop");
        if (staleBackdrop) staleBackdrop.remove();
        removeExisting();
      }, 0);
    }, true);

    document.body.appendChild(backdrop);
    document.body.appendChild(root);
    try {
      window.dispatchEvent(new CustomEvent("watany-universal-form-viewer-opened", {
        detail: {
          title: options.title || options.fileTitle || "عارض النموذج",
          fileUrl: options.fileUrl || "",
          shareUrl: options.shareUrl || ""
        }
      }));
    } catch (e) {}
    revealAfterFirstPaint(root, body);
    window.setTimeout(function () { fitFullForm(root); }, 20);
    window.setTimeout(function () { fitFullForm(root); }, 260);
    return root;
  }

  function init() {
    measureStickyEdges();
    window.addEventListener("resize", function () {
      measureStickyEdges();
      var root = document.getElementById("watany-form-viewer-root");
      if (root) fitFullForm(root);
    });
    window.watanyUniversalFormViewer = {
      open: openViewer,
      close: removeExisting,
      fit: function () {
        var root = document.getElementById("watany-form-viewer-root");
        if (root) fitFullForm(root);
      }
    };
    window.watanyV1ShowUniversalFormViewer = openViewer;
    window.watanyV1UniversalFormViewerReady = true;
    document.documentElement.setAttribute("data-watany-v1-universal-form-viewer-ready", "true");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
