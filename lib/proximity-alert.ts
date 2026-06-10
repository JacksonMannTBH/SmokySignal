// Foreground proximity alerts. When the rider's GPS is granted AND a
// tracked alert-tier (smokey | patrol | unknown) tail enters within
// the configured nm threshold, fire a local notification via the
// service worker. No server-side rider position storage — this is
// pure client-side logic per CLAUDE.md privacy posture.
//
// Per-tail cooldown via localStorage prevents re-firing on every
// 10s poll while a plane orbits within the threshold.

"use client";

import { haversineNm } from "./geo";
import { SS_TOKENS } from "./tokens";
import type { Aircraft, FleetRole } from "./types";
import { speakAlert } from "./voice-mode";

export const PROXIMITY_THRESHOLD_KEY = "ss_proximity_threshold_nm";
export const PROXIMITY_ENABLED_KEY = "ss_proximity_enabled";
export const DEFAULT_PROXIMITY_NM = 5;
const COOLDOWN_MS = 15 * 60 * 1000;
const COOLDOWN_PREFIX = "ss_proximity_seen:";

const ALERT_ROLES: ReadonlySet<FleetRole> = new Set([
  "smokey",
  "patrol",
  "unknown",
]);

type ServiceWorkerNotificationOptions = NotificationOptions & {
  renotify?: boolean;
};

export type ProximityBand = "stop" | "slow" | "watch";

export type ProximityBandInfo = {
  band: ProximityBand;
  label: string;
  color: string;
  severity: number;
};

export function proximityBandForDistance(distanceNm: number): ProximityBandInfo {
  if (distanceNm <= 1) {
    return { band: "stop", label: "STOP", color: SS_TOKENS.danger, severity: 3 };
  }
  if (distanceNm <= 3) {
    return { band: "slow", label: "SLOW", color: SS_TOKENS.warn, severity: 2 };
  }
  return { band: "watch", label: "Watch", color: SS_TOKENS.sky, severity: 1 };
}

export function getProximityThresholdNm(): number {
  if (typeof window === "undefined") return DEFAULT_PROXIMITY_NM;
  const raw = window.localStorage.getItem(PROXIMITY_THRESHOLD_KEY);
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n > 50) return DEFAULT_PROXIMITY_NM;
  return n;
}

export function setProximityThresholdNm(nm: number): void {
  if (typeof window === "undefined") return;
  const clamped = Math.max(1, Math.min(50, Math.round(nm)));
  window.localStorage.setItem(PROXIMITY_THRESHOLD_KEY, String(clamped));
}

export function isProximityEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(PROXIMITY_ENABLED_KEY) === "1";
}

export function setProximityEnabled(on: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PROXIMITY_ENABLED_KEY, on ? "1" : "0");
}

function recentlySeen(tail: string, band: ProximityBandInfo): boolean {
  if (typeof window === "undefined") return false;
  const raw = window.localStorage.getItem(`${COOLDOWN_PREFIX}${tail}`);
  if (!raw) return false;
  try {
    const seen = JSON.parse(raw) as { ts?: number; severity?: number };
    const ts = Number(seen.ts);
    const severity = Number(seen.severity);
    if (!Number.isFinite(ts) || Date.now() - ts >= COOLDOWN_MS) return false;
    return Number.isFinite(severity) && severity >= band.severity;
  } catch {
    const ts = Number(raw);
    if (!Number.isFinite(ts) || Date.now() - ts >= COOLDOWN_MS) return false;
    return band.severity <= 1;
  }
}

function markSeen(tail: string, band: ProximityBandInfo): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    `${COOLDOWN_PREFIX}${tail}`,
    JSON.stringify({ ts: Date.now(), band: band.band, severity: band.severity }),
  );
}

export type ProximityHit = {
  tail: string;
  nickname: string | null;
  role: FleetRole;
  distanceNm: number;
};

/**
 * Returns alert-tier aircraft inside the threshold that haven't fired
 * a notification within the cooldown window. Caller is responsible for
 * actually firing notifications and (on success) calling markSeen.
 */
export function detectProximityHits(
  aircraft: Aircraft[],
  rider: { lat: number; lon: number },
  thresholdNm: number,
): ProximityHit[] {
  const hits: ProximityHit[] = [];
  for (const a of aircraft) {
    if (!a.airborne) continue;
    if (a.lat == null || a.lon == null) continue;
    if (!ALERT_ROLES.has(a.role)) continue;
    const d = haversineNm(rider.lat, rider.lon, a.lat, a.lon);
    const band = proximityBandForDistance(d);
    if (recentlySeen(a.tail, band)) continue;
    if (d <= thresholdNm) {
      hits.push({
        tail: a.tail,
        nickname: a.nickname,
        role: a.role,
        distanceNm: d,
      });
    }
  }
  return hits;
}

/**
 * Fire a local SW notification for each new proximity hit. Returns the
 * count of notifications successfully posted. Per-tail cooldown is
 * recorded only on successful post so a transient SW failure doesn't
 * silently swallow the next opportunity.
 */
export async function fireProximityNotifications(
  hits: ProximityHit[],
): Promise<number> {
  if (hits.length === 0) return 0;
  if (typeof window === "undefined") return 0;
  if (!("serviceWorker" in navigator)) return 0;
  if (typeof Notification === "undefined") return 0;
  if (Notification.permission !== "granted") return 0;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return 0;
  let posted = 0;
  for (const h of hits) {
    const name = h.nickname ?? h.tail;
    const dist = h.distanceNm.toFixed(1);
    const band = proximityBandForDistance(h.distanceNm);
    try {
      const title = `${band.label} - ${dist} nm - ${name} nearby`;
      // Smokey umbrella: every alert-class proximity hit reads as
      // Smokey. The smokey-class FLIR detail (Watching.) is preserved
      // for fixed-wing speed enforcement; the rest collapse to a plain
      // distance-only body since the title already names the plane.
      const body =
        h.role === "smokey"
          ? `${dist} nm out. Watching.`
          : `${dist} nm out.`;
      const options: ServiceWorkerNotificationOptions = {
        body,
        icon: "/icons/washington-eye-logo.svg",
        badge: "/icons/favicon.svg",
        tag: `proximity-${h.tail}`,
        renotify: true,
        data: {
          url: `/plane/${h.tail}`,
          tail: h.tail,
          kind: "proximity",
          band: band.band,
          color: band.color,
          distanceNm: h.distanceNm,
        },
      };
      await reg.showNotification(title, options);
      // Voice-mode readback (no-op when off / unsupported). Title + body
      // separated by a period so the synth pauses naturally.
      speakAlert(`${title}. ${body}`);
      markSeen(h.tail, band);
      posted += 1;
    } catch {
      // Best-effort. Don't markSeen on failure.
    }
  }
  return posted;
}
