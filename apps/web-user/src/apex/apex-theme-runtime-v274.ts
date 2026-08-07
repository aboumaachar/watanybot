const THEME_MARK = "v274";
const FOUNDATION_MARK = "approved-v4-shared-foundation";
const ROOT = document.documentElement;

type Focusable = HTMLElement & { focus: (options?: FocusOptions) => void };

let lastMenuTrigger: Focusable | null = null;
let closeInProgress = false;

function isVisible(element: Element | null): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false;
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    Number(style.opacity || "1") > 0 &&
    rect.width > 0 &&
    rect.height > 0
  );
}

function normalizedLabel(element: Element): string {
  return [
    element.getAttribute("aria-label") ?? "",
    element.getAttribute("title") ?? "",
    element.textContent ?? "",
  ].join(" ").replace(/\s+/g, " ").trim();
}

function isMenuTrigger(element: Element): boolean {
  const expanded = element.getAttribute("aria-expanded");
  const controls = element.getAttribute("aria-controls");
  const popup = element.getAttribute("aria-haspopup");
  const semanticLabel = /(menu|navigation|drawer|القائمة|التنقل)/i.test(
    normalizedLabel(element)
  );
  return semanticLabel || expanded !== null || controls !== null || popup !== null;
}

function isSemanticOpenDrawer(element: Element): element is HTMLElement {
  if (!(element instanceof HTMLElement) || !isVisible(element)) return false;

  const role = element.getAttribute("role");
  const ariaModal = element.getAttribute("aria-modal");
  const ariaHidden = element.getAttribute("aria-hidden");
  const dataState = element.getAttribute("data-state");
  const dataDrawer = element.getAttribute("data-drawer");

  return (
    role === "dialog" ||
    ariaModal === "true" ||
    dataDrawer === "open" ||
    dataState === "open" ||
    (
      element.hasAttribute("data-drawer") &&
      ariaHidden !== "true"
    )
  );
}

function visibleDrawer(): HTMLElement | null {
  const candidates = document.querySelectorAll<HTMLElement>(
    "[role='dialog'],[aria-modal='true'],[data-drawer],[data-state='open']"
  );
  return Array.from(candidates).find(isSemanticOpenDrawer) ?? null;
}

function isCloseControl(element: Element): boolean {
  return /(close|dismiss|إغلاق|اغلاق|×)/i.test(normalizedLabel(element));
}

function visibleCloseControl(drawer: HTMLElement): HTMLElement | null {
  const candidates = drawer.querySelectorAll<HTMLElement>(
    "button,[role='button'],a"
  );
  return Array.from(candidates).find(
    (element) => isVisible(element) && isCloseControl(element)
  ) ?? null;
}

function visibleBackdrop(): HTMLElement | null {
  const candidates = document.querySelectorAll<HTMLElement>(
    "[data-overlay],[data-backdrop],[aria-hidden='false'][data-overlay]"
  );
  return Array.from(candidates).find(isVisible) ?? null;
}

function syncDrawerState(): void {
  const open = Boolean(visibleDrawer());
  ROOT.dataset.apexDrawerOpen = open ? "true" : "false";
  if (!open) {
    document.body.style.removeProperty("overflow");
  }
}

function restoreFocus(): void {
  const target = lastMenuTrigger;
  lastMenuTrigger = null;
  if (target && document.contains(target)) {
    queueMicrotask(() => {
      try {
        target.focus({ preventScroll: true });
      } catch {
        target.focus();
      }
    });
  }
}

function requestCloseDrawer(reason: string): boolean {
  if (closeInProgress) return false;
  const drawer = visibleDrawer();
  if (!drawer) {
    syncDrawerState();
    return false;
  }

  closeInProgress = true;
  try {
    const close = visibleCloseControl(drawer);
    if (close) {
      close.click();
      drawer.dataset.apexCloseReason = reason;
      window.setTimeout(() => {
        syncDrawerState();
        if (!visibleDrawer()) restoreFocus();
      }, 0);
      return true;
    }

    const backdrop = visibleBackdrop();
    if (backdrop) {
      backdrop.click();
      drawer.dataset.apexCloseReason = reason;
      window.setTimeout(() => {
        syncDrawerState();
        if (!visibleDrawer()) restoreFocus();
      }, 0);
      return true;
    }

    drawer.dispatchEvent(
      new CustomEvent("apex-request-close", {
        bubbles: true,
        detail: { reason },
      })
    );
    return false;
  } finally {
    closeInProgress = false;
  }
}

function markTheme(): void {
  ROOT.dataset.apexTheme = THEME_MARK;
  ROOT.dataset.apexFoundation = FOUNDATION_MARK;
  document.body?.setAttribute("data-apex-theme-runtime", THEME_MARK);
  document.body?.setAttribute("data-apex-foundation-runtime", FOUNDATION_MARK);
  syncDrawerState();
}

function onClick(event: MouseEvent): void {
  const target = event.target instanceof Element
    ? event.target.closest<HTMLElement>(
        "button,[role='button'],a,[data-overlay],[data-backdrop]"
      )
    : null;

  if (!target) return;

  if (isMenuTrigger(target)) {
    lastMenuTrigger = target as Focusable;
    window.setTimeout(syncDrawerState, 0);
    return;
  }

  if (!visibleDrawer()) return;

  if (isCloseControl(target)) {
    window.setTimeout(() => {
      syncDrawerState();
      if (!visibleDrawer()) restoreFocus();
    }, 0);
    return;
  }

  if (
    target.matches("[data-overlay],[data-backdrop]") &&
    target === event.target
  ) {
    requestCloseDrawer("backdrop");
  }
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key === "Escape" && visibleDrawer()) {
    event.preventDefault();
    event.stopPropagation();
    requestCloseDrawer("escape");
  }
}

function closeAfterRouteChange(): void {
  window.setTimeout(() => {
    requestCloseDrawer("route-change");
    syncDrawerState();
  }, 0);
}

function patchHistory(): void {
  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);

  history.pushState = (...values: Parameters<History["pushState"]>) => {
    const result = originalPushState(...values);
    closeAfterRouteChange();
    return result;
  };

  history.replaceState = (...values: Parameters<History["replaceState"]>) => {
    const result = originalReplaceState(...values);
    closeAfterRouteChange();
    return result;
  };
}

function install(): void {
  markTheme();
  patchHistory();

  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("popstate", closeAfterRouteChange);
  window.addEventListener("hashchange", closeAfterRouteChange);

  const observer = new MutationObserver(markTheme);
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: [
      "class",
      "style",
      "hidden",
      "aria-hidden",
      "aria-expanded",
      "aria-modal",
      "data-state",
      "data-drawer",
    ],
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", install, { once: true });
} else {
  install();
}

export {};
