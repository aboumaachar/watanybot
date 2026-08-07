declare global {
  interface Window {
    __watanyGuidedHelpCtaOverlayCloseBridgeSafeV2?: boolean;
  }
}

const guidedSurfaceSelector = [
  '[data-guided-help]',
  '[data-watany-guided-help]',
  '[data-watany-helper]',
  '[data-helper-popup]',
  '.watany-guided-help',
  '.guided-help',
  '.guided-helper',
  '.watany-helper',
  '.watany-pre-landing-guide',
  '.pre-landing-guide'
].join(',');

const guidedOverlaySelector = [
  '[data-guided-help-backdrop]',
  '[data-watany-guided-help-backdrop]',
  '.watany-guided-help-backdrop',
  '.guided-help-backdrop',
  '.guided-helper-backdrop',
  '.watany-helper-backdrop',
  '.watany-pre-landing-guide-backdrop',
  '.pre-landing-guide-backdrop'
].join(',');

function asElement(target: EventTarget | null): Element | null {
  return target instanceof Element ? target : null;
}

function closestHtml(element: Element | null, selector: string): HTMLElement | null {
  if (!element) return null;
  const match = element.closest(selector);
  return match instanceof HTMLElement ? match : null;
}

function textOf(element: Element | null): string {
  if (!element) return '';
  return (element.textContent || '').trim().toLowerCase();
}

function looksLikeCancel(element: Element | null): boolean {
  const text = textOf(element);
  return text.includes('cancel') || text.includes('close') || text.includes('skip') || text.includes('later') || text.includes('إلغاء') || text.includes('اغلاق') || text.includes('إغلاق') || text.includes('لاحق') || text.includes('تخطي');
}

function looksLikeAction(element: Element | null): boolean {
  if (!element) return false;
  const tag = element.tagName.toLowerCase();
  if (tag === 'a' || tag === 'button') return true;
  if (element.getAttribute('role') === 'button') return true;
  if (element.hasAttribute('data-cta') || element.hasAttribute('data-action')) return true;
  return false;
}

function hideNode(node: HTMLElement): void {
  node.setAttribute('aria-hidden', 'true');
  node.setAttribute('data-watany-guided-hidden-by-bridge', 'true');
  node.style.opacity = '0';
  node.style.pointerEvents = 'none';
  node.style.visibility = 'hidden';
  node.style.display = 'none';
}

function cleanupGuidedHelpSurfaces(): void {
  document.querySelectorAll<HTMLElement>(guidedOverlaySelector).forEach(hideNode);
  document.querySelectorAll<HTMLElement>(guidedSurfaceSelector).forEach(hideNode);
  document.body.classList.remove('guided-help-open', 'watany-guided-help-open', 'modal-open', 'overflow-hidden');
  document.documentElement.classList.remove('guided-help-open', 'watany-guided-help-open', 'modal-open', 'overflow-hidden');
}

function focusMainLanding(): void {
  const main = document.querySelector<HTMLElement>('main, [role="main"], #root');
  if (!main) return;
  if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
  try { main.focus({ preventScroll: true }); } catch { main.focus(); }
}

function installBridge(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__watanyGuidedHelpCtaOverlayCloseBridgeSafeV2) return;
  window.__watanyGuidedHelpCtaOverlayCloseBridgeSafeV2 = true;

  document.addEventListener('click', (event: MouseEvent) => {
    const target = asElement(event.target);
    const guidedSurface = closestHtml(target, guidedSurfaceSelector);
    if (!target) return;

    if (guidedSurface) {
      const clickable = closestHtml(target, 'a, button, [role="button"], [data-cta], [data-action]');
      if (looksLikeCancel(clickable || target)) {
        event.preventDefault();
        event.stopPropagation();
        cleanupGuidedHelpSurfaces();
        focusMainLanding();
        return;
      }
      if (looksLikeAction(clickable || target)) {
        cleanupGuidedHelpSurfaces();
        window.setTimeout(cleanupGuidedHelpSurfaces, 0);
        return;
      }
    }

    window.setTimeout(() => {
      const leftover = document.querySelector(guidedOverlaySelector);
      if (leftover) cleanupGuidedHelpSurfaces();
    }, 0);
  }, true);
}

installBridge();

export {};
