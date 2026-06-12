// Pure types + defaults for the push pipeline. No node:* imports — this
// file is safe for client bundles. Server-only code (KV ops, web-push
// sending) lives in lib/push/store.ts and lib/push/dispatcher.ts.

export type AlertTier = "all" | "alert_only";

/** Server-side mirror of a UserZone — coordinates + radius + label only,
 *  no IDs, no timestamps. The dispatcher matches takeoff coords against
 *  these on the server so a rider's zone list drives push routing. */
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
   * Otherwise an array of hot-zone cell IDs the rider has opted into.
   */
  zones: string[] | "any";
  /**
   * Rider-defined geofences (synced from lib/user-zones.ts). When present
   * + non-empty, the dispatcher matches takeoff coords against these in
   * addition to the predefined `zones` list — predefined OR user match
   * makes the takeoff eligible for that subscriber.
   */
  userZones?: UserZoneSpec[];
  /**
   * Optional per-tail allow-list. When present + non-empty, the dispatcher
   * only fires for takeoffs of these specific tails (after tier filter).
   * Empty / undefined = no tail restriction. Useful for riders who only
   * care about a specific Smokey.
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
