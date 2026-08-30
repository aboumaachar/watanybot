import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const app = readFileSync(resolve(__dirname, "App.tsx"), "utf8");
const shell = readFileSync(resolve(__dirname, "pages/SuperadminShellPage.tsx"), "utf8");
const viteConfig = readFileSync(resolve(__dirname, "../vite.config.ts"), "utf8");

describe("web-admin superadmin migration contract", () => {
  it("registers the canonical route family and child routes", () => {
    expect(app).toContain('<Route path="/superadmin/*" element={<SuperadminShellPage />} />');
    expect(shell).toContain('path === "/superadmin/system/official-services"');
    expect(shell).toContain('path === "/superadmin/crm/contacts"');
  });

  it("uses /superadmin/ by default and preserves VITE_BASE override", () => {
    expect(viteConfig).toContain('base: env.VITE_BASE || "/superadmin/"');
    expect(viteConfig).toMatch(/base:\s*env\.VITE_BASE\s*\|\|\s*["']\/superadmin\/["']/);
  });
});
