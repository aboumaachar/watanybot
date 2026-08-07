export type WebUserThemeMode = "system" | "light" | "dark";
export type WebUserContrastMode = "normal" | "high";
export type WebUserFontSize = "normal" | "large" | "xlarge";
export type WebUserChannel = "web" | "whatsapp";

export type WebUserVisualTheme = "glassmorphism" | "neubrutalism" | "minimal-flat" | "neumorphism";
export type WebUserLayoutMode = "floating-bubble" | "command-palette" | "split-pane";
export type WebUserNavStyle = "bottom-tab-rail" | "hamburger" | "ai-driven";

export type WebUserDesignConfig = {
  theme: WebUserVisualTheme;
  layout: WebUserLayoutMode;
  nav: WebUserNavStyle;
};

export type PublishedWebUserSettings = {
  themeMode: WebUserThemeMode;
  contrastMode: WebUserContrastMode;
  fontSize: WebUserFontSize;
  showSources: boolean;
  speakReplies: boolean;
  dictationEnabled: boolean;
  channel: WebUserChannel;
  design: WebUserDesignConfig;
};

export type PublishedWebUserSettingsPayload = {
  settings: PublishedWebUserSettings;
  lastUpdatedAt: string | null;
};

export const WEB_USER_THEME_MODES = ["system", "light", "dark"] as const;
export const WEB_USER_CONTRAST_MODES = ["normal", "high"] as const;
export const WEB_USER_FONT_SIZES = ["normal", "large", "xlarge"] as const;
export const WEB_USER_CHANNELS = ["web", "whatsapp"] as const;
export const WEB_USER_VISUAL_THEMES = ["glassmorphism", "neubrutalism", "minimal-flat", "neumorphism"] as const;
export const WEB_USER_LAYOUT_MODES = ["floating-bubble", "command-palette", "split-pane"] as const;
export const WEB_USER_NAV_STYLES = ["bottom-tab-rail", "hamburger", "ai-driven"] as const;

export function defaultPublishedWebUserSettings(): PublishedWebUserSettings {
  return {
    themeMode: "system",
    contrastMode: "normal",
    fontSize: "normal",
    showSources: true,
    speakReplies: false,
    dictationEnabled: true,
    channel: "web",
    design: {
      theme: "glassmorphism",
      layout: "floating-bubble",
      nav: "bottom-tab-rail",
    },
  };
}

export function sanitizePublishedWebUserSettings(input: unknown): PublishedWebUserSettings {
  const defaults = defaultPublishedWebUserSettings();
  const source = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const designSource = source.design && typeof source.design === "object"
    ? source.design as Record<string, unknown>
    : {};

  return {
    themeMode: WEB_USER_THEME_MODES.includes(source.themeMode as WebUserThemeMode) ? source.themeMode as WebUserThemeMode : defaults.themeMode,
    contrastMode: WEB_USER_CONTRAST_MODES.includes(source.contrastMode as WebUserContrastMode) ? source.contrastMode as WebUserContrastMode : defaults.contrastMode,
    fontSize: WEB_USER_FONT_SIZES.includes(source.fontSize as WebUserFontSize) ? source.fontSize as WebUserFontSize : defaults.fontSize,
    showSources: typeof source.showSources === "boolean" ? source.showSources : defaults.showSources,
    speakReplies: typeof source.speakReplies === "boolean" ? source.speakReplies : defaults.speakReplies,
    dictationEnabled: typeof source.dictationEnabled === "boolean" ? source.dictationEnabled : defaults.dictationEnabled,
    channel: WEB_USER_CHANNELS.includes(source.channel as WebUserChannel) ? source.channel as WebUserChannel : defaults.channel,
    design: {
      theme: WEB_USER_VISUAL_THEMES.includes(designSource.theme as WebUserVisualTheme) ? designSource.theme as WebUserVisualTheme : defaults.design.theme,
      layout: WEB_USER_LAYOUT_MODES.includes(designSource.layout as WebUserLayoutMode) ? designSource.layout as WebUserLayoutMode : defaults.design.layout,
      nav: WEB_USER_NAV_STYLES.includes(designSource.nav as WebUserNavStyle) ? designSource.nav as WebUserNavStyle : defaults.design.nav,
    },
  };
}