/* eslint-disable @typescript-eslint/no-unused-vars */
type TickerItem = {
  id?: string;
  title?: string;
  titleAr?: string;
  text?: string;
  message?: string;
  category?: string;
  href?: string;
  url?: string;
  linkType?: string;
  linkId?: string;
  sourceUrl?: string;
  originLandingUrl?: string;
  landingPageUrl?: string;
  announcementUrl?: string;
  createdAt?: string;
  publishedAt?: string;
};

declare global {
  interface Window {
    __watanyTopHeaderRuntimeInstalled?: boolean;
  }
}

const TICKER_ENDPOINT_SUFFIXES = [
  // Keep probing to the known live endpoint to avoid noisy 404s in production.
  "ticker"
];

const APP_BASE_PATH = (() => {
  const baseUrl = `${import.meta.env.BASE_URL || "/"}`;
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  return normalizedBase || "/";
})();

const SIGN_MODE_STORAGE_KEY = "koudama-sign-mode";

type SignMode = "outline" | "filled";

function toAppHref(href: string): string {
  const raw = href.trim();
  if (!raw) return raw;

  if (/^(https?:|mailto:|tel:|#)/i.test(raw)) {
    return raw;
  }

  if (APP_BASE_PATH !== "/" && (raw === APP_BASE_PATH || raw.startsWith(`${APP_BASE_PATH}/`))) {
    return raw;
  }

  if (raw.startsWith("/")) {
    return APP_BASE_PATH === "/" ? raw : `${APP_BASE_PATH}${raw}`;
  }

  return APP_BASE_PATH === "/" ? `/${raw}` : `${APP_BASE_PATH}/${raw}`;
}

function buildTickerEndpoints(): string[] {
  const isSubpathDeployment = Boolean(APP_BASE_PATH && APP_BASE_PATH !== "/");
  const candidates: string[] = [];

  for (const suffix of TICKER_ENDPOINT_SUFFIXES) {
    const normalizedSuffix = suffix.startsWith("/") ? suffix.slice(1) : suffix;
    if (isSubpathDeployment) {
      candidates.push(`${APP_BASE_PATH}/api/${normalizedSuffix}`);
    }
    if (!isSubpathDeployment) {
      candidates.push(`/api/${normalizedSuffix}`);
    }
  }

  return Array.from(new Set(candidates));
}

const FALLBACK_ITEMS: TickerItem[] = [
  { id: "fallback-1", titleAr: "آخر التحديثات والخدمات تظهر هنا تلقائياً عند توفرها.", href: "/services/official", category: "info" },
  { id: "fallback-2", titleAr: "تابع الإشعارات والتنبيهات من الشريط العلوي.", href: "/notifications", category: "notice" }
];

function readStoredSignMode(): SignMode {
  return "outline";
}

function applySignMode(_mode: SignMode) {
  const nextMode: SignMode = "outline";
  try {
    document.body.dataset.koudamaSign = nextMode;
    localStorage.removeItem(SIGN_MODE_STORAGE_KEY);
  } catch {
    document.body.dataset.koudamaSign = nextMode;
  }
}

export function toggleSignMode() {
  applySignMode("outline");
  buildHeader().catch(() => {
    // Header refresh must remain non-fatal.
  });
}

function textOf(item: TickerItem) {
  return item.titleAr || item.title || item.text || item.message || "تحديث جديد";
}

function hrefOf(item: TickerItem) {
  // Use explicit URL or href fields if populated
  const directHref = item.originLandingUrl || item.landingPageUrl || item.announcementUrl || item.sourceUrl || item.url || item.href || "";
  if (directHref.trim()) {
    return directHref;
  }

  const linkType = (item.linkType || "").trim().toLowerCase();
  const linkId = (item.linkId || "").trim();

  if (linkType === "route" && linkId) {
    return linkId;
  }

  switch (linkType) {
    case "faq":
    case "hash":
      return "/faq";
    case "case":
    case "cases":
    case "case_update":
    case "ticket":
    case "ticket_reply":
    case "transaction":
      return "/cases";
    case "document":
    case "documents":
    case "doc":
    case "file":
      return "/documents";
    case "form":
    case "forms":
      return "/forms";
    case "procedure":
    case "procedures":
      return "/procedures";
    case "job":
    case "jobs":
      return "/jobs";
    case "circular":
    case "circulars":
      return "/services/recruitment";
    case "notification":
    case "notifications":
    case "alert":
      return "/updates";
    case "official_service":
    case "official_service_detail":
    case "official-services":
      return linkId ? `/services/official/${encodeURIComponent(linkId)}` : "/services/official";
    case "community":
    case "group":
    case "groups":
      return "/groups";
    default:
      break;
  }

  // Handle support of suggestion items where we want to pre-populate and auto-send inside the chat composer
  const isSuggestType = item.category === "suggest" || item.category === "popular" || item.category === "qotd" || item.id?.includes("suggest") || (item.title && (item.title.includes("سؤال") || item.title.includes("💡") || item.title.includes("❓")));
  if (isSuggestType) {
    const question = (item.titleAr || item.title || item.text || item.message || "").replace(/^[^\s]+\s*(سؤال (متكرر|شائع)|نصيحة اليوم)?:?\s*/i, "").trim();
    if (question) {
      return `/chat?draft=${encodeURIComponent(question)}`;
    }
  }

  return "";
}

function extractItems(payload: unknown): TickerItem[] {
  if (Array.isArray(payload)) return payload as TickerItem[];
  if (!payload || typeof payload !== "object") return [];
  const data = payload as Record<string, unknown>;

  for (const key of ["items", "ticker", "updates", "news", "announcements", "data", "results"]) {
    const value = data[key];
    if (Array.isArray(value)) return value as TickerItem[];
  }

  return [];
}

async function fetchTickerItems(): Promise<TickerItem[]> {
  if (!isUserAuthenticatedForHeader()) {
    return FALLBACK_ITEMS;
  }

  const endpoints = buildTickerEndpoints();
  const authToken = (() => {
    try {
      return sessionStorage.getItem("watany_access_token") || localStorage.getItem("watany_access_token") || "";
    } catch {
      return "";
    }
  })();

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        headers: {
          Accept: "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
      });
      if (!response.ok) continue;
      const payload = await response.json();
      const items = extractItems(payload).filter((item) => textOf(item).trim());
      if (items.length > 0) return items;
    } catch {
      // Continue to the next possible endpoint.
    }
  }

  return FALLBACK_ITEMS;
}

function findExistingLogo(): { src: string; width?: number; height?: number } {
  const candidates = [
    ".kw-logo-tile img",
    ".watany-logo img",
    ".app-logo img",
    ".logo img",
    "[data-logo] img",
    "header img",
    "img[src*='logo']",
    "img[alt*='logo' i]",
    "img[alt*='موطني' i]"
  ];

  for (const selector of candidates) {
    const img = document.querySelector<HTMLImageElement>(selector);
    if (img?.src) {
      const rect = img.getBoundingClientRect();
      return {
        src: img.src,
        width: rect.width > 10 ? Math.round(rect.width) : img.naturalWidth || undefined,
        height: rect.height > 10 ? Math.round(rect.height) : img.naturalHeight || undefined
      };
    }
  }

  return { src: "/logo.png", width: 48, height: 48 };
}

const SVG_NS = "http://www.w3.org/2000/svg";

function svgIcon(d: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg") as SVGSVGElement;
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("class", "watany-top-header__icon-glyph");
  svg.setAttribute("fill", "currentColor");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(SVG_NS, "path") as SVGPathElement;
  path.setAttribute("d", d);
  svg.appendChild(path);
  return svg;
}

function createKoudamaHeaderIcon(iconKey: keyof typeof ICON_PATHS) {
  const wrapper = document.createElement("span");
  wrapper.className = "watany-top-header__icon-glyph-wrap";
  wrapper.appendChild(svgIcon(ICON_PATHS[iconKey]));
  return wrapper;
}

const ICON_PATHS = {
  settings:  "M10.75 2a.75.75 0 0 1 .72.56l.27 1.03c.17.03.34.07.5.12l.75-.76a.75.75 0 0 1 .96-.1l.1.08 1.56 1.56a.75.75 0 0 1 .1.96l-.08.1-.76.75c.05.16.09.33.12.5l1.03.27a.75.75 0 0 1 .56.72V10a.75.75 0 0 1-.56.72l-1.03.27a5.1 5.1 0 0 1-.12.5l.76.75a.75.75 0 0 1 .1.96l-.08.1-1.56 1.56a.75.75 0 0 1-.96.1l-.1-.08-.75-.76c-.16.05-.33.09-.5.12l-.27 1.03a.75.75 0 0 1-.72.56h-2.5a.75.75 0 0 1-.72-.56l-.27-1.03a5.1 5.1 0 0 1-.5-.12l-.75.76a.75.75 0 0 1-.96.1l-.1-.08-1.56-1.56a.75.75 0 0 1-.1-.96l.08-.1.76-.75a5.1 5.1 0 0 1-.12-.5l-1.03-.27A.75.75 0 0 1 2.5 10V7.5a.75.75 0 0 1 .56-.72l1.03-.27c.03-.17.07-.34.12-.5l-.76-.75a.75.75 0 0 1-.1-.96l.08-.1L5 2.64a.75.75 0 0 1 .96-.1l.1.08.75.76c.16-.05.33-.09.5-.12l.27-1.03A.75.75 0 0 1 8.3 2h2.45Zm-.57 1.5H8.87l-.24.93a.75.75 0 0 1-.58.54 3.72 3.72 0 0 0-.93.24.75.75 0 0 1-.78-.16l-.67-.67-.93.93.67.67c.2.2.26.5.16.78-.1.3-.18.61-.24.93a.75.75 0 0 1-.54.58l-.93.24v1.31l.93.24c.27.07.48.3.54.58.06.32.14.63.24.93.1.27.03.58-.16.78l-.67.67.93.93.67-.67a.75.75 0 0 1 .78-.16c.3.1.61.18.93.24.27.06.48.27.54.54l.24.93h1.31l.24-.93a.75.75 0 0 1 .54-.54c.32-.06.63-.14.93-.24a.75.75 0 0 1 .78.16l.67.67.93-.93-.67-.67a.75.75 0 0 1-.16-.78c.1-.3.18-.61.24-.93a.75.75 0 0 1 .54-.58l.93-.24V8.87l-.93-.24a.75.75 0 0 1-.54-.58 3.72 3.72 0 0 0-.24-.93.75.75 0 0 1 .16-.78l.67-.67-.93-.93-.67.67a.75.75 0 0 1-.78.16 3.72 3.72 0 0 0-.93-.24.75.75 0 0 1-.58-.54l-.24-.93Zm-.68 2.75a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Zm0 1.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z",
  palette:   "M12 2.75A6.25 6.25 0 0 0 5.75 9c0 2.33 1.3 3.97 3.22 4.78.33.14.53.47.53.83V16c0 2.21 1.79 4 4 4h1.06a3.44 3.44 0 0 0 0-6.88h-.88a.69.69 0 0 1-.69-.68c0-.38.31-.69.69-.69H15A6.25 6.25 0 0 0 12 2.75Zm-3.3 4.87a1.08 1.08 0 1 1 0 2.16 1.08 1.08 0 0 1 0-2.16Zm6.6 0a1.08 1.08 0 1 1 0 2.16 1.08 1.08 0 0 1 0-2.16Zm-9 3.4a1.08 1.08 0 1 1 0 2.16 1.08 1.08 0 0 1 0-2.16Zm5.3-5.56a1.08 1.08 0 1 1 0 2.16 1.08 1.08 0 0 1 0-2.16Z",
  home:      "M12 3.76 3.5 10.5v8.75c0 .69.56 1.25 1.25 1.25h4.5a.75.75 0 0 0 .75-.75v-4.5c0-.41.34-.75.75-.75h2.5c.41 0 .75.34.75.75v4.5c0 .41.34.75.75.75h4.5c.69 0 1.25-.56 1.25-1.25V10.5L12 3.76Zm.47-1.17 9 7.13c.2.15.32.39.32.65v8.88A2.75 2.75 0 0 1 19.04 22h-4.5a2.25 2.25 0 0 1-2.25-2.25V16h-.58v3.75A2.25 2.25 0 0 1 9.46 22h-4.5a2.75 2.75 0 0 1-2.75-2.75v-8.88c0-.25.12-.5.32-.65l9-7.13a.75.75 0 0 1 .94 0Z",
  official:  "M15.5 2h-3.75a.75.75 0 0 0-.75.75v3.32A7 7 0 0 0 5 13h-.75C3.01 13 2 14 2 15.25v6c0 .41.34.75.75.75H10c.14 0 .25-.11.25-.25v-3c0-.28.22-.5.5-.5h2.5c.28 0 .5.22.5.5v3c0 .14.11.25.25.25h7.25c.41 0 .75-.34.75-.75v-6c0-1.24-1-2.25-2.25-2.25H19a7 7 0 0 0-6.5-6.98V5h3a.5.5 0 0 0 .5-.5v-2a.5.5 0 0 0-.5-.5Zm0 9.75v2a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 1 1.5 0ZM11.75 11c.41 0 .75.34.75.75v2a.75.75 0 0 1-1.5 0v-2c0-.41.34-.75.75-.75Zm-2.25.75v2a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 1 1.5 0ZM5.75 15.5c.41 0 .75.34.75.75v2.5a.75.75 0 0 1-1.5 0v-2.5c0-.41.34-.75.75-.75Zm13.25.75v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0Z",
  trend:     "M5 4a1 1 0 0 0-2 0v13.5A3.5 3.5 0 0 0 6.5 21H20a1 1 0 1 0 0-2H6.5A1.5 1.5 0 0 1 5 17.5V4Zm10 2a1 1 0 1 0 0 2h2.09l-3.84 3.84-1.8-1.8a1 1 0 0 0-1.4 0L6.78 13.3a1 1 0 1 0 1.42 1.42l2.54-2.55 1.8 1.8a1 1 0 0 0 1.4 0L18.5 9.4v2.09a1 1 0 1 0 2 0V7a1 1 0 0 0-1-1H15Z",
  worldcup:  "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm5.65 6.24h-2.4a15.8 15.8 0 0 0-.82-2.7 8.57 8.57 0 0 1 3.22 2.7ZM12 4.1c.55 0 1.43 1.08 2.02 3.14H9.98C10.57 5.18 11.45 4.1 12 4.1ZM9.57 5.54a15.8 15.8 0 0 0-.82 2.7h-2.4a8.57 8.57 0 0 1 3.22-2.7ZM5.28 9.74h3.15a16.9 16.9 0 0 0 0 4.52H5.28a8.46 8.46 0 0 1 0-4.52Zm1.07 6.02h2.4c.2.95.48 1.86.82 2.7a8.57 8.57 0 0 1-3.22-2.7ZM12 19.9c-.55 0-1.43-1.08-2.02-3.14h4.04c-.59 2.06-1.47 3.14-2.02 3.14Zm2.43-1.44c.34-.84.62-1.75.82-2.7h2.4a8.57 8.57 0 0 1-3.22 2.7Zm1.89-4.2a16.9 16.9 0 0 0 0-4.52h3.15a8.46 8.46 0 0 1 0 4.52h-3.15Zm-1.47 0H9.15a15.4 15.4 0 0 1 0-4.52h5.7c.2.74.3 1.49.3 2.26 0 .77-.1 1.52-.3 2.26Z",
  forms:     "M12 8V2H6a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V10h-6a2 2 0 0 1-2-2Zm-5 4.25a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0Zm0 3a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0Zm0 3a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0Zm3-6c0-.41.34-.75.75-.75h5.5a.75.75 0 0 1 0 1.5h-5.5a.75.75 0 0 1-.75-.75Zm0 3c0-.41.34-.75.75-.75h5.5a.75.75 0 0 1 0 1.5h-5.5a.75.75 0 0 1-.75-.75Zm0 3c0-.41.34-.75.75-.75h5.5a.75.75 0 0 1 0 1.5h-5.5a.75.75 0 0 1-.75-.75ZM13.5 8V2.5l6 6H14a.5.5 0 0 1-.5-.5Z",
  faq:       "M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm0 13.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm0-8.75A2.75 2.75 0 0 0 9.25 9.5a.75.75 0 0 0 1.5.1v-.1a1.25 1.25 0 1 1 2.5 0c0 .54-.13.8-.64 1.33l-.14.14c-.88.88-1.22 1.45-1.22 2.53a.75.75 0 0 0 1.5 0c0-.54.13-.8.64-1.33l.14-.14c.88-.88 1.22-1.45 1.22-2.53A2.75 2.75 0 0 0 12 6.75Z",
  person:    "M17.75 14C19 14 20 15 20 16.25v.57c0 .9-.32 1.76-.9 2.44C17.53 21.1 15.15 22 12 22c-3.15 0-5.53-.9-7.1-2.74a3.75 3.75 0 0 1-.9-2.43v-.58C4 15 5.01 14 6.25 14h11.5Zm0 1.5H6.25a.75.75 0 0 0-.75.75v.58c0 .53.2 1.05.54 1.46C7.3 19.76 9.26 20.5 12 20.5c2.74 0 4.7-.74 5.96-2.21.35-.41.54-.93.54-1.47v-.57a.75.75 0 0 0-.75-.75ZM12 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 1.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z",
  notifications: "M12 4.3a5.6 5.6 0 0 1 5.6 5.6v5.4l1.4 2H5l1.4-2V9.9A5.6 5.6 0 0 1 12 4.3Z M9.7 18.3h4.6c-.25 1.05-1.18 1.8-2.3 1.8s-2.05-.75-2.3-1.8Z",
  fullscreen:"M4.5 5.75c0-.69.56-1.25 1.25-1.25h2a.75.75 0 0 0 0-1.5h-2A2.75 2.75 0 0 0 3 5.75v2a.75.75 0 0 0 1.5 0v-2Zm0 12.5c0 .69.56 1.25 1.25 1.25h2a.75.75 0 0 1 0 1.5h-2A2.75 2.75 0 0 1 3 18.25v-2a.75.75 0 0 1 1.5 0v2ZM18.25 4.5c.69 0 1.25.56 1.25 1.25v2a.75.75 0 0 0 1.5 0v-2A2.75 2.75 0 0 0 18.25 3h-2a.75.75 0 0 0 0 1.5h2Zm1.25 13.75c0 .69-.56 1.25-1.25 1.25h-2a.75.75 0 0 0 0 1.5h2A2.75 2.75 0 0 0 21 18.25v-2a.75.75 0 0 0-1.5 0v2Z",
  chat:      "M12 2a10 10 0 1 1-4.59 18.89L3.6 21.96a1.25 1.25 0 0 1-1.54-1.54l1.06-3.83A10 10 0 0 1 12 2Zm0 1.5a8.5 8.5 0 0 0-7.43 12.64l.15.27-1.1 3.98 3.98-1.11.27.15A8.5 8.5 0 1 0 12 3.5ZM8.75 13h4.5a.75.75 0 0 1 .1 1.5h-4.6a.75.75 0 0 1-.1-1.5h4.6-4.5Zm0-3.5h6.5a.75.75 0 0 1 .1 1.5h-6.6a.75.75 0 0 1-.1-1.5h6.6-6.5Z",
  mail:      "M5.25 4h13.5a3.25 3.25 0 0 1 3.24 3.07l.01.18v9.5a3.25 3.25 0 0 1-3.07 3.24l-.18.01H5.25a3.25 3.25 0 0 1-3.24-3.07L2 16.75v-9.5a3.25 3.25 0 0 1 3.07-3.24L5.25 4h13.5-13.5ZM20.5 9.37l-8.15 4.3c-.19.1-.4.1-.6.04l-.1-.05L3.5 9.37v7.38c0 .92.7 1.67 1.6 1.74l.15.01h13.5c.92 0 1.67-.7 1.74-1.6l.01-.15V9.37ZM18.75 5.5H5.25c-.92 0-1.67.7-1.74 1.6l-.01.15v.43l8.5 4.47 8.5-4.47v-.43c0-.92-.7-1.67-1.6-1.74l-.15-.01Z",
  download:  "M18.25 20.5a.75.75 0 1 1 0 1.5h-13a.75.75 0 1 1 0-1.5h13Zm-6.6-18.49h.1c.38 0 .7.28.74.64l.01.1v13.7l3.72-3.73a.75.75 0 0 1 .98-.07l.08.07c.27.27.3.68.07.98l-.07.08-5 5a.75.75 0 0 1-.97.07l-.09-.07-5-5a.75.75 0 0 1 .98-1.13l.08.07L11 16.43V2.76c0-.38.28-.7.65-.75h.1-.1Z",
  menu:      "M7.75 12a1.75 1.75 0 1 1-3.5 0 1.75 1.75 0 0 1 3.5 0Zm6 0a1.75 1.75 0 1 1-3.5 0 1.75 1.75 0 0 1 3.5 0ZM18 13.75a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5ZM12 2A10 10 0 1 0 22 12A10 10 0 0 0 12 2Zm0 1.5A8.5 8.5 0 1 1 3.5 12A8.5 8.5 0 0 1 12 3.5Z",
  burger:    "M3.75 7A.75.75 0 0 1 3.75 5.5h16.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 7Zm0 5.75A.75.75 0 0 1 3.75 11.25h16.5a.75.75 0 0 1 0 1.5H3.75a.75.75 0 0 1 0-1.5Zm0 5.75A.75.75 0 0 1 3.75 17h16.5a.75.75 0 0 1 0 1.5H3.75a.75.75 0 0 1 0-1.5Z",
  network:   "M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm0 1.5a8.5 8.5 0 0 1 7.21 4H16.2a15.82 15.82 0 0 0-.82-2.7A8.53 8.53 0 0 1 12 3.5Zm-2.82.8a15.82 15.82 0 0 0-.82 2.7H4.79a8.53 8.53 0 0 1 4.39-2.7ZM11 7.14a13.3 13.3 0 0 1-1.02-3.14 13.3 13.3 0 0 1 2.04 0C11.55 5.18 11.23 6.18 11 7.14Zm2.02 0c.22-.96.54-1.96.98-3.14a13.3 13.3 0 0 1 1.04 3.14H13.02Zm2.55.8a14.28 14.28 0 0 1 .82 3.56h3.11a8.46 8.46 0 0 1-3.93-3.56Zm1.47 4.56a14.28 14.28 0 0 1-.82 3.56 8.46 8.46 0 0 1 3.93-3.56H17.04Zm-.03.5a15.82 15.82 0 0 0 .82 2.7 8.53 8.53 0 0 1-4.39 2.7 15.82 15.82 0 0 0 .82-2.7H17.01Zm-5.01 3.14c.55 0 1.13-1.08 1.4-3.14H10.6c.27 2.06.85 3.14 1.4 3.14Zm-2.38-3.14a15.82 15.82 0 0 0-.82 2.7 8.53 8.53 0 0 1-4.39-2.7H6.97a15.82 15.82 0 0 0 .82-2.7Zm-1.89-3.56H2.71c.21 2.06.85 3.14 1.4 3.14h2.51a14.28 14.28 0 0 1-.82-3.14Zm1.47 0h7.14a13.4 13.4 0 0 1-7.14 0Zm1.89 0h3.56c.2.74.3 1.49.3 2.26s-.1 1.52-.3 2.26H9.08a13.4 13.4 0 0 1 0-4.52Zm5.74 0H14.8c.2.74.3 1.49.3 2.26s-.1 1.52-.3 2.26h2.51a14.28 14.28 0 0 1-.81-4.52Z",
  market:    "M12 3a3 3 0 0 0-3 3v1H5.5a2.5 2.5 0 0 0-2.5 2.5v10a2.5 2.5 0 0 0 2.5 2.5h13a2.5 2.5 0 0 0 2.5-2.5v-10A2.5 2.5 0 0 0 18.5 7H15V6a3 3 0 0 0-3-3Zm-1.5 3a1.5 1.5 0 0 1 3 0v1h-3V6Zm-5 2.5h13a1 1 0 0 1 1 1V10h-15V9.5a1 1 0 0 1 1-1Zm-1 3.5h15v8a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-8Zm3 1.5 a1.5 1.5 0 1 0 3 0v-1a.75.75 0 0 1 1.5 0v1a3 3 0 1 1-6 0v-1a.75.75 0 0 1 1.5 0v1Zm7 0a1.5 1.5 0 1 0 3 0v-1a.75.75 0 0 1 1.5 0v1a3 3 0 1 1-6 0v-1a.75.75 0 0 1 1.5 0v1Z",
  taxi:      "M6.4 6.5h11.2c1.03 0 1.94.66 2.27 1.64l1.08 3.26A2.75 2.75 0 0 1 22 13.55v3.2c0 .69-.56 1.25-1.25 1.25H19.5a2.5 2.5 0 0 1-5 0h-5a2.5 2.5 0 0 1-5 0H3.25C2.56 18 2 17.44 2 16.75v-3.2c0-.82.37-1.6 1.02-2.12l1.11-3.29A2.4 2.4 0 0 1 6.4 6.5Zm-.85 4h12.9l-.73-2.13A.9.9 0 0 0 16.87 8H7.13a.9.9 0 0 0-.85.61L5.55 10.5ZM5 13.5a1 1 0 1 0 0 2h2a1 1 0 1 0 0-2H5Zm12 0a1 1 0 1 0 0 2h2a1 1 0 1 0 0-2h-2ZM7 17.25a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm10 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z",
  jobs:      "M7.5 5.5V5a3 3 0 0 1 3-3h3a3 3 0 0 1 3 3v.5H20a2.5 2.5 0 0 1 2.5 2.5v11a2.5 2.5 0 0 1-2.5 2.5H4a2.5 2.5 0 0 1-2.5-2.5v-11A2.5 2.5 0 0 1 4 5.5h3.5Zm1.5 0h6V5a1.5 1.5 0 0 0-1.5-1.5h-3A1.5 1.5 0 0 0 9 5v.5ZM4 7a1 1 0 0 0-1 1v2.5h18V8a1 1 0 0 0-1-1H4Zm-1 5v7C3 19.55 3.45 20 4 20h16a1 1 0 0 0 1-1v-7H3Zm6 2.25c0-.41.34-.75.75-.75h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1-.75-.75Z",
  groups:    "M16.5 13c1.38 0 2.5 1.12 2.5 2.5v1.5a1 1 0 0 1-1 1h-12a1 1 0 0 1-1-1v-1.5c0-1.38 1.12-2.5 2.5-2.5h9Zm0 1.5h-9c-.55 0-1 .45-1 1v.5h11v-.5c0-.55-.45-1-1-1ZM12 4a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm0 1.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM6.5 6a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Zm0 1.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm11-1.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Zm0 1.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"
};

function isUserAuthenticatedForHeader(): boolean {
  try {
    return Boolean(
      sessionStorage.getItem("watany_access_token") ||
      localStorage.getItem("watany_access_token"),
    );
  } catch {
    return false;
  }
}

function createIconLink(href: string, label: string, iconKey: keyof typeof ICON_PATHS, extraClass?: string) {
  const link = document.createElement("a");
  link.className = "watany-top-header__icon" + (extraClass ? " " + extraClass : "");
  link.href = toAppHref(href);
  link.setAttribute("aria-label", label);
  link.title = label;
  link.appendChild(createKoudamaHeaderIcon(iconKey));
  // Add badge container for worldcup icon so runtime can update counts
  if (iconKey === "worldcup") {
    const badge = document.createElement("span");
    badge.className = "watany-top-header__icon-badge";
    badge.style.display = "none";
    link.appendChild(badge);
    // expose a small API to update the badge
    (link as any).__updateBadge = (n: number) => {
      if (!badge) return;
      if (!n || n <= 0) {
        badge.style.display = "none";
        badge.textContent = "";
      } else {
        badge.style.display = "inline-flex";
        badge.textContent = n > 99 ? "99+" : String(n);
      }
    };
  }
  return link;
}

function createProfileMenuItem(href: string, label: string) {
  const link = document.createElement("a");
  link.className = "watany-top-header__profile-menu-item";
  link.href = toAppHref(href);
  link.textContent = label;
  return link;
}

function createProfileMenuButton() {
  const isAuthed = isUserAuthenticatedForHeader();
  const wrap = document.createElement("div");
  wrap.className = "watany-top-header__profile-menu-wrap";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "watany-top-header__icon watany-top-header__icon--profile-menu";
  button.setAttribute("aria-label", "ملف المستخدم");
  button.title = "ملف المستخدم";
  button.setAttribute("aria-haspopup", "menu");
  button.setAttribute("aria-expanded", "false");
  button.appendChild(createKoudamaHeaderIcon("person"));

  const menu = document.createElement("div");
  menu.className = "watany-top-header__profile-menu";
  menu.setAttribute("role", "menu");
  menu.hidden = true;
  menu.setAttribute("aria-hidden", "true");

  menu.appendChild(createProfileMenuItem("/settings", "الإعدادات"));
  menu.appendChild(createProfileMenuItem("/notifications", "الإشعارات"));
  if (isAuthed) {
    menu.appendChild(createProfileMenuItem("/profile", "الملف الشخصي"));
    const logout = document.createElement("button");
    logout.type = "button";
    logout.className = "watany-top-header__profile-menu-item watany-top-header__profile-menu-item--danger";
    logout.textContent = "تسجيل الخروج";
    logout.addEventListener("click", () => {
      try {
        sessionStorage.removeItem("watany_access_token");
        localStorage.removeItem("watany_access_token");
      } catch {
        // ignore storage failures
      }
      globalThis.location.assign(toAppHref("/"));
    });
    menu.appendChild(logout);
  } else {
    menu.appendChild(createProfileMenuItem("/login", "تسجيل الدخول"));
  }

  const closeMenu = () => {
    menu.hidden = true;
    menu.setAttribute("aria-hidden", "true");
    button.setAttribute("aria-expanded", "false");
    wrap.classList.remove("is-open");
    if (outsideAbortController) {
      outsideAbortController.abort();
      outsideAbortController = null;
    }
  };

  let outsideAbortController: AbortController | null = null;

  const armOutsideClose = () => {
    if (outsideAbortController) outsideAbortController.abort();
    outsideAbortController = new AbortController();
    const signal = outsideAbortController.signal;

    document.addEventListener("click", (event) => {
      if (!wrap.contains(event.target as Node)) {
        closeMenu();
      }
    }, { signal, capture: true });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    }, { signal });
  };

  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const willOpen = menu.hidden;
    if (willOpen) {
      menu.hidden = false;
      menu.setAttribute("aria-hidden", "false");
      button.setAttribute("aria-expanded", "true");
      wrap.classList.add("is-open");
      armOutsideClose();
    } else {
      closeMenu();
    }
  });

  wrap.appendChild(button);
  wrap.appendChild(menu);
  return wrap;
}

function createTickerNode(items: TickerItem[]) {
  const ticker = document.createElement("div");
  ticker.className = "watany-top-header__ticker";
  ticker.setAttribute("aria-label", "آخر التحديثات والأخبار");

  const track = document.createElement("div");
  track.className = "watany-top-header__ticker-track";

  const renderOnePass = () => {
    items.forEach((item, index) => {
      const href = hrefOf(item);
      const node = href ? document.createElement("a") : document.createElement("span");
      node.className = "watany-top-header__ticker-item";
      node.textContent = textOf(item);
      node.dataset.category = item.category || "update";

      if (href && node instanceof HTMLAnchorElement) {
        node.href = toAppHref(href);
        if (/^https?:\/\//i.test(href)) {
          node.target = "_blank";
          node.rel = "noreferrer noopener";
        }
      }

      const sep = document.createElement("span");
      sep.className = "watany-top-header__ticker-separator";
      sep.textContent = "•";

      track.appendChild(node);
      if (index < items.length - 1) track.appendChild(sep);
    });
  };

  renderOnePass();
  const duplicateSep = document.createElement("span");
  duplicateSep.className = "watany-top-header__ticker-separator";
  duplicateSep.textContent = "•";
  track.appendChild(duplicateSep);
  renderOnePass();

  ticker.appendChild(track);
  return ticker;
}

function createSearchNode() {
  const search = document.createElement("a");
  search.className = "watany-top-header__search";
  search.href = toAppHref("/chat");
  search.setAttribute("aria-label", "اسأل موطني");
  search.textContent = "اسأل موطني... نوفّرها تلقائياً عند توفرها";
  return search;
}

function removeDuplicateTopHeaders(activeHeader: HTMLElement) {
  document.querySelectorAll<HTMLElement>(".watany-top-header").forEach((node) => {
    if (node !== activeHeader) node.remove();
  });
}

function insertHeader(header: HTMLElement) {
  const root = document.querySelector("#root");
  const activeShell = document.querySelector<HTMLElement>(
    "[data-watany-recovery-shell='true'], .watany-recovery-shell, [data-watany-public-shell='true'], .watany-public-shell, .watany-mobile-shell, .app-shell--phone, [data-app-shell]"
  );
  const target = activeShell || root || document.body;

  if (!target) return;

  if (target.firstElementChild !== header) {
    target.insertBefore(header, target.firstElementChild);
  }
}

function isLandingPage(): boolean {
  if (globalThis.window === undefined || globalThis.document === undefined) {
    return false;
  }
  const path = globalThis.location.pathname;
  if (
    path === "/" ||
    path.endsWith("/landing") ||
    path.includes("/landing-page") ||
    path === "/jobs" ||
    path === "/marketplace"
  ) {
    return true;
  }
  if (
    document.querySelector("[data-watany-landing-body-template='true']") ||
    document.querySelector("[data-market-jobs-mobile-landing='true']") ||
    document.querySelector(".landing-page") ||
    document.querySelector(".mj-mobile-landing") ||
    document.querySelector(".watany-feature-landing")
  ) {
    return true;
  }
  return false;
}

async function buildHeader() {
  const existing = document.querySelector<HTMLElement>(".watany-top-header");
  const header = existing || document.createElement("div");
  header.className = "watany-top-header";
  header.setAttribute("dir", "rtl");
  header.dataset.watanyGlobalHeader = "true";

  const logo = findExistingLogo();
  if (logo.width) header.style.setProperty("--watany-top-logo-width", `${logo.width}px`);
  if (logo.height) header.style.setProperty("--watany-top-logo-height", `${logo.height}px`);

  const items = await fetchTickerItems();
  const signMode = readStoredSignMode();
  applySignMode(signMode);

  // ensure a clean header and remove any legacy profile nodes
  header.innerHTML = "";
  try {
    document.querySelectorAll<HTMLElement>(".watany-top-header__profile-menu-wrap, .watany-top-header__icon--profile-menu").forEach((n) => n.remove());
  } catch {
    // ignore
  }

  const topStrip = document.createElement("section");
  topStrip.className = "watany-top-header__top-strip";
  topStrip.setAttribute("aria-label", "الشريط العلوي");

  const logoCol = document.createElement("a");
  logoCol.className = "watany-top-header__logo-tile watany-top-header__logo";
  logoCol.href = toAppHref("/");
  logoCol.setAttribute("aria-label", "شعار موطني");

  const img = document.createElement("img");
  img.src = logo.src;
  img.alt = "موطني";
  img.className = 'watany-top-header__logo-img';
  img.onerror = () => {
    img.style.display = "none";
    logoCol.textContent = "موطني";
    logoCol.classList.add("watany-top-header__logo--text");
  };
  logoCol.appendChild(img);

  const ticker = createTickerNode(items);

  const iconRow = document.createElement("div");
  iconRow.className = "watany-top-header__icon-row";

  // Burger / Drawer Handle — real interactive button
  const burgerBtn = document.createElement("button");
  burgerBtn.type = "button";
  burgerBtn.className = "watany-mobile-shell__drawer-handle watany-top-header__burger";
  burgerBtn.dataset.testid = "watany-main-menu-toggle";
  burgerBtn.setAttribute("aria-label", "القائمة الرئيسية");
  burgerBtn.title = "القائمة";
  try {
    burgerBtn.appendChild(createKoudamaHeaderIcon("burger"));
  } catch {
    // ignore
  }
  burgerBtn.addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    globalThis.dispatchEvent(new CustomEvent("watany-open-main-menu", {
      detail: { focusActiveGroup: false },
    }));
  });
  iconRow.appendChild(burgerBtn);

  topStrip.appendChild(logoCol);
  topStrip.appendChild(ticker);
  topStrip.appendChild(iconRow);

  header.appendChild(topStrip);

  insertHeader(header);
  removeDuplicateTopHeaders(header);
  document.documentElement.classList.add("watany-has-sticky-top-header");
}

function scheduleBuild() {
  buildHeader().catch(() => {
    // Header must never break the app.
  });
}

function patchHistoryMethod(methodName: "pushState" | "replaceState") {
  const original = globalThis.history[methodName];
  globalThis.history[methodName] = function patchedHistoryMethod(...args) {
    const result = original.apply(this, args);
    globalThis.setTimeout(scheduleBuild, 0);
    return result;
  };
}

export function installWatanyTopHeaderRuntime() {
  const browserWindow = globalThis.window;
  if (browserWindow === undefined || globalThis.document === undefined) return;
  if (browserWindow.__watanyTopHeaderRuntimeInstalled) return;
  browserWindow.__watanyTopHeaderRuntimeInstalled = true;
  applySignMode(readStoredSignMode());

  patchHistoryMethod("pushState");
  patchHistoryMethod("replaceState");

  globalThis.addEventListener("popstate", scheduleBuild);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) scheduleBuild();
  });

  scheduleBuild();
  globalThis.setTimeout(scheduleBuild, 250);
  globalThis.setTimeout(scheduleBuild, 1200);
}

// Keep top-header badges in sync with AppShell counts
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function handleWorldCupCountsEvent(ev: Event) {
  try {
    const detail = (ev as CustomEvent).detail || {};
    const total = typeof detail.total === "number" ? detail.total : 0;
    // update any existing top-header worldcup icons
    document.querySelectorAll<HTMLElement>(".watany-top-header__icon").forEach((el) => {
      try {
        if (el.querySelector("svg path, svg") && el.className.includes("worldcup")) {
          const updater = (el as any).__updateBadge;
          if (typeof updater === "function") updater(total);
        }
      } catch {
        // ignore per-element errors
      }
    });
    // Fallback: update any badge containers directly if present
    try {
      document.querySelectorAll<HTMLElement>(".watany-top-header__icon-badge").forEach((badge) => {
        try {
          if (!total || total <= 0) {
            badge.style.display = "none";
            badge.textContent = "";
          } else {
            badge.style.display = "inline-flex";
            badge.textContent = total > 99 ? "99+" : String(total);
          }
        } catch {
          // ignore
        }
      });
    } catch {
      // ignore
    }
    // Worldcup icon insertion disabled: top-header should remain minimal per recent UI decision.
  } catch {
    // ignore
  }
}

globalThis.addEventListener("watany-worldcup-counts", handleWorldCupCountsEvent);

// APEX V1.19.0.15: badge visuals are owned by the canonical static theme.
/* APEX_LOGO_HOME_CLICK_GUARD_v1_0 */
(() => {
  if (globalThis.window === undefined || globalThis.document === undefined) return;
  const logoSelectors = [
    '[data-watany-logo-home]',
    '.watany-top-header__logo-tile',
    '.watany-top-header__brand',
    '.watany-brand-logo',
    '.watany-logo',
    'a[href="/"] img',
    'a[href="/"] svg'
  ];
  const findLogo = (target: EventTarget | null): Element | null => {
    if (!(target instanceof Element)) return null;
    for (const selector of logoSelectors) {
      const match = target.closest(selector);
      if (match) return match;
    }
    return null;
  };
  document.addEventListener('click', (event) => {
    const logo = findLogo(event.target);
    if (!logo) return;
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    const current = globalThis.location.pathname + globalThis.location.search + globalThis.location.hash;
    if (current !== '/') { globalThis.location.assign('/'); return; }
    globalThis.dispatchEvent(new CustomEvent('watany:logo-home-click', { detail: { source: 'top-logo' } }));
  }, true);
})();
