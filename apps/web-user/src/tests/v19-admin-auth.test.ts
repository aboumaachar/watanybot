import { afterEach, describe, expect, it, vi } from "vitest";
import { getV19AdminApiBase, v19AdminFetch } from "../lib/v19AdminApi";

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, String(value)); }
  removeItem(key: string): void { this.values.delete(key); }
  clear(): void { this.values.clear(); }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  get length(): number { return this.values.size; }
}

function installBrowserState(token = "test-admin-token") {
  const storage = new MemoryStorage();
  storage.setItem("admin_token", token);
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("location", { hostname: "koudama.com", origin: "https://koudama.com" });
  vi.stubGlobal("document", { cookie: "watany_csrf=test-csrf" });
  return storage;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("V19 admin authenticated API", () => {
  it("uses the production /mcp base and attaches the Ops bearer token", async () => {
    installBrowserState();
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    expect(getV19AdminApiBase()).toBe("https://koudama.com/mcp");
    await v19AdminFetch("/api/veterans-2019/applications");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://koudama.com/mcp/api/veterans-2019/applications");
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer test-admin-token");
    expect(init.credentials).toBe("include");
  });

  it("refreshes once after HTTP 401 and retries with the new token", async () => {
    const storage = installBrowserState("stale-token");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "UNAUTHORIZED" }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ accessToken: "fresh-token" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await v19AdminFetch("/api/veterans-2019/applications");

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toBe("https://koudama.com/mcp/api/auth/refresh");
    const refreshInit = fetchMock.mock.calls[1][1] as RequestInit;
    expect(new Headers(refreshInit.headers).get("x-csrf-token")).toBe("test-csrf");
    const retryInit = fetchMock.mock.calls[2][1] as RequestInit;
    expect(new Headers(retryInit.headers).get("Authorization")).toBe("Bearer fresh-token");
    expect(storage.getItem("admin_token")).toBe("fresh-token");
  });

  it("fails closed with HTTP 401 when refresh cannot recover the session", async () => {
    const storage = installBrowserState("expired-token");
    storage.setItem("admin_refresh_token", "legacy-refresh");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "UNAUTHORIZED" }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "REFRESH_DENIED" }), { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(v19AdminFetch("/api/veterans-2019/applications"))
      .rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(storage.getItem("admin_token")).toBeNull();
    expect(storage.getItem("admin_refresh_token")).toBeNull();
  });
});
