/** @vitest-environment happy-dom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { clearTokens } from "./auth";
import { api } from "./api";

function createJsonResponse(status: number, body: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response;
}

describe("api.updateProfile", () => {
  afterEach(() => {
    clearTokens();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns the profile persisted by the server", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(createJsonResponse(200, {
      profile: { isAuthed: true, role: "accredited", email: "u@example.test", region: "Beirut", note: "saved" },
    })));
    vi.stubGlobal("fetch", fetchMock);

    const result = await api.updateProfile({ region: "Beirut", note: "saved" }, "http://example.test");
    expect(result).toEqual(expect.objectContaining({ region: "Beirut", note: "saved" }));
    expect(fetchMock).toHaveBeenCalledWith(
      "http://example.test/api/profile",
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("propagates server rejection instead of pretending the profile was saved locally", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(createJsonResponse(409, {
      error: "EMAIL_CHANGE_REQUIRES_REAUTH",
    })));
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.updateProfile(
      { email: "other@example.test" },
      "http://example.test",
    )).rejects.toThrow("EMAIL_CHANGE_REQUIRES_REAUTH");
  });
});
