import type { ReactNode } from "react";
// APEX_CSS_FREEZE_DISABLED_IMPORT import "./watany-landing-body-template.css";

type Props = Readonly<{
  children: ReactNode;
  className?: string;
}>;

export function WatanyLandingBodyTemplate({ children, className }: Props) {
  const rootClassName = ["watany-landing-body-template", className].filter(Boolean).join(" ");

  return (
    <section className={rootClassName} data-watany-landing-body-template="true" dir="rtl">
      <div className="watany-landing-body-template__inner">{children}</div>
    </section>
  );
}

// Client-side: trigger an initial snap-to-top for landing pages and notify
// the app that a landing has mounted so welcome guides can be offered.
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.requestAnimationFrame(() => {
    try {
      const inner = document.querySelector('.watany-landing-body-template__inner');
      if (!inner) return;
      const first = inner.querySelector('.kw-main-card, [data-feature-key], .wt-card, .kw-service-tile, .wt-card--clickable, button[data-feature-key], a[data-feature-key]');
      if (!first) return;
      first.setAttribute('data-watany-initial-snap', 'true');
      globalThis.dispatchEvent(new CustomEvent('kw-panel-open', { detail: { target: '[data-watany-initial-snap="true"]' } }));
      globalThis.dispatchEvent(new CustomEvent('watany-landing-mounted', { detail: { selector: '[data-watany-initial-snap="true"]' } }));
      window.setTimeout(() => first.removeAttribute('data-watany-initial-snap'), 2000);
    } catch {
      // best-effort
    }
  });
}
