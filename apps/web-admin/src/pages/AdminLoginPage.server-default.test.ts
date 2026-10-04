import { describe, expect, it } from "vitest";
import { resolveInitialAdminServer } from "./AdminLoginPage";

describe("production admin server default", () => {
  it("uses production on a fresh koudama.com session", () => {
    expect(resolveInitialAdminServer(null, "koudama.com")).toBe("https://koudama.com/mcp");
  });

  it("replaces known local URLs on production hosts", () => {
    expect(resolveInitialAdminServer("http://127.0.0.1:8099", "koudama.com")).toBe("https://koudama.com/mcp");
    expect(resolveInitialAdminServer("http://localhost:8010", "admin.koudama.com")).toBe("https://koudama.com/mcp");
  });

  it("keeps localhost local by default", () => {
    expect(resolveInitialAdminServer(null, "localhost")).toBe("http://127.0.0.1:8099");
    expect(resolveInitialAdminServer("http://localhost:8010", "127.0.0.1")).toBe("http://127.0.0.1:8099");
  });

  it("preserves an explicit non-local custom URL", () => {
    expect(resolveInitialAdminServer("https://admin-api.example.test", "koudama.com")).toBe("https://admin-api.example.test");
  });
});
