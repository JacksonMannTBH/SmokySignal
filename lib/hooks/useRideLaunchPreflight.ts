"use client";

import { useCallback } from "react";
import { useDeviceHeading } from "./useDeviceHeading";

function requestLocationOnce(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      () => resolve(true),
      () => resolve(false),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 8000 },
    );
  });
}

export function useRideLaunchPreflight(): () => Promise<void> {
  const heading = useDeviceHeading();

  return useCallback(async () => {
    await Promise.allSettled([
      requestLocationOnce(),
      heading.requestPermission(),
    ]);
  }, [heading]);
}
