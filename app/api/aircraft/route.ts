import { NextResponse } from "next/server";
import {
  getSnapshot,
  getSnapshotForRender,
  invalidateSnapshot,
} from "@/lib/snapshot";
import { applyMockState, getMockStateFromRequest } from "@/lib/mock-state";
import { DEFAULT_REGION, isRegionId } from "@/lib/regions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const requestedRegion = url.searchParams.get("region_id");
  const regionId = isRegionId(requestedRegion) ? requestedRegion : DEFAULT_REGION;
  const fresh = url.searchParams.has("fresh");
  if (fresh) {
    await invalidateSnapshot(regionId);
  }
  const snap = fresh
    ? await getSnapshot(regionId)
    : await getSnapshotForRender(regionId);
  const out = applyMockState(snap, getMockStateFromRequest(req));
  return NextResponse.json(out, {
    headers: {
      // Browser won't cache; CDN can hold the same 10s the server does.
      "Cache-Control": fresh
        ? "no-store"
        : "public, max-age=0, s-maxage=10, stale-while-revalidate=30",
    },
  });
}
