// Activity feed: state-change events derived from successive snapshots.
// Stored as a Redis list at activity:feed (last 500 entries, 35-day TTL).
// Surfaced on /activity, on the Glanceable home as a one-line strip,
// and via /api/activity.
//
// Event kinds:
//   takeoff           — was grounded (or absent), now airborne
//   landing           — was airborne, now grounded
//   first_seen        — no prev entry for this tail and now airborne
//                       (effectively "newly added to the registry and
//                        already in the air on first observation")
//   squawk_emergency  — current squawk is 7500/7600/7700 AND prev
//                       squawk differed (so we only fire on transitions,
//                       not continuously while the alert is active)
//
// `altitude_change` is preserved as a tolerated kind on read for any
// pre-existing entries written by the previous activity-detection
// implementation; we no longer emit it.

import { getRedis, cacheGet, cacheSet } from "./cache";
import type { Aircraft, FleetRole, Snapshot } from "./types";

const FEED_KEY = "activity:feed";
const PREV_KEY = "aircraft:prev";
const FEED_LIMIT = 500;
const FEED_TTL_SECONDS = 35 * 24 * 60 * 60;
const PREV_TTL_SECONDS = 24 * 60 * 60;
const READ_CACHE_TTL = 8;

const EMERGENCY_SQUAWKS = new Set(["7500", "7600", "7700"]);

export type ActivityKind =
  | "takeoff"
  | "landing"
  | "first_seen"
  | "squawk_emergency"
  | "altitude_change"; // tolerated for read-back; never emitted by current code

export type ActivityEntry = {
  /** ms since epoch (Date.now()) */
  ts: number;
  tail: string;
  icao24?: string;
  /** FleetRole at the time the event was recorded — used to color the
   *  event icon in the activity feed. Older entries may not have this. */
  role?: FleetRole;
  kind: ActivityKind;
  squawk?: string | null;
  lat?: number | null;
  lon?: number | null;
  alt_ft?: number | null;
  description: string;
};

/**
 * Generates the human-readable description for an event. Branches on
 * fleet role so SAR / transport events read calmer than smokey / patrol
 * events ("on a run" vs "off the deck"). Older callers without the role
 * arg get the conservative default behavior.
 */
export function describeEvent(
  tail: string,
  nickname: string | null | undefined,
  kind: ActivityKind,
  squawk?: string | null,
  role: FleetRole = "unknown",
): string {
  const name = nickname ?? tail;

  if (kind === "takeoff") {
    if (role === "smokey") {
      if (nickname === "Smokey 4") return "Smokey off the deck";
      return `${name} off the deck`;
    }
    if (role === "patrol") {
      return `${name} up`;
    }
    if (role === "sar") {
      return `${name} on a run`;
    }
    if (role === "transport") {
      return `${name} up`;
    }
    return `${name} up`;
  }

  if (kind === "landing") {
    if (role === "sar") return `${name} back on the ground`;
    if (role === "smokey" && nickname === "Smokey 4") return "Smokey down";
    return `${name} down`;
  }

  if (kind === "first_seen") {
    return `${name} on watch`;
  }

  if (kind === "squawk_emergency") {
    const meaning =
      squawk === "7700"
        ? "emergency"
        : squawk === "7600"
          ? "radio failure"
          : squawk === "7500"
            ? "hijack"
            : "alert";
    return `${name} squawking ${meaning}`;
  }

  // altitude_change (legacy) or unknown
  return `${tail} ${kind}`;
}

function readPrev(snap: Snapshot | null): Map<string, Aircraft> {
  const m = new Map<string, Aircraft>();
  if (!snap) return m;
  for (const a of snap.aircraft) m.set(a.tail, a);
  return m;
}

function diffEvents(prev: Snapshot | null, curr: Snapshot): ActivityEntry[] {
  const prevByTail = readPrev(prev);
  const ts = Date.now();
  const out: ActivityEntry[] = [];

  for (const a of curr.aircraft) {
    const p = prevByTail.get(a.tail);
    const currentPos = {
      lat: a.lat ?? null,
      lon: a.lon ?? null,
      alt_ft: a.altitude_ft ?? null,
    };
    // For landings the current snapshot has the plane at on_ground=true
    // (or absent), so its lat/lon are stale or null. The previous
    // snapshot is when we last saw it airborne — that's the position
    // worth recording.
    const lastAirbornePos = {
      lat: p?.lat ?? currentPos.lat,
      lon: p?.lon ?? currentPos.lon,
      alt_ft: p?.altitude_ft ?? currentPos.alt_ft,
    };

    const role: FleetRole = a.role ?? "unknown";

    // first_seen: tail wasn't in prev snapshot at all and is currently
    // airborne. Fires once per registry add for any tail that's already
    // up when it joins.
    if (!p && a.airborne) {
      out.push({
        ts,
        tail: a.tail,
        icao24: a.icao24,
        role,
        ...currentPos,
        kind: "first_seen",
        squawk: a.squawk ?? null,
        description: describeEvent(a.tail, a.nickname, "first_seen", null, role),
      });
      // intentional: don't also emit takeoff for the same instant
      continue;
    }

    // takeoff — current position is the moment of liftoff
    if (p && !p.airborne && a.airborne) {
      out.push({
        ts,
        tail: a.tail,
        icao24: a.icao24,
        role,
        ...currentPos,
        kind: "takeoff",
        squawk: a.squawk ?? null,
        description: describeEvent(a.tail, a.nickname, "takeoff", null, role),
      });
    }

    // landing — use the LAST airborne position (prev snapshot), since
    // the current one is on the ground with stale coords or missing.
    if (p && p.airborne && !a.airborne) {
      out.push({
        ts,
        tail: a.tail,
        icao24: a.icao24,
        role,
        ...lastAirbornePos,
        kind: "landing",
        squawk: a.squawk ?? null,
        description: describeEvent(a.tail, a.nickname, "landing", null, role),
      });
    }

    // squawk transition into emergency code
    const cs = a.squawk ?? null;
    const ps = p?.squawk ?? null;
    if (cs && EMERGENCY_SQUAWKS.has(cs) && cs !== ps) {
      out.push({
        ts,
        tail: a.tail,
        icao24: a.icao24,
        role,
        ...currentPos,
        kind: "squawk_emergency",
        squawk: cs,
        description: describeEvent(
          a.tail,
          a.nickname,
          "squawk_emergency",
          cs,
          role,
        ),
      });
    }
  }

  return out;
}

/**
 * Diff current snapshot vs previous, append events to the feed, persist
 * current as the new "previous" for next call. Best-effort; never throws.
 */
export async function recordActivity(curr: Snapshot): Promise<void> {
  const redis = await getRedis();

  let prev: Snapshot | null = null;
  if (redis) {
    try {
      const raw = await redis.get(PREV_KEY);
      if (raw) {
        prev =
          typeof raw === "string"
            ? (JSON.parse(raw) as Snapshot)
            : (raw as Snapshot);
      }
    } catch (e) {
      console.warn("[activity] read prev failed:", e);
    }
  } else {
    prev = await cacheGet<Snapshot>(PREV_KEY);
  }

  const events = diffEvents(prev, curr);
  if (events.length > 0) {
    if (redis) {
      try {
        const payload = events.map((e) => JSON.stringify(e));
        await redis.rpush(FEED_KEY, ...payload);
        await redis.ltrim(FEED_KEY, -FEED_LIMIT, -1);
        await redis.expire(FEED_KEY, FEED_TTL_SECONDS);
      } catch (e) {
        console.warn("[activity] rpush failed:", e);
      }
    } else {
      const feed = (await cacheGet<ActivityEntry[]>(FEED_KEY)) ?? [];
      await cacheSet(
        FEED_KEY,
        [...feed, ...events].slice(-FEED_LIMIT),
        FEED_TTL_SECONDS,
      );
    }

    // Fan out push notifications for each takeoff. Best-effort; the
    // dispatcher's own try/catch + dedupe key keep this from breaking
    // the snapshot pipeline. Fire all in parallel since the dispatcher
    // already de-duplicates per (tail, minute).
    const takeoffs = events.filter((e) => e.kind === "takeoff");
    if (takeoffs.length > 0) {
      try {
        const { dispatchTakeoff } = await import("./push/dispatcher");
        await Promise.all(
          takeoffs.map((e) =>
            dispatchTakeoff({
              tail: e.tail,
              role: e.role ?? "unknown",
              roleConfidence: "unknown",
              nickname:
                curr.aircraft.find((a) => a.tail === e.tail)?.nickname ?? null,
              lat: e.lat ?? null,
              lon: e.lon ?? null,
              alt_ft: e.alt_ft ?? null,
              ts_iso: new Date(e.ts).toISOString(),
            }).catch((err) => {
              console.warn("[activity] dispatchTakeoff failed:", err);
              return null;
            }),
          ),
        );
      } catch (e) {
        console.warn("[activity] push dispatch import/init failed:", e);
      }
    }
  }

  try {
    if (redis) {
      await redis.set(PREV_KEY, JSON.stringify(curr), { ex: PREV_TTL_SECONDS });
    } else {
      await cacheSet(PREV_KEY, curr, PREV_TTL_SECONDS);
    }
  } catch (e) {
    console.warn("[activity] write prev failed:", e);
  }
}

/**
 * Most recent N events, newest-first. Tolerates the older feed-entry
 * shape (no icao24/squawk/lat/lon/alt_ft, ts in seconds) by leaving
 * those fields undefined.
 */
export async function getRecentActivity(limit = 50): Promise<ActivityEntry[]> {
  const cacheKey = `ss:activity-recent:${limit}`;
  const redis = await getRedis();
  if (!redis) {
    const feed = (await cacheGet<ActivityEntry[]>(FEED_KEY)) ?? [];
    return normalizeActivityEntries(feed.slice(-limit));
  }

  const cached = await cacheGet<ActivityEntry[]>(cacheKey);
  if (cached) return cached;

  let raw: unknown[] = [];
  try {
    raw = (await redis.lrange(FEED_KEY, -limit, -1)) as unknown[];
  } catch {
    return [];
  }

  const entries = normalizeActivityEntries(raw);

  await cacheSet(cacheKey, entries, READ_CACHE_TTL);
  return entries;
}

function normalizeActivityEntries(raw: unknown[]): ActivityEntry[] {
  return raw
    .map((s) => {
      if (typeof s === "string") {
        try {
          return JSON.parse(s) as ActivityEntry;
        } catch {
          return null;
        }
      }
      if (s && typeof s === "object") return s as ActivityEntry;
      return null;
    })
    .filter((e): e is ActivityEntry => e !== null)
    // Normalize: if ts looks like seconds (10-digit unix), promote to ms.
    .map((e) => (e.ts < 1e12 ? { ...e, ts: e.ts * 1000 } : e))
    .reverse(); // newest first
}
