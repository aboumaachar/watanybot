/**
 * Route   Mode mapping for React Router integration.
 *
 * Every `Mode` has a URL path. Components that used `setMode("salary")`
 * now call `navigate("/salary")`  or use the `useNavigateMode()` hook
 * which preserves the old `setMode(mode)` API while navigating via URLs.
 */
import { useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import type { Mode } from "../store/app";

/** Canonical path for each mode */
export const MODE_PATHS: Record<Mode, string> = {
  home:            "/",
  chat:            "/hybrid-kb-chat",
  voting:          "/voting",
  "mobile-os":      "/",
  "mobile-os-chat": "/chat",
  community:       "/community",
  services:        "/",
  media:           "/media",
  search:          "/search",
  salary:          "/salary",
  "school-grants": "/school-grants",
  pension:         "/pension",
  bookmarks:       "/bookmarks",
  cases:           "/cases",
  jobs:            "/jobs",
  marketplace:     "/marketplace",
  alerts:          "/alerts",
  profile:         "/profile",
  messages:        "/messages",
  documents:       "/documents",
  notifications:   "/notifications",
  saved:           "/saved",
  "chat-sessions": "/chat-sessions",
  forms:           "/forms",
  procedures:      "/procedures",
  disaster:        "/disaster",
  superadmin:      "/superadmin",
  faq:             "/faq",
  ticker:          "/updates",
  groups:          "/groups",
  legal:           "/legal",
};

/** Reverse lookup: URL path   Mode */
const PATH_TO_MODE = new Map<string, Mode>(
  Object.entries(MODE_PATHS).map(([mode, path]) => [path, mode as Mode])
);

PATH_TO_MODE.set("/assistant", "chat");
PATH_TO_MODE.set("/", "mobile-os");
PATH_TO_MODE.set("/chat", "mobile-os-chat");
PATH_TO_MODE.set("/hybrid-kb-chat", "chat");
PATH_TO_MODE.set("/ticker", "ticker");
PATH_TO_MODE.set("/updates", "ticker");
PATH_TO_MODE.set("/world-cup", "community");

/** Derive current mode from browser URL */
export function modeFromPath(pathname: string): Mode {
  if (pathname.startsWith("/jobs")) return "jobs";
  if (pathname.startsWith("/admin/al-wafiyat")) return "services";
  if (pathname.startsWith("/al-wafiyat")) return "services";
  if (pathname.startsWith("/deaths")) return "services";
  if (pathname.startsWith("/voting")) return "voting";
  if (pathname.startsWith("/services/recruitment")) return "services";
  if (pathname.startsWith("/hybrid-kb-chat")) return "chat";
  if (pathname.startsWith("/chat")) return "mobile-os-chat";
  if (pathname.startsWith("/mobile-os/chat")) return "mobile-os-chat";
  if (pathname.startsWith("/mobile-os")) return "mobile-os";
  if (pathname.startsWith("/messages")) return "messages";
  if (pathname.startsWith("/forms")) return "forms";
  if (pathname.startsWith("/world-cup")) return "community";
  if (pathname.startsWith("/groups")) return "groups";
  if (pathname === "/legal") return "legal";
  if (pathname.startsWith("/services/")) return "services";
  return PATH_TO_MODE.get(pathname) ?? "home";
}

/**
 * Drop-in replacement for the old `setMode()` pattern.
 * Returns a function with the same signature: `navigateMode("salary")`.
 */
export function useNavigateMode() {
  const navigate = useNavigate();

  const navigateMode = useCallback(
    (mode: Mode) => {
      navigate(MODE_PATHS[mode]);
    },
    [navigate],
  );

  return navigateMode;
}

/**
 * Read current mode from the URL (reactive).
 */
export function useCurrentMode(): Mode {
  const { pathname } = useLocation();
  return modeFromPath(pathname);
}




// APEX THE NETWORK WEB ROUTE REVIEW HOOK
// Marker: APEX_THE_NETWORK_WEB_ROUTE_REGISTRATION_REQUIRED
// APEX_THE_NETWORK_EXACT_ROUTE_CONSTANTS
export const THE_NETWORK_ROUTE = '/network';
export const THE_NETWORK_ROUTE_ALT = '/the-network';