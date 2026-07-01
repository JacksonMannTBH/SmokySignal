// Rider-defined geofences. localStorage only (no accounts), with a
// CustomEvent so subscribers stay in sync.

export type UserZone = {
  id: string;
  lat: number;
  lon: number;
  radiusNm: number;
  label: string;
  createdAt: number;
};

const KEY = "ss_user_zones";
export const USER_ZONES_CHANGE_EVENT = "ss-user-zones-change";

function isUserZone(v: unknown): v is UserZone {
  const z = v as Record<string, unknown> | null;
  return (
    !!z &&
    typeof z.id === "string" &&
    typeof z.lat === "number" &&
    typeof z.lon === "number" &&
    typeof z.radiusNm === "number" &&
    typeof z.label === "string" &&
    typeof z.createdAt === "number"
  );
}

export function readUserZones(): UserZone[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isUserZone) : [];
  } catch {
    return [];
  }
}

function writeAll(zones: UserZone[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(zones));
    window.dispatchEvent(
      new CustomEvent<UserZone[]>(USER_ZONES_CHANGE_EVENT, { detail: zones }),
    );
  } catch {
    // best-effort
  }
}


export function addUserZone(input: {
  lat: number;
  lon: number;
  radiusNm: number;
  label: string;
}): UserZone {
  const zone: UserZone = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    ...input,
    createdAt: Date.now(),
  };
  const all = readUserZones();
  all.push(zone);
  writeAll(all);
  return zone;
}

export function removeUserZone(id: string): void {
  writeAll(readUserZones().filter((z) => z.id !== id));
}

export function updateUserZone(
  id: string,
  patch: Partial<Pick<UserZone, "label" | "radiusNm">>,
): void {
  writeAll(
    readUserZones().map((z) => (z.id === id ? { ...z, ...patch } : z)),
  );
}

export function clearUserZones(): void {
  writeAll([]);
}
