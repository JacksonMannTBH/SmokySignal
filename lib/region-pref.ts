// Localstorage-backed rider region preference. No accounts, no
// server state. Other client components react to changes via the
// "ss-region-change" CustomEvent.

"use client";

import { DEFAULT_REGION, REGIONS, type RegionId } from "./regions";
import {
  getStoredAircraftAlertRangeNm,
  syncAircraftAlertPreferences,
} from "./aircraft-alerts/client";

const KEY = "ss_region_pref";
export const REGION_CHANGE_EVENT = "ss-region-change";

// Retired region IDs map forward to their current equivalents. Pierce +
// Snohomish were folded into Puget Sound in P16.3; Spokane was folded
// into East WA. Returning riders with persisted legacy values get
// transparently migrated on read.
const LEGACY_MAP: Record<string, RegionId> = {
  pierce: "wa_puget_sound",
  snohomish: "wa_puget_sound",
  spokane: "wa_east",
  puget_sound: "wa_puget_sound",
  north_sound: "wa_puget_sound",
  olympic: "wa_olympic",
  sw_wa: "wa_sw",
  central_wa: "wa_central",
  east_wa: "wa_east",
  all_wa: "wa_puget_sound",
};

export function getRegion(): RegionId {
  if (typeof window === "undefined") return DEFAULT_REGION;
  try {
    const v = window.localStorage.getItem(KEY);
    if (!v) return DEFAULT_REGION;
    if (v in REGIONS) return v as RegionId;
    if (v in LEGACY_MAP) return LEGACY_MAP[v]!;
    return DEFAULT_REGION;
  } catch {
    return DEFAULT_REGION;
  }
}

/**
 * Whether the rider has explicitly picked a region. Drives the radar's
 * geolocation auto-pick: if false on first /radar load, the auto-pick
 * runs against rider position; if true, we respect their choice even
 * if a different bbox would otherwise match.
 *
 * Returns false on SSR (no window) and on any localStorage error.
 */
export function hasExplicitRegion(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) != null;
  } catch {
    return false;
  }
}

export function setRegion(id: RegionId): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, id);
    void syncAircraftAlertPreferences({
      regionId: id,
      proximityRangeNm: getStoredAircraftAlertRangeNm(),
    });
    window.dispatchEvent(
      new CustomEvent(REGION_CHANGE_EVENT, { detail: { id } }),
    );
  } catch {
    /* localStorage may be disabled in some contexts (private mode) */
  }
}
