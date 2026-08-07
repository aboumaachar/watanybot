/** @vitest-environment happy-dom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomeScreen } from "./HomeScreen";
import { FeatureFlagsContext, type FeatureFlagsState } from "../store/features";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("./KoudamaGroupedDashboard", () => ({
  KoudamaGroupedDashboard: () => <div data-home-test-grouped-dashboard="true" />,
}));

vi.mock("../features/smart-dashboard/stage-a", () => ({
  SmartDashboardStageASection: () => <div data-home-test-smart-dashboard="true" />,
}));

vi.mock("./koudama-icons/KoudamaFeatureIcon", () => ({
  default: ({ featureId }: { featureId: string }) => <span data-home-test-icon={featureId} />,
}));

vi.mock("./IconShell", () => ({
  IconShell: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span className={className}>{children}</span>
  ),
}));

const enabledFeatureFlags: FeatureFlagsState = {
  flags: {} as FeatureFlagsState["flags"],
  isHydrated: true,
  isEnabled: () => true,
  isModeEnabled: () => true,
  toggle: () => {},
  setFlag: () => {},
  resetAll: () => {},
};

async function flushEffects(times = 4) {
  await act(async () => {
    for (let index = 0; index < times; index += 1) {
      await Promise.resolve();
    }
  });
}

describe("HomeScreen", () => {
  let container: HTMLDivElement;
  let root: Root;

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root.unmount();
      });
    }

    if (container?.isConnected) {
      container.remove();
    }
  });

  it("renders the smart attention homepage shortcuts", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(
        <FeatureFlagsContext.Provider value={enabledFeatureFlags}>
          <MemoryRouter
            initialEntries={["/"]}
            future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
          >
            <HomeScreen onNavigate={() => {}} />
          </MemoryRouter>
        </FeatureFlagsContext.Provider>,
      );
    });
    await flushEffects();

    expect(container.textContent).toContain("الاكثر طلبا");
    expect(container.textContent).toContain("الاحدث");
    expect(container.textContent).toContain("ممكن يهمك");
  });
});