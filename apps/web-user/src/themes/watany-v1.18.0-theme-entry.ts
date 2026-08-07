
import './watany-v1.18.1-current-baseline-full-theme.css';export const WATANY_V1180_THEME_ID = "v1.18.0" as const;
export const WATANY_V1180_ICON_AUTHORITY = "project-source-of-truth" as const;

export function activateWatanyV1180Theme(
  root: HTMLElement = document.documentElement,
): void {
  root.dataset.watanyTheme = WATANY_V1180_THEME_ID;
  root.dataset.watanyIconAuthority = WATANY_V1180_ICON_AUTHORITY;
  root.classList.add("watany-theme-v1180");
}
