type UniversalFormViewerApi = {
  open: (options: {
    title?: string;
    fileTitle?: string;
    fileName?: string;
    fileUrl?: string;
    downloadUrl?: string;
    shareUrl?: string;
    formHtml?: string;
  }) => void;
  fit?: () => void;
  close?: () => void;
};

type ViewerWindow = Window & typeof globalThis & {
  watanyUniversalFormViewer?: UniversalFormViewerApi;
  watanyV1UniversalFormViewerVersion?: string;
  watanyV1ShowUniversalFormViewer?: (options: {
    title?: string;
    fileTitle?: string;
    fileName?: string;
    fileUrl?: string;
    downloadUrl?: string;
    shareUrl?: string;
    formHtml?: string;
  }) => void;
};

const UNIVERSAL_VIEWER_RUNTIME_MARK = "watany-v1-universal-form-viewer-v183";
const objectUrlsToRevoke = new Set<string>();
let objectUrlCleanupBound = false;

export type UniversalFormViewerItem = {
  titleAr: string;
  previewUrl: string;
  downloadUrl?: string;
  preferUniversal?: boolean;
};

function toAbsoluteUrl(url: string) {
  return url.startsWith("http") ? url : new URL(url, globalThis.location.origin).toString();
}

function toAbsoluteUrlSafe(url?: string) {
  if (!url) return "";
  try {
    return toAbsoluteUrl(url);
  } catch {
    return "";
  }
}

function toFileName(url: string, fallbackTitle: string) {
  const pathname = new URL(url, globalThis.location.origin).pathname;
  const segments = pathname.split("/");
  const lastSegment = segments.slice().reverse().find(Boolean);
  return lastSegment || `${fallbackTitle}.html`;
}

function isHtmlLikeUrl(url: string) {
  return /\.html?(?:$|[?#])/i.test(url);
}

function isLikelyHtmlResponse(contentType: string | null, body: string) {
  if (contentType && /html|xhtml|xml/i.test(contentType)) return true;
  return /^\s*(?:<!doctype|<html|<body|<main|<section|<article|<div|<form)\b/i.test(body);
}

function isPdfContentType(contentType: string | null) {
  return Boolean(contentType && /application\/pdf/i.test(contentType));
}

function isImageContentType(contentType: string | null) {
  return Boolean(contentType && /^image\//i.test(contentType));
}

function buildImageHtml(title: string, imageUrl: string) {
  return `<article class="watany-form-viewer-page watany-form-viewer-page--image" dir="rtl"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)}" style="display:block;width:100%;height:auto;object-fit:contain;" /></article>`;
}

function trackObjectUrlForCleanup(url: string) {
  objectUrlsToRevoke.add(url);
  if (objectUrlCleanupBound || typeof window === "undefined") return;

  const revokeAll = () => {
    for (const objectUrl of objectUrlsToRevoke) {
      URL.revokeObjectURL(objectUrl);
    }
    objectUrlsToRevoke.clear();
  };

  window.addEventListener("watany-universal-form-viewer-closed", revokeAll);
  window.addEventListener("beforeunload", revokeAll);
  objectUrlCleanupBound = true;
}

function normalizeHtmlForViewer(html: string) {
  try {
    const parser = new DOMParser();
    const document = parser.parseFromString(html, "text/html");
    const source = document.body?.querySelector("main, .page, article") || document.body;
    if (!source) return html;

    source.querySelectorAll("script, style, link, meta, base, noscript, .print-btn, .toolbar").forEach((node) => node.remove());
    source.querySelectorAll("*").forEach((node) => {
      for (const attribute of Array.from(node.attributes)) {
        if (/^on/i.test(attribute.name)) node.removeAttribute(attribute.name);
      }
    });
    const content = source.innerHTML.trim();
    if (!content) return html;
    if (/class=["'][^"']*watany-form-viewer-page/i.test(content)) return content;
    return `<article class="watany-form-viewer-page" dir="rtl">${content}</article>`;
  } catch {
    return html;
  }
}

function buildStateHtml(title: string, message: string) {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  return [
    '<article class="watany-form-viewer-page" dir="rtl">',
    `<h1>${safeTitle}</h1>`,
    `<p>${safeMessage}</p>`,
    '<div class="form-row"><span class="form-label">ملاحظة</span><span class="form-value">يمكنك استخدام أزرار التحميل أو المشاركة من الشريط العلوي.</span></div>',
    '</article>',
  ].join("");
}

function escapeHtml(value: string) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char] || char));
}

function openDirect(url: string) {
  if (!url) return;
  globalThis.window?.open(url, "_blank", "allow-new-tab");
}

function forceFitMobileViewer(viewerWindow: ViewerWindow | undefined): void {
  if (!viewerWindow) return;
  const runFit = () => {
    try {
      viewerWindow.watanyUniversalFormViewer?.fit?.();
    } catch {
      // no-op
    }
  };

  runFit();
  setTimeout(runFit, 40);
  setTimeout(runFit, 220);
}

function viewerSupportsFileFrames(viewerWindow: ViewerWindow | undefined): boolean {
  const openSource = String(viewerWindow?.watanyUniversalFormViewer?.open || "");
  return openSource.includes("shouldUseFileFrame") || openSource.includes("buildFileFrameHtml");
}

export async function openWatanyUniversalFormViewer(item: UniversalFormViewerItem) {
  const previewUrl = toAbsoluteUrlSafe(item.previewUrl);
  const downloadUrl = toAbsoluteUrlSafe(item.downloadUrl || item.previewUrl) || previewUrl;
  const viewerWindow = globalThis.window as ViewerWindow | undefined;
  const shouldUseUniversal = item.preferUniversal ?? true;
  // Some backend preview routes don't end with .html but return HTML content.
  // Always attempt inline fetch when a preview URL exists, then fallback gracefully.
  const shouldInlineHtml = Boolean(previewUrl);

  // Ensure the universal viewer script is available. If it's not yet loaded, try to load
  // the public script and wait briefly for initialization so we can open inside the
  // in-app viewer instead of opening a full new tab for PDFs.
  function waitForViewerReady(resolve: (value: UniversalFormViewerApi | undefined) => void, fallbackApi: UniversalFormViewerApi | undefined) {
    const api = viewerWindow?.watanyUniversalFormViewer;
    if (api) {
      resolve(api);
      return;
    }

    const start = Date.now();
    const poll = () => {
      const apiNow = viewerWindow?.watanyUniversalFormViewer;
      if (apiNow) {
        resolve(apiNow);
        return;
      }
      if (Date.now() - start >= 2000) {
        resolve(apiNow ?? fallbackApi);
        return;
      }
      setTimeout(poll, 80);
    };

    poll();
  }

  async function ensureViewerApi(): Promise<UniversalFormViewerApi | undefined> {
    const currentApi = viewerWindow?.watanyUniversalFormViewer;

    if (currentApi && viewerSupportsFileFrames(viewerWindow)) {
      return currentApi;
    }

    if (!shouldUseUniversal) return undefined;

    const fallbackApi = currentApi;
    const loadingKey = "__watany_universal_viewer_loading" as const;
    const globalScope = globalThis as typeof globalThis & {
      [loadingKey]?: Promise<UniversalFormViewerApi | undefined>;
    };

    globalScope[loadingKey] ??= new Promise((resolve) => {
      if (typeof document === "undefined") {
        resolve(fallbackApi);
        return;
      }

      if (viewerWindow?.watanyUniversalFormViewer && !viewerSupportsFileFrames(viewerWindow)) {
        try {
          delete viewerWindow.watanyUniversalFormViewer;
          delete viewerWindow.watanyV1ShowUniversalFormViewer;
          delete viewerWindow.watanyV1UniversalFormViewerVersion;
          delete (viewerWindow as ViewerWindow & Record<string, unknown>)[UNIVERSAL_VIEWER_RUNTIME_MARK];
        } catch {
          viewerWindow.watanyUniversalFormViewer = undefined;
          viewerWindow.watanyV1ShowUniversalFormViewer = undefined;
          viewerWindow.watanyV1UniversalFormViewerVersion = undefined;
        }
      }

      const script = document.createElement("script");
      script.src = `${import.meta.env.BASE_URL || "/"}watany-v1-universal-form-viewer-v183.js?v=${Date.now()}`;
      script.async = true;
      script.defer = true;

      script.onload = () => {
        waitForViewerReady(resolve, fallbackApi);
      };

      script.onerror = () => {
        resolve(fallbackApi);
      };

      document.head.appendChild(script);
    });

    const resolvedApi = await globalScope[loadingKey];
    return resolvedApi ?? fallbackApi;
  }

  const viewerApi = await ensureViewerApi();

  if (!viewerApi || !shouldUseUniversal) {
    openDirect(previewUrl || downloadUrl);
    return false;
  }

  const baseOptions = {
    title: item.titleAr,
    fileTitle: item.titleAr,
    fileName: toFileName(downloadUrl || previewUrl, item.titleAr),
    fileUrl: previewUrl || downloadUrl,
    downloadUrl,
    shareUrl: previewUrl || downloadUrl,
  };

  if (!previewUrl && !downloadUrl) {
    viewerApi.open({
      ...baseOptions,
      formHtml: buildStateHtml(item.titleAr, "لا يتوفر رابط معاينة لهذا النموذج حالياً. يمكنك استخدام التحميل أو المشاركة من الشريط العلوي."),
    });
    return false;
  }

  if (!shouldInlineHtml) {
    viewerApi.open(baseOptions);
    forceFitMobileViewer(viewerWindow);
    return true;
  }

  try {
    const response = await fetch(previewUrl, { cache: "no-store" });
    const contentType = response.headers.get("content-type");

    if (!response.ok) {
      viewerApi.open({
        ...baseOptions,
        formHtml: buildStateHtml(item.titleAr, "تعذر تحميل المعاينة الآن. يمكنك استخدام التحميل أو المشاركة من الشريط العلوي."),
      });
      forceFitMobileViewer(viewerWindow);
      return false;
    }

    if (isPdfContentType(contentType)) {
      const pdfBlobUrl = URL.createObjectURL(await response.blob());
      viewerApi.open({
        ...baseOptions,
        fileUrl: pdfBlobUrl,
      });
      trackObjectUrlForCleanup(pdfBlobUrl);
      forceFitMobileViewer(viewerWindow);
      return true;
    }

    const responseBody = await response.clone().text();

    if (!isLikelyHtmlResponse(contentType, responseBody)) {
      const blobUrl = URL.createObjectURL(await response.blob());
      if (isImageContentType(contentType)) {
        viewerApi.open({
          ...baseOptions,
          formHtml: buildImageHtml(item.titleAr, blobUrl),
        });
        trackObjectUrlForCleanup(blobUrl);
        forceFitMobileViewer(viewerWindow);
        return true;
      }
      viewerApi.open({
        ...baseOptions,
        fileUrl: blobUrl,
      });
      trackObjectUrlForCleanup(blobUrl);
      forceFitMobileViewer(viewerWindow);
      return true;
    }

    viewerApi.open({
      ...baseOptions,
      formHtml: normalizeHtmlForViewer(responseBody),
    });
    forceFitMobileViewer(viewerWindow);
    return true;
  } catch {
    viewerApi.open({
      ...baseOptions,
      formHtml: buildStateHtml(item.titleAr, "حدث خطأ أثناء تجهيز النموذج. يمكنك استخدام التحميل أو المشاركة من الشريط العلوي."),
    });
    forceFitMobileViewer(viewerWindow);
    return false;
  }
}
