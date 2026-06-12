"use client";

import { useEffect } from "react";
import {
  THEME_CHANGE_EVENT,
  THEME_STORAGE_KEY,
  readStoredDarkTheme,
} from "@/lib/theme";

function applyTheme(dark: boolean): void {
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.body.dataset.theme = dark ? "dark" : "light";
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", dark ? "#020202" : "#ffffff");
}

export function ThemeController() {
  useEffect(() => {
    applyTheme(readStoredDarkTheme());

    const onThemeChange = (event: Event) => {
      const detail = (event as CustomEvent<{ dark?: boolean }>).detail;
      applyTheme(detail?.dark ?? readStoredDarkTheme());
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) {
        applyTheme(readStoredDarkTheme());
      }
    };

    window.addEventListener(THEME_CHANGE_EVENT, onThemeChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, onThemeChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return null;
}
