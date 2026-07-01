// Scheduled refresh — invalidates the snapshot cache and re-fetches so adsb.fi
// is queried even when no human traffic is hitting /api/aircraft. This keeps
// the activity feed and proximity notification checks running independently
// of normal page loads.
//
// Schedule: vercel.json. Vercel Hobby plan limits crons to once per day,
// so the default is "0 14 * * *" (daily, 2 PM UTC = 7 AM Pacific). On
// Pro, change vercel.json to "* * * * *" for per-minute refresh — that
// gives the activity feed near-real-time event capture independent of
// user traffic.
//
// Auth: Bearer CRON_SECRET.

import { NextResponse } from "next/server";
import { getSnapshot, invalidateSnapshot } from "@/lib/snapshot";
import { DEFAULT_REGION, type RegionId } from "@/lib/regions";
import { purgeRetiredHotZoneData } from "@/lib/retired-data";
import { listAircraftAlertRegions } from "@/lib/aircraft-alerts/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "not_configured" }, { status: 500 });
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) return unauthorized();

  const retiredDataPurge = await purgeRetiredHotZoneData();
  const regionIds = await activeRegionIds();
  const snaps = [];
  for (const regionId of regionIds) {
    await invalidateSnapshot(regionId);
    snaps.push(await getSnapshot(regionId, { dispatchAlerts: true }));
  }
  const airborne = snaps.reduce(
    (sum, snap) => sum + snap.aircraft.filter((a) => a.airborne).length,
    0,
  );
  const snap = snaps[0]!;

  return NextResponse.json({
    ok: true,
    fetched_at: snap.fetched_at,
    source: snap.source,
    airborne,
    regions: regionIds,
    retired_data_purge: retiredDataPurge,
  });
}

async function activeRegionIds(): Promise<RegionId[]> {
  const regions = await listAircraftAlertRegions();
  return [...new Set([DEFAULT_REGION, ...regions])];
}
