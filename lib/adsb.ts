// ADS-B feed adapters: adsb.fi (primary) + OpenSky (fallback).
// Polite usage: bbox query once per refresh, KV-cached upstream.

import { fleetHex } from "./seed";
import { getRegistry } from "./registry";
import { fetchOpenSky } from "./opensky";
import type {
  Aircraft,
  AircraftLive,
  FleetEntry,
  NormalizedAc,
  Snapshot,
} from "./types";

// State-centroid query covers all four corners of Washington within
// ~190 nm. adsb.fi v2 caps the radius at 250 nm (501+ returns HTTP 400),
// so this is the largest single-circle query the API allows. Registry-tail
// filtering downstream drops any non-fleet leakage from BC / OR / ID.
const REGION = {
  lat: Number(process.env.SS_REGION_LAT ?? 47.4),
  lon: Number(process.env.SS_REGION_LON ?? -120.8),
  nm: Number(process.env.SS_REGION_NM ?? 250),
};

// In-memory state across requests — tracks first-seen timestamps so we can
// derive "minutes aloft" without a track-history table yet.
type SeenState = { firstSeenAt: number; lastSeenAt: number };
const seenByIcao = new Map<string, SeenState>();

const FETCH_OPTS: RequestInit = {
  headers: { "User-Agent": "OutOfSight/0.1 (+https://github.com/)" },
  // Avoid Next.js's fetch caching layer — we cache ourselves.
  cache: "no-store",
};

// ─── adsb.fi ───────────────────────────────────────────────────────────────

// Top-level field is `aircraft`, NOT `ac` (adsbexchange uses `ac` —
// don't conflate them). Misreading this field caused every tail to
// classify as airborne:false from launch through 2026-04-30.
type AdsbFiResp = { aircraft?: NormalizedAc[]; now?: number };

async function fetchAdsbFi(): Promise<NormalizedAc[]> {
  const url = `https://opendata.adsb.fi/api/v2/lat/${REGION.lat}/lon/${REGION.lon}/dist/${REGION.nm}`;
  const r = await fetch(url, FETCH_OPTS);
  if (!r.ok) throw new Error(`adsb.fi ${r.status}`);
  const j = (await r.json()) as AdsbFiResp;
  return j.aircraft ?? [];
}

// ─── Normalize + merge ─────────────────────────────────────────────────────

export async function buildSnapshot(): Promise<Snapshot> {
  // Resolve the registry once per snapshot regen — getRegistry caches in
  // memory for 5s so this isn't a hot path on KV.
  const fleet = await getRegistry();
  const fleetByIcao = new Map<string, FleetEntry>();
  for (const f of fleet) {
    const hex = fleetHex(f);
    if (hex) fleetByIcao.set(hex, f);
  }
  const fleetHexes = [...fleetByIcao.keys()];

  let raw: NormalizedAc[] = [];
  let source: Snapshot["source"] = "adsbfi";
  try {
    raw = await fetchAdsbFi();
  } catch (e) {
    console.warn("[adsb] primary failed, falling back to OpenSky:", e);
    try {
      raw = await fetchOpenSky(fleetHexes);
      source = "opensky";
    } catch (e2) {
      console.error("[adsb] both feeds failed:", e2);
      raw = [];
      // Both feeds failed; mark as last-attempted so source stays in the type.
      source = "opensky";
    }
  }

  const now = Date.now();
  const liveByIcao = new Map<string, NormalizedAc>();
  for (const ac of raw) {
    const hex = ac.hex.toLowerCase();
    if (fleetByIcao.has(hex)) liveByIcao.set(hex, ac);
  }

  // Update first-seen state
  for (const [hex, _] of liveByIcao) {
    const prev = seenByIcao.get(hex);
    if (!prev || now - prev.lastSeenAt > 10 * 60 * 1000) {
      // new sighting (or > 10 min gap = treat as a new flight)
      seenByIcao.set(hex, { firstSeenAt: now, lastSeenAt: now });
    } else {
      seenByIcao.set(hex, { ...prev, lastSeenAt: now });
    }
  }

  const aircraft: Aircraft[] = fleet.map((entry) => {
    const hex = fleetHex(entry);
    const ac = liveByIcao.get(hex);
    const seen = seenByIcao.get(hex);

    if (!ac) {
      const last_seen_min = seen
        ? Math.floor((now - seen.lastSeenAt) / 60_000)
        : null;
      const live: AircraftLive = {
        tail: entry.tail,
        icao24: hex,
        airborne: false,
        last_seen_min,
      };
      return { ...entry, ...live };
    }

    const grounded = ac.alt_baro === "ground";
    const time_aloft_min = seen
      ? Math.max(0, Math.floor((now - seen.firstSeenAt) / 60_000))
      : 0;

    const live: AircraftLive = {
      tail: entry.tail,
      icao24: hex,
      airborne: !grounded,
      lat: ac.lat,
      lon: ac.lon,
      altitude_ft:
        typeof ac.alt_baro === "number" ? ac.alt_baro : undefined,
      ground_speed_kt: ac.gs,
      heading: ac.track,
      squawk: ac.squawk ?? null,
      time_aloft_min: grounded ? undefined : time_aloft_min,
      last_seen_min: 0,
    };
    return { ...entry, ...live };
  });

  return {
    fetched_at: now,
    source,
    aircraft,
    live_seen_count: raw.length,
  };
}

export function anyAirborne(snap: Snapshot): boolean {
  return snap.aircraft.some((a) => a.airborne);
}
