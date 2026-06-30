"use client";

import {
  DEFAULT_RIDE_STATUS_THRESHOLDS,
  normalizeRideStatusThresholds,
  type RideStatus,
  type RideStatusThresholds,
} from "./ride-mode";

export const RIDE_STATUS_THRESHOLDS_KEY = "ss_ride_status_thresholds";
export const RIDE_STATUS_NOTIFICATIONS_KEY = "ss_ride_status_notifications";

export type RideStatusNotificationPrefs = Record<RideStatus, boolean>;

export const DEFAULT_RIDE_STATUS_NOTIFICATIONS: RideStatusNotificationPrefs = {
  clear: true,
  watch: true,
  warning: true,
  danger: true,
};

export function getRideStatusThresholds(): RideStatusThresholds {
  if (typeof window === "undefined") return DEFAULT_RIDE_STATUS_THRESHOLDS;
  try {
    const raw = window.localStorage.getItem(RIDE_STATUS_THRESHOLDS_KEY);
    if (!raw) return DEFAULT_RIDE_STATUS_THRESHOLDS;
    const parsed = JSON.parse(raw) as Partial<RideStatusThresholds>;
    return normalizeRideStatusThresholds(parsed);
  } catch {
    return DEFAULT_RIDE_STATUS_THRESHOLDS;
  }
}

export function setRideStatusThresholds(
  thresholds: Partial<RideStatusThresholds>,
): RideStatusThresholds {
  const normalized = normalizeRideStatusThresholds(thresholds);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      RIDE_STATUS_THRESHOLDS_KEY,
      JSON.stringify(normalized),
    );
  }
  return normalized;
}

export function getRideStatusNotificationPrefs(): RideStatusNotificationPrefs {
  if (typeof window === "undefined") return DEFAULT_RIDE_STATUS_NOTIFICATIONS;
  try {
    const raw = window.localStorage.getItem(RIDE_STATUS_NOTIFICATIONS_KEY);
    if (!raw) return DEFAULT_RIDE_STATUS_NOTIFICATIONS;
    const parsed = JSON.parse(raw) as Partial<RideStatusNotificationPrefs>;
    return normalizeRideStatusNotificationPrefs(parsed);
  } catch {
    return DEFAULT_RIDE_STATUS_NOTIFICATIONS;
  }
}

export function setRideStatusNotificationPrefs(
  prefs: Partial<RideStatusNotificationPrefs>,
): RideStatusNotificationPrefs {
  const normalized = normalizeRideStatusNotificationPrefs(prefs);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      RIDE_STATUS_NOTIFICATIONS_KEY,
      JSON.stringify(normalized),
    );
  }
  return normalized;
}

export function normalizeRideStatusNotificationPrefs(
  prefs?: Partial<RideStatusNotificationPrefs> | null,
): RideStatusNotificationPrefs {
  return {
    clear:
      typeof prefs?.clear === "boolean"
        ? prefs.clear
        : DEFAULT_RIDE_STATUS_NOTIFICATIONS.clear,
    watch:
      typeof prefs?.watch === "boolean"
        ? prefs.watch
        : DEFAULT_RIDE_STATUS_NOTIFICATIONS.watch,
    warning:
      typeof prefs?.warning === "boolean"
        ? prefs.warning
        : DEFAULT_RIDE_STATUS_NOTIFICATIONS.warning,
    danger:
      typeof prefs?.danger === "boolean"
        ? prefs.danger
        : DEFAULT_RIDE_STATUS_NOTIFICATIONS.danger,
  };
}
