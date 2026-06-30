import { getRedis } from "./cache";

const PURGE_FLAG_KEY = "retired-hotzone-data:purged:v1";
const PURGE_FLAG_TTL_SECONDS = 30 * 24 * 60 * 60;
const RETIRED_KEY_PATTERNS = [
  "hotzones:*",
  "*:hotzones:*",
  "dryrun-warnings:*",
] as const;

type PurgeSummary = {
  ok: boolean;
  skipped: boolean;
  deleted: number;
  patterns: readonly string[];
};

export async function purgeRetiredHotZoneData(): Promise<PurgeSummary> {
  const redis = await getRedis();
  if (!redis) {
    return {
      ok: true,
      skipped: true,
      deleted: 0,
      patterns: RETIRED_KEY_PATTERNS,
    };
  }

  const alreadyPurged = await redis.get<string>(PURGE_FLAG_KEY);
  if (alreadyPurged) {
    return {
      ok: true,
      skipped: true,
      deleted: 0,
      patterns: RETIRED_KEY_PATTERNS,
    };
  }

  const keys = new Set<string>();
  for (const pattern of RETIRED_KEY_PATTERNS) {
    let cursor = 0;
    do {
      const result = (await redis.scan(cursor, {
        match: pattern,
        count: 100,
      })) as [number | string, string[]];
      cursor = Number(result[0]);
      for (const key of result[1]) keys.add(key);
    } while (cursor !== 0);
  }

  let deleted = 0;
  for (const key of keys) {
    deleted += Number(await redis.del(key));
  }

  await redis.set(
    PURGE_FLAG_KEY,
    JSON.stringify({ ts: Date.now(), deleted }),
    { ex: PURGE_FLAG_TTL_SECONDS },
  );

  return {
    ok: true,
    skipped: false,
    deleted,
    patterns: RETIRED_KEY_PATTERNS,
  };
}
