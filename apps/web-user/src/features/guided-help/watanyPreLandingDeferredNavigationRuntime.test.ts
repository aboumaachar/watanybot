/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  installWatanyPreLandingDeferredNavigationRuntime,
  uninstallWatanyPreLandingDeferredNavigationRuntime,
} from "./watanyPreLandingDeferredNavigationRuntime";

describe("watanyPreLandingDeferredNavigationRuntime", () => {
  beforeEach(() => {
    uninstallWatanyPreLandingDeferredNavigationRuntime();
    document.body.innerHTML = "";
    document.documentElement.removeAttribute(
      "data-watany-prelanding-pending-href",
    );
    history.replaceState({}, "", "/");
  });

  afterEach(() => {
    uninstallWatanyPreLandingDeferredNavigationRuntime();
    vi.restoreAllMocks();
  });

  it("installs once and second install is a no-op", () => {
    const documentSpy = vi.spyOn(document, "addEventListener");
    const windowSpy = vi.spyOn(window, "addEventListener");

    installWatanyPreLandingDeferredNavigationRuntime();
    installWatanyPreLandingDeferredNavigationRuntime();

    expect(
      documentSpy.mock.calls.filter(([type]) => type === "click"),
    ).toHaveLength(1);
    expect(
      documentSpy.mock.calls.filter(([type]) => type === "keydown"),
    ).toHaveLength(1);
    expect(
      windowSpy.mock.calls.filter(([type]) => type === "popstate"),
    ).toHaveLength(1);
  });

  it("uninstall removes listeners and clears pending state", () => {
    const documentSpy = vi.spyOn(document, "removeEventListener");
    const windowSpy = vi.spyOn(window, "removeEventListener");

    installWatanyPreLandingDeferredNavigationRuntime();
    window.__watanyPreLandingPendingNavigation = {
      href: "/salary",
      startedAt: Date.now(),
      label: "Salary",
    };
    document.documentElement.setAttribute(
      "data-watany-prelanding-pending-href",
      "/salary",
    );

    uninstallWatanyPreLandingDeferredNavigationRuntime();

    expect(
      documentSpy.mock.calls.some(([type]) => type === "click"),
    ).toBe(true);
    expect(
      documentSpy.mock.calls.some(([type]) => type === "keydown"),
    ).toBe(true);
    expect(
      windowSpy.mock.calls.some(([type]) => type === "popstate"),
    ).toBe(true);
    expect(window.__watanyPreLandingPendingNavigation).toBeUndefined();
    expect(
      document.documentElement.getAttribute(
        "data-watany-prelanding-pending-href",
      ),
    ).toBeNull();
  });

  it("clears pending state after the clicked route becomes current", async () => {
    installWatanyPreLandingDeferredNavigationRuntime();

    const anchor = document.createElement("a");
    anchor.href = "/salary";
    anchor.textContent = "Salary";
    document.body.appendChild(anchor);

    anchor.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        button: 0,
      }),
    );

    expect(window.__watanyPreLandingPendingNavigation?.href).toBe(
      "/salary",
    );

    history.pushState({}, "", "/salary");

    await new Promise((resolve) => window.setTimeout(resolve, 80));

    expect(window.__watanyPreLandingPendingNavigation).toBeUndefined();
    expect(
      document.documentElement.getAttribute(
        "data-watany-prelanding-pending-href",
      ),
    ).toBeNull();
  });

  it("records an internal primary anchor click without navigating", () => {
    installWatanyPreLandingDeferredNavigationRuntime();

    const anchor = document.createElement("a");
    anchor.href = "/procedures?tab=one#top";
    anchor.textContent = "Procedures";
    document.body.appendChild(anchor);

    anchor.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        button: 0,
      }),
    );

    expect(window.location.pathname).toBe("/");
    expect(window.__watanyPreLandingPendingNavigation?.href).toBe(
      "/procedures?tab=one#top",
    );
  });

  it("rejects external, modified, and non-primary clicks", () => {
    installWatanyPreLandingDeferredNavigationRuntime();

    const external = document.createElement("a");
    external.href = "https://example.com/path";
    document.body.appendChild(external);

    external.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        button: 0,
      }),
    );
    expect(window.__watanyPreLandingPendingNavigation).toBeUndefined();

    const internal = document.createElement("a");
    internal.href = "/jobs";
    document.body.appendChild(internal);

    internal.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        button: 0,
        ctrlKey: true,
      }),
    );
    expect(window.__watanyPreLandingPendingNavigation).toBeUndefined();

    internal.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        button: 1,
      }),
    );
    expect(window.__watanyPreLandingPendingNavigation).toBeUndefined();
  });
});