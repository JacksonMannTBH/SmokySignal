import { stateIdForOpsAircraftTail } from "@/lib/aircraft-directory";
import { haversineNm } from "@/lib/geo";
import { nmToStatuteMiles } from "@/lib/proximity-limits";
import { REGIONS, stateIdForRegion, type RegionId } from "@/lib/regions";
import type { Aircraft, Snapshot } from "@/lib/types";
import {
  deleteAircraftAlertSubscriber,
  getAircraftAlertDedupeState,
  listEnabledAircraftAlertSubscribersForRegion,
  recordAircraftAlertSent,
  setAircraftAlertDedupeState,
} from "./store";
import type {
  AircraftAlertDedupeState,
  AircraftAlertSubscriber,
} from "./types";
import {
  isAircraftAlertPushConfigured,
  sendAircraftAlertPush,
} from "./web-push";

const OUTSIDE_RESET_MS = 10 * 60 * 1000;
const LONG_COOLDOWN_MS = 60 * 60 * 1000;

export type AircraftAlertDispatchSummary = {
  regionId: RegionId;
  subscribers: number;
  checked: number;
  sent: number;
  expiredSubscriptions: number;
  skippedReason?: "not_configured" | "no_region" | "no_subscribers";
};

export async function dispatchAircraftProximityAlerts(
  snapshot: Snapshot,
  regionId: RegionId,
): Promise<AircraftAlertDispatchSummary> {
  const subscribers = await listEnabledAircraftAlertSubscribersForRegion(regionId);
  const summary: AircraftAlertDispatchSummary = {
    regionId,
    subscribers: subscribers.length,
    checked: 0,
    sent: 0,
    expiredSubscriptions: 0,
  };
  if (subscribers.length === 0) {
    summary.skippedReason = "no_subscribers";
    return summary;
  }
  if (!REGIONS[regionId]) {
    summary.skippedReason = "no_region";
    return summary;
  }
  if (!isAircraftAlertPushConfigured()) {
    summary.skippedReason = "not_configured";
    return summary;
  }

  for (const subscriber of subscribers) {
    for (const aircraft of snapshot.aircraft) {
      summary.checked += 1;
      const sent = await checkAircraftForSubscriber(
        subscriber,
        aircraft,
        regionId,
      );
      if (sent === "sent") summary.sent += 1;
      if (sent === "expired") summary.expiredSubscriptions += 1;
    }
  }

  return summary;
}

async function checkAircraftForSubscriber(
  subscriber: AircraftAlertSubscriber,
  aircraft: Aircraft,
  regionId: RegionId,
): Promise<"sent" | "expired" | "none"> {
  if (subscriber.regionId !== regionId) return "none";
  if (!aircraftMatchesSubscriberState(subscriber, aircraft, regionId)) {
    await markAircraftInactiveOrOutside(subscriber.userId, aircraft.tail, false);
    return "none";
  }

  const active = aircraft.airborne && isFiniteCoord(aircraft.lat) && isFiniteCoord(aircraft.lon);
  if (!active) {
    await markAircraftInactiveOrOutside(subscriber.userId, aircraft.tail, false);
    return "none";
  }

  const region = REGIONS[subscriber.regionId];
  const distanceNm = haversineNm(
    region.centerLat,
    region.centerLon,
    aircraft.lat!,
    aircraft.lon!,
  );
  const insideRange = distanceNm <= subscriber.proximityRangeNm;
  if (!insideRange) {
    await markAircraftInactiveOrOutside(subscriber.userId, aircraft.tail, true);
    return "none";
  }

  const recent = await getAircraftAlertDedupeState(
    subscriber.userId,
    aircraft.tail,
  );
  if (!canSendAgainForAircraftAlert(recent)) {
    await setAircraftAlertDedupeState({
      ...(recent ?? baseDedupeState(subscriber.userId, aircraft.tail)),
      active: true,
      insideRange: true,
      lastSeenInsideRangeAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return "none";
  }

  const aircraftLabel =
    aircraft.nickname || aircraft.tail || aircraft.icao24 || "Aircraft";
  const result = await sendAircraftAlertPush(subscriber.subscription, {
    title: "Aircraft nearby",
    body: `${aircraftLabel} is ${nmToStatuteMiles(distanceNm).toFixed(1)} miles from your alert region.`,
    url: `/plane/${encodeURIComponent(aircraft.tail)}`,
    tag: `aircraft-alert-${aircraft.tail}`,
    aircraftTail: aircraft.tail,
  });

  if (!result.ok) {
    if (result.reason === "expired") {
      await deleteAircraftAlertSubscriber(subscriber.userId);
      return "expired";
    }
    return "none";
  }

  const now = new Date().toISOString();
  await setAircraftAlertDedupeState({
    userId: subscriber.userId,
    aircraftTail: aircraft.tail,
    active: true,
    insideRange: true,
    sentAt: now,
    lastSeenInsideRangeAt: now,
    updatedAt: now,
  });
  await recordAircraftAlertSent({
    userId: subscriber.userId,
    aircraftTail: aircraft.tail,
    aircraftLabel,
    stateId: subscriber.stateId,
    regionId: subscriber.regionId,
    distanceNm,
    proximityRangeNm: subscriber.proximityRangeNm,
    sentAt: now,
  });
  return "sent";
}

function aircraftMatchesSubscriberState(
  subscriber: AircraftAlertSubscriber,
  aircraft: Aircraft,
  regionId: RegionId,
): boolean {
  const aircraftStateId =
    stateIdForOpsAircraftTail(aircraft.tail) ?? stateIdForRegion(regionId);
  return aircraftStateId === subscriber.stateId;
}

function canSendAgainForAircraftAlert(
  recent: AircraftAlertDedupeState | null,
): boolean {
  if (!recent?.sentAt) return true;
  if (!recent.active) return true;

  const now = Date.now();
  const sentAt = Date.parse(recent.sentAt);
  const outsideAt = recent.lastSeenOutsideRangeAt
    ? Date.parse(recent.lastSeenOutsideRangeAt)
    : null;

  if (!recent.insideRange && outsideAt && now - outsideAt >= OUTSIDE_RESET_MS) {
    return true;
  }
  if (Number.isFinite(sentAt) && now - sentAt >= LONG_COOLDOWN_MS) {
    return true;
  }
  return false;
}

async function markAircraftInactiveOrOutside(
  userId: string,
  aircraftTail: string,
  active: boolean,
): Promise<void> {
  const recent = await getAircraftAlertDedupeState(userId, aircraftTail);
  if (!recent?.sentAt) return;
  const now = new Date().toISOString();
  await setAircraftAlertDedupeState({
    ...recent,
    active,
    insideRange: false,
    lastSeenOutsideRangeAt:
      recent.insideRange === false && recent.lastSeenOutsideRangeAt
        ? recent.lastSeenOutsideRangeAt
        : now,
    updatedAt: now,
  });
}

function baseDedupeState(
  userId: string,
  aircraftTail: string,
): AircraftAlertDedupeState {
  return {
    userId,
    aircraftTail,
    active: true,
    insideRange: false,
    updatedAt: new Date().toISOString(),
  };
}

function isFiniteCoord(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
