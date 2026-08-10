import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(appRoot, relativePath), "utf8");
}

function registryEntries() {
  return JSON.parse(
    read("src/data/watanyFeatureRegistryV4.json"),
  ) as Array<{
    id: string;
    route: string;
    publicVisibility: string;
    status: string;
    featureOwner: string;
  }>;
}

const restoredFeatureIds = [
  "profile",
  "notifications",
  "news",
  "fake-fact",
  "circulars",
  "ads",
  "forms",
  "network",
  "taxi",
  "voting",
  "faq",
  "community",
  "deaths",
  "health",
] as const;

describe("WatanyBot V1.17.3 direct-owner supersession", () => {
  it("guards profile and notifications at the route boundary", () => {
    const source = read("src/components/AppShell.tsx");

    expect(source).toContain("function RequireAuthenticated");
    expect(source).toMatch(/if \(!profile\.isAuthed(?: \|\| !isLoggedIn\(\))?\)/);
    expect(source).toContain('<Navigate to="/login" replace state={{ from }} />');
    expect(source).toMatch(
      /path="profile"[\s\S]*?<RequireAuthenticated>[\s\S]*?<ProfilePage \/>[\s\S]*?<\/RequireAuthenticated>/,
    );
    expect(source).toMatch(
      /path="notifications"[\s\S]*?<RequireAuthenticated>[\s\S]*?<NotificationsPage \/>[\s\S]*?<\/RequireAuthenticated>/,
    );
  });

  it("keeps Network public-read while requiring auth for writes", () => {
    const source = read("src/pages/NetworkPage.tsx");

    expect(source).not.toContain('|| "guest"');
    expect(source).toContain("function requireAuthenticatedWrite()");
    expect(source).toContain('navigate("/login", {');
    expect(source).toContain('state: { from: "/network" }');
    expect(source).toMatch(
      /async function saveDraft\(\)[\s\S]*?if \(!requireAuthenticatedWrite\(\)\)/,
    );
    expect(source).toMatch(
      /async function submitMembership\(\)[\s\S]*?if \(!requireAuthenticatedWrite\(\)\)/,
    );
    expect(source).toContain("if (!profile.isAuthed || !userId)");
  });

  it("binds all restored features to exact direct owners", () => {
    const entries = registryEntries();
    const selected = entries.filter((entry) =>
      restoredFeatureIds.includes(
        entry.id as (typeof restoredFeatureIds)[number],
      ),
    );

    expect(selected).toHaveLength(restoredFeatureIds.length);
    expect(
      selected.filter(
        (entry) =>
          entry.status === "DISABLED_NOT_IMPLEMENTED" ||
          entry.status === "BLOCKED_OWNER_MISSING",
      ),
    ).toEqual([]);

    const profile = selected.find((entry) => entry.id === "profile");
    const notifications = selected.find(
      (entry) => entry.id === "notifications",
    );

    expect(profile).toEqual(
      expect.objectContaining({
        route: "/profile",
        publicVisibility: "guarded",
        status: "ROLE_RESTRICTED_PROVEN",
        featureOwner: "apps/web-user/src/pages/ProfilePage.tsx",
      }),
    );
    expect(notifications).toEqual(
      expect.objectContaining({
        route: "/notifications",
        publicVisibility: "guarded",
        status: "ROLE_RESTRICTED_PROVEN",
        featureOwner: "apps/web-user/src/pages/NotificationsPage.tsx",
      }),
    );
  });

  it("retires the legacy DOM-patch runtime chain", () => {
    const indexSource = read("index.html");
    const runtimeTest = read(
      "tests/watany-v1-runtime-chain-integrity.node.cjs",
    );
    const retiredLegacyDomPatchAssets = [
      "watany-v1-tools-schools-public-access-v144.js",
      "watany-v1-jobs-market-public-access-v150.js",
      "watany-v1-going-now-feed-v160.js",
      "watany-v1-procedures-source-polish-v190.js",
      "watany-v1-school-forms-universal-viewer-bridge-v185.js",
      "watany-v1-clean-settings-single-template-v190.js",
      "watany-v1-procedures-title-source-grouping-polish-v200.js",
      "watany-v1-procedures-title-inline-size-closeout-v202.js",
    ] as const;

    for (const asset of retiredLegacyDomPatchAssets) {
      expect(indexSource).not.toContain(`/${asset}`);
    }
    expect(runtimeTest).toContain(
      "WATANY_DIRECT_OWNER_RUNTIME_CHAIN_SUPERSESSION_PASS",
    );
    expect(runtimeTest).toContain(
      "LEGACY_DOM_PATCH_CHAIN_RETIRED",
    );
  });
});
