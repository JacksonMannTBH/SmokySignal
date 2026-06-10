// Position-history time-series in Upstash KV. Internal-only — there's no
// public endpoint surfacing this yet. Foundation for Phase 4 hot-zone
// learning and the orbit glyph on the plane detail screen.
//
// Storage shape:
//   tracks:{tail}:{YYYYMMDD}  →  Redis list of compact JSON strings
//   each entry: {"lat":47.5,"lon":-122.3,"alt":3200,"spd":118,"trk":85,"ts":1746024518}
//
// Each daily key gets a 35-day TTL so the rolling window auto-cleans.

import { getRedis } from "./cache";
import { recordFirstSampleIfMissing } from "./learning";
import { recordLastSample } from "./freshness";
import { trackKey, trackScanPattern } from "./storage-keys";
import type { Snapshot } from "./types";

export type TrackPoint = {
  lat: number;
  lon: number;
  alt: number | null;
  spd: number | null;
  trk: number | null;
  ts: number;
};

const TTL_SECONDS = 35 * 24 * 60 * 60; // 35 days

const memoryTracks = new Map<
  string,
  { points: TrackPoint[]; expiresAt: number }
>();

function utcDateKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

/**
 * Append airborne-plane positions to today's track-history list. Best-effort:
 * any failure logs and returns; never throws to the caller.
 */
export async function logTracks(snap: Snapshot): Promise<void> {
  const redis = await getRedis();

  const date = utcDateKey(new Date(snap.fetched_at));
  const tsSec = Math.floor(snap.fetched_at / 1000);

  const points = snap.aircraft.filter(
    (a) => a.airborne && a.lat != null && a.lon != null,
  );
  // Seed the learning-state timer on the first ingest after this code
  // ships. Idempotent NX-write — a no-op after the first call. Skip when
  // we have nothing to write so an empty-sky deploy doesn't start the
  // clock prematurely.
  if (points.length > 0) {
    await recordFirstSampleIfMissing(new Date(snap.fetched_at));
  }
  // Always update the freshness pointer so /radar + / can flip the LAST
  // SAMPLE label amber when this cron silently dies. Best-effort; never
  // throws.
  await recordLastSample(snap.fetched_at);

  if (!redis) {
    for (const a of points) {
      const key = trackKey(a.tail, date);
      const entry = memoryTracks.get(key) ?? {
        points: [],
        expiresAt: Date.now() + TTL_SECONDS * 1000,
      };
      entry.points.push({
        lat: a.lat as number,
        lon: a.lon as number,
        alt: a.altitude_ft ?? null,
        spd: a.ground_speed_kt ?? null,
        trk: a.heading ?? null,
        ts: tsSec,
      });
      entry.expiresAt = Date.now() + TTL_SECONDS * 1000;
      memoryTracks.set(key, entry);
    }
    pruneMemoryTracks();
    return;
  }

  const writes = points.map(async (a) => {
    const key = trackKey(a.tail, date);
    const point: TrackPoint = {
      lat: a.lat as number,
      lon: a.lon as number,
      alt: a.altitude_ft ?? null,
      spd: a.ground_speed_kt ?? null,
      trk: a.heading ?? null,
      ts: tsSec,
    };
    try {
      await redis.rpush(key, JSON.stringify(point));
      await redis.expire(key, TTL_SECONDS);
    } catch (e) {
      console.warn(`[tracks] rpush failed for ${a.tail}:`, e);
    }
  });

  await Promise.allSettled(writes);
}

/** Sorted list of YYYYMMDD dates that have tracks for this tail (newest first). */
export async function listTrackKeys(tail: string): Promise<string[]> {
  const redis = await getRedis();
  if (!redis) {
    pruneMemoryTracks();
    const prefix = trackScanPattern(tail).replace("*", "");
    const dates = new Set<string>();
    for (const k of memoryTracks.keys()) {
      if (!k.startsWith(prefix)) continue;
      const d = k.split(":")[2];
      if (d) dates.add(d);
    }
    return [...dates].sort().reverse();
  }
  const dates = new Set<string>();
  let cursor: string | number = 0;
  do {
    const result = (await redis.scan(cursor, {
      match: trackScanPattern(tail),
      count: 100,
    })) as [string | number, string[]];
    for (const k of result[1]) {
      const d = k.split(":")[2];
      if (d) dates.add(d);
    }
    cursor = result[0];
  } while (String(cursor) !== "0");
  return [...dates].sort().reverse();
}

/** All track points for a single UTC day, oldest → newest. */
export async function getTracksForDay(
  tail: string,
  date: string,
): Promise<TrackPoint[]> {
  const redis = await getRedis();
  if (!redis) {
    pruneMemoryTracks();
    return [...(memoryTracks.get(trackKey(tail, date))?.points ?? [])];
  }
  const key = trackKey(tail, date);
  let raw: unknown[] = [];
  try {
    raw = (await redis.lrange(key, 0, -1)) as unknown[];
  } catch {
    return [];
  }
  return raw
    .map((s) => safeParse(s))
    .filter((p): p is TrackPoint => p !== null);
}

export type TrackSummary = {
  totalSamples: number;
  daysWithData: number;
  firstSampleTs: number | null;
  lastSampleTs: number | null;
};

/** Summary stats for the debug overview — total count, day count, span. */
export async function getTrackSummary(tail: string): Promise<TrackSummary> {
  const redis = await getRedis();
  if (!redis) {
    return {
      totalSamples: 0,
      daysWithData: 0,
      firstSampleTs: null,
      lastSampleTs: null,
    };
  }
  const dates = await listTrackKeys(tail); // newest first
  if (dates.length === 0) {
    return {
      totalSamples: 0,
      daysWithData: 0,
      firstSampleTs: null,
      lastSampleTs: null,
    };
  }

  // Sum LLEN across each day. Done sequentially — at most 35 days
  // (matches our 35-day TTL on track keys), so 35 round-trips worst case.
  let total = 0;
  for (const date of dates) {
    try {
      const len = (await redis.llen(trackKey(tail, date))) as number;
      total += typeof len === "number" ? len : 0;
    } catch {
      /* skip */
    }
  }

  const newest = dates[0]!;
  const oldest = dates[dates.length - 1]!;
  const lastRaw = (await redis.lrange(trackKey(tail, newest), -1, -1)) as unknown[];
  const firstRaw = (await redis.lrange(trackKey(tail, oldest), 0, 0)) as unknown[];
  const last = safeParse(lastRaw[0]);
  const first = safeParse(firstRaw[0]);

  return {
    totalSamples: total,
    daysWithData: dates.length,
    firstSampleTs: first?.ts ?? null,
    lastSampleTs: last?.ts ?? null,
  };
}

function safeParse(s: unknown): TrackPoint | null {
  if (typeof s !== "string") {
    // Upstash sometimes auto-deserializes JSON strings into objects.
    if (s && typeof s === "object") return s as TrackPoint;
    return null;
  }
  try {
    return JSON.parse(s) as TrackPoint;
  } catch {
    return null;
  }
}

function pruneMemoryTracks(): void {
  const now = Date.now();
  for (const [key, entry] of memoryTracks) {
    if (entry.expiresAt < now) memoryTracks.delete(key);
  }
}
