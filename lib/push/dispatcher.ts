// Push dispatcher. Called once per grounded→airborne transition from the
// snapshot regen path (lib/activity.ts → recordActivity). For each takeoff
// we compose a role-aware payload, fan out to every opted-in subscription
// matching tier + zone + quiet-hours, and best-effort send via web-push.
// Dead endpoints (HTTP 410/404) are pruned from KV. Failures never throw —
// the snapshot pipeline must keep flowing.

import webpush from "web-push";
import { getRedis } from "../cache";
import { zoneIdForPoint } from "../hotzones";
import {
  listSubscriptions,
  removeSubscription,
  type AlertPrefs,
  type StoredSubscription,
  type UserZoneSpec,
} from "./store";
import type { FleetRole, RoleConfidence } from "../types";

const DEDUPE_PREFIX = "push:dispatched:";
const DEDUPE_TTL_SECONDS = 6 * 60 * 60;
const MAX_BODY_CHARS = 140;

const ALERT_ROLES: ReadonlySet<FleetRole> = new Set([
  "smokey",
  "patrol",
  "unknown",
]);

let vapidConfigured = false;
function ensureVapid(): boolean {
  if (vapidConfigured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subj = process.env.VAPID_SUBJECT;
  if (!pub || !priv || !subj) return false;
  webpush.setVapidDetails(subj, pub, priv);
  vapidConfigured = true;
  return true;
}

export type DispatchTakeoffArgs = {
  tail: string;
  role: FleetRole;
  roleConfidence: RoleConfidence;
  nickname: string | null;
  /**
   * Coordinates at the moment of takeoff. Used for zone matching and
   * (where available) corridor labelling in the body. Null is tolerated;
   * we just skip zone filters and drop the corridor field.
   */
  lat: number | null;
  lon: number | null;
  alt_ft: number | null;
  /** ISO timestamp of takeoff. Used to compute the dedupe key. */
  ts_iso: string;
};

export type DispatchResult = {
  sent: number;
  skipped: number;
  removed: number;
  reason?: string;
};

export async function dispatchTakeoff(
  args: DispatchTakeoffArgs,
): Promise<DispatchResult> {
  if (!ensureVapid()) {
    return { sent: 0, skipped: 0, removed: 0, reason: "vapid_not_configured" };
  }

  const dedupeKey = buildDedupeKey(args.tail, args.ts_iso);
  const redis = await getRedis();
  if (redis) {
    const already = await redis.get(`${DEDUPE_PREFIX}${dedupeKey}`);
    if (already) return { sent: 0, skipped: 0, removed: 0, reason: "duplicate" };
    await redis.set(`${DEDUPE_PREFIX}${dedupeKey}`, "1", {
      ex: DEDUPE_TTL_SECONDS,
    });
  }

  const subs = await listSubscriptions();
  if (subs.length === 0) {
    return { sent: 0, skipped: 0, removed: 0, reason: "no_subs" };
  }

  const payload = composePayload(args);
  const aircraftZone =
    args.lat != null && args.lon != null
      ? zoneIdForPoint(args.lat, args.lon)
      : null;

  let sent = 0;
  let skipped = 0;
  let removed = 0;
  for (const stored of subs) {
    const skip = shouldSkip(
      stored.prefs,
      args.role,
      args.tail,
      args.lat,
      args.lon,
      aircraftZone,
    );
    if (skip) {
      skipped++;
      continue;
    }
    const result = await sendOne(stored, payload);
    if (result === "sent") sent++;
    else if (result === "removed") removed++;
    else skipped++;
  }
  return { sent, skipped, removed };
}

function buildDedupeKey(tail: string, tsIso: string): string {
  // Round to the nearest minute so a 10s poll cadence can't fire two
  // distinct dedupe keys for the same takeoff event.
  const ts = Date.parse(tsIso);
  const minute = Number.isFinite(ts)
    ? Math.floor(ts / 60_000) * 60_000
    : Math.floor(Date.now() / 60_000) * 60_000;
  return `${tail}:${minute}`;
}

// Per-degree shorthand for the user-zone bbox check. 1° latitude is
// 60 nm everywhere; 1° longitude is ~41 nm at 47°N (Puget Sound).
// Slight over-inclusion outside that latitude band is acceptable —
// rider zone match is a "could you care?" check, not a hard fence.
const NM_PER_DEG_LAT = 60;
const NM_PER_DEG_LON_47N = 41;

function matchesUserZone(
  lat: number,
  lon: number,
  userZones?: UserZoneSpec[],
): boolean {
  if (!userZones || userZones.length === 0) return false;
  for (const z of userZones) {
    const latDeg = z.radiusNm / NM_PER_DEG_LAT;
    const lonDeg = z.radiusNm / NM_PER_DEG_LON_47N;
    if (Math.abs(lat - z.lat) <= latDeg && Math.abs(lon - z.lon) <= lonDeg) {
      return true;
    }
  }
  return false;
}

function shouldSkip(
  prefs: AlertPrefs,
  role: FleetRole,
  tail: string,
  lat: number | null,
  lon: number | null,
  aircraftZone: string | null,
): boolean {
  // tier
  if (prefs.tier === "alert_only" && !ALERT_ROLES.has(role)) return true;
  // tail allow-list — applied AFTER tier so a rider asking for "all
  // tiers, only N305DK" still gets every transition for that tail.
  if (Array.isArray(prefs.tails) && prefs.tails.length > 0) {
    if (!prefs.tails.includes(tail.toUpperCase())) return true;
  }
  // zone — predefined list AND/OR user-defined geofences. Any explicit
  // zone constraint imposes the gate; matching either kind passes it.
  // Empty constraints (no predefined + no user zones) means "any" — no gate.
  const hasPredefined = Array.isArray(prefs.zones) && prefs.zones.length > 0;
  const hasUser = Array.isArray(prefs.userZones) && prefs.userZones.length > 0;
  if (hasPredefined || hasUser) {
    const matchesPredefined =
      hasPredefined &&
      aircraftZone != null &&
      (prefs.zones as string[]).includes(aircraftZone);
    const matchesUser =
      hasUser && lat != null && lon != null
        ? matchesUserZone(lat, lon, prefs.userZones)
        : false;
    if (!matchesPredefined && !matchesUser) return true;
  }
  // quiet hours
  if (insideQuietHours(prefs)) return true;
  return false;
}

function insideQuietHours(prefs: AlertPrefs): boolean {
  const start = prefs.quiet_start_h;
  const end = prefs.quiet_end_h;
  if (start === end) return false; // zero-length window = always firing
  let hour: number;
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: prefs.tz,
      hour: "numeric",
      hour12: false,
    });
    const parts = fmt.formatToParts(new Date());
    const h = parts.find((p) => p.type === "hour")?.value ?? "0";
    hour = Number(h) % 24;
  } catch {
    // bad TZ → fall back to UTC; quiet hours are advisory at best in that case
    hour = new Date().getUTCHours();
  }
  if (start < end) {
    return hour >= start && hour < end;
  }
  // wrap-around: e.g. 23 → 6
  return hour >= start || hour < end;
}

type PushPayload = {
  title: string;
  body: string;
  tag: string;
  data: Record<string, unknown>;
};

function composePayload(args: DispatchTakeoffArgs): PushPayload {
  const name = args.nickname ?? args.tail;
  const altStr = args.alt_ft != null ? `${args.alt_ft.toLocaleString()}'` : "alt unk";
  let title: string;
  let body: string;
  // Title carries the Smokey umbrella for every law-enforcement role —
  // speed-enforcement fixed-wing, patrol helicopter, or unconfirmed
  // alert-class all read "Smokey's up." Body still distinguishes airframe.
  switch (args.role) {
    case "smokey":
      title = "Smokey's up.";
      body = trimBody(`${name} watching. ${altStr}.`);
      break;
    case "patrol":
      title = "Smokey's up.";
      body = trimBody(`${name} airborne. ${altStr}.`);
      break;
    case "unknown":
      title = "Smokey's up.";
      body = trimBody(`Unidentified bird airborne. ${altStr}.`);
      break;
    case "sar":
      title = "SAR run.";
      body = trimBody(`${name} on a rescue run.`);
      break;
    case "transport":
      title = "Transport up.";
      body = trimBody(`${name} airborne. ${altStr}.`);
      break;
  }
  return {
    title,
    body,
    tag: `smokey-${args.tail}`,
    data: { url: `/plane/${args.tail}`, tail: args.tail, role: args.role },
  };
}

function trimBody(s: string): string {
  if (s.length <= MAX_BODY_CHARS) return s;
  return s.slice(0, MAX_BODY_CHARS - 1) + "…";
}

type SendResult = "sent" | "removed" | "skipped";

async function sendOne(
  stored: StoredSubscription,
  payload: PushPayload,
): Promise<SendResult> {
  try {
    const sub = stored.sub as webpush.PushSubscription;
    if (!sub.endpoint) return "skipped";
    await webpush.sendNotification(sub, JSON.stringify(payload), { TTL: 600 });
    return "sent";
  } catch (e: unknown) {
    const status =
      typeof e === "object" && e !== null && "statusCode" in e
        ? Number((e as { statusCode: unknown }).statusCode)
        : 0;
    if (status === 404 || status === 410) {
      // Subscription is dead at the push service — prune.
      try {
        await removeSubscription(stored.id);
      } catch {
        /* best-effort */
      }
      return "removed";
    }
    console.warn(`[push] send failed for ${stored.id}:`, e);
    return "skipped";
  }
}
