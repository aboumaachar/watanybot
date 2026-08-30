import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { DesignConfig } from "../types/design";
import { DEFAULT_DESIGN } from "../types/design";
import {
  defaultPublishedWebUserSettings,
  sanitizePublishedWebUserSettings,
  type PublishedWebUserSettings,
} from "@watany/shared/web-user-settings";
import { getCandidateApiBaseUrls, getDefaultApiBaseUrl, isSameOriginDevProxyBase } from "../lib/api-base";
import { api } from "../lib/api";
import { dirForLang } from "../lib/lang";
import { applyKoudamaTheme, applyThemeModeAttributes, readStoredKoudamaTheme } from "../lib/koudama-theme";
import { MODE_PATHS, modeFromPath } from "../lib/routes";
import { isLoggedIn, profileFromToken, subscribeAuthStateChange } from "../lib/auth";
import { useFeatureFlags } from "./features";
import {
  ConfigContext,
  type ConfigState,
  type ContrastMode,
  type FontSize,
  type Mode,
  type ThemeMode,
  type UIState,
  UIContext,
  type UserState,
  UserContext,
} from "./app";
import type { Lang, UserProfile } from "../types/domain";

type UserRole = NonNullable<UserProfile["role"]>;

const ROLE_LEVEL: Record<UserRole, number> = {
  public: 0,
  accredited: 1,
  driver: 2,
  moderator: 3,
  admin: 4,
  superadmin: 5,
};

function hasMinimumRole(currentRole: UserProfile["role"], requiredRole: UserRole) {
  if (!currentRole) {
    return false;
  }

  return ROLE_LEVEL[currentRole] >= ROLE_LEVEL[requiredRole];
}

const API_BASE_STORAGE_KEY = "watany_api_base_url";
const DEFAULT_API = getCandidateApiBaseUrls()[0] || getDefaultApiBaseUrl();
const DEFAULT_UPLOAD = import.meta.env.VITE_UPLOAD_URL || "https://koudama.com/data/pictures";
const AUTH_BYPASS_FOR_TESTING = import.meta.env.DEV && (import.meta.env.VITE_DISABLE_AUTH ?? "false").toLowerCase() === "true";
const AUTH_BYPASS_LOGGED_OUT_KEY = "watany_auth_bypass_logged_out";
const DEV_SUPERADMIN_PROFILE: UserProfile = {
  name: "مدير النظام المحلي",
  email: "admin@koudama.com",
  isAuthed: true,
  role: "superadmin",
};

function isBypassLoggedOut(): boolean {
  if (typeof localStorage === "undefined") {
    return false;
  }

  return localStorage.getItem(AUTH_BYPASS_LOGGED_OUT_KEY) === "true";
}

function setBypassLoggedOut(next: boolean): void {
  if (typeof localStorage === "undefined") {
    return;
  }

  if (next) {
    localStorage.setItem(AUTH_BYPASS_LOGGED_OUT_KEY, "true");
    return;
  }

  localStorage.removeItem(AUTH_BYPASS_LOGGED_OUT_KEY);
}

function readProfileFromAuthState(): UserProfile {
  if (AUTH_BYPASS_FOR_TESTING) {
    if (isBypassLoggedOut()) {
      return { isAuthed: false, role: "public" };
    }
    return DEV_SUPERADMIN_PROFILE;
  }

  return profileFromToken() ?? { isAuthed: false, role: "public" };
}

function loadDesign(): DesignConfig {
  try {
    const raw = localStorage.getItem("watany_design");
    if (raw) return { ...DEFAULT_DESIGN, ...JSON.parse(raw) };
  } catch {
    // ignore malformed local design state
  }
  return { ...DEFAULT_DESIGN };
}

function loadBooleanPreference(key: string, fallback: boolean): boolean {
  const raw = localStorage.getItem(key);
  if (raw === "true") return true;
  if (raw === "false") return false;
  return fallback;
}

function loadChannelPreference(): "web" | "whatsapp" {
  const raw = localStorage.getItem("watany_channel");
  return raw === "whatsapp" ? "whatsapp" : "web";
}

function persistPublishedSettingsLocally(settings: PublishedWebUserSettings) {
  localStorage.setItem("watany_theme_mode", settings.themeMode);
  localStorage.setItem("watany_contrast_mode", settings.contrastMode);
  localStorage.setItem("watany_fontsize", settings.fontSize);
  localStorage.setItem("watany_show_sources", String(settings.showSources));
  localStorage.setItem("watany_speak_replies", String(settings.speakReplies));
  localStorage.setItem("watany_dictation", String(settings.dictationEnabled));
  localStorage.setItem("watany_channel", settings.channel);
  localStorage.setItem("watany_design", JSON.stringify(settings.design));
}

export function AppProvider({ children }: Readonly<{ children: ReactNode }>) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { isEnabled } = useFeatureFlags();

  const [profile, setProfile] = useState<UserProfile>(() => readProfileFromAuthState());
  const apiBaseUrlRef = useRef(DEFAULT_API);

  const [lang, setLang] = useState<Lang>("ar");
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    return (localStorage.getItem("watany_theme_mode") as ThemeMode) || "system";
  });
  const [contrastMode, setContrastMode] = useState<ContrastMode>(() => {
    return (localStorage.getItem("watany_contrast_mode") as ContrastMode) || "normal";
  });
  const [showSources, setShowSources] = useState(true);
  const [speakRepliesPreference, setSpeakRepliesPreference] = useState(() => loadBooleanPreference("watany_speak_replies", false));
  const [dictationPreference, setDictationPreference] = useState(() => loadBooleanPreference("watany_dictation", true));
  const [fontSize, setFontSize] = useState<FontSize>(() => {
    return (localStorage.getItem("watany_fontsize") as FontSize) || "normal";
  });
  const [apiBaseUrl, setApiBaseUrl] = useState(DEFAULT_API);
  const [uploadUrl, setUploadUrl] = useState(DEFAULT_UPLOAD);
  const [channelPreference, setChannelPreference] = useState<"web" | "whatsapp">(loadChannelPreference);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [designState, setDesignState] = useState<DesignConfig>(loadDesign);
  const [designSelectorOpen, setDesignSelectorOpen] = useState(false);
  const dictationFeatureEnabled = isEnabled("dictation");
  const speakRepliesFeatureEnabled = isEnabled("speak-replies");
  const whatsappModeFeatureEnabled = isEnabled("whatsapp-mode");
  const effectiveDictationEnabled = dictationFeatureEnabled ? dictationPreference : false;
  const effectiveSpeakReplies = speakRepliesFeatureEnabled ? speakRepliesPreference : false;
  const effectiveChannel = whatsappModeFeatureEnabled ? channelPreference : "web";

  const mode = modeFromPath(pathname);
  const setMode = useCallback(
    (nextMode: Mode) => navigate(MODE_PATHS[nextMode]),
    [navigate],
  );

  const setDesign = (value: DesignConfig) => {
    setDesignState(value);
    localStorage.setItem("watany_design", JSON.stringify(value));
  };

  useEffect(() => {
    const defaults = defaultPublishedWebUserSettings();
    setShowSources(loadBooleanPreference("watany_show_sources", defaults.showSources));
  }, []);

  const setSpeakReplies = useCallback((value: boolean) => {
    setSpeakRepliesPreference(speakRepliesFeatureEnabled ? value : false);
  }, [speakRepliesFeatureEnabled]);

  const setDictationEnabled = useCallback((value: boolean) => {
    setDictationPreference(dictationFeatureEnabled ? value : false);
  }, [dictationFeatureEnabled]);

  const setChannel = useCallback((value: "web" | "whatsapp") => {
    if (value === "whatsapp" && !whatsappModeFeatureEnabled) {
      setChannelPreference("web");
      return;
    }

    setChannelPreference(value);
  }, [whatsappModeFeatureEnabled]);

  useEffect(() => {
    apiBaseUrlRef.current = apiBaseUrl;
  }, [apiBaseUrl]);

  useEffect(() => {
    localStorage.setItem(API_BASE_STORAGE_KEY, apiBaseUrl);
  }, [apiBaseUrl]);

  useEffect(() => {
    let active = true;
    const candidates = getCandidateApiBaseUrls();
    const primaryCandidate = candidates[0];

    if (isSameOriginDevProxyBase(primaryCandidate)) {
      if (primaryCandidate && apiBaseUrlRef.current !== primaryCandidate) {
        setApiBaseUrl(primaryCandidate);
      }

      return () => {
        active = false;
      };
    }

    if (candidates.length <= 1) {
      const singleCandidate = candidates[0];
      if (singleCandidate && apiBaseUrlRef.current !== singleCandidate) {
        setApiBaseUrl(singleCandidate);
      }

      return () => {
        active = false;
      };
    }

    async function ensureReachableApiBaseUrl() {
      for (const candidate of candidates) {
        try {
          const res = await fetch(`${candidate}/api/forms/sources`, { method: "GET" });
          if (!active) return;
          if (!res.ok) continue;
          if (apiBaseUrlRef.current !== candidate) {
            setApiBaseUrl(candidate);
          }
          return;
        } catch {
          // try the next known local gateway candidate
        }
      }
    }

    void ensureReachableApiBaseUrl();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dirForLang(lang);
  }, [lang]);

  useEffect(() => {
    const media = globalThis.matchMedia("(prefers-color-scheme: dark)");

    const applyTheme = () => {
      applyThemeModeAttributes(themeMode);
      applyKoudamaTheme(readStoredKoudamaTheme(), false);
      localStorage.setItem("watany_theme_mode", themeMode);
    };

    applyTheme();
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [themeMode]);

  useEffect(() => {
    document.documentElement.dataset.contrast = contrastMode;
    localStorage.setItem("watany_contrast_mode", contrastMode);
  }, [contrastMode]);

  useEffect(() => {
    localStorage.setItem("watany_show_sources", String(showSources));
  }, [showSources]);

  useEffect(() => {
    localStorage.setItem("watany_speak_replies", String(speakRepliesPreference));
  }, [speakRepliesPreference]);

  useEffect(() => {
    localStorage.setItem("watany_dictation", String(dictationPreference));
  }, [dictationPreference]);

  useEffect(() => {
    const el = document.documentElement;
    el.classList.remove("font-large", "font-xlarge");
    if (fontSize === "large") el.classList.add("font-large");
    if (fontSize === "xlarge") el.classList.add("font-xlarge");
    localStorage.setItem("watany_fontsize", fontSize);
  }, [fontSize]);

  useEffect(() => {
    localStorage.setItem("watany_channel", channelPreference);
  }, [channelPreference]);

  useEffect(() => subscribeAuthStateChange(() => {
    setProfile(readProfileFromAuthState());
  }), []);

  useEffect(() => {
    let active = true;

    async function loadPublishedSettings() {
      const payload = await api.getPublishedWebUserSettings(apiBaseUrlRef.current);
      if (!active || !payload) return;

      const next = sanitizePublishedWebUserSettings(payload.settings);
      persistPublishedSettingsLocally(next);
      setThemeMode(next.themeMode);
      setContrastMode(next.contrastMode);
      setFontSize(next.fontSize);
      setShowSources(next.showSources);
      setSpeakRepliesPreference(next.speakReplies);
      setDictationPreference(next.dictationEnabled);
      setChannelPreference(next.channel);
      setDesignState(next.design);
    }

    void loadPublishedSettings();
    return () => {
      active = false;
    };
  }, [apiBaseUrl]);

  useEffect(() => {
    let active = true;

    async function hydrateAuthenticatedProfile() {
      if (AUTH_BYPASS_FOR_TESTING) {
        setProfile(readProfileFromAuthState());
        return;
      }
      if (!isLoggedIn()) return;

      const nextProfile = await api.getProfile(apiBaseUrlRef.current);
      if (!active) return;

      setProfile(nextProfile.isAuthed ? nextProfile : { isAuthed: false, role: "public" });
    }

    void hydrateAuthenticatedProfile();
    return () => {
      active = false;
    };
  }, [apiBaseUrl]);

  useEffect(() => {
    const waFlag = import.meta.env.VITE_ENABLE_WHATSAPP_MODE === "true";
    if ((!waFlag || !whatsappModeFeatureEnabled) && channelPreference !== "web") {
      setChannelPreference("web");
    }
    if (waFlag && effectiveChannel === "whatsapp") {
      document.documentElement.classList.add("wa-mode");
    } else {
      document.documentElement.classList.remove("wa-mode");
    }
  }, [channelPreference, effectiveChannel, whatsappModeFeatureEnabled]);

  const userValue = useMemo<UserState>(() => ({
    profile,
    login: async (email: string, password: string, rememberMe?: boolean) => {
      const next = await api.login(email, password, apiBaseUrlRef.current, rememberMe);
      setBypassLoggedOut(false);
      setProfile(next);
    },
    loginWithProfile: (nextProfile: UserProfile) => {
      if (nextProfile.isAuthed) {
        setBypassLoggedOut(false);
      }
      setProfile(nextProfile);
    },
    logout: async () => {
      await api.logout(apiBaseUrlRef.current);
      if (AUTH_BYPASS_FOR_TESTING) {
        setBypassLoggedOut(true);
      }
      setProfile({ isAuthed: false, role: "public" });
    },
    updateProfile: async (patch) => {
      const next = await api.updateProfile(patch, apiBaseUrlRef.current);
      setProfile((current) => ({ ...current, ...next, isAuthed: current.isAuthed || next.isAuthed }));
    },
    requestPhoneVerification: (phoneNumber: string) => api.requestPhoneVerification(phoneNumber, apiBaseUrlRef.current),
    verifyPhoneVerification: async (requestId: string, code: string) => {
      const next = await api.verifyPhoneVerification(requestId, code, apiBaseUrlRef.current);
      setProfile((current) => ({ ...current, ...next, isAuthed: true }));
      return next;
    },
    hasRole: (roles) => {
      const list = Array.isArray(roles) ? roles : [roles];
      return list.some((role) => hasMinimumRole(profile.role, role));
    },
  }), [profile]);

  const configValue = useMemo<ConfigState>(() => ({
    lang,
    setLang,
    themeMode,
    setThemeMode,
    contrastMode,
    setContrastMode,
    showSources,
    setShowSources,
    speakReplies: effectiveSpeakReplies,
    setSpeakReplies,
    dictationEnabled: effectiveDictationEnabled,
    setDictationEnabled,
    fontSize,
    setFontSize,
    apiBaseUrl,
    setApiBaseUrl,
    uploadUrl,
    setUploadUrl,
    channel: effectiveChannel,
    setChannel,
  }), [lang, themeMode, contrastMode, showSources, effectiveSpeakReplies, setSpeakReplies, effectiveDictationEnabled, setDictationEnabled, fontSize, apiBaseUrl, uploadUrl, effectiveChannel, setChannel]);

  const uiValue = useMemo<UIState>(() => ({
    settingsOpen,
    setSettingsOpen,
    design: designState,
    setDesign,
    designSelectorOpen,
    setDesignSelectorOpen,
    mode,
    setMode,
  }), [settingsOpen, designState, designSelectorOpen, mode, setMode]);

  return (
    <UserContext.Provider value={userValue}>
      <ConfigContext.Provider value={configValue}>
        <UIContext.Provider value={uiValue}>
          {children}
        </UIContext.Provider>
      </ConfigContext.Provider>
    </UserContext.Provider>
  );
}