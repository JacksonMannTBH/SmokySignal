import { buildSnapshot } from "./adsb";
import { cacheGet, cacheSet, getRedis } from "./cache";
import { getCurrentFlightDuration, logTracks } from "./tracks";
import { recordActivity } from "./activity";
import { dispatchProximitySnapshot } from "./push/dispatcher";
import { DEFAULT_REGION, type RegionId } from "./regions";
import type { Snapshot, SnapshotSource } from "./types";

const KEY = "ss:snapshot:v1";
const TTL_SECONDS = 10;
// /api/health needs to know "is the snapshot pipeline working?" without
// being dependent on the 10s hot-path cache, which is empty 50s/min
// between cron ticks. This mirror gets a 10-min TTL so /api/health
// shows accurate counts even when the hot-path cache has expired.
const HEALTH_KEY = "ss:snapshot:health:v1";
const HEALTH_TTL_SECONDS = 10 * 60;
// Stale-data canary — written every time we observe ≥1 airborne tail.
// Read by /api/health; if it's been more than ~12h during daytime, either
// there's no fleet activity or the upstream parser is broken.
const LAST_AIRBORNE_KEY = "adsb:last_airborne_ts";
const LAST_AIRBORNE_TTL_SECONDS = 30 * 24 * 60 * 60;

/**
 * Force the next /api/aircraft fetch to rebuild the snapshot from scratch
 * — used after registry edits so changes are visible immediately rather
 * than after the 10s KV TTL.
 */
export async function invalidateSnapshot(regionId: RegionId = DEFAULT_REGION): Promise<void> {
  const redis = await getRedis();
  if (redis) {
    try {
      await redis.del(snapshotKey(regionId));
    } catch (e) {
      console.warn("[snapshot] invalidate failed:", e);
    }
  }
}

// Last successful upstream source. Surfaced via /api/health.
let lastSource: SnapshotSource | null = null;

export function getLastSource(): SnapshotSource | null {
  return lastSource;
}

export async function getLastAirborneTs(): Promise<number | null> {
  return await cacheGet<number>(LAST_AIRBORNE_KEY);
}

/** Read-only access to the cached snapshot (no fresh fetch). */
export async function peekSnapshot(): Promise<Snapshot | null> {
  return await cacheGet<Snapshot>(snapshotKey(DEFAULT_REGION));
}

/**
 * Most recent successful snapshot regardless of whether the 10s hot-path
 * cache is current. /api/health uses this to discriminate "cron is dead"
 * (this returns null) from "cron just ran but the hot-path TTL expired".
 */
export async function peekHealthSnapshot(): Promise<Snapshot | null> {
  return await cacheGet<Snapshot>(HEALTH_KEY);
}

// Single-flight: collapse concurrent calls within the cache window into one
// upstream fetch so 100 riders = 1 adsb.fi call.
let inflight: Promise<Snapshot> | null = null;
const inflightByRegion = new Map<RegionId, Promise<Snapshot>>();

export async function getSnapshot(regionId: RegionId = DEFAULT_REGION): Promise<Snapshot> {
  const key = snapshotKey(regionId);
  const cached = await cacheGet<Snapshot>(key);
  if (cached) {
    lastSource = cached.source;
    return cached;
  }
  const existing = inflightByRegion.get(regionId);
  if (existing) return existing;

  const next = (async () => {
    try {
      const snap = await buildSnapshot(regionId);
      let enrichedSnap = snap;
      // Append airborne positions + record state-change activity events.
      // Both are best-effort: never fail /api/aircraft on a side-channel error.
      try {
        await logTracks(snap);
      } catch (e) {
        console.warn("[snapshot] track write failed:", e);
      }
      try {
        enrichedSnap = await hydrateCurrentFlightDurations(snap);
      } catch (e) {
        console.warn("[snapshot] current-flight duration failed:", e);
      }
      try {
        await recordActivity(enrichedSnap, regionId);
      } catch (e) {
        console.warn("[snapshot] activity write failed:", e);
      }
      try {
        await dispatchProximitySnapshot(enrichedSnap);
      } catch (e) {
        console.warn("[snapshot] proximity dispatch failed:", e);
      }
      // Stamp the canary if any tail is airborne.
      if (enrichedSnap.aircraft.some((a) => a.airborne)) {
        try {
          await cacheSet(
            LAST_AIRBORNE_KEY,
            enrichedSnap.fetched_at,
            LAST_AIRBORNE_TTL_SECONDS,
          );
        } catch (e) {
          console.warn("[snapshot] last-airborne stamp failed:", e);
        }
      }
      await cacheSet(key, enrichedSnap, TTL_SECONDS);
      // Health mirror gets a much longer TTL so the cron pipeline is
      // observable between hot-path cache expirations.
      try {
        await cacheSet(HEALTH_KEY, enrichedSnap, HEALTH_TTL_SECONDS);
      } catch (e) {
        console.warn("[snapshot] health-mirror write failed:", e);
      }
      lastSource = enrichedSnap.source;
      return enrichedSnap;
    } finally {
      inflightByRegion.delete(regionId);
    }
  })();
  inflightByRegion.set(regionId, next);
  inflight = regionId === DEFAULT_REGION ? next : inflight;
  return next;
}

function snapshotKey(regionId: RegionId): string {
  return regionId === DEFAULT_REGION ? KEY : `${KEY}:${regionId}`;
}

async function hydrateCurrentFlightDurations(snap: Snapshot): Promise<Snapshot> {
  const aircraft = await Promise.all(
    snap.aircraft.map(async (a) => {
      if (!a.airborne) return { ...a, time_aloft_min: undefined };
      const duration = await getCurrentFlightDuration(a.tail, snap.fetched_at);
      return { ...a, time_aloft_min: duration?.elapsedMinutes };
    }),
  );
  return { ...snap, aircraft };
}
