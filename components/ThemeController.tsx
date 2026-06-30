"use client";

import { useEffect } from "react";
import {
  THEME_CHANGE_EVENT,
  THEME_STORAGE_KEY,
} from "@/lib/theme";

function applyTheme(): void {
  document.documentElement.dataset.theme = "dark";
  document.body.dataset.theme = "dark";
  document.documentElement.style.colorScheme = "dark";
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", "#050607");
}

export function ThemeController() {
  useEffect(() => {
    applyTheme();

    const onThemeChange = () => applyTheme();
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) {
        applyTheme();
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
