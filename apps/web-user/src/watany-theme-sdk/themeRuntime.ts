export const WATANY_THEME_SDK_STATUS = {
  enabledByDefault: false,
  mode: "preview-only",
  contract: "Does not replace routes, APIs, auth, database, or business logic.",
};

export function isWatanyThemeEnabled(): boolean {
  return import.meta.env.VITE_WATANY_THEME_SDK === "true";
}
