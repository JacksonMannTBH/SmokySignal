"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { SS_TOKENS } from "@/lib/tokens";
import {
  THEME_CHANGE_EVENT,
  readStoredDarkTheme,
  writeStoredDarkTheme,
} from "@/lib/theme";
import { Tooltip } from "./Tooltip";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const pathname = usePathname();
  const onRadar = pathname === "/radar";

  useEffect(() => {
    setDark(readStoredDarkTheme());
    const onThemeChange = (event: Event) => {
      const detail = (event as CustomEvent<{ dark?: boolean }>).detail;
      setDark(detail?.dark ?? readStoredDarkTheme());
    };
    window.addEventListener(THEME_CHANGE_EVENT, onThemeChange);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, onThemeChange);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    writeStoredDarkTheme(next);
  };

  return (
    <Tooltip
      side="bottom"
      align="end"
      content={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <button
        type="button"
        onClick={toggle}
        aria-pressed={dark}
        aria-label={dark ? "Use light mode" : "Use dark mode"}
        style={{
          position: "fixed",
          top: onRadar ? "calc(env(safe-area-inset-top, 0px) + 54px)" : 6,
          ...(onRadar ? { left: 128, right: "auto" } : { right: 94 }),
          zIndex: 30,
          width: 44,
          height: 44,
          padding: 6,
          borderRadius: "50%",
          background: "transparent",
          border: 0,
          color: dark ? SS_TOKENS.alert : SS_TOKENS.fg1,
          cursor: "pointer",
          touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          aria-hidden
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: dark ? SS_TOKENS.surface : SS_TOKENS.surfaceTranslucent,
            border: `.5px solid ${dark ? SS_TOKENS.alertDim : SS_TOKENS.hairline}`,
            boxShadow: SS_TOKENS.shadowSm,
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
          }}
        >
          <ThemeIcon active={dark} />
        </span>
      </button>
    </Tooltip>
  );
}

function ThemeIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path
        d="M12 3a9 9 0 0 1 0 18z"
        fill={active ? "currentColor" : "none"}
        stroke="none"
      />
    </svg>
  );
}
