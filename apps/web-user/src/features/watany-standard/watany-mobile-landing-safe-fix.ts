let lastOffset = "";

export {};

function setWatanyLandingOffset(): void {
  const header = document.querySelector<HTMLElement>(
    "header, [class*='TopBar'], [class*='TopMenu'], [class*='top-bar'], [class*='top-menu']"
  );

  const headerBottom = header ? Math.ceil(header.getBoundingClientRect().bottom) : 126;
  const offset = Math.min(Math.max(headerBottom + 10, 118), 176);
  const nextOffset = `${offset}px`;

  if (!document.documentElement.classList.contains("watany-safe-mobile-landing")) {
    document.documentElement.classList.add("watany-safe-mobile-landing");
  }

  if (lastOffset !== nextOffset) {
    lastOffset = nextOffset;
    document.documentElement.style.setProperty("--watany-safe-sticky-offset", nextOffset);
  }
}

function shouldSkipSafePanel(element: HTMLElement): boolean {
  return (
    element.id === "root" ||
    element.classList.contains("watany-drawer-page") ||
    element.classList.contains("watany-drawer-phone") ||
    element.classList.contains("watany-prelanding-guide") ||
    element.classList.contains("watany-prelanding-guide__dialog") ||
    element.closest(".watany-prelanding-guide") !== null ||
    element.closest('[data-watany-universal-feature-menu]') !== null
  );
}

function markSafePanels(): void {
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(
      "[role='dialog'], [aria-modal='true'], [class*='Drawer'], [class*='drawer'], [class*='Sheet'], [class*='sheet'], [class*='Menu'], [class*='menu']"
    )
  );

  for (const element of candidates) {
    if (element.classList.contains("watany-safe-side-drawer")) continue;
    if (shouldSkipSafePanel(element)) continue;

    const text = element.innerText || "";
    const rect = element.getBoundingClientRect();

    const looksLikeFeatureMenu =
      text.includes("حاسبة المعاش") ||
      text.includes("إفادة بالراتب") ||
      text.includes("روابط مفيدة") ||
      text.includes("المعاملات") ||
      text.includes("الإجراءات") ||
      text.includes("القوانين");

    if (looksLikeFeatureMenu && rect.height > 180) {
      element.classList.add("watany-safe-side-drawer");
    }
  }

  const blocks = Array.from(document.querySelectorAll<HTMLElement>("section, article, div"));
  for (const block of blocks) {
    if (block.classList.contains("watany-safe-updates-card")) continue;

    const text = block.innerText || "";
    const rect = block.getBoundingClientRect();

    if (text.includes("تحديثات") && text.includes("ملخص آخر ما حدث") && rect.height > 120 && rect.width > 260) {
      block.classList.add("watany-safe-updates-card");
    }
  }
}

let scheduled = false;

function runSafeFix(): void {
  setWatanyLandingOffset();
  markSafePanels();
}

function scheduleSafeFix(): void {
  if (scheduled) return;
  scheduled = true;

  window.setTimeout(() => {
    scheduled = false;
    runSafeFix();
  }, 120);
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runSafeFix, { once: true });
  } else {
    runSafeFix();
  }

  window.addEventListener("resize", scheduleSafeFix, { passive: true });
  window.addEventListener("orientationchange", scheduleSafeFix, { passive: true });
  window.addEventListener("click", scheduleSafeFix, { passive: true });

  const observer = new MutationObserver(scheduleSafeFix);
  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true
  });
}