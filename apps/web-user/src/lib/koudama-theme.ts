export const KOUDAMA_THEME_STORAGE_KEY = "watany_theme_preference";

export type KoudamaThemeId = "watani" | "wadih" | "layli" | "nahasi" | "askari" | "arzi" | "azraq" | "ramli";
export type ThemeModePreference = "system" | "light" | "dark";

export const KOUDAMA_THEME_OPTIONS: ReadonlyArray<{
  id: KoudamaThemeId;
  label: string;
  description: string;
  swatch: string;
}> = [
  { id: "watani", label: "موطني", description: "النسخة الدافئة المعتمدة", swatch: "linear-gradient(135deg, #c7a55a, #f4ead0)" },
  { id: "wadih", label: "واضح", description: "تباين مرتفع داكن", swatch: "linear-gradient(135deg, #171717, #ffb74d)" },
  { id: "layli", label: "ليلي", description: "وضع ليلي هادئ", swatch: "linear-gradient(135deg, #121212, #64b5f6)" },
  { id: "nahasi", label: "نحاس", description: "سطوح نحاسية هادئة", swatch: "linear-gradient(135deg, #9d7d51, #f6efe5)" },
  { id: "askari", label: "عسكري", description: "درجات ميدانية ناعمة", swatch: "linear-gradient(135deg, #8b7b3c, #f2f0e6)" },
  { id: "arzi", label: "أرضي", description: "أخضر ترابي فاتح", swatch: "linear-gradient(135deg, #5d8a6f, #f0f4ec)" },
  { id: "azraq", label: "أزرق", description: "نسخة زرقاء نظيفة", swatch: "linear-gradient(135deg, #4a90d9, #f0f4f8)" },
  { id: "ramli", label: "رملي", description: "سطوح بيج هادئة", swatch: "linear-gradient(135deg, #a69060, #f5f0e8)" },
];

const DEFAULT_THEME: KoudamaThemeId = "watani";
const DARK_THEMES = new Set<KoudamaThemeId>(["wadih", "layli"]);

export function isKoudamaThemeId(value: unknown): value is KoudamaThemeId {
  return KOUDAMA_THEME_OPTIONS.some((option) => option.id === value);
}

export function readStoredKoudamaTheme(): KoudamaThemeId {
  try {
    const saved = globalThis.localStorage?.getItem(KOUDAMA_THEME_STORAGE_KEY);
    return isKoudamaThemeId(saved) ? saved : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function getKoudamaThemeScheme(themeId: KoudamaThemeId): "light" | "dark" {
  return DARK_THEMES.has(themeId) ? "dark" : "light";
}

export function resolveThemeModeColorScheme(themeMode: ThemeModePreference): "light" | "dark" {
  if (themeMode === "light" || themeMode === "dark") {
    return themeMode;
  }

  if (globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }

  return "light";
}

export function applyThemeModeAttributes(themeMode: ThemeModePreference) {
  if (globalThis.document === undefined) {
    return resolveThemeModeColorScheme(themeMode);
  }

  const resolvedScheme = resolveThemeModeColorScheme(themeMode);
  const root = document.documentElement;
  root.dataset.themeMode = themeMode;
  root.dataset.colorScheme = resolvedScheme;
  root.style.setProperty("color-scheme", resolvedScheme);
  document.querySelector('meta[name="color-scheme"]')?.setAttribute(
    "content",
    resolvedScheme === "dark" ? "dark light" : "light dark",
  );
  return resolvedScheme;
}

export function applyKoudamaTheme(themeId: KoudamaThemeId, persist = true) {
  if (globalThis.document === undefined) {
    return themeId;
  }

  const root = document.documentElement;
  root.dataset.theme = themeId;
  root.dataset.koudamaTheme = themeId;
  root.style.setProperty("--koudama-theme-id", themeId);

  if (persist) {
    try {
      globalThis.localStorage?.setItem(KOUDAMA_THEME_STORAGE_KEY, themeId);
    } catch {
      // ignore storage failures
    }
  }

  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    "content",
    getKoudamaThemeScheme(themeId) === "dark" ? "#171717" : "#faf7f0",
  );

  globalThis.dispatchEvent(new CustomEvent("watany-theme-change", { detail: { themeId } }));
  return themeId;
}