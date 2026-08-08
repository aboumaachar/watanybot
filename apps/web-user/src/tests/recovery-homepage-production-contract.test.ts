import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function read(relativeUrl: string) {
  return readFileSync(fileURLToPath(new URL(relativeUrl, import.meta.url)), "utf8");
}

describe("production recovery homepage contract", () => {
  it("tests the actual /home recovery surface rather than only the V4 launcher surface", () => {
    const recoveryPage = read("../pages/WatanyRecoveryPages.tsx");
    expect(recoveryPage).toContain('className="watany-service-grid"');
    expect(recoveryPage).toContain('className="watany-service-card"');
  });

  it("loads the runtime closure after the legacy recovery styles", () => {
    const themeEntry = read("../styles/watany-v4-theme.css");
    const recoveryIndex = themeEntry.indexOf('watany-source-of-truth-recovery.css');
    const closureIndex = themeEntry.indexOf('post-deploy-runtime-closure.css');

    expect(recoveryIndex).toBeGreaterThanOrEqual(0);
    expect(closureIndex).toBeGreaterThan(recoveryIndex);
  });

  it("forces the active homepage to three columns with readable icon and label sizing", () => {
    const closure = read("../styles/post-deploy-runtime-closure.css");

    expect(closure).toMatch(/\.watany-service-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(closure).toMatch(/\.watany-service-card\s*>\s*span\s*\{[\s\S]*width:\s*48px;[\s\S]*height:\s*48px;[\s\S]*font-size:\s*1\.35rem/);
    expect(closure).toMatch(/\.watany-service-card\s+strong\s*\{[\s\S]*font-size:\s*14px/);
  });
});
