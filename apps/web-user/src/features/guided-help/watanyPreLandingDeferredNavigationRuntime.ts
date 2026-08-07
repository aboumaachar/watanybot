type PendingWatanyGuideNavigation = {
  href: string;
  startedAt: number;
  label: string;
};

declare global {
  interface Window {
    __watanyPreLandingPendingNavigation?: PendingWatanyGuideNavigation;
    __watanyPreLandingDeferredNavigationRuntimeInstalled?: boolean;
  }
}

const ANCHOR_SELECTOR = "a[href]";

function isPrimarySameWindowClick(event: MouseEvent): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

function normalizeInternalHref(rawHref: string | null): string {
  if (!rawHref) {
    return "";
  }

  try {
    const url = new URL(rawHref, window.location.origin);
    if (url.origin !== window.location.origin) {
      return "";
    }

    return `${url.pathname || "/"}${url.search || ""}${url.hash || ""}`;
  } catch {
    return "";
  }
}

function closestAnchor(target: EventTarget | null): HTMLAnchorElement | null {
  if (!(target instanceof Element)) {
    return null;
  }

  return target.closest<HTMLAnchorElement>(ANCHOR_SELECTOR);
}

function readElementLabel(element: Element): string {
  const ariaLabel = element.getAttribute("aria-label") || "";
  const title = element.getAttribute("title") || "";
  const text = element.textContent || "";

  return (ariaLabel || title || text)
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 180);
}

function clearPendingNavigation(): void {
  window.__watanyPreLandingPendingNavigation = undefined;
  document.documentElement.removeAttribute(
    "data-watany-prelanding-pending-href",
  );
}

function rememberPendingNavigation(anchor: HTMLAnchorElement): void {
  const href = normalizeInternalHref(anchor.getAttribute("href"));
  if (!href || href === "#") {
    return;
  }

  window.__watanyPreLandingPendingNavigation = {
    href,
    startedAt: Date.now(),
    label: readElementLabel(anchor),
  };

  document.documentElement.setAttribute(
    "data-watany-prelanding-pending-href",
    href,
  );
}

let pendingRouteReconciliationTimer: number | undefined;

function schedulePendingRouteReconciliation(expectedHref: string): void {
  if (pendingRouteReconciliationTimer !== undefined) {
    window.clearTimeout(pendingRouteReconciliationTimer);
  }

  let remainingChecks = 20;

  const reconcile = (): void => {
    const pending = window.__watanyPreLandingPendingNavigation;
    if (!pending || pending.href !== expectedHref) {
      pendingRouteReconciliationTimer = undefined;
      return;
    }

    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (current === expectedHref) {
      clearPendingNavigation();
      pendingRouteReconciliationTimer = undefined;
      return;
    }

    remainingChecks -= 1;
    if (remainingChecks <= 0) {
      pendingRouteReconciliationTimer = undefined;
      return;
    }

    pendingRouteReconciliationTimer = window.setTimeout(reconcile, 50);
  };

  pendingRouteReconciliationTimer = window.setTimeout(reconcile, 0);
}

function handleDocumentClickCapture(event: MouseEvent): void {
  if (!isPrimarySameWindowClick(event)) {
    return;
  }

  const anchor = closestAnchor(event.target);
  if (!anchor) {
    return;
  }

  if (
    (anchor.target && anchor.target !== "_self") ||
    anchor.hasAttribute("download")
  ) {
    return;
  }

  rememberPendingNavigation(anchor);
  const pendingHref = window.__watanyPreLandingPendingNavigation?.href;
  if (pendingHref) {
    schedulePendingRouteReconciliation(pendingHref);
  }
}

function handleKeyDown(event: KeyboardEvent): void {
  if (event.key !== "Enter") {
    return;
  }

  const active = document.activeElement;
  if (!(active instanceof HTMLAnchorElement)) {
    return;
  }

  rememberPendingNavigation(active);
  const pendingHref = window.__watanyPreLandingPendingNavigation?.href;
  if (pendingHref) {
    schedulePendingRouteReconciliation(pendingHref);
  }
}

function handlePopState(): void {
  clearPendingNavigation();
}

export function installWatanyPreLandingDeferredNavigationRuntime(): void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  if (window.__watanyPreLandingDeferredNavigationRuntimeInstalled) {
    return;
  }

  window.__watanyPreLandingDeferredNavigationRuntimeInstalled = true;
  document.addEventListener("click", handleDocumentClickCapture, true);
  document.addEventListener("keydown", handleKeyDown, true);
  window.addEventListener("popstate", handlePopState);
}

export function uninstallWatanyPreLandingDeferredNavigationRuntime(): void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  document.removeEventListener("click", handleDocumentClickCapture, true);
  document.removeEventListener("keydown", handleKeyDown, true);
  window.removeEventListener("popstate", handlePopState);
  if (pendingRouteReconciliationTimer !== undefined) {
    window.clearTimeout(pendingRouteReconciliationTimer);
    pendingRouteReconciliationTimer = undefined;
  }
  window.__watanyPreLandingDeferredNavigationRuntimeInstalled = false;
  clearPendingNavigation();
}

export {};