import type { AppStateId } from "@/lib/app-regions";
import type { RegionId } from "@/lib/regions";

export type AircraftAlertPushSubscription = {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export type AircraftAlertSubscriber = {
  userId: string;
  enabled: boolean;
  subscription: AircraftAlertPushSubscription;
  stateId: AppStateId;
  regionId: RegionId;
  proximityRangeNm: number;
  userAgent?: string | null;
  createdAt: string;
  updatedAt: string;
  disabledAt?: string | null;
};

export type AircraftAlertDedupeState = {
  userId: string;
  aircraftTail: string;
  insideRange: boolean;
  active: boolean;
  sentAt?: string | null;
  lastSeenInsideRangeAt?: string | null;
  lastSeenOutsideRangeAt?: string | null;
  updatedAt: string;
};

export type AircraftAlertSentLog = {
  userId: string;
  aircraftTail: string;
  aircraftLabel: string;
  stateId: AppStateId;
  regionId: RegionId;
  distanceNm: number;
  proximityRangeNm: number;
  sentAt: string;
};

export type AircraftAlertStatus = {
  supported: boolean;
  configured: boolean;
  enabled: boolean;
  permission: NotificationPermission | "unsupported";
  regionId?: RegionId;
  stateId?: AppStateId;
  proximityRangeNm?: number;
  publicKey?: string;
  message?: string;
};
