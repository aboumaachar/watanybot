/** @vitest-environment happy-dom */

import { Buffer } from "node:buffer";
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

let authModule: Awaited<typeof import("../lib/auth")> | null = null;

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

function ensureStorageGlobals() {
  vi.stubGlobal("localStorage", createStorageMock());
  vi.stubGlobal("sessionStorage", createStorageMock());
}

async function loadAppModules() {
  authModule = await import("../lib/auth");

  const [{ api }, { useUser }, { AppProvider }, { FeatureFlagsContext }] = await Promise.all([
    import("../lib/api"),
    import("./app"),
    import("./app-provider"),
    import("./features"),
  ]);

  return {
    api,
    useUser,
    AppProvider,
    FeatureFlagsContext,
    auth: authModule,
  };
}

function createFakeAccessToken(overrides?: Partial<{ sub: string; role: string; email: string; exp: number }>): string {
  const payload = {
    sub: "user-1",
    role: "accredited",
    email: "user@example.com",
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  };

  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.signature`;
}

function createJsonResponse(status: number, body?: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response;
}

function installFetchMock(resolver: (url: string) => Response | Promise<Response>) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    let url: string;
    if (typeof input === "string") {
      url = input;
    } else if (input instanceof URL) {
      url = input.toString();
    } else {
      url = input.url;
    }
    return Promise.resolve(resolver(url));
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function flushMicrotasks(times = 4): Promise<void> {
  return Array.from({ length: times }).reduce<Promise<void>>(
    (pending) => pending.then(async () => {
      await Promise.resolve();
    }),
    Promise.resolve(),
  );
}

describe("AppProvider auth sync", () => {
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

    authModule?.clearTokens();
    authModule = null;
    localStorage.clear();
    sessionStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("drops to logged-out state as soon as authFetch clears a stale token", async () => {
    ensureStorageGlobals();
    const { auth, useUser, AppProvider, FeatureFlagsContext } = await loadAppModules();

    auth.storeTokens({ accessToken: createFakeAccessToken(), expiresIn: 3600 });

    installFetchMock((url) => {
      if (url.endsWith("/api/forms/sources")) {
        return createJsonResponse(200, { items: [] });
      }
      if (url.endsWith("/api/web-user/settings")) {
        return createJsonResponse(404, {});
      }
      if (url.endsWith("/api/auth/refresh")) {
        return createJsonResponse(401, { error: "refresh failed" });
      }
      if (url.endsWith("/api/profile")) {
        return createJsonResponse(401, { error: "stale token" });
      }
      if (url.endsWith("/api/me")) {
        return createJsonResponse(401, { error: "stale token" });
      }

      return createJsonResponse(404, {});
    });

    vi.stubGlobal("matchMedia", vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));

    const observed: boolean[] = [];

    function Probe() {
      const { profile } = useUser();
      observed.push(profile.isAuthed);
      return null;
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

    await act(async () => {
      await flushMicrotasks();
    });

    expect(observed).toContain(true);
    expect(observed.at(-1)).toBe(false);
    expect(auth.getAccessToken()).toBeNull();
  });

  it("exposes the JWT subject as the authenticated profile id", async () => {
    ensureStorageGlobals();
    const { auth } = await loadAppModules();

    auth.storeTokens({ accessToken: createFakeAccessToken({ sub: "community-admin-1" }), expiresIn: 3600 });

    expect(auth.profileFromToken()).toEqual(expect.objectContaining({
      id: "community-admin-1",
      email: "user@example.com",
      isAuthed: true,
      role: "accredited",
    }));
  });

  it("does not reuse stale token claims after getProfile clears auth", async () => {
    ensureStorageGlobals();
    const { api, auth } = await loadAppModules();

    auth.storeTokens({ accessToken: createFakeAccessToken(), expiresIn: 3600 });

    installFetchMock((url) => {
      if (url.endsWith("/api/auth/refresh")) {
        return createJsonResponse(401, { error: "refresh failed" });
      }
      if (url.endsWith("/api/profile") || url.endsWith("/api/me")) {
        return createJsonResponse(401, { error: "stale token" });
      }

      return createJsonResponse(404, {});
    });

    const profile = await api.getProfile("http://example.test");

    expect(profile).toEqual({ isAuthed: false, role: "public" });
    expect(auth.getAccessToken()).toBeNull();
  });
});