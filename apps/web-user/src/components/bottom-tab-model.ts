import type { Mode } from "../store/app";

export type TabId = "home" | "community" | "services" | "documents" | "profile";

export const TAB_ROOT_MODES: Record<TabId, Mode> = {
  home: "home",
  community: "community",
  services: "services",
  documents: "documents",
  profile: "profile",
};

const TAB_MODES = new Set<string>(Object.values(TAB_ROOT_MODES));

export function isTabMode(mode: string): boolean {
  return TAB_MODES.has(mode);
}

export function activeTabFromMode(mode: Mode): TabId {
  if (mode === "home") return "home";
  if (mode === "mobile-os") return "services";
  if (mode === "mobile-os-chat") return "community";
  if (mode === "community" || mode === "chat" || mode === "groups" || mode === "chat-sessions") return "community";
  if (mode === "forms" || mode === "procedures") return "services";
  if (mode === "documents") return "documents";
  if (mode === "profile" || mode === "messages" || mode === "notifications" || mode === "saved" || mode === "bookmarks") return "profile";
  if (mode === "superadmin") return "profile";
  return TAB_MODES.has(mode) ? (mode as TabId) : "services";
}