// KV-backed tail registry with seed fallback. Replaces the static FLEET
// import everywhere except seed.ts itself (which stays the source of truth
// for the initial registry shape and the cold-start data).
//
// Storage:
//   registry:tails              → JSON array of FleetEntry
//   registry:tails:backup:{ISO} → JSON array (rolling 5-deep)
//   registry:audit              → list of AuditEntry, capped at 1000
//
// 5-second in-memory cache fronts every read so /api/aircraft (called
// every 10s) doesn't hammer KV.

import { getRedis } from "./cache";
import { FLEET as SEED } from "./seed";
import { isTrackedTail, trackedTailOrder } from "./tracked-tails";
import type { FleetEntry } from "./types";

const REGISTRY_KEY = "registry:tails";
const BACKUP_PREFIX = "registry:tails:backup:";
const BACKUPS_TO_KEEP = 5;
const AUDIT_KEY = "registry:audit";
const AUDIT_TTL_SECONDS = 90 * 24 * 60 * 60;
const AUDIT_LIMIT = 1000;
const MEM_CACHE_MS = 5_000;

let memCache: { value: FleetEntry[]; expiresAt: number } | null = null;

function parseFleet(raw: unknown): FleetEntry[] | null {
  if (raw == null) return null;
  let arr: unknown[] | null = null;
  if (Array.isArray(raw)) arr = raw;
  else if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      arr = Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  if (!arr) return null;
  // Backfill the post-v1 fields (role, roleConfidence, roleDescription) on
  // read so older registry rows continue to work without a manual
  // migration. Conservative default for role is "unknown" → triggers
  // alert pill.
  return arr.map((row) => {
    const e = row as Partial<FleetEntry> & Record<string, unknown>;
    return {
      tail: String(e.tail ?? ""),
      hex: e.hex ?? null,
      operator: String(e.operator ?? ""),
      model: String(e.model ?? ""),
      nickname: (e.nickname as string | null) ?? null,
      base: String(e.base ?? ""),
      // Older rows had a free-text `role` (mission description). Promote
      // it to roleDescription if the new typed field is missing.
      roleDescription:
        typeof e.roleDescription === "string"
          ? e.roleDescription
          : typeof (e as { role?: unknown }).role === "string" &&
              !["smokey", "patrol", "sar", "transport", "unknown"].includes(
                (e as { role: string }).role,
              )
            ? (e as { role: string }).role
            : "—",
      role:
        typeof e.role === "string" &&
        ["smokey", "patrol", "sar", "transport", "unknown"].includes(e.role)
          ? (e.role as FleetEntry["role"])
          : "unknown",
      roleConfidence:
        typeof e.roleConfidence === "string" &&
        ["confirmed", "tentative", "unknown"].includes(e.roleConfidence)
          ? (e.roleConfidence as FleetEntry["roleConfidence"])
          : "unknown",
      roleNote: typeof e.roleNote === "string" ? e.roleNote : undefined,
    } satisfies FleetEntry;
  });
}

export async function getRegistry(): Promise<FleetEntry[]> {
  if (memCache && memCache.expiresAt > Date.now()) return memCache.value;
  const redis = await getRedis();
  let value: FleetEntry[] = SEED;
  if (redis) {
    try {
      const raw = await redis.get(REGISTRY_KEY);
      const parsed = parseFleet(raw);
      if (parsed && parsed.length > 0) value = parsed;
    } catch (e) {
      console.warn("[registry] read failed, using seed:", e);
    }
  }
  value = value
    .filter((entry) => isTrackedTail(entry.tail))
    .sort((a, b) => trackedTailOrder(a.tail) - trackedTailOrder(b.tail));
  memCache = { value, expiresAt: Date.now() + MEM_CACHE_MS };
  return value;
}

export function invalidateRegistryCache(): void {
  memCache = null;
}

export async function saveRegistry(tails: FleetEntry[]): Promise<void> {
  const redis = await getRedis();
  if (!redis) throw new Error("KV not configured — cannot save registry");

  // Snapshot current state into a backup before overwriting.
  const ts = new Date().toISOString();
  const backupKey = `${BACKUP_PREFIX}${ts}`;
  try {
    const current = await redis.get(REGISTRY_KEY);
    if (current != null) {
      const value = typeof current === "string" ? current : JSON.stringify(current);
      await redis.set(backupKey, value);
    }
  } catch (e) {
    console.warn("[registry] backup snapshot failed (continuing):", e);
  }

  await redis.set(REGISTRY_KEY, JSON.stringify(tails));
  await rotateBackups();
  invalidateRegistryCache();
}

async function rotateBackups(): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;
  const keys = await scanKeys(`${BACKUP_PREFIX}*`);
  keys.sort().reverse(); // newest first (ISO timestamps sort lexically)
  const toDelete = keys.slice(BACKUPS_TO_KEEP);
  for (const k of toDelete) {
    try {
      await redis.del(k);
    } catch (e) {
      console.warn(`[registry] failed to delete old backup ${k}:`, e);
    }
  }
}

async function scanKeys(pattern: string): Promise<string[]> {
  const redis = await getRedis();
  if (!redis) return [];
  const keys: string[] = [];
  let cursor: string | number = 0;
  do {
    const result = (await redis.scan(cursor, { match: pattern, count: 100 })) as [
      string | number,
      string[],
    ];
    keys.push(...result[1]);
    cursor = result[0];
  } while (String(cursor) !== "0");
  return keys;
}

export type BackupInfo = {
  key: string;
  timestamp: string;
  tailCount: number;
};

export async function listBackups(): Promise<BackupInfo[]> {
  const redis = await getRedis();
  if (!redis) return [];
  const keys = (await scanKeys(`${BACKUP_PREFIX}*`)).sort().reverse();
  const recent = keys.slice(0, BACKUPS_TO_KEEP);
  const out: BackupInfo[] = [];
  for (const key of recent) {
    let tailCount = 0;
    try {
      const raw = await redis.get(key);
      const parsed = parseFleet(raw);
      tailCount = parsed ? parsed.length : 0;
    } catch {
      /* swallow — show 0 count */
    }
    out.push({
      key,
      timestamp: key.slice(BACKUP_PREFIX.length),
      tailCount,
    });
  }
  return out;
}

export async function restoreBackup(backupKey: string): Promise<FleetEntry[]> {
  const redis = await getRedis();
  if (!redis) throw new Error("KV not configured");
  if (!backupKey.startsWith(BACKUP_PREFIX)) throw new Error("invalid backup key");
  const raw = await redis.get(backupKey);
  const parsed = parseFleet(raw);
  if (!parsed) throw new Error("backup not parseable");
  await saveRegistry(parsed); // saveRegistry snapshots current state before overwriting
  return parsed;
}

// ─── Audit log ─────────────────────────────────────────────────────────────

export type AuditOp = "create" | "update" | "delete" | "restore";

export type AuditEntry = {
  ts: string;
  op: AuditOp;
  tail: string;
  prev: FleetEntry | null;
  next: FleetEntry | null;
};

export async function appendAudit(entry: AuditEntry): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;
  try {
    await redis.rpush(AUDIT_KEY, JSON.stringify(entry));
    await redis.ltrim(AUDIT_KEY, -AUDIT_LIMIT, -1);
    await redis.expire(AUDIT_KEY, AUDIT_TTL_SECONDS);
  } catch (e) {
    console.warn("[registry] audit append failed:", e);
  }
}

export async function getAudit(limit = 20): Promise<AuditEntry[]> {
  const redis = await getRedis();
  if (!redis) return [];
  let raw: unknown[] = [];
  try {
    raw = (await redis.lrange(AUDIT_KEY, -limit, -1)) as unknown[];
  } catch {
    return [];
  }
  return raw
    .map((s) => {
      if (typeof s === "string") {
        try {
          return JSON.parse(s) as AuditEntry;
        } catch {
          return null;
        }
      }
      if (s && typeof s === "object") return s as AuditEntry;
      return null;
    })
    .filter((e): e is AuditEntry => e !== null)
    .reverse();
}
