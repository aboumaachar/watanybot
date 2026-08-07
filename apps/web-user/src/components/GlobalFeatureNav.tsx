import { useLocation } from "react-router-dom";
import React, { useMemo, useState } from "react";
import { Home24Regular } from "../theme/watany-v4/legacyIconBridge";
import { StickyFeatureRail } from "./template/StickyFeatureRail";
import { getUnifiedPillarConfig, unifiedPillars, type UnifiedPillarId } from "../features/unified-pillars/pillar-config";
import { WORLD_CUP_FEATURES } from "./worldcup/worldCupFeatures";
import type { WorldCupFeatureId } from "./worldcup/worldCupFeatures";

function renderIcon(icon: string | React.ComponentType<React.SVGProps<SVGSVGElement>>) {
  if (typeof icon === "string" || typeof icon === "number") {
    return icon;
  }
  return React.createElement(icon, { "aria-hidden": "true" });
}

/** Routes that should NOT show a global feature menu */
const ROUTES_WITHOUT_FEATURE_MENU = [
  "/login",
  "/register",
  "/",
  "/mobile-os",
  "/community",
  "/services",
  "/salary",
];

/**
 * Determines which pillar/feature the current route belongs to.
 * Returns the pillarId and whether it's a sub-page route.
 */
function getPillarFromRoute(pathname: string): { pillarId?: UnifiedPillarId; isSubPage: boolean } {
  // World Cup routes
  if (pathname.startsWith("/world-cup")) {
    return { pillarId: "world-cup", isSubPage: pathname !== "/world-cup" && pathname !== "/world-cup/" };
  }

  // Route aliases: secondary URLs that map to a pillar
  const ROUTE_ALIASES: Record<string, UnifiedPillarId> = {
    "/marketplace": "market",
  };
  if (ROUTE_ALIASES[pathname] !== undefined) {
    return { pillarId: ROUTE_ALIASES[pathname], isSubPage: false };
  }

  // Check other pillars by route prefix
  for (const [key, config] of Object.entries(unifiedPillars)) {
    if (key === "world-cup") continue; // Already handled

    const route = config.route;
    if (pathname === route || pathname.startsWith(`${route}/`) || pathname.startsWith(`${route}?`)) {
      return { pillarId: key as UnifiedPillarId, isSubPage: pathname !== route && pathname !== `${route}/` };
    }
  }

  return { pillarId: undefined, isSubPage: false };
}

function isLandingRootRoute(pathname: string, pillarId?: UnifiedPillarId): boolean {
  if (!pillarId) {
    return false;
  }

  if (pillarId === "world-cup") {
    return pathname === "/world-cup" || pathname === "/world-cup/";
  }

  const config = getUnifiedPillarConfig(pillarId);
  return pathname === config.route || pathname === `${config.route}/`;
}

/**
 * Determines if a World Cup feature is active.
 */
function isWorldCupFeatureActive(pathname: string, path: string, id: WorldCupFeatureId) {
  return pathname === path || pathname.startsWith(`${path}/`) || (pathname === "/world-cup" && id === "today");
}

/**
 * Renders the World Cup feature menu.
 */
function WorldCupFeatureMenu({ pathname, title }: { readonly pathname: string; readonly title: string }) {
  const WORLD_CUP_FEATURES_UNIQUE = WORLD_CUP_FEATURES.filter((item, index, all) => {
    return all.findIndex((candidate) => candidate.path === item.path) === index;
  });
  let wcMap: Record<string, number> = (globalThis as any).__watany_wc_counts__ || {};
  try {
    if (import.meta.env.DEV && Object.keys(wcMap).length === 0) {
      wcMap = {
        ...wcMap,
        '/world-cup/today': 3,
        '/world-cup/polls': 128,
      };
    }
  } catch {
    // ignore
  }

  const items = [
    {
      label: "الرئيسية",
      href: "/world-cup",
      icon: renderIcon(Home24Regular),
      active: pathname === "/world-cup" || pathname === "/world-cup/",
      target: "_blank",
      rel: "noreferrer noopener",
    },
    ...WORLD_CUP_FEATURES_UNIQUE.map((item) => ({
      label: item.label,
      href: item.path,
      icon: renderIcon(item.icon),
      active: isWorldCupFeatureActive(pathname, item.path, item.id),
      target: "_blank",
      rel: "noreferrer noopener",
      count: wcMap[item.path.split('?')[0]] || 0,
    })),
  ];

  return (
    <StickyFeatureRail
      ariaLabel={`قائمة ${title}`}
      items={items}
    />
  );
}

/**
 * Renders a standard feature menu for unified pillars.
 */
function StandardFeatureMenu({
  config,
  activeItemId,
  onItemClick,
}: {
  readonly config: ReturnType<typeof getUnifiedPillarConfig>;
  readonly activeItemId: string;
  readonly onItemClick: (itemId: string) => void;
}) {
  // Filter items to only show those with valid endpoints
  const validItems = useMemo(() => {
    return config.navItems.filter((item) => {
      // Remove items if they don't have a valid route or have empty routes
      return item.route && item.route.trim().length > 0;
    });
  }, [config.navItems]);

  if (validItems.length === 0) {
    return null; // No valid items to display
  }

  return (
    <StickyFeatureRail
      ariaLabel={`قائمة ${config.title}`}
      accentColor={config.accent}
      items={validItems.map((item) => ({
        label: item.label,
        href: item.route,
        icon: renderIcon(item.icon),
        active: activeItemId === item.id,
        onClick: () => onItemClick(item.id),
        ariaLabel: `${item.label}: ${item.description}`,
        title: item.description,
      }))}
    />
  );
}

/**
 * Global feature navigation that appears beneath the app header.
 * Shows context-specific menu items based on the current route.
 * Positioned globally and standardized across all landing pages.
 */
export function GlobalFeatureNav() {
  const location = useLocation();
  const [activeItemId, setActiveItemId] = useState<string>("");

  // Determine if this route should show a feature menu
  const shouldShowMenu = useMemo(() => {
    return !ROUTES_WITHOUT_FEATURE_MENU.some((route) => {
      if (route === "/") return location.pathname === "/";
      return location.pathname.startsWith(route);
    });
  }, [location.pathname]);

  const { pillarId } = useMemo(() => getPillarFromRoute(location.pathname), [location.pathname]);
  const isLandingRoot = useMemo(() => isLandingRootRoute(location.pathname, pillarId), [location.pathname, pillarId]);

  if (!shouldShowMenu || !pillarId || pillarId === "market" || pillarId === "jobs" || isLandingRoot) {
    return null;
  }

  const config = getUnifiedPillarConfig(pillarId);

  const menu =
    pillarId === "world-cup" ? (
      <WorldCupFeatureMenu pathname={location.pathname} title={config.title} />
    ) : (
      <StandardFeatureMenu
        config={config}
        activeItemId={activeItemId}
        onItemClick={setActiveItemId}
      />
    );

  return (
    <div className="global-feature-nav-container" data-pillar={pillarId}>
      {menu}
    </div>
  );
}

export default GlobalFeatureNav;


