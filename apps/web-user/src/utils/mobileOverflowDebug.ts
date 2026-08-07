declare global {
  interface Window {
    __watanyOverflowDebugInstalled?: boolean;
    __watanyCheckOverflowNow?: () => void;
  }
}

const DEBUG_PARAM = "wmoDebugOverflow";
const DEBUG_STORAGE_KEY = "watany_debug_overflow";
const OUTLINE_ATTR = "data-overflow-debug-offender";
const ROOT_SELECTORS = [
  ".watany-mobile-shell__route-content",
  ".sa-page",
  ".admin-procedures-dashboard",
  ".procs-page",
  "main"
];

let lastSignature = "";

function isDebugEnabled() {
  try {
    const query = new URLSearchParams(window.location.search);
    if (query.get(DEBUG_PARAM) === "1") return true;
    if (window.localStorage?.getItem(DEBUG_STORAGE_KEY) === "1") return true;
  } catch {
    // Ignore storage/query failures.
  }

  return import.meta.env.DEV && import.meta.env.VITE_WATANY_DEBUG_OVERFLOW === "true";
}

function buildElementPath(element: Element) {
  const parts: string[] = [];
  let current: Element | null = element;

  while (current && parts.length < 5) {
    const tag = current.tagName.toLowerCase();
    const id = current.id ? `#${current.id}` : "";
    const className = (current.className || "")
      .toString()
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((token) => `.${token}`)
      .join("");
    parts.unshift(`${tag}${id}${className}`);
    current = current.parentElement;
  }

  return parts.join(" > ");
}

function isOverflowing(element: Element) {
  if (!(element instanceof HTMLElement)) return false;
  const epsilon = 1;
  return element.scrollWidth > element.clientWidth + epsilon;
}

function findRootElement() {
  for (const selector of ROOT_SELECTORS) {
    const found = document.querySelector(selector);
    if (found) return found;
  }
  return document.body;
}

function clearPreviousMark() {
  const previous = document.querySelector(`[${OUTLINE_ATTR}="1"]`);
  if (previous instanceof HTMLElement) {
    previous.removeAttribute(OUTLINE_ATTR);
    previous.style.removeProperty("box-shadow");
  }
}

function markOffender(element: HTMLElement) {
  clearPreviousMark();
  element.setAttribute(OUTLINE_ATTR, "1");
  // Inset ring does not affect layout metrics, unlike outlines with offsets.
  element.style.boxShadow = "inset 0 0 0 2px #ef4444";
}

function findFirstOverflowingDescendant(root: Element) {
  const stack: Element[] = [root];

  while (stack.length > 0) {
    const current = stack.shift();
    if (!current) continue;
    if (isOverflowing(current)) {
      return current as HTMLElement;
    }
    stack.push(...Array.from(current.children));
  }

  return null;
}

function runOverflowCheck() {
  const root = findRootElement();
  const offender = findFirstOverflowingDescendant(root);
  const rootElement = root as HTMLElement;

  const nextSignature = offender
    ? `${buildElementPath(offender)}|${offender.clientWidth}|${offender.scrollWidth}|${window.location.pathname}`
    : "none";

  if (lastSignature === nextSignature) return;
  lastSignature = nextSignature;

  if (!offender) {
    clearPreviousMark();
    return;
  }

  markOffender(offender);

  // Log one concise payload that can be copy-pasted into bug reports.
  console.warn("[watany-overflow-debug] horizontal overflow detected", {
    route: window.location.pathname,
    root: {
      selector: buildElementPath(root),
      clientWidth: rootElement.clientWidth,
      scrollWidth: rootElement.scrollWidth
    },
    offender: {
      selector: buildElementPath(offender),
      clientWidth: offender.clientWidth,
      scrollWidth: offender.scrollWidth
    }
  });
}

export function installMobileOverflowDebug() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (!isDebugEnabled()) return;
  if (window.__watanyOverflowDebugInstalled) return;

  window.__watanyOverflowDebugInstalled = true;

  let pending = false;
  const scheduleCheck = () => {
    if (pending) return;
    pending = true;
    window.requestAnimationFrame(() => {
      pending = false;
      runOverflowCheck();
    });
  };

  window.__watanyCheckOverflowNow = runOverflowCheck;
  window.addEventListener("resize", scheduleCheck);
  window.visualViewport?.addEventListener("resize", scheduleCheck);
  window.addEventListener("popstate", scheduleCheck);

  const observer = new MutationObserver(scheduleCheck);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  scheduleCheck();
  window.setTimeout(scheduleCheck, 300);
  window.setTimeout(scheduleCheck, 1000);
}
