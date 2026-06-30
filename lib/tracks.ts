// Position-history time-series in Upstash KV. Powers recent aircraft
// trails, flight details, and forecast learning.
//
// Storage shape:
//   tracks:{tail}:{YYYYMMDD}  →  Redis list of compact JSON strings
//   each entry: {"lat":47.5,"lon":-122.3,"alt":3200,"spd":118,"trk":85,"ts":1746024518}
//
// Each daily key gets a 35-day TTL so the rolling window auto-cleans.

import { getRedis } from "./cache";
import { recordFirstSampleIfMissing } from "./learning";
import { recordLastSample } from "./freshness";
import { liveTrackKey, trackKey, trackScanPattern } from "./storage-keys";
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
const LIVE_TRACK_WINDOW_SECONDS = 60 * 60;
const LIVE_TRACK_TTL_SECONDS = 70 * 60;
const LIVE_TRACK_MAX_POINTS = 140;
export const CURRENT_FLIGHT_GAP_SECONDS = 60 * 60;
const CURRENT_FLIGHT_LOOKBACK_DAYS = 3;

export type CurrentFlightDuration = {
  elapsedMinutes: number;
  startedAtMs: number;
  lastSampleMs: number;
  sampleCount: number;
};

export type CurrentFlightTrack = {
  points: TrackPoint[];
  startedAtMs: number;
  lastSampleMs: number;
};

const memoryTracks = new Map<
  string,
  { points: TrackPoint[]; expiresAt: number }
>();
const memoryLiveTracks = new Map<
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
      const point = trackPointForAircraft(a, tsSec);
      const entry = memoryTracks.get(key) ?? {
        points: [],
        expiresAt: Date.now() + TTL_SECONDS * 1000,
      };
      entry.points.push(point);
      entry.expiresAt = Date.now() + TTL_SECONDS * 1000;
      memoryTracks.set(key, entry);
      appendMemoryLiveTrack(a.tail, point);
    }
    pruneMemoryTracks();
    pruneMemoryLiveTracks();
    return;
  }

  const writes = points.map(async (a) => {
    const key = trackKey(a.tail, date);
    const point = trackPointForAircraft(a, tsSec);
    try {
      await redis.rpush(key, JSON.stringify(point));
      await redis.expire(key, TTL_SECONDS);
      await appendRedisLiveTrack(redis, a.tail, point);
    } catch (e) {
      console.warn(`[tracks] rpush failed for ${a.tail}:`, e);
    }
  });

  await Promise.allSettled(writes);
}

function trackPointForAircraft(
  aircraft: Snapshot["aircraft"][number],
  tsSec: number,
): TrackPoint {
  return {
    lat: aircraft.lat as number,
    lon: aircraft.lon as number,
    alt: aircraft.altitude_ft ?? null,
    spd: aircraft.ground_speed_kt ?? null,
    trk: aircraft.heading ?? null,
    ts: tsSec,
  };
}

function appendMemoryLiveTrack(tail: string, point: TrackPoint): void {
  const key = liveTrackKey(tail);
  const cutoff = point.ts - LIVE_TRACK_WINDOW_SECONDS;
  const entry = memoryLiveTracks.get(key) ?? {
    points: [],
    expiresAt: Date.now() + LIVE_TRACK_TTL_SECONDS * 1000,
  };
  entry.points = [...entry.points, point]
    .filter((p) => p.ts >= cutoff)
    .slice(-LIVE_TRACK_MAX_POINTS);
  entry.expiresAt = Date.now() + LIVE_TRACK_TTL_SECONDS * 1000;
  memoryLiveTracks.set(key, entry);
}

async function appendRedisLiveTrack(
  redis: NonNullable<Awaited<ReturnType<typeof getRedis>>>,
  tail: string,
  point: TrackPoint,
): Promise<void> {
  const key = liveTrackKey(tail);
  const cutoff = point.ts - LIVE_TRACK_WINDOW_SECONDS;
  await redis.rpush(key, JSON.stringify(point));
  const raw = (await redis.lrange(key, 0, -1)) as unknown[];
  const kept = raw
    .map((s) => safeParse(s))
    .filter((p): p is TrackPoint => p !== null && p.ts >= cutoff)
    .sort((a, b) => a.ts - b.ts)
    .slice(-LIVE_TRACK_MAX_POINTS);

  if (kept.length !== raw.length) {
    await redis.del(key);
    if (kept.length > 0) {
      await redis.rpush(key, ...kept.map((p) => JSON.stringify(p)));
    }
  }
  await redis.expire(key, LIVE_TRACK_TTL_SECONDS);
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

export function getCurrentFlightDurationFromPoints(
  points: TrackPoint[],
  nowMs = Date.now(),
  gapSeconds = CURRENT_FLIGHT_GAP_SECONDS,
): CurrentFlightDuration | null {
  const track = getCurrentFlightTrackFromPoints(points, nowMs, gapSeconds);
  if (!track) return null;
  return {
    elapsedMinutes: Math.max(0, Math.floor((nowMs - track.startedAtMs) / 60_000)),
    startedAtMs: track.startedAtMs,
    lastSampleMs: track.lastSampleMs,
    sampleCount: track.points.length,
  };
}

export function getCurrentFlightTrackFromPoints(
  points: TrackPoint[],
  nowMs = Date.now(),
  gapSeconds = CURRENT_FLIGHT_GAP_SECONDS,
): CurrentFlightTrack | null {
  const sorted = points
    .filter((p) => Number.isFinite(p.ts))
    .sort((a, b) => a.ts - b.ts);
  const latest = sorted[sorted.length - 1];
  if (!latest) return null;

  const gapMs = gapSeconds * 1000;
  const latestMs = latest.ts * 1000;
  if (Math.abs(nowMs - latestMs) > gapMs) return null;

  const session: TrackPoint[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const point = sorted[i]!;
    session.unshift(point);
    const prev = sorted[i - 1];
    if (!prev) break;
    if (point.ts - prev.ts > gapSeconds) break;
  }

  const first = session[0];
  if (!first) return null;
  return {
    points: session,
    startedAtMs: first.ts * 1000,
    lastSampleMs: latestMs,
  };
}

export async function getCurrentFlightDuration(
  tail: string,
  nowMs = Date.now(),
): Promise<CurrentFlightDuration | null> {
  const track = await getCurrentFlightTrack(tail, nowMs);
  if (!track) return null;
  return {
    elapsedMinutes: Math.max(0, Math.floor((nowMs - track.startedAtMs) / 60_000)),
    startedAtMs: track.startedAtMs,
    lastSampleMs: track.lastSampleMs,
    sampleCount: track.points.length,
  };
}

export async function getCurrentFlightTrack(
  tail: string,
  nowMs = Date.now(),
): Promise<CurrentFlightTrack | null> {
  const dates = (await listTrackKeys(tail)).slice(0, CURRENT_FLIGHT_LOOKBACK_DAYS);
  if (dates.length === 0) return null;

  const points: TrackPoint[] = [];
  for (const date of dates) {
    points.push(...(await getTracksForDay(tail, date)));
  }
  return getCurrentFlightTrackFromPoints(points, nowMs);
}

export async function getLiveTrackWindow(
  tail: string,
  nowMs = Date.now(),
  windowSeconds = LIVE_TRACK_WINDOW_SECONDS,
): Promise<TrackPoint[]> {
  const cutoffSec = Math.floor(nowMs / 1000) - windowSeconds;
  const key = liveTrackKey(tail);
  const redis = await getRedis();
  if (!redis) {
    pruneMemoryLiveTracks();
    return (memoryLiveTracks.get(key)?.points ?? [])
      .filter((p) => p.ts >= cutoffSec)
      .sort((a, b) => a.ts - b.ts);
  }

  let raw: unknown[] = [];
  try {
    raw = (await redis.lrange(key, 0, -1)) as unknown[];
  } catch {
    return [];
  }

  return raw
    .map((s) => safeParse(s))
    .filter((p): p is TrackPoint => p !== null && p.ts >= cutoffSec)
    .sort((a, b) => a.ts - b.ts);
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

function pruneMemoryLiveTracks(): void {
  const now = Date.now();
  for (const [key, entry] of memoryLiveTracks) {
    if (entry.expiresAt < now) memoryLiveTracks.delete(key);
  }
}
