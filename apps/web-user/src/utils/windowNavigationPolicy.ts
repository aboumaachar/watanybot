type WindowOpenFunction = typeof window.open;

type Cleanup = () => void;

function shouldAllowNewTab(anchor: HTMLAnchorElement): boolean {
  return anchor.dataset.allowNewTab === "true";
}

function isBlankTargetAnchor(element: Element | null): HTMLAnchorElement | null {
  if (!element) return null;
  const anchor = element.closest("a[target='_blank']");
  if (!(anchor instanceof HTMLAnchorElement)) return null;
  return anchor;
}

function resolveAnchorHref(anchor: HTMLAnchorElement): string | null {
  const rawHref = anchor.getAttribute("href")?.trim();
  if (!rawHref || rawHref === "#") return null;
  if (rawHref.toLowerCase().startsWith("javascript:")) return null;
  return rawHref;
}

function installAnchorSameWindowPolicy(): Cleanup {
  const onDocumentClick = (event: MouseEvent) => {
    if (event.defaultPrevented) return;
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const targetElement = event.target instanceof Element ? event.target : null;
    const anchor = isBlankTargetAnchor(targetElement);
    if (!anchor) return;
    if (shouldAllowNewTab(anchor)) return;

    const href = resolveAnchorHref(anchor);
    if (!href) return;

    event.preventDefault();
    window.location.assign(anchor.href || href);
  };

  document.addEventListener("click", onDocumentClick, true);
  return () => {
    document.removeEventListener("click", onDocumentClick, true);
  };
}

function installWindowOpenSameWindowPolicy(): Cleanup {
  const originalOpen: WindowOpenFunction = window.open.bind(window);

  window.open = ((url?: string | URL, target?: string, features?: string) => {
    const nextTarget = (target ?? "").toLowerCase();
    const allowNewTab = typeof features === "string" && features.includes("allow-new-tab");

    if (allowNewTab || (nextTarget && nextTarget !== "_blank")) {
      return originalOpen(url as any, target, features);
    }

    if (typeof url === "string" && url.trim()) {
      window.location.assign(url);
      return window;
    }

    if (url instanceof URL) {
      window.location.assign(url.toString());
      return window;
    }

    return originalOpen(url as any, target, features);
  }) as WindowOpenFunction;

  return () => {
    window.open = originalOpen;
  };
}

export function installSameWindowNavigationPolicy(): Cleanup {
  const cleanups = [installAnchorSameWindowPolicy(), installWindowOpenSameWindowPolicy()];
  return () => {
    cleanups.forEach((cleanup) => cleanup());
  };
}
