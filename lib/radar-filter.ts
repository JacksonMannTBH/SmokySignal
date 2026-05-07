// Shared radar filter state — operator / tail-set / roles. Lives in
// localStorage under "ss_hotzones_filter" (legacy key kept so existing
// user state survives this refactor) and broadcasts changes via a
// CustomEvent so the heatmap chevron panel and the aircraft marker
// layer stay in sync without a context provider.
//
// Region selection is owned by lib/region-pref.ts — the rider's region
// pref drives /api/hotzones via the region_id param. This filter only
// concerns operator / role / tail filtering inside the chosen region.

export type RadarFilterShowMode = "all" | "smoky" | "operator";

/** Role IDs the rider can multi-select. Mirrors lib/types.ts FleetRole. */
export const FILTERABLE_ROLES = [
  "smokey",
  "patrol",
  "sar",
  "transport",
  "unknown",
] as const;
export type FilterableRole = (typeof FILTERABLE_ROLES)[number];

export type RadarFilter = {
  showMode: RadarFilterShowMode;
  operator: string | null;
  /** Multi-select role allow-list. Empty = show all roles. */
  roles: FilterableRole[];
};

export const RADAR_FILTER_KEY = "ss_hotzones_filter";
export const RADAR_FILTER_CHANGE_EVENT = "ss-radar-filter-change";

/**
 * Roles that count as "Smokey" — speed-enforcement birds. The filter
 * UI labels this "Smokey" because that's the rider mental model; the
 * implementation matches by classified role, NOT a hardcoded tail list,
 * so a new WSP smokey added to the registry is automatically included.
 */
export const SMOKY_FILTER_ROLES = ["smokey", "patrol"] as const;

/**
 * @deprecated Use SMOKY_FILTER_ROLES instead. Retained as an empty
 * array so any prior import compiles, but no longer drives filtering
 * — role-based classification (lib/types.ts FleetRole) is the source
 * of truth.
 */
export const SMOKY_TAILS: readonly string[] = [];
export const OPERATORS = [
  "WSP",
  "KCSO",
  "Pierce SO",
  "Snohomish SO",
  "Spokane SO",
  "State of WA",
] as const;

export const DEFAULT_RADAR_FILTER: RadarFilter = {
  showMode: "all",
  operator: "WSP",
  roles: [],
};

export function readRadarFilter(): RadarFilter {
  if (typeof window === "undefined") return DEFAULT_RADAR_FILTER;
  try {
    const raw = window.localStorage.getItem(RADAR_FILTER_KEY);
    if (!raw) return DEFAULT_RADAR_FILTER;
    const parsed = JSON.parse(raw) as Partial<RadarFilter>;
    return {
      showMode:
        parsed.showMode === "smoky" || parsed.showMode === "operator"
          ? parsed.showMode
          : "all",
      operator:
        typeof parsed.operator === "string" &&
        OPERATORS.includes(parsed.operator as (typeof OPERATORS)[number])
          ? parsed.operator
          : "WSP",
      // roles is new in this shape; missing on prior persisted state →
      // empty array (which means "show all", same behavior as before).
      roles: Array.isArray(parsed.roles)
        ? (parsed.roles.filter((r) =>
            (FILTERABLE_ROLES as readonly string[]).includes(r as string),
          ) as FilterableRole[])
        : [],
    };
  } catch {
    return DEFAULT_RADAR_FILTER;
  }
}

export function writeRadarFilter(f: RadarFilter): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RADAR_FILTER_KEY, JSON.stringify(f));
    window.dispatchEvent(
      new CustomEvent(RADAR_FILTER_CHANGE_EVENT, { detail: f }),
    );
  } catch {
    // best-effort
  }
}

export function passesAircraftFilter(
  aircraft: { tail: string; operator: string; role?: string },
  f: RadarFilter,
): boolean {
  // Multi-select role filter (new). Empty array = no role constraint.
  if (f.roles.length > 0) {
    if (
      typeof aircraft.role !== "string" ||
      !(f.roles as readonly string[]).includes(aircraft.role)
    ) {
      return false;
    }
  }
  // Existing showMode predicate runs after roles. The two compose:
  // role ∈ allow-list AND showMode passes.
  if (f.showMode === "all") return true;
  if (f.showMode === "smoky") {
    return (
      typeof aircraft.role === "string" &&
      (SMOKY_FILTER_ROLES as readonly string[]).includes(aircraft.role)
    );
  }
  if (f.showMode === "operator" && f.operator) {
    return aircraft.operator === f.operator;
  }
  return true;
}
