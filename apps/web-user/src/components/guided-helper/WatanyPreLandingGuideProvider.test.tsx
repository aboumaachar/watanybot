/** @vitest-environment jsdom */
import React from "react";
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  WatanyPreLandingGuideProvider,
  navigateWatanyPreLandingRoute,
} from "./WatanyPreLandingGuideProvider";

describe("WatanyPreLandingGuideProvider navigation", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    history.replaceState({}, "", "/");
    document.documentElement.removeAttribute(
      "data-watany-prelanding-current-route",
    );
    delete window.__watanyPreLandingPendingNavigation;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("navigates deterministically and emits one proceeded event", () => {
    const proceeded = vi.fn();
    window.addEventListener("watany:prelanding:proceeded", proceeded);

    const result = navigateWatanyPreLandingRoute("/salary");

    expect(result.beforeRoute).toBe("/");
    expect(result.requestedRoute).toBe("/salary");
    expect(result.afterRoute).toBe("/salary");
    expect(result.navigationConfirmed).toBe(true);
    expect(proceeded).toHaveBeenCalledTimes(1);

    window.removeEventListener("watany:prelanding:proceeded", proceeded);
  });

  it("provider owns proceed and clears pending state after navigation", async () => {
    act(() => {
      root.render(
        <WatanyPreLandingGuideProvider>
          <div>child</div>
        </WatanyPreLandingGuideProvider>,
      );
    });

    act(() => {
      window.dispatchEvent(
        new CustomEvent("watany:prelanding:navigate", {
          detail: {
            route: "/voting",
            label: "Voting",
            force: true,
          },
          cancelable: true,
        }),
      );
    });

    const dialog = document.querySelector(
      ".watany-prelanding-guide__dialog",
    );
    expect(dialog).not.toBeNull();

    const proceed = document.querySelector<HTMLButtonElement>(
      ".watany-prelanding-guide__proceed",
    );
    expect(proceed).not.toBeNull();

    await act(async () => {
      proceed?.click();
      await Promise.resolve();
    });

    expect(window.location.pathname).toBe("/voting");
    expect(
      document.querySelector(".watany-prelanding-guide__dialog"),
    ).toBeNull();
    expect(window.__watanyPreLandingPendingNavigation).toBeUndefined();
    expect(
      document.documentElement.getAttribute(
        "data-watany-prelanding-current-route",
      ),
    ).toBeNull();
  });
});