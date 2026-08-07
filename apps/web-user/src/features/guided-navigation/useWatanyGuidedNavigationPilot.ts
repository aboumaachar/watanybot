import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  createWatanyGuidedNavigationPilotEvent,
  resolveWatanyGuidedNavigationPilot,
  type WatanyGuidedNavigationPilotDecision,
} from './watanyGuidedNavigationPilot';

export type WatanyGuidedNavigationPilotOptions = Readonly<{
  label?: string;
  beforeNavigate?: (decision: WatanyGuidedNavigationPilotDecision) => boolean | void;
}>;

export function useWatanyGuidedNavigationPilot() {
  const navigate = useNavigate();

  const navigateWithPilot = useCallback(
    (route: string, options: WatanyGuidedNavigationPilotOptions = {}) => {
      const decision = resolveWatanyGuidedNavigationPilot(route);

      if (!decision.allowed) {
        navigate(route);
        return decision;
      }

      const shouldContinue = options.beforeNavigate?.(decision);
      if (shouldContinue === false) {
        return decision;
      }

      const pilotEvent = createWatanyGuidedNavigationPilotEvent(decision.normalizedRoute, options.label);
      window.dispatchEvent(pilotEvent);

      if (!pilotEvent.defaultPrevented) {
        navigate(decision.normalizedRoute);
      }

      return decision;
    },
    [navigate],
  );

  return { navigateWithPilot };
}