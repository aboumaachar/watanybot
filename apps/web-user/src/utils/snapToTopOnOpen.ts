export function installSnapToTop() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if ((window as any).__watanySnapToTopInstalled) return;
  (window as any).__watanySnapToTopInstalled = true;

  function getScrollParent(node: Element | null): Element | (Document & ParentNode) {
    let el = node ? node.parentElement : null;
    while (el && el !== document.body && el !== document.documentElement) {
      const style = getComputedStyle(el);
      const overflow = style.overflowY || style.overflow;
      if (overflow === 'auto' || overflow === 'scroll' || overflow === 'overlay') return el;
      el = el.parentElement;
    }
    return document.scrollingElement || document.documentElement;
  }

  function parseOffset(): number {
    const doc = document.documentElement;
    const v = getComputedStyle(doc).getPropertyValue('--watany-safe-sticky-offset') || getComputedStyle(doc).getPropertyValue('--watany-top-logo-width') || '132px';
    const n = parseInt(v.trim(), 10);
    return Number.isFinite(n) ? n : 132;
  }

  function snapElement(el: Element) {
    try {
      if (el.closest('.popup-overlay, .popup-sheet, dialog, [role="dialog"]')) return;
      const parent = getScrollParent(el);
      const elRect = el.getBoundingClientRect();
      const parentIsDoc = parent === document.scrollingElement || parent === document.documentElement;
      const parentRect = parentIsDoc ? { top: 0, left: 0 } : (parent as Element).getBoundingClientRect();
      const offset = parseOffset();
      const extra = 12; // small gap below sticky header

      if (parentIsDoc) {
        const top = window.scrollY + elRect.top - offset - extra;
        window.scrollTo({ top: Math.max(0, Math.round(top)), behavior: 'smooth' });
      } else {
        const pn = parent as Element;
        const top = pn.scrollTop + (elRect.top - parentRect.top) - offset - extra;
        pn.scrollTo({ top: Math.max(0, Math.round(top)), behavior: 'smooth' });
      }
    } catch (err) {
      // swallow errors silently; snapping is best-effort
    }
  }

  const clickSelector = '.kw-main-card, [data-feature-key], .wt-card, .wt-card--clickable, .kw-service-tile, button[data-feature-key], a[data-feature-key]';

  document.addEventListener('click', (ev) => {
    const t = ev.target as Element | null;
    if (!t || !t.closest) return;
    if (t.closest('.popup-overlay, .popup-sheet, dialog, [role="dialog"]')) return;
    const el = t.closest(clickSelector) as Element | null;
    if (!el) return;
    // Defer so any popup/expanded state can apply first
    window.requestAnimationFrame(() => window.setTimeout(() => snapElement(el), 60));
  }, { passive: true });

  const mo = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'attributes') {
        const name = m.attributeName || '';
        if (name === 'aria-expanded' || name === 'open') {
          const target = m.target as Element;
          if (target.closest('.popup-overlay, .popup-sheet, dialog, [role="dialog"]')) continue;
          const expanded = target.getAttribute('aria-expanded') === 'true' || target.hasAttribute('open');
          if (expanded) {
            window.requestAnimationFrame(() => window.setTimeout(() => snapElement(target), 60));
          }
        }
      }
    }
  });

  mo.observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['aria-expanded', 'open'] });

  // Listen for a small set of custom events used by overlays/panels
  document.addEventListener('kw-panel-open', (e: Event) => {
    const detail = (e as CustomEvent).detail;
    const target = detail?.target ? document.querySelector(detail.target) : (e.target as Element);
    if (target) window.requestAnimationFrame(() => window.setTimeout(() => snapElement(target as Element), 60));
  });
}

export default installSnapToTop;
