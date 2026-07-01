import { NextResponse } from "next/server";
import {
  APP_STATES,
  stateForRegion,
  type AppStateId,
} from "@/lib/app-regions";
import {
  isRegionId,
  type RegionId,
} from "@/lib/regions";
import { clampRegionProximityNm } from "@/lib/proximity-limits";
import {
  deleteAircraftAlertSubscriber,
  getAircraftAlertSubscriber,
  updateAircraftAlertSubscriberPreferences,
  upsertAircraftAlertSubscriber,
} from "@/lib/aircraft-alerts/store";
import type { AircraftAlertPushSubscription } from "@/lib/aircraft-alerts/types";
import {
  getAircraftAlertPublicKey,
  isAircraftAlertPushConfigured,
} from "@/lib/aircraft-alerts/web-push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SubscriptionBody = {
  userId?: unknown;
  subscription?: unknown;
  stateId?: unknown;
  regionId?: unknown;
  proximityRangeNm?: unknown;
};

export async function GET(req: Request) {
  const userId = new URL(req.url).searchParams.get("userId");
  if (!isValidUserId(userId)) {
    return NextResponse.json(
      baseStatus({ enabled: false, message: "missing_user" }),
      { status: 200 },
    );
  }
  const subscriber = await getAircraftAlertSubscriber(userId);
  return NextResponse.json(
    baseStatus({
      enabled: Boolean(subscriber?.enabled),
      regionId: subscriber?.regionId,
      stateId: subscriber?.stateId,
      proximityRangeNm: subscriber?.proximityRangeNm,
    }),
  );
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as SubscriptionBody | null;
  const parsed = parseSubscriptionBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const subscriber = await upsertAircraftAlertSubscriber({
    ...parsed.value,
    userAgent: req.headers.get("user-agent"),
  });
  return NextResponse.json(baseStatus({
    enabled: true,
    regionId: subscriber.regionId,
    stateId: subscriber.stateId,
    proximityRangeNm: subscriber.proximityRangeNm,
  }));
}

export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => null)) as SubscriptionBody | null;
  const userId = typeof body?.userId === "string" ? body.userId : null;
  if (!isValidUserId(userId)) {
    return NextResponse.json({ error: "invalid_user" }, { status: 400 });
  }
  const update: Parameters<typeof updateAircraftAlertSubscriberPreferences>[1] =
    {};
  if (typeof body?.regionId === "string" && isRegionId(body.regionId)) {
    update.regionId = body.regionId;
    update.stateId = parseStateId(body.stateId) ?? stateForRegion(body.regionId).id;
  }
  if (typeof body?.proximityRangeNm === "number") {
    update.proximityRangeNm = clampRegionProximityNm(body.proximityRangeNm);
  }
  if (typeof body?.stateId === "string") {
    const stateId = parseStateId(body.stateId);
    if (stateId) update.stateId = stateId;
  }
  const subscriber = await updateAircraftAlertSubscriberPreferences(
    userId,
    update,
  );
  if (!subscriber) {
    return NextResponse.json({ error: "not_subscribed" }, { status: 404 });
  }
  return NextResponse.json(baseStatus({
    enabled: subscriber.enabled,
    regionId: subscriber.regionId,
    stateId: subscriber.stateId,
    proximityRangeNm: subscriber.proximityRangeNm,
  }));
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  let userId = url.searchParams.get("userId");
  if (!userId) {
    const body = (await req.json().catch(() => null)) as { userId?: unknown } | null;
    userId = typeof body?.userId === "string" ? body.userId : null;
  }
  if (!isValidUserId(userId)) {
    return NextResponse.json({ error: "invalid_user" }, { status: 400 });
  }
  await deleteAircraftAlertSubscriber(userId);
  return NextResponse.json(baseStatus({ enabled: false }));
}

function baseStatus(update: {
  enabled: boolean;
  regionId?: RegionId;
  stateId?: AppStateId;
  proximityRangeNm?: number;
  message?: string;
}) {
  return {
    supported: true,
    configured: isAircraftAlertPushConfigured(),
    publicKey: getAircraftAlertPublicKey(),
    ...update,
  };
}

function parseSubscriptionBody(body: SubscriptionBody | null):
  | {
      ok: true;
      value: {
        userId: string;
        subscription: AircraftAlertPushSubscription;
        stateId: AppStateId;
        regionId: RegionId;
        proximityRangeNm: number;
      };
    }
  | { ok: false; error: string } {
  const userId = typeof body?.userId === "string" ? body.userId : null;
  if (!isValidUserId(userId)) return { ok: false, error: "invalid_user" };
  if (!isPushSubscription(body?.subscription)) {
    return { ok: false, error: "invalid_subscription" };
  }
  const regionId =
    typeof body?.regionId === "string" && isRegionId(body.regionId)
      ? body.regionId
      : null;
  if (!regionId) return { ok: false, error: "invalid_region" };
  const stateId = parseStateId(body?.stateId) ?? stateForRegion(regionId).id;
  const rawRange =
    typeof body?.proximityRangeNm === "number" ? body.proximityRangeNm : NaN;
  const proximityRangeNm = Number.isFinite(rawRange)
    ? clampRegionProximityNm(rawRange)
    : null;
  if (!proximityRangeNm) return { ok: false, error: "invalid_range" };
  return {
    ok: true,
    value: {
      userId,
      subscription: body.subscription,
      stateId,
      regionId,
      proximityRangeNm,
    },
  };
}

function isPushSubscription(value: unknown): value is AircraftAlertPushSubscription {
  if (!value || typeof value !== "object") return false;
  const sub = value as Partial<AircraftAlertPushSubscription>;
  return Boolean(
    typeof sub.endpoint === "string" &&
      sub.endpoint &&
      sub.keys &&
      typeof sub.keys.p256dh === "string" &&
      typeof sub.keys.auth === "string",
  );
}

function parseStateId(value: unknown): AppStateId | null {
  if (typeof value !== "string") return null;
  return APP_STATES.some((state) => state.id === value)
    ? (value as AppStateId)
    : null;
}

function isValidUserId(value: string | null | undefined): value is string {
  return Boolean(value && /^[a-f0-9-]{20,80}$/i.test(value));
}
