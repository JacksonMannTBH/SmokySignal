"use client";

// Registers the static /sw.js service worker on every page load. This remains
// for PWA install/update behavior only.

import { useEffect } from "react";

export function SwRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* silent: PWA registration should fail gracefully */
    });
  }, []);
  return null;
}
