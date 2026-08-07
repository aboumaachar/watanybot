const ROOT_CLASS = "watany-mobile-visual-fixes-enabled";

export {};

function getStickyHeaderHeight(): number {
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(
      [
        "[data-testid*='top']",
        "[class*='TopBar']",
        "[class*='top-bar']",
        "[class*='TopMenu']",
        "[class*='top-menu']",
        "[class*='sticky']",
        "header"
      ].join(",")
    )
  );

  let bestHeight = 112;
  for (const element of candidates) {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    const isTop = rect.top <= 24;
    const isVisible = rect.width > 120 && rect.height > 30;
    const isStickyLike = style.position === "sticky" || style.position === "fixed" || isTop;
    if (isVisible && isStickyLike) {
      bestHeight = Math.max(bestHeight, Math.ceil(rect.bottom));
    }
  }

  return Math.min(Math.max(bestHeight + 10, 118), 190);
}

function setStickyOffset(): void {
  const offset = getStickyHeaderHeight();
  document.documentElement.style.setProperty("--watany-sticky-offset", `${offset}px`);
}

function normalizeScrollablePanels(): void {
  const selectors = [
    "[role='dialog']",
    "[aria-modal='true']",
    "[class*='Drawer']",
    "[class*='drawer']",
    "[class*='Menu']",
    "[class*='menu']",
    "[class*='Sheet']",
    "[class*='sheet']",
    "[class*='Panel']",
    "[class*='panel']"
  ];

  const elements = Array.from(document.querySelectorAll<HTMLElement>(selectors.join(",")));

  for (const element of elements) {
    // Skip universal feature menu — it manages its own layout
    if (element.closest('[data-watany-universal-feature-menu]')) continue;
    // Skip prelanding guide modal to avoid turning it into side-drawer layout.
    if (element.classList.contains("watany-prelanding-guide")) continue;
    if (element.classList.contains("watany-prelanding-guide__dialog")) continue;
    if (element.closest(".watany-prelanding-guide")) continue;

    // Skip known overlay / "fake page" roots so opening them doesn't
    // cause the global layout to flip into the drawer style.
    const SKIP_ROOTS = [
      '#watany-form-viewer-root',
      '.kw-agent5-root',
      '.watany-v1-snapped-popup-overlay',
      '.watany-mobile-popup-backdrop'
    ];
    const skipSelector = SKIP_ROOTS.join(',');
    if (element.closest(skipSelector)) continue;

    const text = (element.innerText || "").trim();
    const rect = element.getBoundingClientRect();

    const looksLikeFeatureMenu =
      text.includes("\u0627\u0644\u0645\u0633\u0627\u0639\u062f") ||
      text.includes("\u062d\u0627\u0633\u0628\u0629") ||
      text.includes("\u0627\u0644\u0645\u0639\u0627\u0634") ||
      text.includes("\u0627\u0644\u0642\u0648\u0627\u0646\u064a\u0646") ||
      text.includes("\u0627\u0644\u0625\u062c\u0631\u0627\u0621\u0627\u062a");

    const isNarrowCenteredPanel = rect.width > 180 && rect.width < window.innerWidth * 0.92 && rect.left > 40;
    const isTallPanel = rect.height > window.innerHeight * 0.35;

    if (looksLikeFeatureMenu && (isNarrowCenteredPanel || isTallPanel)) {
      element.classList.add("watany-force-side-drawer");
    }

    const looksLikeExpandedCard =
      text.includes("\u062a\u062d\u062f\u064a\u062b\u0627\u062a") ||
      text.includes("\u0645\u0644\u062e\u0635") ||
      text.includes("\u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645");

    if (looksLikeExpandedCard && rect.height > 120) {
      element.classList.add("watany-expanded-card-panel");
    }
  }
}

function normalizeUpdatesSection(): void {
  const elements = Array.from(document.querySelectorAll<HTMLElement>("section, article, div, main"));

  for (const element of elements) {
    if (element.classList.contains("watany-prelanding-guide")) continue;
    if (element.classList.contains("watany-prelanding-guide__dialog")) continue;
    if (element.closest(".watany-prelanding-guide")) continue;
    const text = (element.innerText || "").trim();
    const rect = element.getBoundingClientRect();

    if (text.includes("\u062a\u062d\u062f\u064a\u062b\u0627\u062a") && text.includes("\u0645\u0644\u062e\u0635") && rect.height > 90) {
      element.classList.add("watany-updates-visual-fix");
    }
  }
}

function normalizeHeaderIcons(): void {
  const headerCandidates = Array.from(
    document.querySelectorAll<HTMLElement>(
      "header, [class*='TopBar'], [class*='TopMenu'], [class*='top-bar'], [class*='top-menu']"
    )
  );

  for (const header of headerCandidates) {
    const rect = header.getBoundingClientRect();
    if (rect.top < 40 && rect.height > 35) {
      header.classList.add("watany-top-header-visual-fix");
    }
  }
}

function applyFixes(): void {
  document.documentElement.classList.add(ROOT_CLASS);
  setStickyOffset();
  normalizeScrollablePanels();
  normalizeUpdatesSection();
  normalizeHeaderIcons();
}

let scheduled = false;

function scheduleFixes(): void {
  if (scheduled) return;
  scheduled = true;
  window.requestAnimationFrame(() => {
    scheduled = false;
    applyFixes();
  });
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyFixes, { once: true });
  } else {
    applyFixes();
  }

  window.addEventListener("resize", scheduleFixes, { passive: true });
  window.addEventListener("orientationchange", scheduleFixes, { passive: true });
  window.addEventListener("click", () => window.setTimeout(scheduleFixes, 80), { passive: true });
  window.addEventListener("scroll", scheduleFixes, { passive: true });

  const observer = new MutationObserver(scheduleFixes);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "style", "aria-hidden", "open"]
  });
}