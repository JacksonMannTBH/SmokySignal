"use client";

import { useCallback } from "react";
import { useDeviceHeading } from "./useDeviceHeading";
import {
  getCurrentSubscriptionId,
  isPushSupported,
  pushAvailableInThisContext,
  subscribePush,
  updatePushPrefs,
} from "../push/client";
import type { AlertPrefs } from "../push/types";
import { getProximityThresholdNm, setProximityEnabled } from "../proximity-alert";
import { getRegion } from "../region-pref";

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

async function requestNotificationOnce(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (typeof Notification === "undefined") return false;
  if (!("serviceWorker" in navigator)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  } catch {
    return false;
  }
}

async function ensureBackgroundProximityAlerts(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!isPushSupported()) return requestNotificationOnce();
  if (!pushAvailableInThisContext().available) return requestNotificationOnce();

  setProximityEnabled(true);
  const prefs: Partial<AlertPrefs> = {
    tier: "all",
    zones: "any",
    tails: undefined,
    region_id: getRegion(),
    proximity_enabled: true,
    proximity_nm: getProximityThresholdNm(),
  };

  const existingId = await getCurrentSubscriptionId();
  if (existingId) return updatePushPrefs(existingId, prefs);

  const result = await subscribePush(prefs);
  if (result.ok) return true;

  return requestNotificationOnce();
}

export function useRideLaunchPreflight(): () => Promise<void> {
  const heading = useDeviceHeading();

  return useCallback(async () => {
    await Promise.allSettled([
      requestLocationOnce(),
      heading.requestPermission(),
      ensureBackgroundProximityAlerts(),
    ]);
  }, [heading]);
}
