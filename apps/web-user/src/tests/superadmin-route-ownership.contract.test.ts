import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appShell = readFileSync(resolve(__dirname, "../components/AppShell.tsx"), "utf8");

describe("web-user superadmin route ownership", () => {
  it("does not register /superadmin routes while allowing references", () => {
    expect(appShell).not.toMatch(/<Route\s+path=["']\/superadmin(?:\/\*)?["']/);
    expect(appShell).toContain("superadmin");
  });
});
