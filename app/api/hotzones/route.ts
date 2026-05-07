import { NextResponse } from "next/server";
import {
  getHotZonesCached,
  getLastHotZoneRefresh,
  type HotZone,
} from "@/lib/hotzones";
import { getRegistry } from "@/lib/registry";
import { REGIONS, type RegionBbox, type RegionId } from "@/lib/regions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Resolve the rider-facing region selector → bbox. Accepts the
// `region_id` query param (any RegionId from lib/regions.ts) and falls
// back to All Washington — matches lib/regions.ts:DEFAULT_REGION so
// a malformed query renders the same scope as a fresh-install client.
function resolveBbox(url: URL): { regionId: RegionId; bbox: RegionBbox } {
  const idParam = url.searchParams.get("region_id");
  if (idParam && idParam in REGIONS) {
    const id = idParam as RegionId;
    return { regionId: id, bbox: REGIONS[id].bbox };
  }
  // Legacy "?region=all" alias from the pre-P16.3 chevron filter still
  // resolves to all_wa explicitly for back-compat with anything that
  // bookmarked the old shape.
  const legacy = url.searchParams.get("region");
  if (legacy === "all") {
    return { regionId: "all_wa", bbox: REGIONS.all_wa.bbox };
  }
  return { regionId: "all_wa", bbox: REGIONS.all_wa.bbox };
}

function inBbox(z: HotZone, b: NonNullable<RegionBbox>): boolean {
  return (
    z.lat >= b.latMin &&
    z.lat <= b.latMax &&
    z.lon >= b.lonMin &&
    z.lon <= b.lonMax
  );
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

export async function GET(req: Request) {
  const url = new URL(req.url);
  const { regionId, bbox } = resolveBbox(url);
  const tails = parseList(url.searchParams.get("tails"));
  // Operator now accepts a comma-separated list. A single-operator query
  // (?operator=WSP) still works — parses as a one-element list.
  const operators = parseListCaseSensitive(url.searchParams.get("operator"));
  // "Smokey" filter resolves through here as ?roles=smokey,patrol — the
  // registry lookup expands the role set to the current matching tails
  // so the rider's filter follows fleet membership changes automatically.
  const roles = parseList(url.searchParams.get("roles")).map((r) =>
    r.toLowerCase(),
  );

  const [allZones, lastRefresh] = await Promise.all([
    getHotZonesCached(),
    getLastHotZoneRefresh(),
  ]);

  // Build effective tail set from operator + roles if specified.
  let allowedTails: Set<string> | null = null;
  if (tails.length > 0 || operators.length > 0 || roles.length > 0) {
    allowedTails = new Set(tails);
    if (operators.length > 0 || roles.length > 0) {
      const registry = await getRegistry();
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

  const zones = allZones.filter((z) => {
    if (bbox && !inBbox(z, bbox)) return false;
    if (allowedTails && !z.tails.some((t) => allowedTails!.has(t))) return false;
    return true;
  });

  return NextResponse.json(
    {
      zones,
      last_refresh_ts: lastRefresh,
      region_id: regionId,
      filter_tails: tails,
      filter_operator: operators.length > 0 ? operators.join(",") : null,
      filter_operators: operators,
      filter_roles: roles,
      total_unfiltered: allZones.length,
    },
    {
      headers: {
        "Cache-Control":
          "public, max-age=0, s-maxage=300, stale-while-revalidate=3600",
        ...(lastRefresh != null
          ? { "x-hotzones-refreshed-at": String(lastRefresh) }
          : {}),
      },
    },
  );
}
