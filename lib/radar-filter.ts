// Shared radar filter state — operator / category / tail-set. Lives in
// localStorage under "ss_hotzones_filter" (legacy key kept so existing
// user state survives this refactor) and broadcasts changes via a
// CustomEvent so the heatmap chevron panel and the aircraft marker
// layer stay in sync without a context provider.
//
// Region selection is owned by lib/region-pref.ts — the rider's region
// pref drives /api/hotzones via the region_id param. This filter only
// concerns operator / category / tail filtering inside the chosen region.
//
// Vocabulary alignment: riders see three categories — Smokey, Search &
// Rescue, Transport — that mirror what the role badges say. The backend
// FleetRole taxonomy stays granular (smokey / patrol / unknown all under
// the Smokey umbrella) but never leaks into the filter UI. Persisted
// state from the prior FleetRole-chip era migrates forward in
// readRadarFilter().

export type RadarFilterShowMode = "all" | "smoky" | "operator";

/** Underlying FleetRole IDs. Mirrors lib/types.ts FleetRole. Used by
 *  bucket-to-role expansion when a category set hits the API. */
export const FILTERABLE_ROLES = [
  "smokey",
  "patrol",
  "sar",
  "transport",
  "unknown",
] as const;
export type FilterableRole = (typeof FILTERABLE_ROLES)[number];

/** Rider-facing category buckets. Each bucket maps to one or more
 *  FleetRoles; the LE-tier roles (smokey + patrol + unknown) collapse
 *  into the single "Smokey" bucket to match the umbrella relabel in
 *  lib/role-display.ts. */
export const RIDER_BUCKETS = [
  {
    id: "smokey",
    label: "Smokey",
    roles: ["smokey", "patrol", "unknown"] as readonly FilterableRole[],
  },
  {
    id: "sar",
    label: "Search & Rescue",
    roles: ["sar"] as readonly FilterableRole[],
  },
  {
    id: "transport",
    label: "Transport",
    roles: ["transport"] as readonly FilterableRole[],
  },
] as const;
export type RiderBucketId = (typeof RIDER_BUCKETS)[number]["id"];

const RIDER_BUCKET_IDS: readonly RiderBucketId[] = RIDER_BUCKETS.map(
  (b) => b.id,
);

/** Expand a bucket-id set to the underlying FleetRole list. Empty input
 *  returns empty (caller treats as "no constraint"). Used by the heatmap
 *  query builder to send a comma-separated `roles` to /api/hotzones. */
export function bucketsToRoles(
  buckets: readonly RiderBucketId[],
): FilterableRole[] {
  if (buckets.length === 0) return [];
  const out = new Set<FilterableRole>();
  for (const b of RIDER_BUCKETS) {
    if (buckets.includes(b.id)) {
      for (const r of b.roles) out.add(r);
    }
  }
  return [...out];
}

/** Inverse of bucketsToRoles — derives the bucket set that contains the
 *  given roles. Used to migrate prior persisted state that stored raw
 *  FleetRole arrays. */
function rolesToBuckets(
  roles: readonly FilterableRole[],
): RiderBucketId[] {
  const out = new Set<RiderBucketId>();
  for (const b of RIDER_BUCKETS) {
    if (b.roles.some((r) => roles.includes(r))) out.add(b.id);
  }
  return [...out];
}

export type RadarFilter = {
  showMode: RadarFilterShowMode;
  /** Single-operator selection driven by the "Operator" quick-filter
   *  shortcut. Coordinates with showMode === "operator" — the dropdown
   *  inside the panel mutates this. */
  operator: string | null;
  /** Multi-select category allow-list. Empty = show all categories. */
  buckets: RiderBucketId[];
  /** Multi-select operator allow-list — independent from the showMode
   *  shortcut. Toggled by the per-operator chips in the filter panel.
   *  Empty = no operator constraint. */
  operatorSet: string[];
  /** Multi-select tail allow-list driven by the typeahead picker.
   *  Empty = no tail constraint. */
  tailSet: string[];
};

export const RADAR_FILTER_KEY = "ss_hotzones_filter";
export const RADAR_FILTER_CHANGE_EVENT = "ss-radar-filter-change";

/**
 * Roles that count as "Smokey" — every law-enforcement aircraft. Mirrors
 * the alert-tier set in lib/status.ts: smokey + patrol + unknown all
 * surface to riders under the single Smokey umbrella, so the filter
 * widens to match. The implementation matches by classified role,
 * NOT a hardcoded tail list, so a new fixed-wing smokey added to the
 * registry is automatically included.
 */
export const SMOKY_FILTER_ROLES = ["smokey", "patrol", "unknown"] as const;

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
  "CBP",
  "USCG",
] as const;

export const DEFAULT_RADAR_FILTER: RadarFilter = {
  showMode: "all",
  operator: "WSP",
  buckets: [],
  operatorSet: [],
  tailSet: [],
};

export function readRadarFilter(): RadarFilter {
  if (typeof window === "undefined") return DEFAULT_RADAR_FILTER;
  try {
    const raw = window.localStorage.getItem(RADAR_FILTER_KEY);
    if (!raw) return DEFAULT_RADAR_FILTER;
    const parsed = JSON.parse(raw) as Partial<RadarFilter> & {
      roles?: unknown;
      tails?: unknown;
    };
    let buckets: RiderBucketId[];
    if (Array.isArray(parsed.buckets)) {
      buckets = parsed.buckets.filter((b): b is RiderBucketId =>
        (RIDER_BUCKET_IDS as readonly string[]).includes(b as string),
      );
    } else if (Array.isArray(parsed.roles)) {
      // Migration: prior persisted state stored a `roles` array of raw
      // FleetRole values. Map forward to the bucket containing each role
      // so a returning rider's filter retains its meaning.
      const legacyRoles = (parsed.roles as unknown[]).filter(
        (r): r is FilterableRole =>
          (FILTERABLE_ROLES as readonly string[]).includes(r as string),
      );
      buckets = rolesToBuckets(legacyRoles);
    } else {
      buckets = [];
    }
    const operatorSet = Array.isArray(parsed.operatorSet)
      ? (parsed.operatorSet.filter(
          (o): o is string =>
            typeof o === "string" &&
            OPERATORS.includes(o as (typeof OPERATORS)[number]),
        ) as string[])
      : [];
    // Migration: prior `tails` array carries forward as tailSet.
    const tailSet = Array.isArray(parsed.tailSet)
      ? (parsed.tailSet.filter((t): t is string => typeof t === "string") as string[])
      : Array.isArray(parsed.tails)
        ? ((parsed.tails as unknown[]).filter(
            (t): t is string => typeof t === "string",
          ) as string[])
        : [];
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
      buckets,
      operatorSet,
      tailSet,
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
  // Tail allow-list (most specific) runs first — short-circuit.
  if (f.tailSet.length > 0 && !f.tailSet.includes(aircraft.tail)) return false;
  // Operator allow-list runs alongside the showMode shortcut. The
  // showMode-based "Operator" still uses filter.operator (single); the
  // multi-select chip set is independent and always applies.
  if (f.operatorSet.length > 0 && !f.operatorSet.includes(aircraft.operator)) {
    return false;
  }
  // Multi-select bucket filter. Empty array = no category constraint.
  if (f.buckets.length > 0) {
    const allowed = bucketsToRoles(f.buckets);
    if (
      typeof aircraft.role !== "string" ||
      !(allowed as readonly string[]).includes(aircraft.role)
    ) {
      return false;
    }
  }
  // Existing showMode predicate runs after categories. The two compose:
  // role ∈ allowed-bucket-roles AND showMode passes.
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

// ─── Registry tail cache (client-only) ──────────────────────────────────────
//
// The tail-picker typeahead in FilterPanel needs the list of every
// registry tail + nickname so it can suggest matches. Fetched once from
// /api/aircraft on first call, cached in module scope. /api/aircraft
// already runs to populate the home page so this is usually a cache hit.

export type RegistryTail = {
  tail: string;
  nickname: string | null;
  operator: string;
  role: string;
};

let registryTailsCache: RegistryTail[] | null = null;
let registryTailsPromise: Promise<RegistryTail[]> | null = null;

export async function getRegistryTails(): Promise<RegistryTail[]> {
  if (registryTailsCache) return registryTailsCache;
  if (registryTailsPromise) return registryTailsPromise;
  registryTailsPromise = (async () => {
    try {
      const r = await fetch("/api/aircraft", { cache: "no-store" });
      if (!r.ok) return [];
      const data = (await r.json()) as {
        aircraft: Array<{
          tail: string;
          nickname?: string | null;
          operator: string;
          role: string;
        }>;
      };
      const list: RegistryTail[] = (data.aircraft ?? []).map((a) => ({
        tail: a.tail,
        nickname: a.nickname ?? null,
        operator: a.operator,
        role: a.role,
      }));
      registryTailsCache = list;
      return list;
    } catch {
      return [];
    } finally {
      registryTailsPromise = null;
    }
  })();
  return registryTailsPromise;
}

/** Case-insensitive prefix match across tail + nickname. Returns up to
 *  `cap` suggestions, alpha-sorted by tail. */
export function searchRegistryTails(
  registry: readonly RegistryTail[],
  query: string,
  cap = 8,
): RegistryTail[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const matches = registry.filter((r) => {
    if (r.tail.toLowerCase().includes(q)) return true;
    if (r.nickname && r.nickname.toLowerCase().includes(q)) return true;
    return false;
  });
  matches.sort((a, b) => a.tail.localeCompare(b.tail));
  return matches.slice(0, cap);
}
