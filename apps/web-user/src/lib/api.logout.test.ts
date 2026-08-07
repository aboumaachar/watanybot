/** @vitest-environment happy-dom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { clearTokens } from "./auth";
import { api } from "./api";

function createJsonResponse(status: number, body?: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response;
}

describe("api.logout", () => {
  afterEach(() => {
    clearTokens();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("invalidates both auth and profile sessions", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      let url = "";
      if (typeof input === "string") {
        url = input;
      } else if (input instanceof URL) {
        url = input.toString();
      } else {
        url = input.url;
      }
      if (url.endsWith("/api/auth/logout") || url.endsWith("/api/profile/logout")) {
        return Promise.resolve(createJsonResponse(200, { ok: true }));
      }
      return Promise.resolve(createJsonResponse(404, {}));
    });

    vi.stubGlobal("fetch", fetchMock);

    const profile = await api.logout("http://example.test");

    expect(fetchMock).toHaveBeenCalledWith("http://example.test/api/auth/logout", expect.objectContaining({ method: "POST" }));
    expect(fetchMock).toHaveBeenCalledWith("http://example.test/api/profile/logout", expect.objectContaining({ method: "POST" }));
    expect(profile).toEqual({ isAuthed: false, role: "public" });
  });

  it("still clears local auth state when backend logout endpoints fail", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      let url = "";
      if (typeof input === "string") {
        url = input;
      } else if (input instanceof URL) {
        url = input.toString();
      } else {
        url = input.url;
      }
      if (url.endsWith("/api/auth/logout") || url.endsWith("/api/profile/logout")) {
        return Promise.reject(new Error("network down"));
      }
      return Promise.resolve(createJsonResponse(404, {}));
    });

    vi.stubGlobal("fetch", fetchMock);

    const profile = await api.logout("http://example.test");

    expect(fetchMock).toHaveBeenCalledWith("http://example.test/api/auth/logout", expect.objectContaining({ method: "POST" }));
    expect(fetchMock).toHaveBeenCalledWith("http://example.test/api/profile/logout", expect.objectContaining({ method: "POST" }));
    expect(profile).toEqual({ isAuthed: false, role: "public" });
  });
});
