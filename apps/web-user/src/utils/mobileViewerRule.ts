const OVERLAY_CLASS = "watany-v1-snapped-popup-overlay";
const HEADER_SNAP_CLASS = "watany-v1-header-snap-closeout";
const BODY_SNAP_CLASS = "watany-v1-body-portal-snap-closeout";
const READY_ATTR = "data-watany-v1-snapped-popup-ready";

const OVERLAY_SELECTORS = [
  ".popup-overlay",
  ".form-viewer-overlay",
  ".watany-mobile-popup-backdrop",
  "dialog[open]",
  "[role='dialog'][aria-modal='true']",
].join(",");

const PANEL_SELECTORS = [
  ".popup-sheet",
  ".form-viewer-container",
  ".watany-mobile-popup",
  ".kw-profile-sheet__panel",
  ".kw-overlay-panel",
].join(",");

const DRAWER_GUARD = [
  ".launcher-drawer",
  ".launcher-drawer__backdrop",
  ".watany-mobile-shell__drawer-handle",
  ".watany-force-side-drawer",
  ".watany-recovery-drawer-layer",
  ".watany-recovery-drawer",
  ".watany-recovery-drawer-backdrop",
].join(",");

const HYBRID_LAUNCHER_GUARD = '[data-sticky-hybrid-chat-launcher="true"]';

type ViewerRuleScanSummary = {
  checked: number;
  anomalies: number;
  entries: Array<{ selector: string; reason: string }>;
};

declare global {
  interface Window {
    __watanyMobileViewerRuleInstalled?: boolean;
    __watanyMobileViewerRuleScan?: ViewerRuleScanSummary;
  }
}

function getStickyTopOffset(): number {
  const header = document.querySelector<HTMLElement>(
    ".watany-mobile-shell__topbar, [aria-label='الشريط العلوي'], header, [class*='TopBar'], [class*='topbar'], [class*='top-bar']"
  );
  if (!header) return 72;
  return Math.max(64, Math.ceil(header.getBoundingClientRect().bottom));
}

function getBottomComposerInset(): number {
  const composer = document.querySelector<HTMLElement>("form[aria-label='اسأل موطني']");
  if (!composer) return 0;
  return Math.max(0, Math.ceil(window.innerHeight - composer.getBoundingClientRect().top));
}

function isOverlayCandidate(element: HTMLElement): boolean {
  if (element.matches(HYBRID_LAUNCHER_GUARD) || element.closest(HYBRID_LAUNCHER_GUARD)) return false;
  if (element.matches(DRAWER_GUARD) || element.closest(DRAWER_GUARD)) return false;
  if (element.classList.contains("market-commerce-sheet")) return false;
  // Keep prelanding guide modal fully owned by its component styles/events.
  if (element.classList.contains("watany-prelanding-guide__dialog")) return false;
  if (element.classList.contains("watany-prelanding-guide")) return false;
  if (element.closest(".watany-prelanding-guide")) return false;
  // Universal feature menu handles its own positioning; exclude from V1 snap
  if (element.closest('[data-watany-universal-feature-menu]')) return false;
  return true;
}

function clearOverlaySnap(element: HTMLElement): void {
  element.classList.remove(OVERLAY_CLASS);
  element.style.removeProperty("--watany-v1-snap-top");
  element.style.removeProperty("--watany-v1-snap-bottom");
  element.style.removeProperty("--watany-v1-snap-max-height");
}

function applyOverlaySnap(element: HTMLElement): void {
  const top = getStickyTopOffset();
  const bottom = getBottomComposerInset();
  const height = Math.max(240, Math.floor(window.innerHeight - top - bottom));
  element.classList.add(OVERLAY_CLASS);
  element.style.setProperty("--watany-v1-snap-top", `${top}px`, "important");
  element.style.setProperty("--watany-v1-snap-bottom", `${bottom}px`, "important");
  element.style.setProperty("--watany-v1-snap-max-height", `${height}px`, "important");
}

function applyPanelSnap(element: HTMLElement): void {
  const panel = element.querySelector<HTMLElement>(PANEL_SELECTORS);
  if (!panel) return;
  panel.classList.add(HEADER_SNAP_CLASS, BODY_SNAP_CLASS);
  panel.setAttribute("data-watany-v1-header-snap-closeout", "v2.1.1");
  panel.setAttribute("data-watany-v1-body-portal-snap-closeout", "v2.1.2");
}

function enforceRuleAndScan(): void {
  const mobile = window.innerWidth <= 768;
  const overlays = Array.from(document.querySelectorAll<HTMLElement>(OVERLAY_SELECTORS)).filter(isOverlayCandidate);
  const scan: ViewerRuleScanSummary = { checked: overlays.length, anomalies: 0, entries: [] };

  document.documentElement.setAttribute(READY_ATTR, "true");

  for (const overlay of overlays) {
    if (!mobile) {
      clearOverlaySnap(overlay);
      continue;
    }

    applyOverlaySnap(overlay);
    applyPanelSnap(overlay);

    const rect = overlay.getBoundingClientRect();
    const topExpected = getStickyTopOffset();
    const maxAllowedWidth = Math.min(430, window.innerWidth - 8);

    if (rect.top + 2 < topExpected) {
      scan.anomalies += 1;
      scan.entries.push({ selector: overlay.className || overlay.tagName, reason: "top_not_snapped" });
    }

    if (rect.width > maxAllowedWidth + 8) {
      scan.anomalies += 1;
      scan.entries.push({ selector: overlay.className || overlay.tagName, reason: "width_not_compact" });
    }
  }

  window.__watanyMobileViewerRuleScan = scan;
}

export function installMobileViewerRule(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.__watanyMobileViewerRuleInstalled) return;
  window.__watanyMobileViewerRuleInstalled = true;

  let raf = 0;
  const schedule = () => {
    if (raf) return;
    raf = window.requestAnimationFrame(() => {
      raf = 0;
      enforceRuleAndScan();
    });
  };

  schedule();
  window.addEventListener("resize", schedule, { passive: true });
  window.addEventListener("orientationchange", schedule, { passive: true });
  document.addEventListener("click", () => window.setTimeout(schedule, 60), { passive: true });

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["class", "style", "open", "aria-modal", "role"],
  });
}

export default installMobileViewerRule;
