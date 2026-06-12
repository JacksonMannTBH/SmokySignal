export const THEME_STORAGE_KEY = "ss_radar_dark_mode";
export const THEME_CHANGE_EVENT = "ss-theme-change";

export function isDarkThemeValue(value: string | null | undefined): boolean {
  return value === "1" || value === "dark";
}

export function readStoredDarkTheme(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return isDarkThemeValue(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return false;
  }
}

export function writeStoredDarkTheme(dark: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, dark ? "1" : "0");
  } catch {
    /* localStorage may be unavailable in private browsing */
  }
  window.dispatchEvent(
    new CustomEvent(THEME_CHANGE_EVENT, { detail: { dark } }),
  );
}
