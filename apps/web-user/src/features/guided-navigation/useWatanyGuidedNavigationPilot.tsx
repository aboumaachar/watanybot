import { useCallback, useState } from 'react';
import type { WatanyGuidedPilotStep, WatanyGuidedPilotChoice } from './watanyGuidedNavigationPilot';
import { getWatanyGuidedPilotInitialStep, getWatanyGuidedPilotStep } from './watanyGuidedNavigationPilot';

export function useWatanyGuidedNavigationPilot() {
  const [currentStepId, setCurrentStepId] = useState<string>(() => getWatanyGuidedPilotInitialStep().id);

  const currentStep: WatanyGuidedPilotStep | undefined = getWatanyGuidedPilotStep(currentStepId);

  const select = useCallback((choice: WatanyGuidedPilotChoice) => {
    if (choice.nextStepId) setCurrentStepId(choice.nextStepId);
    else if (choice.route) setCurrentStepId('__complete__');
    else setCurrentStepId('__complete__');
  }, []);

  const reset = useCallback(() => setCurrentStepId(getWatanyGuidedPilotInitialStep().id), []);

  const back = useCallback(() => {
    // Simple back behavior: if on other-options go to start, else reset
    if (currentStepId === 'other-options') setCurrentStepId('start');
    else reset();
  }, [currentStepId, reset]);

  return {
    currentStepId,
    currentStep,
    select,
    reset,
    back,
  };
}
