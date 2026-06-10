// "How stale is the latest live track sample?" Single source of truth so
// /radar and / can both render a LAST SAMPLE label that flips amber when
// the cron silently dies. Without this, the UI keeps reporting state as
// current even when the live poller has been down for hours.
//
// The writer is logTracks() in lib/tracks.ts (called from the live cron
// on every successful snapshot). The reader is the home + radar pages.

import { cacheGet, cacheSet } from "./cache";

export const LAST_SAMPLE_KEY = "meta:last_sample_ts";
export const STALE_MS = 15 * 60 * 1000; // 15 min — should see a sample every ~60s when healthy

export type Freshness = {
  lastSampleMs: number | null;
  ageMs: number | null;
  isStale: boolean;
};

export async function getFreshness(): Promise<Freshness> {
  try {
    const raw = await cacheGet<string | number>(LAST_SAMPLE_KEY);
    const lastSampleMs =
      typeof raw === "number" ? raw : raw ? Number(raw) : null;
    if (!lastSampleMs || !Number.isFinite(lastSampleMs)) {
      return { lastSampleMs: null, ageMs: null, isStale: false };
    }
    const ageMs = Date.now() - lastSampleMs;
    return { lastSampleMs, ageMs, isStale: ageMs > STALE_MS };
  } catch {
    return { lastSampleMs: null, ageMs: null, isStale: false };
  }
}

/** Best-effort writer. Called from logTracks() on every snapshot. */
export async function recordLastSample(tsMs: number): Promise<void> {
  try {
    await cacheSet(LAST_SAMPLE_KEY, tsMs, 24 * 60 * 60);
  } catch {
    /* best-effort — non-fatal */
  }
}
