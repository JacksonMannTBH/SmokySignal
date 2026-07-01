import { buildSnapshot } from "./adsb";
import { cacheGet, cacheSet, getRedis } from "./cache";
import { getCurrentFlightDuration, logTracks } from "./tracks";
import { recordActivity } from "./activity";
import { dispatchAircraftProximityAlerts } from "./aircraft-alerts/dispatcher";
import { DEFAULT_REGION, type RegionId } from "./regions";
import type { Snapshot, SnapshotSource } from "./types";

type GetSnapshotOptions = {
  dispatchAlerts?: boolean;
};

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
export async function peekSnapshot(
  regionId: RegionId = DEFAULT_REGION,
): Promise<Snapshot | null> {
  return await cacheGet<Snapshot>(snapshotKey(regionId));
}

/**
 * Most recent successful snapshot regardless of whether the 10s hot-path
 * cache is current. /api/health uses this to discriminate "cron is dead"
 * (this returns null) from "cron just ran but the hot-path TTL expired".
 */
export async function peekHealthSnapshot(
  regionId: RegionId = DEFAULT_REGION,
): Promise<Snapshot | null> {
  return await cacheGet<Snapshot>(healthSnapshotKey(regionId));
}

/**
 * Fast render path: return the hot cache, then the longer-lived stale mirror,
 * and only perform a fresh upstream fetch on a fully cold cache.
 */
export async function getSnapshotForRender(
  regionId: RegionId = DEFAULT_REGION,
): Promise<Snapshot> {
  const hot = await peekSnapshot(regionId);
  if (hot) {
    lastSource = hot.source;
    return hot;
  }

  const stale = await peekHealthSnapshot(regionId);
  if (stale) {
    lastSource = stale.source;
    return stale;
  }

  return await getSnapshot(regionId);
}

// Single-flight: collapse concurrent calls within the cache window into one
// upstream fetch so 100 riders = 1 adsb.fi call.
const inflightByRegion = new Map<string, Promise<Snapshot>>();

export async function getSnapshot(
  regionId: RegionId = DEFAULT_REGION,
  options: GetSnapshotOptions = {},
): Promise<Snapshot> {
  const key = snapshotKey(regionId);
  const cached = await cacheGet<Snapshot>(key);
  if (cached) {
    lastSource = cached.source;
    return cached;
  }
  const inflightKey = snapshotInflightKey(regionId, options);
  const existing = inflightByRegion.get(inflightKey);
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
      if (options.dispatchAlerts) {
        try {
          await dispatchAircraftProximityAlerts(enrichedSnap, regionId);
        } catch (e) {
          console.warn("[snapshot] aircraft-alert dispatch failed:", e);
        }
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
        await cacheSet(
          healthSnapshotKey(regionId),
          enrichedSnap,
          HEALTH_TTL_SECONDS,
        );
      } catch (e) {
        console.warn("[snapshot] health-mirror write failed:", e);
      }
      lastSource = enrichedSnap.source;
      return enrichedSnap;
    } finally {
      inflightByRegion.delete(inflightKey);
    }
  })();
  inflightByRegion.set(inflightKey, next);
  return next;
}

function snapshotKey(regionId: RegionId): string {
  return regionId === DEFAULT_REGION ? KEY : `${KEY}:${regionId}`;
}

function healthSnapshotKey(regionId: RegionId): string {
  return regionId === DEFAULT_REGION ? HEALTH_KEY : `${HEALTH_KEY}:${regionId}`;
}

function snapshotInflightKey(
  regionId: RegionId,
  options: GetSnapshotOptions,
): string {
  return `${regionId}:${options.dispatchAlerts ? "alerts" : "normal"}`;
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
