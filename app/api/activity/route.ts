import { NextResponse } from "next/server";
import { getRecentActivity } from "@/lib/activity";
import { getSnapshot } from "@/lib/snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limitRaw = Number(url.searchParams.get("limit") ?? 50);
  const limit = Number.isFinite(limitRaw)
    ? Math.max(1, Math.min(500, Math.floor(limitRaw)))
    : 50;
  await getSnapshot();
  const entries = await getRecentActivity(limit);
  return NextResponse.json(
    { entries, fetched_at: Date.now() },
    {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=8, stale-while-revalidate=30",
      },
    },
  );
}
