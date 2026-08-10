import rawRegistry from "./watanyFeatureRegistryV4.json";

export type WatanyV4FeatureCategory = "account" | "admin" | "core" | "information" | "services" | "support";
export type WatanyV4FeatureStatus = "BLOCKED_OWNER_MISSING" | "DISABLED_NOT_IMPLEMENTED" | "EXTERNAL_BOUNDARY_PROVEN" | "LIVE_PROVEN" | "ROLE_RESTRICTED_PROVEN";
export type WatanyV4MenuPlacement = "bottom" | "drawer" | "hidden" | "quick";
export type WatanyV4HomepagePlacement = "grid" | "hidden" | "quick";

export type WatanyV4FeatureRegistryEntry = {
  id: string;
  labelAr: string;
  labelEn: string;
  category: WatanyV4FeatureCategory;
  route: string;
  actionType: string;
  publicVisibility: "guarded" | "public" | "restricted";
  requiredRoles: string[];
  iconAsset: string;
  menuPlacement: WatanyV4MenuPlacement;
  homepagePlacement: WatanyV4HomepagePlacement;
  featureOwner: string;
  apiDependencies: string[];
  primaryInteraction: string;
  status: WatanyV4FeatureStatus;
};

export type WatanyV4DrawerCategory = "account" | "core" | "services" | "support";

export type WatanyV4DrawerItem = {
  id: string;
  label: string;
  labelAr: string;
  route: string;
  icon: string;
  runtimeState: WatanyV4FeatureStatus;
  color: "green" | "navy" | "red" | "slate";
  category: WatanyV4DrawerCategory;
  badgeCount?: number;
  disabled?: boolean;
};

const homepageOnlyEntries: WatanyV4FeatureRegistryEntry[] = [
  { id: "for-you", labelAr: "يهمك", labelEn: "For You", category: "information", route: "/for-you", actionType: "route", publicVisibility: "public", requiredRoles: [], iconAsset: "important", menuPlacement: "hidden", homepagePlacement: "grid", featureOwner: "apps/web-user/src/components/WatanyV4FeatureLanding.tsx", apiDependencies: [], primaryInteraction: "personalized-shortcuts", status: "LIVE_PROVEN" },
  { id: "latest", labelAr: "جديد", labelEn: "Latest", category: "information", route: "/latest", actionType: "route", publicVisibility: "public", requiredRoles: [], iconAsset: "latest", menuPlacement: "hidden", homepagePlacement: "grid", featureOwner: "apps/web-user/src/components/WatanyV4FeatureLanding.tsx", apiDependencies: [], primaryInteraction: "latest-updates", status: "LIVE_PROVEN" },
  { id: "popular", labelAr: "الأكثر طلباً", labelEn: "Most Requested", category: "services", route: "/popular", actionType: "route", publicVisibility: "public", requiredRoles: [], iconAsset: "most-requested", menuPlacement: "hidden", homepagePlacement: "grid", featureOwner: "apps/web-user/src/components/WatanyV4FeatureLanding.tsx", apiDependencies: [], primaryInteraction: "most-requested", status: "LIVE_PROVEN" },
  { id: "useful-links", labelAr: "روابط", labelEn: "Useful Links", category: "information", route: "/services/official", actionType: "route", publicVisibility: "public", requiredRoles: [], iconAsset: "links", menuPlacement: "hidden", homepagePlacement: "grid", featureOwner: "apps/web-user/src/pages/OfficialServicesPage.tsx", apiDependencies: ["gateway-api"], primaryInteraction: "official-services-landing", status: "LIVE_PROVEN" },
  { id: "tools", labelAr: "أدوات", labelEn: "Tools", category: "support", route: "/tools", actionType: "route", publicVisibility: "public", requiredRoles: [], iconAsset: "tools", menuPlacement: "hidden", homepagePlacement: "grid", featureOwner: "apps/web-user/src/components/WatanyV4FeatureLanding.tsx", apiDependencies: [], primaryInteraction: "tools", status: "LIVE_PROVEN" },
  { id: "designs", labelAr: "التصاميم", labelEn: "Designs", category: "support", route: "/designs", actionType: "route", publicVisibility: "public", requiredRoles: [], iconAsset: "designs", menuPlacement: "hidden", homepagePlacement: "grid", featureOwner: "apps/web-user/src/components/WatanyV4FeatureLanding.tsx", apiDependencies: [], primaryInteraction: "designs", status: "DISABLED_NOT_IMPLEMENTED" },
];

export const watanyFeatureRegistryV4 = [
  ...(rawRegistry as WatanyV4FeatureRegistryEntry[]),
  ...homepageOnlyEntries,
];

const categoryMap: Record<WatanyV4FeatureCategory, WatanyV4DrawerCategory> = {
  account: "account",
  admin: "account",
  core: "core",
  information: "support",
  services: "services",
  support: "support",
};

const colorMap: Record<WatanyV4FeatureCategory, WatanyV4DrawerItem["color"]> = {
  account: "slate",
  admin: "red",
  core: "green",
  information: "slate",
  services: "navy",
  support: "slate",
};

const enabledRuntimeStates = new Set<WatanyV4FeatureStatus>([
  "EXTERNAL_BOUNDARY_PROVEN",
  "LIVE_PROVEN",
  "ROLE_RESTRICTED_PROVEN",
]);

export function getWatanyV4FeatureById(id: string): WatanyV4FeatureRegistryEntry | undefined {
  return watanyFeatureRegistryV4.find((feature) => feature.id === id);
}

export function getWatanyV4FeaturesByRoutes(routes: readonly string[]): WatanyV4FeatureRegistryEntry[] {
  const routeSet = new Set(routes);
  return watanyFeatureRegistryV4.filter((feature) => routeSet.has(feature.route));
}

function toDrawerItem(feature: WatanyV4FeatureRegistryEntry): WatanyV4DrawerItem {
  const disabled = !enabledRuntimeStates.has(feature.status);
  return {
    id: feature.id,
    label: feature.labelEn,
    labelAr: disabled ? `${feature.labelAr} - غير متاح` : feature.labelAr,
    route: feature.route,
    icon: feature.iconAsset,
    runtimeState: feature.status,
    category: categoryMap[feature.category],
    color: colorMap[feature.category],
    disabled: disabled || undefined,
  };
}

export const watanyV4DrawerItems = watanyFeatureRegistryV4
  .filter((feature) => feature.menuPlacement === "drawer" && feature.id !== "world-cup")
  .map(toDrawerItem);

export const watanyV4BottomDockItems = watanyFeatureRegistryV4
  .filter((feature) => feature.menuPlacement === "bottom")
  .map(toDrawerItem);

const homepageFeatureOrder = [
  "for-you", "latest", "popular", "marketplace", "jobs", "schools", "procedures", "salary", "taxi", "network",
  "forms", "useful-links", "deaths", "community", "voting", "news", "laws", "faq", "fake-fact", "profile", "settings",
] as const;

const homepageLabels: Record<(typeof homepageFeatureOrder)[number], string> = {
  "for-you": "يهمك", latest: "جديد", popular: "الأكثر طلباً", schools: "مدارس", procedures: "معاملات", salary: "المعاش", taxi: "تاكسي", marketplace: "السوق", jobs: "وظائف", network: "الشبكة", "useful-links": "روابط", deaths: "وفيات", community: "مجتمعي", voting: "تصويت", forms: "نماذج", laws: "قوانين", faq: "أسئلة", "fake-fact": "زائف", news: "أخبار", profile: "الحساب", settings: "الإعدادات",
};

export const watanyV4HomepageItems = homepageFeatureOrder.map((id) => {
  const feature = getWatanyV4FeatureById(id);
  if (!feature) throw new Error(`Missing homepage registry entry: ${id}`);
  return { ...toDrawerItem(feature), labelAr: homepageLabels[id] };
});

export const watanyV4MandatoryRoutePaths = [
  "/profile",
  "/notifications",
  "/faq",
  "/news",
  "/fake-fact",
  "/voting",
  "/community",
  "/taxi",
  "/network",
  "/forms",
  "/circulars",
  "/ads",
  "/deaths",
  "/health",
] as const;
