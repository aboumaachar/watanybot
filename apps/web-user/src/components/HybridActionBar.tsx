import { useNavigate } from "react-router-dom";
import { useNavigateMode } from "../lib/routes";
import type { CTAAction } from "../lib/hybrid-routing";
import { executeHybridAction } from "../lib/service-flow-engine";

type Props = Readonly<{
  actions: CTAAction[];
}>;

export function HybridActionBar({ actions }: Props) {
  const navigate = useNavigate();
  const navigateMode = useNavigateMode();

  function handleAction(action: CTAAction) {
    executeHybridAction(action, { navigate, navigateMode });
  }

  return (
    <div className="hybrid-action-bar" role="group" aria-label="الخطوة التالية">
      {actions.map((action) => (
        <button
          key={action.id}
          data-feature-key={action.id}
          className="hybrid-action-bar__button"
          type="button"
          onClick={() => handleAction(action)}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}