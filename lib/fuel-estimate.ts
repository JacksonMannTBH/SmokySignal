export type AircraftCategory = "fixedWing" | "helicopter";

export type FuelProfile = {
  usableFuelGal: number;
  baseEnduranceMin: number;
  referenceCruiseKts: number;
  category: AircraftCategory;
};

export type FuelEstimateAircraft = {
  tail?: string | null;
  airborne?: boolean | null;
  altitude_ft?: number | null;
  ground_speed_kt?: number | null;
  heading?: number | null;
  time_aloft_min?: number | null;
};

export type FuelObservation = {
  tail: string;
  timestampMs: number;
  speedKts: number | null;
  altitudeFt: number | null;
  headingDeg: number | null;
};

export type FuelEstimateResult = {
  minutesRemaining: number;
  label: string;
  profile: FuelProfile;
};

export const FUEL_PROFILES: Record<string, FuelProfile> = {
  N102LP: {
    usableFuelGal: 87,
    baseEnduranceMin: 360,
    referenceCruiseKts: 145,
    category: "fixedWing",
  },
  N207HB: {
    usableFuelGal: 544,
    baseEnduranceMin: 390,
    referenceCruiseKts: 290,
    category: "fixedWing",
  },
  N2446X: {
    usableFuelGal: 88,
    baseEnduranceMin: 360,
    referenceCruiseKts: 142,
    category: "fixedWing",
  },
  N305DK: {
    usableFuelGal: 88,
    baseEnduranceMin: 360,
    referenceCruiseKts: 142,
    category: "fixedWing",
  },
  N305RC: {
    usableFuelGal: 87,
    baseEnduranceMin: 360,
    referenceCruiseKts: 145,
    category: "fixedWing",
  },
  N3532K: {
    usableFuelGal: 87,
    baseEnduranceMin: 360,
    referenceCruiseKts: 145,
    category: "fixedWing",
  },
  N407KS: {
    usableFuelGal: 127.8,
    baseEnduranceMin: 240,
    referenceCruiseKts: 133,
    category: "helicopter",
  },
  N411KS: {
    usableFuelGal: 75,
    baseEnduranceMin: 180,
    referenceCruiseKts: 118,
    category: "helicopter",
  },
  N67817: {
    usableFuelGal: 91,
    baseEnduranceMin: 180,
    referenceCruiseKts: 118,
    category: "helicopter",
  },
  N67880: {
    usableFuelGal: 91,
    baseEnduranceMin: 180,
    referenceCruiseKts: 118,
    category: "helicopter",
  },
  N78906: {
    usableFuelGal: 91,
    baseEnduranceMin: 180,
    referenceCruiseKts: 118,
    category: "helicopter",
  },
  N790RJ: {
    usableFuelGal: 206.5,
    baseEnduranceMin: 150,
    referenceCruiseKts: 117,
    category: "helicopter",
  },
  N815SC: {
    usableFuelGal: 206.5,
    baseEnduranceMin: 150,
    referenceCruiseKts: 117,
    category: "helicopter",
  },
  N9446P: {
    usableFuelGal: 87,
    baseEnduranceMin: 264,
    referenceCruiseKts: 161,
    category: "fixedWing",
  },
  N422CT: {
    usableFuelGal: 127.8,
    baseEnduranceMin: 240,
    referenceCruiseKts: 133,
    category: "helicopter",
  },
};

const MAX_OBSERVED_GAP_MS = 10 * 60 * 1000;
const MAX_HISTORY_AGE_MS = 8 * 60 * 60 * 1000;
const RECENT_BURN_WINDOW_MS = 10 * 60 * 1000;

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function normalizeTailNumber(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, "");
  return normalized.length > 0 ? normalized : null;
}

export function getAircraftFuelProfile(
  tailNumber: unknown,
): FuelProfile | null {
  const normalized = normalizeTailNumber(tailNumber);
  if (!normalized) return null;
  return FUEL_PROFILES[normalized] ?? null;
}

export function getBaseBurnGph(profile: FuelProfile): number {
  return profile.usableFuelGal / (profile.baseEnduranceMin / 60);
}

export function getSpeedFactor(
  speedKts: number,
  referenceCruiseKts: number,
  category: AircraftCategory,
): number {
  if (
    !Number.isFinite(speedKts) ||
    speedKts <= 0 ||
    !Number.isFinite(referenceCruiseKts) ||
    referenceCruiseKts <= 0
  ) {
    return 1;
  }
  const ratio = speedKts / referenceCruiseKts;
  if (category === "helicopter") {
    return clamp(
      1 +
        0.45 * Math.max(0, ratio - 1.0) ** 2 +
        0.9 * Math.max(0, 0.7 - ratio) ** 2,
      0.85,
      1.45,
    );
  }
  return clamp(
    1 +
      0.55 * Math.max(0, ratio - 1.0) ** 2 +
      0.4 * Math.max(0, 0.6 - ratio) ** 2,
    0.85,
    1.35,
  );
}

export function getAltitudeFactor(
  altitudeFt: number,
  category: AircraftCategory,
): number {
  if (!Number.isFinite(altitudeFt)) return 1;
  if (category === "helicopter") {
    const referenceAltitudeFt = 1500;
    return clamp(
      1 + 0.015 * ((altitudeFt - referenceAltitudeFt) / 1000),
      0.95,
      1.18,
    );
  }
  const referenceAltitudeFt = 4000;
  return clamp(
    1 - 0.012 * ((altitudeFt - referenceAltitudeFt) / 1000),
    0.9,
    1.1,
  );
}

export function getPhaseFactor(params: {
  verticalRateFpm: number;
  headingChangeDeg: number;
  speedRatio: number;
  category: AircraftCategory;
}): number {
  const { verticalRateFpm, headingChangeDeg, speedRatio, category } = params;
  const isHelicopter = category === "helicopter";
  if (Number.isFinite(verticalRateFpm) && verticalRateFpm > 300) {
    return isHelicopter ? 1.25 : 1.18;
  }
  if (Number.isFinite(verticalRateFpm) && verticalRateFpm < -300) {
    return isHelicopter ? 0.8 : 0.75;
  }
  const isLoitering =
    Number.isFinite(headingChangeDeg) &&
    Number.isFinite(speedRatio) &&
    headingChangeDeg > 45 &&
    speedRatio < 0.75;
  if (isLoitering) return isHelicopter ? 1.2 : 1.08;
  return 1;
}

export function getAdjustedBurnGph(params: {
  profile: FuelProfile;
  speedKts: number;
  altitudeFt: number;
  verticalRateFpm?: number;
  headingChangeDeg?: number;
}): number {
  const { profile, speedKts, altitudeFt } = params;
  const baseBurnGph = getBaseBurnGph(profile);
  const speed = safeNumber(speedKts) ?? profile.referenceCruiseKts;
  const altitude = safeNumber(altitudeFt) ?? referenceAltitudeFt(profile.category);
  const speedRatio = speed / profile.referenceCruiseKts;
  const raw =
    baseBurnGph *
    getSpeedFactor(speed, profile.referenceCruiseKts, profile.category) *
    getAltitudeFactor(altitude, profile.category) *
    getPhaseFactor({
      verticalRateFpm: safeNumber(params.verticalRateFpm) ?? Number.NaN,
      headingChangeDeg: safeNumber(params.headingChangeDeg) ?? Number.NaN,
      speedRatio,
      category: profile.category,
    });
  return clamp(raw, baseBurnGph * 0.65, baseBurnGph * 1.6);
}

export function formatFuelRemaining(totalMinutes: number): string {
  const safeMinutes = Math.max(0, Math.floor(safeNumber(totalMinutes) ?? 0));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  const hourLabel = hours === 1 ? "Hour" : "Hours";
  const minuteLabel = minutes === 1 ? "Minute" : "Minutes";
  return `Estimated Fuel remaining - ${hours} ${hourLabel} ${minutes} ${minuteLabel}`;
}

export function updateFuelObservationHistory(
  store: Map<string, FuelObservation[]>,
  aircraft: FuelEstimateAircraft[],
  timestampMs = Date.now(),
): void {
  const now = normalizeTimestampMs(timestampMs) ?? Date.now();
  const activeTails = new Set<string>();

  for (const plane of aircraft) {
    const tail = normalizeTailNumber(plane.tail);
    if (!tail) continue;
    if (!isAircraftAirborne(plane)) {
      store.delete(tail);
      continue;
    }

    activeTails.add(tail);
    const prev = store.get(tail) ?? [];
    const last = prev[prev.length - 1];
    const observation: FuelObservation = {
      tail,
      timestampMs: now,
      speedKts: safeNumber(plane.ground_speed_kt),
      altitudeFt: safeNumber(plane.altitude_ft),
      headingDeg: safeNumber(plane.heading),
    };

    const points =
      last && now - last.timestampMs > MAX_OBSERVED_GAP_MS
        ? []
        : prev.filter((p) => now - p.timestampMs <= MAX_HISTORY_AGE_MS);

    if (!last || now > last.timestampMs) {
      points.push(observation);
    }
    store.set(tail, points);
  }

  for (const [tail, points] of store) {
    const last = points[points.length - 1];
    if (!activeTails.has(tail) || !last || now - last.timestampMs > MAX_OBSERVED_GAP_MS) {
      store.delete(tail);
    }
  }
}

export function estimateFuelRemaining(
  aircraft: FuelEstimateAircraft,
  now = Date.now(),
  history: FuelObservation[] = [],
): FuelEstimateResult | null {
  const profile = getAircraftFuelProfile(aircraft.tail);
  if (!profile) return null;
  if (!isAircraftAirborne(aircraft)) return null;

  const timestampMs = normalizeTimestampMs(now) ?? Date.now();
  const baseBurnGph = getBaseBurnGph(profile);
  const currentBurnGph = getAdjustedBurnGph({
    profile,
    speedKts: safeNumber(aircraft.ground_speed_kt) ?? profile.referenceCruiseKts,
    altitudeFt: safeNumber(aircraft.altitude_ft) ?? referenceAltitudeFt(profile.category),
  });
  const currentTail = normalizeTailNumber(aircraft.tail);
  const points = history
    .filter((point) => point.tail === currentTail)
    .sort((a, b) => a.timestampMs - b.timestampMs);

  const segmented = estimateFromSegments(profile, points, timestampMs);
  const fuelBurnedGal =
    segmented != null
      ? segmented.fuelBurnedGal +
        estimatePreHistoryFuelBurnedGal(aircraft, points, baseBurnGph)
      : estimateFallbackFuelBurnedGal(aircraft, points, baseBurnGph, timestampMs);
  if (fuelBurnedGal == null) return null;

  const recentBurnGph = segmented?.recentBurnGph ?? currentBurnGph ?? baseBurnGph;
  if (!Number.isFinite(recentBurnGph) || recentBurnGph <= 0) return null;

  const remainingGal = clamp(
    profile.usableFuelGal - fuelBurnedGal,
    0,
    profile.usableFuelGal,
  );
  const minutesRemaining = clamp(
    (remainingGal / recentBurnGph) * 60,
    0,
    profile.baseEnduranceMin,
  );

  return {
    minutesRemaining,
    label: formatFuelRemaining(minutesRemaining),
    profile,
  };
}

function estimateFromSegments(
  profile: FuelProfile,
  points: FuelObservation[],
  now: number,
): { fuelBurnedGal: number; recentBurnGph: number } | null {
  if (points.length < 2) return null;

  let fuelBurnedGal = 0;
  let lastBurnGph: number | null = null;
  let recentFuelBurnedGal = 0;
  let recentElapsedHours = 0;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const curr = points[i]!;
    const elapsedMs = curr.timestampMs - prev.timestampMs;
    if (elapsedMs <= 0 || elapsedMs > MAX_OBSERVED_GAP_MS) continue;

    const elapsedHours = elapsedMs / 60 / 60 / 1000;
    const elapsedMinutes = elapsedMs / 60 / 1000;
    const speedKts = averageNumber(
      prev.speedKts,
      curr.speedKts,
      profile.referenceCruiseKts,
    );
    const altitudeFt = averageNumber(
      prev.altitudeFt,
      curr.altitudeFt,
      referenceAltitudeFt(profile.category),
    );
    const verticalRateFpm =
      prev.altitudeFt != null && curr.altitudeFt != null
        ? (curr.altitudeFt - prev.altitudeFt) / elapsedMinutes
        : Number.NaN;
    const headingChangeDeg =
      prev.headingDeg != null && curr.headingDeg != null
        ? headingDeltaDeg(prev.headingDeg, curr.headingDeg)
        : Number.NaN;
    const burnGph = getAdjustedBurnGph({
      profile,
      speedKts,
      altitudeFt,
      verticalRateFpm,
      headingChangeDeg,
    });
    const segmentBurnGal = burnGph * elapsedHours;
    fuelBurnedGal += segmentBurnGal;
    lastBurnGph = burnGph;

    if (curr.timestampMs >= now - RECENT_BURN_WINDOW_MS) {
      recentFuelBurnedGal += segmentBurnGal;
      recentElapsedHours += elapsedHours;
    }
  }

  if (!Number.isFinite(fuelBurnedGal)) return null;
  const recentBurnGph =
    recentElapsedHours > 0
      ? recentFuelBurnedGal / recentElapsedHours
      : lastBurnGph ?? getBaseBurnGph(profile);
  return { fuelBurnedGal, recentBurnGph };
}

function estimateFallbackFuelBurnedGal(
  aircraft: FuelEstimateAircraft,
  points: FuelObservation[],
  baseBurnGph: number,
  now: number,
): number | null {
  const explicitElapsed = safeNumber(aircraft.time_aloft_min);
  const observedElapsed =
    points.length > 0 ? Math.max(0, (now - points[0]!.timestampMs) / 60_000) : null;
  const elapsedMinutes = explicitElapsed ?? observedElapsed;
  if (elapsedMinutes == null || elapsedMinutes < 0) return null;
  return baseBurnGph * (elapsedMinutes / 60);
}

function estimatePreHistoryFuelBurnedGal(
  aircraft: FuelEstimateAircraft,
  points: FuelObservation[],
  baseBurnGph: number,
): number {
  const explicitElapsed = safeNumber(aircraft.time_aloft_min);
  const first = points[0];
  const last = points[points.length - 1];
  if (explicitElapsed == null || !first || !last) return 0;
  const observedHistoryMinutes = Math.max(
    0,
    (last.timestampMs - first.timestampMs) / 60_000,
  );
  const preHistoryMinutes = Math.max(0, explicitElapsed - observedHistoryMinutes);
  return baseBurnGph * (preHistoryMinutes / 60);
}

function safeNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeTimestampMs(value: unknown): number | null {
  const n = safeNumber(value);
  if (n == null || n <= 0) return null;
  return n < 10_000_000_000 ? n * 1000 : n;
}

function isAircraftAirborne(aircraft: FuelEstimateAircraft): boolean {
  if (aircraft.airborne === true) return true;
  if (aircraft.airborne === false) return false;
  const altitudeFt = safeNumber(aircraft.altitude_ft);
  const speedKts = safeNumber(aircraft.ground_speed_kt);
  return (altitudeFt != null && altitudeFt > 0) || (speedKts != null && speedKts > 30);
}

function referenceAltitudeFt(category: AircraftCategory): number {
  return category === "helicopter" ? 1500 : 4000;
}

function averageNumber(
  a: number | null,
  b: number | null,
  fallback: number,
): number {
  if (a != null && b != null) return (a + b) / 2;
  if (a != null) return a;
  if (b != null) return b;
  return fallback;
}

function headingDeltaDeg(a: number, b: number): number {
  const delta = Math.abs((((b - a) % 360) + 540) % 360 - 180);
  return Number.isFinite(delta) ? delta : Number.NaN;
}
