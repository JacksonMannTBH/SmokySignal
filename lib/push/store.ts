// Push subscription storage in KV. Each subscription is keyed by a stable
// hash of its endpoint URL — that's a Push-service URL (e.g. fcm.googleapis,
// web.push.apple) which already isn't personally identifying, so we don't
// store browser fingerprints, IPs, or any rider PII. Just the endpoint +
// p256dh + auth keys we need to send a push, plus the rider's preferences.
//
// Storage shape:
//   push:sub:${id}       JSON { sub, prefs, savedAt } — 90-day TTL
//   push:subs            Redis SET of subscription IDs (no TTL, manually pruned
//                        when removeSubscription() runs or the dispatcher hits
//                        a 410/404 and culls a dead endpoint)

import { createHash } from "node:crypto";
import { getRedis } from "../cache";
import {
  DEFAULT_PREFS,
  type AlertPrefs,
  type StoredSubscription,
  type UserZoneSpec,
} from "./types";
import { isRegionId } from "../regions";
import { clampRegionProximityNm } from "../proximity-limits";

// Re-export so server-side callers can keep their existing import sites.
export {
  DEFAULT_PREFS,
  type AlertPrefs,
  type AlertTier,
  type StoredSubscription,
  type UserZoneSpec,
} from "./types";

const SUB_PREFIX = "push:sub:";
const SUBS_INDEX = "push:subs";
const SUB_TTL_SECONDS = 90 * 24 * 60 * 60;

export function subscriptionId(sub: PushSubscriptionJSON): string {
  if (!sub.endpoint) throw new Error("subscription endpoint missing");
  return createHash("sha256").update(sub.endpoint).digest("hex").slice(0, 24);
}

function sanitizeUserZones(v: unknown): UserZoneSpec[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: UserZoneSpec[] = [];
  for (const z of v) {
    if (!z || typeof z !== "object") continue;
    const r = z as Record<string, unknown>;
    if (
      typeof r.lat === "number" &&
      Number.isFinite(r.lat) &&
      typeof r.lon === "number" &&
      Number.isFinite(r.lon) &&
      typeof r.radiusNm === "number" &&
      Number.isFinite(r.radiusNm) &&
      r.radiusNm > 0 &&
      typeof r.label === "string"
    ) {
      out.push({
        lat: r.lat,
        lon: r.lon,
        radiusNm: r.radiusNm,
        label: r.label.slice(0, 64),
      });
    }
  }
  // Cap at 32 zones per subscriber — generous for any plausible rider use,
  // bounded so a malformed client can't fan out an unbounded payload.
  return out.slice(0, 32);
}

function mergePrefs(partial?: Partial<AlertPrefs>): AlertPrefs {
  if (!partial) return { ...DEFAULT_PREFS };
  const merged: AlertPrefs = {
    tier: partial.tier === "all" ? "all" : "alert_only",
    zones: Array.isArray(partial.zones) ? partial.zones : "any",
    quiet_start_h: clampHour(partial.quiet_start_h, DEFAULT_PREFS.quiet_start_h),
    quiet_end_h: clampHour(partial.quiet_end_h, DEFAULT_PREFS.quiet_end_h),
    tz: typeof partial.tz === "string" && partial.tz ? partial.tz : DEFAULT_PREFS.tz,
    proximity_enabled: partial.proximity_enabled === true,
    proximity_nm: sanitizeRadiusNm(partial.proximity_nm),
  };
  if (typeof partial.region_id === "string" && isRegionId(partial.region_id)) {
    merged.region_id = partial.region_id;
  }
  const userZones = sanitizeUserZones(partial.userZones);
  if (userZones !== undefined) merged.userZones = userZones;
  const tails = sanitizeTails(partial.tails);
  if (tails !== undefined) merged.tails = tails;
  return merged;
}

function sanitizeRadiusNm(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return clampRegionProximityNm(n);
}

function sanitizeTails(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: string[] = [];
  for (const t of v) {
    if (typeof t !== "string") continue;
    const upper = t.trim().toUpperCase();
    // Tail format is loosely "N" + 1-5 alphanumerics. Permissive — we
    // intersect with the registry at dispatch time so noise is harmless.
    if (/^N[0-9A-Z]{1,5}$/.test(upper)) out.push(upper);
  }
  // Cap at 32 tails per subscriber — generous given our ~16-tail registry.
  return Array.from(new Set(out)).slice(0, 32);
}

function clampHour(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.trunc(n);
  if (i < 0 || i > 23) return fallback;
  return i;
}

export async function saveSubscription(
  sub: PushSubscriptionJSON,
  prefsPartial?: Partial<AlertPrefs>,
): Promise<string> {
  const redis = await getRedis();
  if (!redis) throw new Error("KV not configured");
  const id = subscriptionId(sub);
  const prefs = mergePrefs(prefsPartial);
  const stored: StoredSubscription = {
    id,
    sub,
    prefs,
    savedAt: Date.now(),
  };
  await redis.set(`${SUB_PREFIX}${id}`, JSON.stringify(stored), {
    ex: SUB_TTL_SECONDS,
  });
  await redis.sadd(SUBS_INDEX, id);
  return id;
}

export async function getSubscription(
  id: string,
): Promise<StoredSubscription | null> {
  const redis = await getRedis();
  if (!redis) return null;
  try {
    const raw = await redis.get(`${SUB_PREFIX}${id}`);
    if (!raw) return null;
    if (typeof raw === "string") return JSON.parse(raw) as StoredSubscription;
    if (typeof raw === "object") return raw as StoredSubscription;
    return null;
  } catch {
    return null;
  }
}

/**
 * Updates only the prefs field on an existing subscription. The endpoint +
 * keys are immutable across pref updates — riders edit their alert config
 * without re-subscribing.
 */
export async function updatePrefs(
  id: string,
  prefsPartial: Partial<AlertPrefs>,
): Promise<StoredSubscription | null> {
  const existing = await getSubscription(id);
  if (!existing) return null;
  const prefs = mergePrefs({ ...existing.prefs, ...prefsPartial });
  const next: StoredSubscription = { ...existing, prefs, savedAt: Date.now() };
  const redis = await getRedis();
  if (!redis) throw new Error("KV not configured");
  await redis.set(`${SUB_PREFIX}${id}`, JSON.stringify(next), {
    ex: SUB_TTL_SECONDS,
  });
  return next;
}

export async function removeSubscription(id: string): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;
  await redis.del(`${SUB_PREFIX}${id}`);
  await redis.srem(SUBS_INDEX, id);
}

/**
 * Used by the dispatcher only. Returns every active subscription. Single-
 * digit subscriber count expected for the foreseeable future; if this ever
 * climbs past ~500 we'd batch + paginate instead of scanning the full set.
 */
export async function listSubscriptions(): Promise<StoredSubscription[]> {
  const redis = await getRedis();
  if (!redis) return [];
  const ids = (await redis.smembers(SUBS_INDEX)) as string[];
  if (ids.length === 0) return [];
  const out: StoredSubscription[] = [];
  for (const id of ids) {
    const s = await getSubscription(id);
    if (s) {
      out.push(s);
    } else {
      // The TTL expired or the row was manually deleted — clean the index.
      await redis.srem(SUBS_INDEX, id);
    }
  }
  return out;
}
