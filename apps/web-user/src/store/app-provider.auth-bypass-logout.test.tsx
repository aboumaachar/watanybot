/** @vitest-environment happy-dom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { defaultFeatureFlags } from "@watany/shared/features";
import { afterEach, describe, expect, it, vi } from "vitest";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const featureFlagsValue = {
  flags: defaultFeatureFlags(),
  isHydrated: true,
  isEnabled: () => true,
  isModeEnabled: () => true,
  toggle: () => undefined,
  setFlag: () => undefined,
  resetAll: () => undefined,
};

function createStorageMock(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key: string) {
      return values.has(key) ? values.get(key) ?? null : null;
    },
    key(index: number) {
      return Array.from(values.keys())[index] ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      values.set(key, String(value));
    },
  };
}

function createJsonResponse(status: number, body?: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response;
}

async function flushMicrotasks(times = 4): Promise<void> {
  await act(async () => {
    for (let index = 0; index < times; index += 1) {
      await Promise.resolve();
    }
  });
}

describe("AppProvider logout in auth-bypass mode", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
    }

    container?.remove();
    container = null;
    root = null;

    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("allows an explicit logout instead of re-forcing dev superadmin", async () => {
    vi.stubEnv("VITE_DISABLE_AUTH", "true");
    vi.stubGlobal("localStorage", createStorageMock());
    vi.stubGlobal("sessionStorage", createStorageMock());
    vi.stubGlobal("matchMedia", vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));

    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      let url = "";
      if (typeof input === "string") {
        url = input;
      } else if (input instanceof URL) {
        url = input.toString();
      } else {
        url = input.url;
      }
      if (
        url.endsWith("/api/forms/sources") ||
        url.endsWith("/api/web-user/settings") ||
        url.endsWith("/api/auth/logout") ||
        url.endsWith("/api/profile/logout")
      ) {
        return Promise.resolve(createJsonResponse(200, { items: [], ok: true }));
      }
      return Promise.resolve(createJsonResponse(404, {}));
    });
    vi.stubGlobal("fetch", fetchMock);

    vi.resetModules();
    const [{ useUser }, { AppProvider }, { FeatureFlagsContext }] = await Promise.all([
      import("./app"),
      import("./app-provider"),
      import("./features"),
    ]);

    const observed: boolean[] = [];

    function Probe() {
      const { profile, logout } = useUser();
      observed.push(profile.isAuthed);
      return (
        <button
          type="button"
          id="logout"
          onClick={() => {
            logout().catch(() => undefined);
          }}
        >
          logout
        </button>
      );
    }

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <FeatureFlagsContext.Provider value={featureFlagsValue}>
          <MemoryRouter
            initialEntries={["/"]}
            future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
          >
            <AppProvider>
              <Probe />
            </AppProvider>
          </MemoryRouter>
        </FeatureFlagsContext.Provider>,
      );
    });

    await flushMicrotasks();

    const logoutButton = container.querySelector("#logout");
    expect(logoutButton).not.toBeNull();

    await act(async () => {
      logoutButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushMicrotasks(6);

    expect(observed).toContain(true);
    expect(observed.at(-1)).toBe(false);
    expect(localStorage.getItem("watany_auth_bypass_logged_out")).toBe("true");
  });
});
