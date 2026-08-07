import type { ReactNode } from 'react';
import { resolveNotificationBadgeFeatureKey } from './notification-badge-types';
import { useNotificationBadges } from './NotificationBadgeProvider';
// APEX_CSS_FREEZE_DISABLED_IMPORT import './notification-badges.css';

type IconNotificationBadgeProps = {
  featureKey: string;
  count?: number;
  max?: number;
  label?: string;
  className?: string;
  children: ReactNode;
};

function formatBadgeCount(count: number, max: number): string {
  if (count > max) return `${max}+`;
  return String(count);
}

export function IconNotificationBadge({
  featureKey,
  count = 0,
  max = 99,
  label,
  className = '',
  children,
}: IconNotificationBadgeProps) {
  const normalizedKey = resolveNotificationBadgeFeatureKey(featureKey);
  const safeCount = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  const display = safeCount > 0 ? formatBadgeCount(safeCount, max) : '';
  const ariaLabel = label || `${safeCount} new updates`;

  return (
    <span
      className={`watany-icon-badge-wrap ${className}`.trim()}
      data-feature-key={normalizedKey}
      data-has-badge={safeCount > 0 ? 'true' : 'false'}
    >
      {children}
      {safeCount > 0 ? (
        <span className="watany-icon-badge" aria-label={ariaLabel} title={ariaLabel}>
          {display}
        </span>
      ) : null}
    </span>
  );
}

type FeatureIconNotificationBadgeProps = Omit<IconNotificationBadgeProps, 'count'>;

export function FeatureIconNotificationBadge(props: FeatureIconNotificationBadgeProps) {
  const { getCount, getItem } = useNotificationBadges();
  const count = getCount(props.featureKey);
  const item = getItem(props.featureKey);

  return (
    <IconNotificationBadge
      {...props}
      count={count}
      label={item?.label || props.label}
    />
  );
}
