import { createContext, useContext, type Context } from "react";
import type { Lang, UserProfile } from "../types/domain";
import type { DesignConfig } from "../types/design";

const contextStore = globalThis as typeof globalThis & {
  __watanyReactContexts__?: Map<string, Context<unknown>>;
};

function getStableContext<T>(key: string): Context<T | null> {
  contextStore.__watanyReactContexts__ ??= new Map<string, Context<unknown>>();
  const existing = contextStore.__watanyReactContexts__.get(key);
  if (existing) {
    return existing as Context<T | null>;
  }

  // Keep context identity stable across Vite HMR so providers and hooks do not drift apart.
  const created = createContext<T | null>(null);
  contextStore.__watanyReactContexts__.set(key, created as Context<unknown>);
  return created;
}

export type FontSize = "normal" | "large" | "xlarge";
export type ThemeMode = "system" | "light" | "dark";
export type ContrastMode = "normal" | "high";

export type Mode =
  | "home"
  | "chat"
  | "voting"
  | "mobile-os"
  | "mobile-os-chat"
  | "community"
  | "services"
  | "media"
  | "search"
  | "salary"
  | "school-grants"
  | "pension"
  | "bookmarks"
  | "cases"
  | "jobs"
  | "marketplace"
  | "alerts"
  | "profile"
  | "documents"
  | "messages"
  | "notifications"
  | "saved"
  | "chat-sessions"
  | "forms"
  | "procedures"
  | "disaster"
  | "superadmin"
  | "faq"
  | "ticker"
  | "groups"
  | "legal";

/* ──────────────────────────────────────────────────
   Context 1: User — profile, auth (changes rarely)
   ────────────────────────────────────────────────── */
export type UserState = {
  profile: UserProfile;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  /** Directly set the profile after OTP verification (no extra API call needed). */
  loginWithProfile: (profile: UserProfile) => void;
  logout: () => Promise<void>;
  updateProfile: (patch: Partial<UserProfile> & { role?: UserProfile["role"] }) => Promise<void>;
  requestPhoneVerification: (phoneNumber: string) => Promise<{
    requestId: string;
    phoneNumber: string;
    expiresAt: string;
    message: string;
  }>;
  verifyPhoneVerification: (requestId: string, code: string) => Promise<UserProfile>;
  hasRole: (roles: NonNullable<UserProfile["role"]> | NonNullable<UserProfile["role"]>[]) => boolean;
};

export const UserContext = getStableContext<UserState>("watany:user-context");

/* ──────────────────────────────────────────────────
   Context 2: Config — lang, api urls, settings
   ────────────────────────────────────────────────── */
export type ConfigState = {
  lang: Lang;
  setLang: (value: Lang) => void;
  themeMode: ThemeMode;
  setThemeMode: (value: ThemeMode) => void;
  contrastMode: ContrastMode;
  setContrastMode: (value: ContrastMode) => void;
  showSources: boolean;
  setShowSources: (value: boolean) => void;
  speakReplies: boolean;
  setSpeakReplies: (value: boolean) => void;
  dictationEnabled: boolean;
  setDictationEnabled: (value: boolean) => void;
  fontSize: FontSize;
  setFontSize: (value: FontSize) => void;
  apiBaseUrl: string;
  setApiBaseUrl: (value: string) => void;
  uploadUrl: string;
  setUploadUrl: (value: string) => void;
  channel: "web" | "whatsapp";
  setChannel: (value: "web" | "whatsapp") => void;
};

export const ConfigContext = getStableContext<ConfigState>("watany:config-context");

/* ──────────────────────────────────────────────────
   Context 3: UI — transient UI state (changes often)
   ────────────────────────────────────────────────── */
export type UIState = {
  settingsOpen: boolean;
  setSettingsOpen: (value: boolean) => void;
  design: DesignConfig;
  setDesign: (value: DesignConfig) => void;
  designSelectorOpen: boolean;
  setDesignSelectorOpen: (value: boolean) => void;
  mode: Mode;
  setMode: (value: Mode) => void;
};

export const UIContext = getStableContext<UIState>("watany:ui-context");

/* ──────────────────────────────────────────────────
   Combined AppState for backward compatibility
   ────────────────────────────────────────────────── */
export type AppState = UserState & ConfigState & UIState;

/* ── Granular hooks for consuming only what you need ── */

export function useUser() {
  const value = useContext(UserContext);
  if (!value) throw new Error("AppProvider missing");
  return value;
}

export function useConfig() {
  const value = useContext(ConfigContext);
  if (!value) throw new Error("AppProvider missing");
  return value;
}

export function useOptionalConfig() {
  return useContext(ConfigContext);
}

export function useUI() {
  const value = useContext(UIContext);
  if (!value) throw new Error("AppProvider missing");
  return value;
}

/** Backward-compatible hook that combines all contexts.
 *  Components that need everything can still use useApp().
 *  For best performance, prefer useUser/useConfig/useUI. */
export function useApp(): AppState {
  const user = useUser();
  const config = useConfig();
  const ui = useUI();
  return { ...user, ...config, ...ui };
}
export { AppProvider } from "./app-provider";
