const ROUTE_ACTIVATION_PANEL_SELECTOR = '[data-watany-route-activation-panel="true"]';
const ALL_FEATURES_LINK_SELECTOR = '[data-watany-all-features-link="true"]';

export function cleanupRouteActivationChrome(): void {
  document.querySelectorAll<HTMLElement>(ROUTE_ACTIVATION_PANEL_SELECTOR).forEach((node) => {
    node.remove();
  });

  document.querySelectorAll<HTMLElement>(ALL_FEATURES_LINK_SELECTOR).forEach((node) => {
    const parent = node.parentElement;
    if (parent && parent.childElementCount === 1 && !parent.hasAttribute('data-watany-route-activation-panel')) {
      parent.remove();
      return;
    }
    node.remove();
  });
}

export function shouldAllowRouteActivationOptIn(pathname: string): boolean {
  const normalizedPath = pathname || "/";
  const isHomePath = normalizedPath === "/" || normalizedPath === "/mobile-os";
  return isHomePath && document.documentElement.hasAttribute('data-watany-route-activation-opt-in');
}

export function clearRouteActivationOptIn(): void {
  document.documentElement.removeAttribute('data-watany-route-activation-opt-in');
}