// Push dispatcher. Called once per grounded→airborne transition from the
// snapshot regen path (lib/activity.ts → recordActivity). For each takeoff
// we compose a role-aware payload, fan out to every opted-in subscription
// for the fixed tracked tail list, and best-effort send via web-push.
// Dead endpoints (HTTP 410/404) are pruned from KV. Failures never throw —
// the snapshot pipeline must keep flowing.

import webpush from "web-push";
import { getRedis } from "../cache";
import { isTrackedTail } from "../tracked-tails";
import {
  listSubscriptions,
  removeSubscription,
  type AlertPrefs,
  type StoredSubscription,
} from "./store";
import { haversineNm } from "../geo";
import { aircraftVehicleType } from "../aircraft-type";
import { clampRegionProximityNm } from "../proximity-limits";
import { DEFAULT_REGION, REGIONS, isRegionId } from "../regions";
import type { Aircraft, FleetRole, RoleConfidence, Snapshot } from "../types";

const DEDUPE_PREFIX = "push:dispatched:";
const PROXIMITY_DEDUPE_PREFIX = "push:proximity:";
const DEDUPE_TTL_SECONDS = 6 * 60 * 60;
const PROXIMITY_COOLDOWN_SECONDS = 15 * 60;
const MAX_BODY_CHARS = 140;
const ALERT_ROLES: ReadonlySet<FleetRole> = new Set(["smokey", "patrol", "unknown"]);

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

export async function dispatchProximitySnapshot(
  snap: Snapshot,
): Promise<DispatchResult> {
  if (!ensureVapid()) {
    return { sent: 0, skipped: 0, removed: 0, reason: "vapid_not_configured" };
  }
  const subs = await listSubscriptions();
  if (subs.length === 0) {
    return { sent: 0, skipped: 0, removed: 0, reason: "no_subs" };
  }
  const redis = await getRedis();
  const airborne = snap.aircraft.filter(
    (a) => a.airborne && a.lat != null && a.lon != null && ALERT_ROLES.has(a.role),
  );
  let sent = 0;
  let skipped = 0;
  let removed = 0;

  for (const stored of subs) {
    if (shouldSkip(stored.prefs) || !stored.prefs.proximity_enabled) {
      skipped++;
      continue;
    }
    const hit = nearestProximityHit(stored.prefs, airborne);
    if (!hit) {
      skipped++;
      continue;
    }
    const dedupeKey = `${PROXIMITY_DEDUPE_PREFIX}${stored.id}:${hit.aircraft.tail}`;
    if (redis) {
      const already = await redis.get(dedupeKey);
      if (already) {
        skipped++;
        continue;
      }
      await redis.set(dedupeKey, "1", { ex: PROXIMITY_COOLDOWN_SECONDS });
    }
    const result = await sendOne(
      stored,
      composeProximityPayload(hit.aircraft, hit.distanceNm, hit.zoneLabel),
    );
    if (result === "sent") sent++;
    else if (result === "removed") removed++;
    else skipped++;
  }
  return { sent, skipped, removed };
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
  if (!isTrackedTail(args.tail)) {
    return { sent: 0, skipped: 0, removed: 0, reason: "untracked_tail" };
  }

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

  let sent = 0;
  let skipped = 0;
  let removed = 0;
  for (const stored of subs) {
    const skip = shouldSkip(stored.prefs);
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

function shouldSkip(prefs: AlertPrefs): boolean {
  if (insideQuietHours(prefs)) return true;
  return false;
}

function nearestProximityHit(
  prefs: AlertPrefs,
  aircraft: Aircraft[],
): { aircraft: Aircraft; distanceNm: number; zoneLabel: string } | null {
  const zone = proximityZoneForPrefs(prefs);
  if (!zone) return null;
  let best: { aircraft: Aircraft; distanceNm: number; zoneLabel: string } | null = null;
  for (const a of aircraft) {
    if (prefs.tails && prefs.tails.length > 0 && !prefs.tails.includes(a.tail)) {
      continue;
    }
    if (prefs.tier === "alert_only" && !ALERT_ROLES.has(a.role)) continue;
    const d = haversineNm(zone.lat, zone.lon, a.lat!, a.lon!);
    if (d > zone.radiusNm) continue;
    if (!best || d < best.distanceNm) {
      best = { aircraft: a, distanceNm: d, zoneLabel: zone.label };
    }
  }
  return best;
}

function proximityZoneForPrefs(
  prefs: AlertPrefs,
): { lat: number; lon: number; radiusNm: number; label: string } | null {
  const regionId = isRegionId(prefs.region_id) ? prefs.region_id : DEFAULT_REGION;
  const region = REGIONS[regionId];
  if (!region) return null;
  const rawRadius = prefs.proximity_nm;
  const radiusNm =
    typeof rawRadius === "number" && Number.isFinite(rawRadius)
      ? clampRegionProximityNm(rawRadius)
      : 8;
  return {
    lat: region.centerLat,
    lon: region.centerLon,
    radiusNm,
    label: `${region.label} ${region.zip}`,
  };
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
  // Title carries the Bird umbrella for every law-enforcement role —
  // speed-enforcement fixed-wing, patrol helicopter, or unconfirmed
  // alert-class all read "Eye In The Sky." Body still distinguishes airframe.
  switch (args.role) {
    case "smokey":
      title = "Eye In The Sky";
      body = trimBody(`${name} watching. ${altStr}.`);
      break;
    case "patrol":
      title = "Eye In The Sky";
      body = trimBody(`${name} airborne. ${altStr}.`);
      break;
    case "unknown":
      title = "Eye In The Sky";
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

function composeProximityPayload(
  aircraft: Aircraft,
  distanceNm: number,
  zoneLabel: string,
): PushPayload {
  const band = proximityBandForDistance(distanceNm);
  const vehicleType = aircraftVehicleType(aircraft.model);
  const dist = distanceNm.toFixed(1);
  const body =
    aircraft.role === "smokey"
      ? `${dist} nm from ${zoneLabel}. Watching.`
      : `${dist} nm from ${zoneLabel}.`;
  return {
    title: `${band.label} - ${dist} nm - ${vehicleType} nearby`,
    body: trimBody(body),
    tag: `proximity-${aircraft.tail}`,
    data: {
      url: `/plane/${aircraft.tail}`,
      tail: aircraft.tail,
      role: aircraft.role,
      kind: "proximity",
      band: band.band,
      distanceNm,
    },
  };
}

function proximityBandForDistance(distanceNm: number): {
  band: "stop" | "slow" | "watch";
  label: string;
} {
  if (distanceNm <= 1) return { band: "stop", label: "STOP" };
  if (distanceNm <= 3) return { band: "slow", label: "SLOW" };
  return { band: "watch", label: "Watch" };
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
