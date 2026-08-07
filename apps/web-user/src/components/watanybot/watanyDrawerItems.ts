import { watanyV4BottomDockItems, watanyV4DrawerItems } from "../../data/watanyFeatureRegistryV4";

export type WatanyDrawerItem = {
  id: string;
  label: string;
  labelAr?: string;
  route: string;
  icon: string;
  runtimeState?: string;
  color?: "navy" | "green" | "red" | "slate";
  badgeCount?: number;
  disabled?: boolean;
  category?: "core" | "services" | "account" | "support";
};

export const watanyDrawerItems: WatanyDrawerItem[] = watanyV4DrawerItems;

export const watanyBottomDockItems: WatanyDrawerItem[] = [
  { id: "home", label: "Home", labelAr: "الرئيسية", route: "/", icon: "home", category: "core", color: "navy" },
  ...watanyV4BottomDockItems,
];
export const watanyOwnerBottomBarItems: WatanyDrawerItem[] = [
  { id: "home", label: "Home", labelAr: "الرئيسية", route: "/home", icon: "home", category: "core", color: "navy" },
  { id: "profile", label: "Profile", labelAr: "ملفي", route: "/profile", icon: "person", category: "account", color: "slate" },
  { id: "login", label: "Login", labelAr: "الدخول", route: "/login", icon: "login", category: "account", color: "slate" },
  { id: "community", label: "Community", labelAr: "مجتمعي", route: "/community", icon: "people", category: "support", color: "slate" },
  { id: "assistant", label: "Assistant", labelAr: "المساعد", route: "/chat", icon: "bot", category: "support", color: "slate" },
];

// APEX THE NETWORK WEB ROUTE REVIEW HOOK
// The Network is exposed in the drawer on /network with Arabic and English labels.
// Marker: APEX_THE_NETWORK_WEB_ROUTE_REGISTRATION_REQUIRED