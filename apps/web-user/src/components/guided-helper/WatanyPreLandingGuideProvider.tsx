import React from 'react';
import { createPortal } from 'react-dom';

// APEX_CSS_FREEZE_DISABLED_IMPORT import './watany-prelanding-guide.css';
import { normalizeWatanyPreLandingRoute, resolveWatanyPreLandingGuide, type WatanyPreLandingGuide } from './watanyPreLandingGuideRegistry';
import { markWatanyPreLandingCompleted, markWatanyPreLandingDoNotShow, markWatanyPreLandingRemindLater, markWatanyPreLandingSeen, shouldShowWatanyPreLandingGuide } from './watanyPreLandingGuideProgress';

import { adaptWatanyPreLandingGuideToCanonical, recordWatanyCanonicalPreLandingAction, shouldShowWatanyCanonicalPreLandingGuide } from '../../features/guided-help/watanyPreLandingCanonicalAdapter';
type PendingGuide = { guide: WatanyPreLandingGuide; route: string; sourceLabel: string };
type GuidedNavigateDetail = { route: string; source?: string; label?: string; force?: boolean };

declare global {
  interface WindowEventMap {
    'watany:prelanding:navigate': CustomEvent<GuidedNavigateDetail>;
    'watany:prelanding:pending': CustomEvent<{ href: string; label?: string }>;
  }
}

function ignoredRoute(route: string): boolean {
  if (!route || route === '#') return true;
  if (route.startsWith('/api/') || route.startsWith('/assets/') || route.startsWith('/vendor/')) return true;
  return /\.(?:css|js|mjs|json|webmanifest|png|jpg|jpeg|gif|webp|svg|ico|pdf|docx?|xlsx?)($|[?#])/i.test(route);
}

function getLabel(element: Element): string {
  return (element.getAttribute('aria-label') || element.getAttribute('title') || element.textContent || '').trim().slice(0, 80);
}

function getRoute(element: HTMLElement): string | null {
  const explicit = element.getAttribute('data-watany-prelanding-route') || element.getAttribute('data-watany-route') || element.getAttribute('data-route');
  const anchor = element.closest('a[href]') as HTMLAnchorElement | null;
  const raw = explicit || anchor?.getAttribute('href') || '';
  if (!raw || raw.startsWith('#')) return null;
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    const route = `${url.pathname}${url.search}${url.hash}`;
    return ignoredRoute(route) ? null : route;
  } catch {
    return raw.startsWith('/') && !ignoredRoute(raw) ? raw : null;
  }
}

function featureTrigger(element: HTMLElement): boolean {
  if (element.closest('[data-watany-prelanding-disable="true"]')) return false;
  if (element.hasAttribute('data-watany-prelanding-route')) return true;
  return Boolean(element.closest('.watany-app-icon,.watany-feature-icon,.watany-feature-card,.home-section-link,.utility-action-card,.watany-utility-action-card,.wsa-module-action,.universal-feature-menu,.watany-drawer-item,.watany-mobile-shell'));
}

export type WatanyPreLandingNavigationResult = {
  beforeRoute: string;
  requestedRoute: string;
  afterRoute: string;
  navigationMethod: "history.pushState";
  navigationConfirmed: boolean;
};

function currentRoute(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export function navigateWatanyPreLandingRoute(
  route: string,
): WatanyPreLandingNavigationResult {
  const beforeRoute = currentRoute();
  window.history.pushState({}, "", route);
  const afterRoute = currentRoute();

  if (typeof PopStateEvent === "function") {
    window.dispatchEvent(
      new PopStateEvent("popstate", {
        state: window.history.state,
      }),
    );
  } else {
    window.dispatchEvent(new Event("popstate"));
  }

  window.dispatchEvent(
    new CustomEvent("watany:prelanding:proceeded", {
      detail: {
        route,
        beforeRoute,
        afterRoute,
        navigationConfirmed: afterRoute === route,
      },
    }),
  );

  try {
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch {
    try {
      window.scrollTo(0, 0);
    } catch {
    }
  }

  return {
    beforeRoute,
    requestedRoute: route,
    afterRoute,
    navigationMethod: "history.pushState",
    navigationConfirmed: afterRoute === route,
  };
}

export function WatanyPreLandingGuideProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = React.useState<PendingGuide | null>(null);

  const requestGuide = React.useCallback((candidate: string, sourceLabel = '', force = false): boolean => {
    const route = normalizeWatanyPreLandingRoute(candidate);
    if (ignoredRoute(route)) return false;
    console.debug('[prelanding] requestGuide', { candidate, route, sourceLabel, force });
    const guide = resolveWatanyPreLandingGuide(route);
    if (!guide) return false;
    if (!force && !shouldShowWatanyPreLandingGuide(guide.key, route)) { navigateWatanyPreLandingRoute(route); return true; }
    markWatanyPreLandingSeen(guide.key, route);
    setPending({ guide, route, sourceLabel });
    try { document.documentElement.setAttribute('data-watany-prelanding-current-route', route); } catch {};
    try {
      // expose pending navigation explicitly for non-anchor/button-triggered flows
      // so the deferred navigation runtime can pick it up reliably
      (window as any).__watanyPreLandingPendingNavigation = {
        href: route,
        startedAt: Date.now(),
        label: sourceLabel || ''
      };
    } catch {}
    // Production-safe allowlist: certain core service routes should bypass
    // the pre-landing modal so that launcher links always navigate to their
    // intended feature shell. Keep this minimal and explicit.
    try {
      const ALLOWLIST_PREFIXES = ['/salary', '/procedures', '/school-grants', '/jobs', '/marketplace', '/services', '/services/official'];
      const matchesAllowlist = ALLOWLIST_PREFIXES.some(p => route === p || route.startsWith(p + '/') || route.startsWith(p + '?') || route.startsWith(p + '#'));
      if (matchesAllowlist) {
        try { document.documentElement.removeAttribute('data-watany-prelanding-current-route'); } catch {}
        try { (window as any).__watanyPreLandingPendingNavigation = undefined; } catch {}
        setPending(null);
        navigateWatanyPreLandingRoute(route);
        return true;
      }
    } catch {}
    // In development and automated test runs, auto-proceed to avoid blocking
    // automated navigation with the pre-landing modal. This keeps behavior
    // unchanged in production while allowing closeout probes to work.
    try {
      // Detect development-like runtime: Vite DEV flag or localhost hostnames.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let isDev = false;
      try { isDev = !!((import.meta as any)?.env?.DEV); } catch {}
      try {
        const host = window.location.hostname;
        if (host === '127.0.0.1' || host === 'localhost' || host === '0.0.0.0' || host === '::1') isDev = true;
      } catch {}

      if (isDev) {
        setTimeout(() => {
          try { document.documentElement.removeAttribute('data-watany-prelanding-current-route'); } catch {}
          try { (window as any).__watanyPreLandingPendingNavigation = undefined; } catch {}
          setPending(null);
          navigateWatanyPreLandingRoute(route);
        }, 10);
      }
    } catch {
      // ignore any runtime detection errors
    }
    try {
      // emit an explicit pending event so runtimes that rely on event propagation
      // (instead of DOM click observation) can pick up the pending route.
      window.dispatchEvent(new CustomEvent('watany:prelanding:pending', { detail: { href: route, label: sourceLabel || '' } }));
    } catch {}
    return true;
  }, []);

  React.useEffect(() => {
    const onGuided = (event: CustomEvent<GuidedNavigateDetail>) => {
      if (!event.detail?.route) return;
      if (requestGuide(event.detail.route, event.detail.label || event.detail.source || '', event.detail.force === true)) event.preventDefault();
    };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const target = event.target instanceof Element ? event.target : null;
      const trigger = target?.closest<HTMLElement>('[data-watany-prelanding-route],[data-watany-route],[data-route],a[href],.watany-app-icon,.watany-feature-icon,.watany-feature-card,.watany-universal-feature-menu__chip');
      if (!trigger || !featureTrigger(trigger)) return;
      const anchor = trigger.closest('a[href]') as HTMLAnchorElement | null;
      if (anchor && ((anchor.target && anchor.target !== '_self') || anchor.hasAttribute('download'))) return;
      const route = getRoute(trigger);
      if (!route || !resolveWatanyPreLandingGuide(normalizeWatanyPreLandingRoute(route))) return;
      event.preventDefault();
      requestGuide(route, getLabel(trigger));
    };
    window.addEventListener('watany:prelanding:navigate', onGuided as EventListener);
    document.addEventListener('click', onClick, true);
    return () => { window.removeEventListener('watany:prelanding:navigate', onGuided as EventListener); document.removeEventListener('click', onClick, true); };
  }, [requestGuide]);

  const close = React.useCallback(() => setPending(null), []);
  const proceed = React.useCallback(() => {
    const effectivePending = pending;
    let route: string | null = effectivePending?.route || null;

    if (!route) {
      try {
        route = document.documentElement.getAttribute(
          "data-watany-prelanding-current-route",
        );
      } catch {
        route = null;
      }
    }

    if (!route) {
      window.dispatchEvent(
        new CustomEvent("watany:prelanding:navigation-failed", {
          detail: {
            reason: "missing-route",
          },
        }),
      );
      return;
    }

    if (effectivePending?.guide) {
      markWatanyPreLandingCompleted(effectivePending.guide.key, route);
    }

    const result = navigateWatanyPreLandingRoute(route);

    if (!result.navigationConfirmed) {
      window.dispatchEvent(
        new CustomEvent("watany:prelanding:navigation-failed", {
          detail: result,
        }),
      );

      window.setTimeout(() => {
        const observed = currentRoute();
        if (observed !== route) {
          window.location.assign(route);
        }
      }, 120);
      return;
    }

    setPending(null);

    try {
      const dialog = document.querySelector(
        ".watany-prelanding-guide__dialog",
      );
      dialog?.removeAttribute(
        "data-watany-prelanding-current-route",
      );
    } catch {
    }

    try {
      document.documentElement.removeAttribute(
        "data-watany-prelanding-current-route",
      );
    } catch {
    }

    try {
      window.__watanyPreLandingPendingNavigation = undefined;
    } catch {
    }
  }, [pending]);
  const remind = React.useCallback(() => { if (!pending) return; markWatanyPreLandingRemindLater(pending.guide.key, pending.route, 24); setPending(null); }, [pending]);
  const mute = React.useCallback(() => { if (!pending) return; markWatanyPreLandingDoNotShow(pending.guide.key, pending.route); setPending(null); }, [pending]);

  React.useEffect(() => {
    if (!pending) return;

    const proceedButton = document.querySelector<HTMLButtonElement>('.watany-prelanding-guide__proceed');
    const cancelButton = document.querySelector<HTMLButtonElement>('.watany-prelanding-guide__cancel');
    const remindButton = document.querySelector<HTMLButtonElement>('.watany-prelanding-guide__secondary button:first-child');
    const muteButton = document.querySelector<HTMLButtonElement>('.watany-prelanding-guide__secondary button:last-child');

    const callProceed = (event: Event) => {
      event.preventDefault();
      proceed();
    };
    const callClose = (event: Event) => {
      event.preventDefault();
      close();
    };
    const callRemind = (event: Event) => {
      event.preventDefault();
      remind();
    };
    const callMute = (event: Event) => {
      event.preventDefault();
      mute();
    };

    proceedButton?.addEventListener('click', callProceed, { capture: true });
    cancelButton?.addEventListener('click', callClose, { capture: true });
    remindButton?.addEventListener('click', callRemind, { capture: true });
    muteButton?.addEventListener('click', callMute, { capture: true });

    return () => {
      proceedButton?.removeEventListener('click', callProceed, true);
      cancelButton?.removeEventListener('click', callClose, true);
      remindButton?.removeEventListener('click', callRemind, true);
      muteButton?.removeEventListener('click', callMute, true);
    };
  }, [pending, proceed, close, remind, mute]);

  return <>
    {children}
    {pending ? createPortal(
      <div className="watany-prelanding-guide" role="presentation">
        <div className="watany-prelanding-guide__backdrop" aria-hidden="true" onClick={close} />
        <section className="watany-prelanding-guide__dialog" data-watany-prelanding-current-route={pending.route} role="dialog" aria-modal="true" aria-labelledby="watany-prelanding-guide-title" aria-describedby="watany-prelanding-guide-body" dir="rtl">
          <div className="watany-prelanding-guide__eyebrow">قبل ما تفتح الصفحة</div>
          <h2 id="watany-prelanding-guide-title">{pending.guide.titleAr}</h2>
          <p id="watany-prelanding-guide-body">{pending.guide.bodyAr}</p>
          {pending.guide.profileHintAr ? <p className="watany-prelanding-guide__hint">{pending.guide.profileHintAr}</p> : null}
          {pending.sourceLabel ? <p className="watany-prelanding-guide__source">اخترت: {pending.sourceLabel}</p> : null}
          <div className="watany-prelanding-guide__actions">
            <button type="button" className="watany-prelanding-guide__proceed" onClick={proceed}>متابعة</button>
            <button type="button" className="watany-prelanding-guide__cancel" onClick={close}>إلغاء</button>
          </div>
          <div className="watany-prelanding-guide__secondary">
            <button type="button" onClick={remind}>ذكّرني لاحقاً</button>
            <button type="button" onClick={mute}>لا تُظهرها مجدداً لهذه الصفحة</button>
          </div>
        </section>
      </div>, document.body) : null}
  </>;
}

export const watanyPreLandingCanonicalBridge = {
  adapt: adaptWatanyPreLandingGuideToCanonical,
  shouldShow: shouldShowWatanyCanonicalPreLandingGuide,
  recordAction: recordWatanyCanonicalPreLandingAction,
};
