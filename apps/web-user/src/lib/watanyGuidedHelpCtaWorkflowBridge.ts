/*
  Watany Guided Help CTA Workflow Bridge
  Purpose:
  - CTA buttons inside guided help popups hide the popup before their original action runs.
  - Cancel/close/skip actions hide the popup, cancel task execution, and return focus to the main landing area.
  - Implemented as a side-effect import so existing Guided Help components do not need to be rewritten first.
*/
interface WatanyGuidedHelpBridgeWindow extends Window {
  __watanyGuidedHelpCtaWorkflowBridgeInstalled?: boolean;
  WatanyGuidedHelpCtaWorkflowBridge?: {
    hideAll: (reason?: string) => number;
    focusLanding: () => boolean;
  };
}

type GuidedElement = HTMLElement & {
  dataset: DOMStringMap;
};

(function installWatanyGuidedHelpCtaWorkflowBridge(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  var bridgeWindow = window as WatanyGuidedHelpBridgeWindow;
  if (bridgeWindow.__watanyGuidedHelpCtaWorkflowBridgeInstalled) {
    return;
  }
  bridgeWindow.__watanyGuidedHelpCtaWorkflowBridgeInstalled = true;

  var cancelWords = [
    'cancel',
    'close',
    'dismiss',
    'skip',
    'later',
    'not now',
    'no',
    String.fromCharCode(0x625, 0x644, 0x63a, 0x627, 0x621),
    String.fromCharCode(0x627, 0x644, 0x63a, 0x627, 0x621),
    String.fromCharCode(0x644, 0x627),
    String.fromCharCode(0x644, 0x627, 0x62d, 0x642, 0x627),
    String.fromCharCode(0x62a, 0x62e, 0x637, 0x64a)
  ];

  var guidedSelectors = [
    '[data-watany-guided-help]',
    '[data-guided-help]',
    '[data-guided-helper]',
    '[data-help-popup]',
    '[data-watany-help]',
    '[data-tour]',
    '[data-onboarding]',
    '[role="dialog"]',
    '[aria-modal="true"]',
    '[class*="guided"]',
    '[class*="Guided"]',
    '[class*="helper"]',
    '[class*="Helper"]',
    '[class*="welcome"]',
    '[class*="Welcome"]',
    '[class*="onboarding"]',
    '[class*="Onboarding"]',
    '[class*="tooltip"]',
    '[class*="Tooltip"]',
    '[class*="popover"]',
    '[class*="Popover"]',
    '[class*="modal"]',
    '[class*="Modal"]'
  ].join(',');

  var actionSelectors = [
    'button',
    'a',
    '[role="button"]',
    '[data-action]',
    '[data-cta]',
    '[data-watany-action]',
    '[data-guided-help-action]',
    '[data-guided-action]'
  ].join(',');

  function getText(element: Element | null): string {
    if (!element) {
      return '';
    }
    var label = element.getAttribute('aria-label') || '';
    var title = element.getAttribute('title') || '';
    var action = element.getAttribute('data-action') || '';
    var cta = element.getAttribute('data-cta') || '';
    var text = (element.textContent || '') + ' ' + label + ' ' + title + ' ' + action + ' ' + cta;
    return text.replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function hasGuidedIdentity(element: Element | null): boolean {
    if (!element || !(element instanceof HTMLElement)) {
      return false;
    }

    var attrText = [
      element.getAttribute('data-watany-guided-help') || '',
      element.getAttribute('data-guided-help') || '',
      element.getAttribute('data-guided-helper') || '',
      element.getAttribute('data-help-popup') || '',
      element.getAttribute('data-watany-help') || '',
      element.getAttribute('data-tour') || '',
      element.getAttribute('data-onboarding') || '',
      element.getAttribute('class') || '',
      element.getAttribute('id') || '',
      element.getAttribute('aria-label') || '',
      element.getAttribute('role') || ''
    ].join(' ').toLowerCase();

    if (/guided|helper|help|welcome|onboarding|tour|tooltip|popover|modal|dialog/.test(attrText)) {
      return true;
    }

    var elementText = getText(element);
    if (/guided|help|welcome/.test(elementText)) {
      return true;
    }

    return false;
  }

  function closestGuidedContainer(start: Element | null): HTMLElement | null {
    var current: Element | null = start;
    while (current && current !== document.documentElement) {
      if (current instanceof HTMLElement) {
        if (hasGuidedIdentity(current)) {
          return current;
        }
        if (current.matches && current.matches(guidedSelectors) && hasGuidedIdentity(current)) {
          return current;
        }
      }
      current = current.parentElement;
    }

    var closestCandidate = start && start.closest ? start.closest(guidedSelectors) : null;
    if (closestCandidate instanceof HTMLElement && hasGuidedIdentity(closestCandidate)) {
      return closestCandidate;
    }

    return null;
  }

  function isCancelAction(element: Element): boolean {
    var raw = getText(element);
    var explicit = (
      element.getAttribute('data-guided-help-action') ||
      element.getAttribute('data-guided-action') ||
      element.getAttribute('data-watany-action') ||
      element.getAttribute('data-action') ||
      element.getAttribute('data-cta') ||
      ''
    ).toLowerCase();

    if (/cancel|close|dismiss|skip|later|not-now|no/.test(explicit)) {
      return true;
    }

    for (var i = 0; i < cancelWords.length; i += 1) {
      if (raw.indexOf(cancelWords[i]) >= 0) {
        return true;
      }
    }

    return false;
  }

  function focusLanding(): boolean {
    var focusTarget = document.querySelector(
      '[data-watany-main], [data-main-landing], main, [role="main"], #root'
    ) as HTMLElement | null;

    if (!focusTarget) {
      return false;
    }

    if (!focusTarget.hasAttribute('tabindex')) {
      focusTarget.setAttribute('tabindex', '-1');
      focusTarget.setAttribute('data-watany-guided-help-temp-tabindex', 'true');
    }

    try {
      focusTarget.focus({ preventScroll: true });
    } catch (_err) {
      try {
        focusTarget.focus();
      } catch (_focusErr) {
        return false;
      }
    }

    return document.activeElement === focusTarget || focusTarget.contains(document.activeElement);
  }

  function markHidden(container: HTMLElement, reason: string): void {
    container.setAttribute('data-watany-guided-help-dismissed', 'true');
    container.setAttribute('data-watany-guided-help-dismiss-reason', reason);
    container.setAttribute('aria-hidden', 'true');
    container.style.setProperty('display', 'none', 'important');
    container.style.setProperty('visibility', 'hidden', 'important');
    container.style.setProperty('pointer-events', 'none', 'important');

    var details = {
      reason: reason,
      at: new Date().toISOString()
    };

    try {
      container.dispatchEvent(new CustomEvent('watany:guided-help:hide', {
        bubbles: true,
        detail: details
      }));
    } catch (_containerEventError) {
      // non-blocking fallback
    }

    try {
      window.dispatchEvent(new CustomEvent('watany:guided-help:hide', {
        detail: details
      }));
    } catch (_windowEventError) {
      // non-blocking fallback
    }
  }

  function hideAll(reason?: string): number {
    var count = 0;
    var list = Array.prototype.slice.call(document.querySelectorAll(guidedSelectors)) as HTMLElement[];
    for (var i = 0; i < list.length; i += 1) {
      var element = list[i];
      if (element instanceof HTMLElement && hasGuidedIdentity(element)) {
        markHidden(element, reason || 'programmatic-hide');
        count += 1;
      }
    }
    return count;
  }

  function handleClick(event: MouseEvent): void {
    var target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    var actionElement = target.closest(actionSelectors);
    if (!(actionElement instanceof HTMLElement)) {
      return;
    }

    var container = closestGuidedContainer(actionElement);
    if (!container) {
      return;
    }

    if (isCancelAction(actionElement)) {
      markHidden(container, 'cancel');
      focusLanding();
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }
      return;
    }

    markHidden(container, 'cta-before-action');
  }

  document.addEventListener('click', handleClick, true);

  bridgeWindow.WatanyGuidedHelpCtaWorkflowBridge = {
    hideAll: hideAll,
    focusLanding: focusLanding
  };
})();

export {};
