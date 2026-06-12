// /api/trails — recent track-history slice for currently-airborne tails.
// Powers the polyline trail layer on /radar (components/AircraftTrailLayer).
//
// Query: GET /api/trails?tails=N305DK,N2446X
// Response: { trails: { [tail]: [{ lat, lon, ts }] } }
//   - Coordinates only (no alt/speed) — the trail layer doesn't need them
//     and dropping fields keeps the payload small.
//   - Sorted ascending by ts so a polyline reads from oldest → newest.

import { NextResponse } from "next/server";
import { getTracksForDay, listTrackKeys, type TrackPoint } from "@/lib/tracks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TAILS = 32;
const MAX_LOOKBACK_DAYS = 3;
// Treat ordinary feed/cache dropouts as one current flight. A 5-minute gap
// split trails whenever sampling was sparse, making the path look like it
// began when the web page opened.
const CURRENT_FLIGHT_GAP_SECONDS = 60 * 60;

function parseTails(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^N[0-9A-Z]{1,5}$/.test(s))
    .slice(0, MAX_TAILS);
}

type TrailPoint = { lat: number; lon: number; ts: number };

async function trailFor(
  tail: string,
): Promise<TrailPoint[]> {
  const interestingDates = (await listTrackKeys(tail)).slice(
    0,
    MAX_LOOKBACK_DAYS,
  );
  const allPoints: TrackPoint[] = [];
  for (const date of interestingDates) {
    const points = await getTracksForDay(tail, date);
    allPoints.push(...points);
  }
  allPoints.sort((a, b) => a.ts - b.ts);
  if (allPoints.length === 0) return [];

  const session: TrackPoint[] = [];
  for (let i = allPoints.length - 1; i >= 0; i--) {
    const point = allPoints[i]!;
    session.unshift(point);
    const prev = allPoints[i - 1];
    if (!prev) break;
    if (point.ts - prev.ts > CURRENT_FLIGHT_GAP_SECONDS) break;
  }

  return session.map((p) => ({ lat: p.lat, lon: p.lon, ts: p.ts }));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tails = parseTails(url.searchParams.get("tails"));
  if (tails.length === 0) {
    return NextResponse.json({ trails: {} });
  }
  const entries = await Promise.all(
    tails.map(async (t) => [t, await trailFor(t)] as const),
  );
  const trails: Record<string, TrailPoint[]> = {};
  for (const [tail, points] of entries) {
    if (points.length > 0) trails[tail] = points;
  }
  return NextResponse.json(
    { trails },
    {
      headers: {
        // Trails update every ~10s on the client; cache for half that
        // at the edge so two simultaneous radar viewers share a fetch
        // but never see stale-by-more-than-a-poll data.
        "Cache-Control":
          "public, max-age=0, s-maxage=5, stale-while-revalidate=30",
      },
    },
  );
}
