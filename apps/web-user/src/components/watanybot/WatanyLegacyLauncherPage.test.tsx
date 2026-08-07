/** @vitest-environment happy-dom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import WatanyLegacyLauncherPage from "./WatanyLegacyLauncherPage";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../../store/app", () => ({
  useApp: () => ({
    profile: { isAuthed: false },
  }),
}));

vi.mock("../../lib/internal-mail", () => ({
  useInternalMail: vi.fn(),
}));

vi.mock("../../lib/publicRuntimeChrome", () => ({
  cleanupRouteActivationChrome: vi.fn(),
  clearRouteActivationOptIn: vi.fn(),
}));

vi.mock("../../lib/koudama-theme", () => ({
  applyKoudamaTheme: vi.fn(),
  KOUDAMA_THEME_OPTIONS: [],
  readStoredKoudamaTheme: () => "watany-sand",
}));

function LocationEcho() {
  const location = useLocation();
  return <div data-testid="current-path">{location.pathname}</div>;
}

describe("WatanyLegacyLauncherPage", () => {
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

  it("renders the smart-attention shortcut icons on the live launcher route", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root.render(
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <>
            <WatanyLegacyLauncherPage />
            <LocationEcho />
          </>
        </MemoryRouter>,
      );
    });

    expect(container.textContent).toContain("الاكثر طلبا");
    expect(container.textContent).toContain("الاحدث");
    expect(container.textContent).toContain("ممكن يهمك");

    const shortcuts = Array.from(container.querySelectorAll("a.watany-app-icon")) as HTMLAnchorElement[];
    expect(shortcuts.length).toBeGreaterThan(0);

    const firstShortcut = shortcuts[0];
    expect(firstShortcut.getAttribute("href")).toBeTruthy();

    act(() => {
      firstShortcut.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.querySelector('[data-testid="current-path"]')?.textContent).toBe(firstShortcut.getAttribute("href"));
  });
});