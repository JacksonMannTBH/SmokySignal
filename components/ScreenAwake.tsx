"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  readStoredWakeLockEnabled,
  WAKE_LOCK_CHANGE_EVENT,
  WAKE_LOCK_STORAGE_KEY,
} from "@/lib/wake-lock";

type WakeLockSentinel = {
  released: boolean;
  release: () => Promise<void>;
  addEventListener?: (type: string, listener: () => void) => void;
};

type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> };
};

export function ScreenAwake() {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const nav = navigator as WakeLockNavigator;
    if (!nav.wakeLock) {
      setSupported(false);
      return;
    }

    setSupported(true);
    setEnabled(readStoredWakeLockEnabled());

    const sync = () => setEnabled(readStoredWakeLockEnabled());
    const onStorage = (event: StorageEvent) => {
      if (event.key === WAKE_LOCK_STORAGE_KEY) sync();
    };
    window.addEventListener(WAKE_LOCK_CHANGE_EVENT, sync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(WAKE_LOCK_CHANGE_EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const release = useCallback(async () => {
    const current = sentinelRef.current;
    sentinelRef.current = null;
    if (!current || current.released) return;
    try {
      await current.release();
    } catch {
      /* already released */
    }
  }, []);

  const acquire = useCallback(async () => {
    if (typeof navigator === "undefined") return;
    const nav = navigator as WakeLockNavigator;
    if (!nav.wakeLock || document.visibilityState !== "visible") return;
    try {
      const sentinel = await nav.wakeLock.request("screen");
      sentinelRef.current = sentinel;
      sentinel.addEventListener?.("release", () => {
        if (sentinelRef.current === sentinel) sentinelRef.current = null;
      });
    } catch {
      sentinelRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!supported) return;
    if (!enabled) {
      void release();
      return;
    }

    void acquire();
    const onVisibility = () => {
      if (document.visibilityState === "visible" && !sentinelRef.current) {
        void acquire();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      void release();
    };
  }, [supported, enabled, acquire, release]);

  return null;
}
