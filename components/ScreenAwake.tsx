"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { SS_TOKENS } from "@/lib/tokens";
import { Tooltip } from "./Tooltip";

const STORAGE_KEY = "ss_wake_lock";
const PREF_ON = "on";
const PREF_OFF = "off";

type WakeLockSentinel = {
  released: boolean;
  release: () => Promise<void>;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
};

type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> };
};

/**
 * Keeps the screen awake while the user is on the rider-facing screens.
 * Mounted by app/(tabs)/layout.tsx so /admin and /about are unaffected.
 *
 * Renders a small moon-icon toggle top-right. Filled moon-with-slash
 * (MoonOff) = lock is held / screen won't sleep. Outline moon = lock
 * released / screen will sleep. Tap toggles; choice persists in
 * localStorage. Wake-lock-unsupported browsers render nothing.
 */
export function ScreenAwake() {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [active, setActive] = useState(false);
  const sentinelRef = useRef<WakeLockSentinel | null>(null);
  const pathname = usePathname();
  const onRadar = pathname === "/radar";
  const onHome = pathname === "/";

  // Bootstrap once on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const nav = navigator as WakeLockNavigator;
    if (!nav.wakeLock) {
      setSupported(false);
      return;
    }
    setSupported(true);
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === PREF_OFF) setEnabled(false);
  }, []);

  const release = useCallback(async () => {
    const s = sentinelRef.current;
    sentinelRef.current = null;
    if (s && !s.released) {
      try {
        await s.release();
      } catch {
        // already gone
      }
    }
    setActive(false);
  }, []);

  const acquire = useCallback(async () => {
    if (typeof navigator === "undefined") return;
    const nav = navigator as WakeLockNavigator;
    if (!nav.wakeLock) return;
    try {
      const s = await nav.wakeLock.request("screen");
      sentinelRef.current = s;
      setActive(true);
      // Browsers auto-release on tab hide; mark inactive so the next visible
      // event re-acquires.
      s.addEventListener?.("release", () => {
        if (sentinelRef.current === s) sentinelRef.current = null;
        setActive(false);
      });
    } catch {
      setActive(false);
    }
  }, []);

  // Acquire / release based on enabled + visibility.
  useEffect(() => {
    if (!supported) return;
    if (!enabled) {
      void release();
      return;
    }
    void acquire();
    const onVis = () => {
      if (document.visibilityState === "visible" && !sentinelRef.current) {
        void acquire();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      void release();
    };
  }, [supported, enabled, acquire, release]);

  if (!supported) return null;

  const onToggle = () => {
    setEnabled((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, next ? PREF_ON : PREF_OFF);
      }
      return next;
    });
  };

  // Lit = wake lock is currently held. Unlit = preference disabled or
  // tab hidden so the browser released it.
  const lit = enabled && active;
  const color = lit ? SS_TOKENS.alert : SS_TOKENS.fg1;

  return (
    <Tooltip
      side="bottom"
      align="end"
      content={
        lit
          ? "Wake lock on — your phone won't sleep while Out Of Sight is open."
          : "Wake lock off — phone sleeps normally. Tap to enable."
      }
    >
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={enabled}
        aria-label={
          enabled ? "Keep screen awake (currently on)" : "Allow screen to sleep (currently off)"
        }
        style={{
          position: "fixed",
          top: onRadar
            ? "calc(env(safe-area-inset-top, 0px) + 54px)"
            : onHome
              ? "calc(env(safe-area-inset-top, 0px) + 48px)"
              : 16,
          ...(onRadar ? { left: 172, right: "auto" } : { right: 10 }),
          zIndex: 30,
          width: 44,
          height: 44,
          padding: 6,
          borderRadius: "50%",
          background: "transparent",
          border: 0,
          color,
          cursor: "pointer",
          touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "color 200ms",
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
            background: lit ? SS_TOKENS.alertDim : SS_TOKENS.surfaceTranslucent,
            border: `.5px solid ${lit ? `color-mix(in srgb, ${SS_TOKENS.alert} 34%, transparent)` : SS_TOKENS.hairline}`,
            boxShadow: SS_TOKENS.shadowSm,
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
            transition: "background 200ms, border-color 200ms, box-shadow 200ms",
          }}
        >
          <MoonStateIcon lit={lit} />
        </span>
      </button>
    </Tooltip>
  );
}

// Lucide-style Moon (lit=false: outline, screen will sleep) and
// MoonOff (lit=true: filled crescent with diagonal slash, screen
// won't sleep).
function MoonStateIcon({ lit }: { lit: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill={lit ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      {lit && <path d="m2 2 20 20" />}
    </svg>
  );
}
