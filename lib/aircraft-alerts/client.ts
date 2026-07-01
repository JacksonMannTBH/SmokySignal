"use client";

import { stateForRegion, type AppStateId } from "@/lib/app-regions";
import { DEFAULT_PROXIMITY_NM } from "@/lib/proximity-display";
import { clampRegionProximityNm } from "@/lib/proximity-limits";
import type { RegionId } from "@/lib/regions";
import type {
  AircraftAlertPushSubscription,
  AircraftAlertStatus,
} from "./types";

const USER_ID_KEY = "ss_aircraft_alert_user_id";
const RANGE_NM_KEY = "ss_aircraft_alert_range_nm";

type EnableInput = {
  regionId: RegionId;
  proximityRangeNm: number;
  stateId?: AppStateId;
};

export function getAircraftAlertUserId(): string {
  if (typeof window === "undefined") return "";
  const existing = window.localStorage.getItem(USER_ID_KEY);
  if (existing) return existing;
  const next =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
  window.localStorage.setItem(USER_ID_KEY, next);
  return next;
}

export function getStoredAircraftAlertRangeNm(): number {
  if (typeof window === "undefined") return DEFAULT_PROXIMITY_NM;
  const raw = Number(window.localStorage.getItem(RANGE_NM_KEY));
  return Number.isFinite(raw) && raw > 0
    ? clampRegionProximityNm(raw)
    : DEFAULT_PROXIMITY_NM;
}

export function setStoredAircraftAlertRangeNm(value: number): number {
  const next = clampRegionProximityNm(value);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(RANGE_NM_KEY, String(next));
  }
  return next;
}

export async function readAircraftAlertStatus(): Promise<AircraftAlertStatus> {
  if (!browserSupportsAircraftAlerts()) {
    return {
      supported: false,
      configured: false,
      enabled: false,
      permission: "unsupported",
      message: "unsupported",
    };
  }
  const userId = getAircraftAlertUserId();
  const res = await fetch(
    `/api/aircraft-alerts/subscription?userId=${encodeURIComponent(userId)}`,
    { cache: "no-store" },
  );
  const server = (await res.json().catch(() => ({}))) as Partial<AircraftAlertStatus>;
  return {
    supported: true,
    configured: Boolean(server.configured),
    enabled: Boolean(server.enabled),
    permission: Notification.permission,
    regionId: server.regionId,
    stateId: server.stateId,
    proximityRangeNm: server.proximityRangeNm,
    publicKey: server.publicKey,
    message: server.message,
  };
}

export async function enableAircraftProximityAlerts(
  input: EnableInput,
): Promise<AircraftAlertStatus> {
  if (!browserSupportsAircraftAlerts()) {
    throw new Error("unsupported");
  }
  const status = await readAircraftAlertStatus();
  const publicKey =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || status.publicKey || "";
  if (!publicKey) throw new Error("not_configured");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("permission_denied");

  await navigator.serviceWorker.register("/sw.js");
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToArrayBuffer(publicKey),
    });
  }

  const pushSubscription = normalizePushSubscription(subscription);
  const proximityRangeNm = setStoredAircraftAlertRangeNm(input.proximityRangeNm);
  const regionId = input.regionId;
  const stateId = input.stateId ?? stateForRegion(regionId).id;
  const res = await fetch("/api/aircraft-alerts/subscription", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      userId: getAircraftAlertUserId(),
      subscription: pushSubscription,
      regionId,
      stateId,
      proximityRangeNm,
    }),
  });
  if (!res.ok) throw new Error("subscribe_failed");
  return {
    ...(await readAircraftAlertStatus()),
    enabled: true,
    permission,
    regionId,
    stateId,
    proximityRangeNm,
  };
}

export async function disableAircraftProximityAlerts(): Promise<AircraftAlertStatus> {
  const userId = getAircraftAlertUserId();
  if (browserSupportsAircraftAlerts()) {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      await subscription?.unsubscribe();
    } catch {
      // Server cleanup below still disarms this browser.
    }
  }
  await fetch("/api/aircraft-alerts/subscription", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  return {
    ...(await readAircraftAlertStatus()),
    enabled: false,
  };
}

export async function syncAircraftAlertPreferences(
  input: EnableInput,
): Promise<AircraftAlertStatus | null> {
  const current = await readAircraftAlertStatus();
  if (!current.enabled) {
    setStoredAircraftAlertRangeNm(input.proximityRangeNm);
    return current;
  }
  const proximityRangeNm = setStoredAircraftAlertRangeNm(input.proximityRangeNm);
  const stateId = input.stateId ?? stateForRegion(input.regionId).id;
  const res = await fetch("/api/aircraft-alerts/subscription", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      userId: getAircraftAlertUserId(),
      regionId: input.regionId,
      stateId,
      proximityRangeNm,
    }),
  });
  if (!res.ok) return null;
  return await readAircraftAlertStatus();
}

export async function sendAircraftAlertTest(): Promise<void> {
  const res = await fetch("/api/aircraft-alerts/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: getAircraftAlertUserId() }),
  });
  if (!res.ok) throw new Error("test_failed");
}

function browserSupportsAircraftAlerts(): boolean {
  return Boolean(
    typeof window !== "undefined" &&
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window,
  );
}

function normalizePushSubscription(
  subscription: PushSubscription,
): AircraftAlertPushSubscription {
  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!json.endpoint || !p256dh || !auth) {
    throw new Error("invalid_subscription");
  }
  return {
    endpoint: json.endpoint,
    expirationTime: json.expirationTime ?? null,
    keys: { p256dh, auth },
  };
}

function urlBase64ToArrayBuffer(base64Url: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = `${base64Url}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i += 1) {
    output[i] = rawData.charCodeAt(i);
  }
  return buffer;
}
