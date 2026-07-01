import { getRedis } from "@/lib/cache";
import { DEFAULT_REGION, isRegionId, type RegionId } from "@/lib/regions";
import {
  DEFAULT_APP_STATE_ID,
  type AppStateId,
} from "@/lib/app-regions";
import type {
  AircraftAlertDedupeState,
  AircraftAlertSentLog,
  AircraftAlertSubscriber,
} from "./types";

const PREFIX = "aircraft-alerts";
const SUBSCRIBERS_KEY = `${PREFIX}:subscribers`;
const REGIONS_KEY = `${PREFIX}:regions`;
const DEDUPE_TTL_SECONDS = 7 * 24 * 60 * 60;
const SENT_LOG_TTL_SECONDS = 30 * 24 * 60 * 60;
const SENT_LOG_LIMIT = 100;

const memorySubscribers = new Map<string, AircraftAlertSubscriber>();
const memoryRegionSubscribers = new Map<RegionId, Set<string>>();
const memoryDedupe = new Map<string, AircraftAlertDedupeState>();
const memorySentLogs = new Map<string, AircraftAlertSentLog[]>();

type UpsertInput = {
  userId: string;
  subscription: AircraftAlertSubscriber["subscription"];
  stateId: AppStateId;
  regionId: RegionId;
  proximityRangeNm: number;
  userAgent?: string | null;
};

type PreferenceUpdate = Partial<{
  enabled: boolean;
  stateId: AppStateId;
  regionId: RegionId;
  proximityRangeNm: number;
}>;

export async function upsertAircraftAlertSubscriber(
  input: UpsertInput,
): Promise<AircraftAlertSubscriber> {
  const now = new Date().toISOString();
  const existing = await getAircraftAlertSubscriber(input.userId);
  const subscriber: AircraftAlertSubscriber = {
    userId: input.userId,
    enabled: true,
    subscription: input.subscription,
    stateId: input.stateId,
    regionId: input.regionId,
    proximityRangeNm: input.proximityRangeNm,
    userAgent: input.userAgent ?? null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    disabledAt: null,
  };
  await writeSubscriber(subscriber, existing?.regionId);
  return subscriber;
}

export async function updateAircraftAlertSubscriberPreferences(
  userId: string,
  update: PreferenceUpdate,
): Promise<AircraftAlertSubscriber | null> {
  const existing = await getAircraftAlertSubscriber(userId);
  if (!existing) return null;
  const next: AircraftAlertSubscriber = {
    ...existing,
    ...update,
    disabledAt:
      update.enabled === false
        ? new Date().toISOString()
        : update.enabled === true
          ? null
          : existing.disabledAt,
    updatedAt: new Date().toISOString(),
  };
  await writeSubscriber(next, existing.regionId);
  return next;
}

export async function getAircraftAlertSubscriber(
  userId: string,
): Promise<AircraftAlertSubscriber | null> {
  const redis = await getRedis();
  if (redis) {
    return await redis.get<AircraftAlertSubscriber>(subscriberKey(userId));
  }
  return memorySubscribers.get(userId) ?? null;
}

export async function deleteAircraftAlertSubscriber(
  userId: string,
): Promise<void> {
  const existing = await getAircraftAlertSubscriber(userId);
  const redis = await getRedis();
  if (redis) {
    await redis.del(subscriberKey(userId));
    await redis.srem(SUBSCRIBERS_KEY, userId);
    if (existing) {
      await redis.srem(regionSubscribersKey(existing.regionId), userId);
    }
    return;
  }
  memorySubscribers.delete(userId);
  if (existing) memoryRegionSubscribers.get(existing.regionId)?.delete(userId);
}

export async function listEnabledAircraftAlertSubscribersForRegion(
  regionId: RegionId,
): Promise<AircraftAlertSubscriber[]> {
  const redis = await getRedis();
  const userIds = redis
    ? normalizeStringList(await redis.smembers(regionSubscribersKey(regionId)))
    : [...(memoryRegionSubscribers.get(regionId) ?? [])];
  const subscribers = await Promise.all(
    userIds.map((userId) => getAircraftAlertSubscriber(userId)),
  );
  return subscribers.filter(
    (subscriber): subscriber is AircraftAlertSubscriber =>
      Boolean(
        subscriber &&
          subscriber.enabled &&
          subscriber.regionId === regionId &&
          subscriber.subscription?.endpoint,
      ),
  );
}

export async function listAircraftAlertRegions(): Promise<RegionId[]> {
  const redis = await getRedis();
  const regionIds = redis
    ? normalizeStringList(await redis.smembers(REGIONS_KEY))
    : [...memoryRegionSubscribers.keys()];
  const valid = regionIds.filter(isRegionId);
  return valid.length > 0 ? valid : [DEFAULT_REGION];
}

export async function getAircraftAlertDedupeState(
  userId: string,
  aircraftTail: string,
): Promise<AircraftAlertDedupeState | null> {
  const key = dedupeKey(userId, aircraftTail);
  const redis = await getRedis();
  if (redis) return await redis.get<AircraftAlertDedupeState>(key);
  return memoryDedupe.get(key) ?? null;
}

export async function setAircraftAlertDedupeState(
  state: AircraftAlertDedupeState,
): Promise<void> {
  const key = dedupeKey(state.userId, state.aircraftTail);
  const redis = await getRedis();
  if (redis) {
    await redis.set(key, state, { ex: DEDUPE_TTL_SECONDS });
    return;
  }
  memoryDedupe.set(key, state);
}

export async function recordAircraftAlertSent(
  log: AircraftAlertSentLog,
): Promise<void> {
  const redis = await getRedis();
  if (redis) {
    const key = sentLogKey(log.userId);
    await redis.rpush(key, JSON.stringify(log));
    await redis.ltrim(key, -SENT_LOG_LIMIT, -1);
    await redis.expire(key, SENT_LOG_TTL_SECONDS);
    return;
  }
  const logs = memorySentLogs.get(log.userId) ?? [];
  memorySentLogs.set(log.userId, [...logs, log].slice(-SENT_LOG_LIMIT));
}

async function writeSubscriber(
  subscriber: AircraftAlertSubscriber,
  previousRegionId?: RegionId,
): Promise<void> {
  const redis = await getRedis();
  if (redis) {
    await redis.set(subscriberKey(subscriber.userId), subscriber);
    await redis.sadd(SUBSCRIBERS_KEY, subscriber.userId);
    await redis.sadd(REGIONS_KEY, subscriber.regionId);
    await redis.sadd(regionSubscribersKey(subscriber.regionId), subscriber.userId);
    if (previousRegionId && previousRegionId !== subscriber.regionId) {
      await redis.srem(regionSubscribersKey(previousRegionId), subscriber.userId);
    }
    return;
  }

  memorySubscribers.set(subscriber.userId, subscriber);
  if (previousRegionId && previousRegionId !== subscriber.regionId) {
    memoryRegionSubscribers.get(previousRegionId)?.delete(subscriber.userId);
  }
  const set = memoryRegionSubscribers.get(subscriber.regionId) ?? new Set();
  set.add(subscriber.userId);
  memoryRegionSubscribers.set(subscriber.regionId, set);
}

export function defaultAircraftAlertSubscriber(
  userId: string,
  subscription: AircraftAlertSubscriber["subscription"],
): AircraftAlertSubscriber {
  const now = new Date().toISOString();
  return {
    userId,
    enabled: false,
    subscription,
    stateId: DEFAULT_APP_STATE_ID,
    regionId: DEFAULT_REGION,
    proximityRangeNm: 5,
    createdAt: now,
    updatedAt: now,
    disabledAt: now,
  };
}

function subscriberKey(userId: string): string {
  return `${PREFIX}:subscriber:${userId}`;
}

function regionSubscribersKey(regionId: RegionId): string {
  return `${PREFIX}:region:${regionId}:subscribers`;
}

function dedupeKey(userId: string, aircraftTail: string): string {
  return `${PREFIX}:dedupe:${userId}:${aircraftTail.toUpperCase()}`;
}

function sentLogKey(userId: string): string {
  return `${PREFIX}:sent:${userId}`;
}

function normalizeStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") return [value];
  return [];
}
