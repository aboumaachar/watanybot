import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const componentDir = dirname(fileURLToPath(import.meta.url));

function readComponentSource(relativePath: string) {
  return readFileSync(resolve(componentDir, relativePath), "utf8");
}

describe("user shell menu regression guard", () => {
  it("keeps the legacy global feature rail out of AppShell", () => {
    const source = readComponentSource("./AppShell.tsx");

    expect(source).not.toMatch(/from\s+["']\.\/GlobalFeatureNav["']/);
    expect(source).not.toMatch(/<GlobalFeatureNav\b/);
  });

  it("keeps the universal menu as the only citizen shell menu mount", () => {
    const source = readComponentSource("./layouts/WatanyMobileShell.tsx");

    expect(source).toMatch(/<UniversalFeatureMenu\b/);
    expect(source).not.toMatch(/from\s+["']\.\.\/BurgerDrawer["']/);
    expect(source).not.toMatch(/<BurgerDrawer\b/);
  });
});