// Flight-path overlay endpoint. Returns one GeoJSON LineString per
// tail-day with > 5 points, filtered by region bbox + optional
// operator / role allow-list. Powers the polyline layer on /radar —
// corridors render as thin amber threads behind live aircraft.
//
// The endpoint walks lib/tracks.ts:listTrackKeys() + getTracksForDay()
// across the registry, composed per-request and per-region. Edge cached
// for 5 min to keep the round-trip cost contained when riders flip
// filters or regions in quick succession.

import { NextResponse } from "next/server";
import { getRegistry } from "@/lib/registry";
import { listTrackKeys, getTracksForDay } from "@/lib/tracks";
import {
  DEFAULT_REGION,
  REGIONS,
  type RegionBbox,
  type RegionId,
} from "@/lib/regions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_POINTS_PER_LINE = 2;
const MAX_DAYS = 30;

type LineFeature = GeoJSON.Feature<
  GeoJSON.LineString,
  { tail: string; date: string; count: number }
>;

function resolveBbox(url: URL): { regionId: RegionId; bbox: RegionBbox } {
  const idParam = url.searchParams.get("region_id");
  if (idParam && idParam in REGIONS) {
    const id = idParam as RegionId;
    return { regionId: id, bbox: REGIONS[id].bbox };
  }
  // Fallback matches lib/regions.ts:DEFAULT_REGION so a malformed query
  // renders the same scope as a fresh-install client.
  return { regionId: DEFAULT_REGION, bbox: REGIONS[DEFAULT_REGION].bbox };
}

function parseList(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

/** Like parseList but preserves case — operator names like "Pierce SO"
 *  are case-sensitive in the registry. */
function parseListCaseSensitive(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function utcDateKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

/**
 * Bbox intersection test: a tail-day line passes if any of its points
 * fall inside the region. Cheaper than computing line-rect intersection
 * — false negatives are limited to a single mid-line point that crosses
 * the bbox while both endpoints sit outside, which is rare for the
 * patrol orbit + transit shapes our tracks actually contain.
 */
function lineIntersectsBbox(
  coords: [number, number][],
  bbox: NonNullable<RegionBbox>,
): boolean {
  for (const [lon, lat] of coords) {
    if (
      lat >= bbox.latMin &&
      lat <= bbox.latMax &&
      lon >= bbox.lonMin &&
      lon <= bbox.lonMax
    ) {
      return true;
    }
  }
  return false;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const { regionId, bbox } = resolveBbox(url);
  // Operator + tails accept comma-separated lists. Either or both can
  // be empty; intersection with `roles` (via registry lookup) builds the
  // effective tail allow-list.
  const operators = parseListCaseSensitive(url.searchParams.get("operator"));
  const tails = parseList(url.searchParams.get("tails"));
  const roles = parseList(url.searchParams.get("roles")).map((r) =>
    r.toLowerCase(),
  );
  const daysRaw = Number(url.searchParams.get("days") ?? MAX_DAYS);
  const days = Number.isFinite(daysRaw)
    ? Math.max(1, Math.min(MAX_DAYS, Math.floor(daysRaw)))
    : MAX_DAYS;

  const registry = await getRegistry();

  // Resolve operator + role + tails filters to a tail allow-list. Empty
  // filter = every tail in the registry.
  let allowedTails: Set<string> | null = null;
  if (operators.length > 0 || roles.length > 0 || tails.length > 0) {
    allowedTails = new Set(tails);
    if (operators.length > 0 || roles.length > 0) {
      for (const f of registry) {
        if (operators.length > 0 && operators.includes(f.operator)) {
          allowedTails.add(f.tail);
        }
        if (roles.length > 0 && roles.includes(String(f.role).toLowerCase())) {
          allowedTails.add(f.tail);
        }
      }
    }
  }

  const cutoff = utcDateKey(new Date(Date.now() - days * 86_400_000));
  const features: LineFeature[] = [];

  for (const f of registry) {
    if (allowedTails && !allowedTails.has(f.tail)) continue;
    const dates = await listTrackKeys(f.tail);
    const keep = dates.filter((d) => d >= cutoff);
    for (const date of keep) {
      const points = await getTracksForDay(f.tail, date);
      if (points.length < MIN_POINTS_PER_LINE) continue;
      // Tracks are appended in chronological order but defensively sort
      // by ts in case a slow Redis write reorders pings on the same
      // millisecond.
      points.sort((a, b) => a.ts - b.ts);
      const coords: [number, number][] = points.map((p) => [p.lon, p.lat]);
      if (bbox && !lineIntersectsBbox(coords, bbox)) continue;
      features.push({
        type: "Feature",
        geometry: { type: "LineString", coordinates: coords },
        properties: { tail: f.tail, date, count: coords.length },
      });
    }
  }

  return NextResponse.json(
    {
      type: "FeatureCollection",
      features,
      region_id: regionId,
      filter_operators: operators,
      filter_tails: tails,
      filter_roles: roles,
      window_days: days,
    },
    {
      headers: {
        "Cache-Control":
          "public, max-age=0, s-maxage=300, stale-while-revalidate=3600",
      },
    },
  );
}
