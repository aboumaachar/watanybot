"use strict";

const fs = require("fs");
const path = require("path");

const appRoot = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(appRoot, relativePath), "utf8");
}

function fail(failureClass, details) {
  const payload = {
    failureClass,
    details,
  };
  process.stderr.write(
    "WATANY_DIRECT_OWNER_RUNTIME_CHAIN_SUPERSESSION_BLOCKED " +
      JSON.stringify(payload) +
      "\n",
  );
  process.exit(20);
}

const legacyAssets = [
  "watany-v1-tools-schools-public-access-v144.js",
  "watany-v1-jobs-market-public-access-v150.js",
  "watany-v1-going-now-feed-v160.js",
  "watany-v1-procedures-source-polish-v190.js",
  "watany-v1-school-forms-universal-viewer-bridge-v185.js",
  "watany-v1-clean-settings-single-template-v190.js",
  "watany-v1-procedures-title-source-grouping-polish-v200.js",
  "watany-v1-procedures-title-inline-size-closeout-v202.js",
];

const directOwnerRoutes = [
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
  "world-cup",
  "community",
  "voice",
  "deaths",
  "health",
];

const indexSource = read("index.html");
const mainSource = read("src/main.tsx");
const appShellSource = read("src/components/AppShell.tsx");
const networkSource = read("src/pages/NetworkPage.tsx");
const registry = JSON.parse(
  read("src/data/watanyFeatureRegistryV4.json"),
);

const activeLegacyReferences = legacyAssets.filter((asset) =>
  indexSource.includes("/" + asset),
);
if (activeLegacyReferences.length > 0) {
  fail(
    "APEX_V1_17_3_LEGACY_DOM_PATCH_SCRIPT_REFERENCE_REINTRODUCED_DEFECT",
    { activeLegacyReferences },
  );
}

const missingRetiredAssets = legacyAssets.filter(
  (asset) => !fs.existsSync(path.join(appRoot, "public", asset)),
);
if (missingRetiredAssets.length > 0) {
  fail(
    "APEX_V1_17_3_LEGACY_ASSET_RETIREMENT_INVENTORY_INCOMPLETE_DEFECT",
    { missingRetiredAssets },
  );
}

if (!mainSource.includes('import App from "./App";')) {
  fail(
    "APEX_V1_17_3_CURRENT_REACT_ENTRYPOINT_NOT_BOUND_DEFECT",
    {},
  );
}
if (
  !appShellSource.includes("function RequireAuthenticated") ||
  !appShellSource.includes('to="/login"')
) {
  fail(
    "APEX_V1_17_3_GUARDED_ROUTE_CONTRACT_MISSING_DEFECT",
    {},
  );
}
if (
  networkSource.includes('|| "guest"') ||
  !networkSource.includes("requireAuthenticatedWrite")
) {
  fail(
    "APEX_V1_17_3_NETWORK_PROGRESSIVE_AUTH_CONTRACT_MISSING_DEFECT",
    {},
  );
}

const registryById = new Map(
  registry.map((entry) => [entry.id, entry]),
);
const routeFailures = [];
for (const id of directOwnerRoutes) {
  const entry = registryById.get(id);
  if (!entry) {
    routeFailures.push({ id, reason: "REGISTRY_ENTRY_MISSING" });
    continue;
  }
  if (
    entry.status === "DISABLED_NOT_IMPLEMENTED" ||
    entry.status === "BLOCKED_OWNER_MISSING"
  ) {
    routeFailures.push({
      id,
      reason: "REGISTRY_STATUS_NOT_ENABLED",
      status: entry.status,
    });
  }
  const routeToken =
    id === "world-cup"
      ? 'path="world-cup/*"'
      : `path="${entry.route.replace(/^\//, "")}"`;
  if (!appShellSource.includes(routeToken)) {
    routeFailures.push({
      id,
      reason: "DIRECT_ROUTE_NOT_REGISTERED",
      routeToken,
    });
  }
}
if (routeFailures.length > 0) {
  fail(
    "APEX_V1_17_3_DIRECT_OWNER_ROUTE_CHAIN_INCOMPLETE_DEFECT",
    { routeFailures },
  );
}

const profile = registryById.get("profile");
const notifications = registryById.get("notifications");
if (
  !profile ||
  profile.publicVisibility !== "guarded" ||
  profile.status !== "ROLE_RESTRICTED_PROVEN" ||
  !notifications ||
  notifications.publicVisibility !== "guarded" ||
  notifications.status !== "ROLE_RESTRICTED_PROVEN"
) {
  fail(
    "APEX_V1_17_3_ROLE_RESTRICTED_REGISTRY_CONTRACT_MISMATCH_DEFECT",
    { profile, notifications },
  );
}

const result = {
  schemaVersion: "1.0",
  status: "LEGACY_DOM_PATCH_CHAIN_RETIRED",
  legacyAssetInventoryCount: legacyAssets.length,
  activeLegacyReferenceCount: activeLegacyReferences.length,
  directOwnerRouteCount: directOwnerRoutes.length,
  guardedRouteCount: 2,
  networkProgressiveAuth: true,
  gatePass: true,
};

process.stdout.write(
  "WATANY_DIRECT_OWNER_RUNTIME_CHAIN_SUPERSESSION_PASS " +
    JSON.stringify(result) +
    "\n",
);
