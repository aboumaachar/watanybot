import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from 'react';

import {
  getWatanyGuidedNavigationPilotRoutes,
  resolveWatanyGuidedNavigationPilot,
} from './watanyGuidedNavigationPilot';
import { useWatanyGuidedNavigationPilot } from './useWatanyGuidedNavigationPilot';

type WatanyGuidedPilotLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'onClick'> & {
  to: string;
  label?: string;
  children: ReactNode;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
};

function isModifiedClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
}

export function WatanyGuidedPilotLink({
  to,
  label,
  children,
  onClick,
  ...anchorProps
}: WatanyGuidedPilotLinkProps) {
  const { navigateWithPilot } = useWatanyGuidedNavigationPilot();
  const decision = resolveWatanyGuidedNavigationPilot(to);
  const pilotRoutes = getWatanyGuidedNavigationPilotRoutes();

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented || isModifiedClick(event)) return;
    if (anchorProps.target && anchorProps.target !== '_self') return;

    event.preventDefault();
    navigateWithPilot(to, { label });
  }

  return (
    <a
      {...anchorProps}
      href={decision.normalizedRoute}
      data-watany-guided-pilot={decision.allowed ? 'true' : undefined}
      data-watany-guided-pilot-routes={pilotRoutes.join(',')}
      onClick={handleClick}
    >
      {children}
    </a>
  );
}