// Pure types + defaults for the push pipeline. No node:* imports — this
// file is safe for client bundles. Server-only code (KV ops, web-push
// sending) lives in lib/push/store.ts and lib/push/dispatcher.ts.

export type AlertTier = "all" | "alert_only";

/** Legacy server-side mirror of a UserZone. Proximity alerts now resolve
 *  from region_id + proximity_nm instead of these coordinates. */
export type UserZoneSpec = {
  lat: number;
  lon: number;
  radiusNm: number;
  label: string;
};

export type AlertPrefs = {
  /**
   * 'alert_only' (default) → only fire pushes for smokey + patrol + unknown
   * (matches computeStatus() alert tiers). 'all' also fires for sar +
   * transport so curious riders can hear about every wing in the air.
   */
  tier: AlertTier;
  /**
   * 'any' → push for any qualifying takeoff regardless of where it happens.
   * Other values are legacy zone IDs kept only so old subscriptions parse.
   */
  zones: string[] | "any";
  /** Legacy rider-defined geofences. Kept for compatibility with existing
   * subscriptions; region proximity does not read these coordinates. */
  userZones?: UserZoneSpec[];
  /** Selected app region id. Used by cron to know which regions to refresh. */
  region_id?: string;
  /** Whether background proximity notifications are armed for this sub. */
  proximity_enabled?: boolean;
  /** Radius used by the region-center geofence, stored internally in nautical miles. */
  proximity_nm?: number;
  /**
   * Optional per-tail allow-list. When present + non-empty, the dispatcher
   * only fires for takeoffs of these specific tails (after tier filter).
   * Empty / undefined = no tail restriction. Useful for riders who only
   * care about a specific Bird.
   */
  tails?: string[];
  /** Rider-local hour at which quiet hours START (24-hour, 0-23). */
  quiet_start_h: number;
  /** Rider-local hour at which quiet hours END (24-hour, 0-23). */
  quiet_end_h: number;
  /** IANA TZ name; rider browser supplies it via Intl.DateTimeFormat. */
  tz: string;
};

export const DEFAULT_PREFS: AlertPrefs = {
  tier: "all",
  zones: "any",
  quiet_start_h: 23,
  quiet_end_h: 6,
  tz: "America/Los_Angeles",
};

export type StoredSubscription = {
  id: string;
  sub: PushSubscriptionJSON;
  prefs: AlertPrefs;
  savedAt: number;
};
