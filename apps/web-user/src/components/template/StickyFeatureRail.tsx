import type { ReactNode } from "react";
// APEX_CSS_FREEZE_DISABLED_IMPORT import "../../styles/wc-sticky-header.css";

export type StickyFeatureRailItem = Readonly<{
  label: string;
  href: string;
  icon: ReactNode;
  /** Optional numeric badge to show on the pill (e.g., unread count) */
  count?: number;
  active?: boolean;
  title?: string;
  ariaLabel?: string;
  target?: string;
  rel?: string;
  onClick?: () => void;
}>;

export type StickyFeatureRailProps = Readonly<{
  ariaLabel: string;
  items: readonly StickyFeatureRailItem[];
  className?: string;
  accentColor?: string;
}>;

export function StickyFeatureRail({ ariaLabel, items, className, accentColor }: StickyFeatureRailProps) {
  const rootClassName = ["wc-feature-rail", className].filter(Boolean).join(" ");

  return (
    <nav className={rootClassName} aria-label={ariaLabel} data-sticky-feature-rail="true">
      {items.map((item) => (
        <a
          key={`${item.href}-${item.label}`}
          href={item.href}
          target={item.target}
          rel={item.rel}
          onClick={item.onClick}
          className={`wc-feature-pill${item.active ? " is-active" : ""}`}
          aria-label={item.ariaLabel ?? item.label}
          title={item.title ?? item.label}
          data-pillar-accent={accentColor}
        >
          <span aria-hidden="true">{item.icon}</span>
          <span className="wc-feature-pill__label">{item.label}</span>
          {item.count && item.count > 0 ? (
            <span className="wc-feature-pill__count" aria-hidden="true">{item.count > 99 ? "99+" : item.count}</span>
          ) : null}
        </a>
      ))}
    </nav>
  );
}
