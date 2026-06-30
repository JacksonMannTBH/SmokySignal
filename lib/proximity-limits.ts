export const STATUTE_MILES_PER_NM = 1.150779;
export const REGION_PROXIMITY_MIN_MI = 1;
export const REGION_PROXIMITY_MAX_MI = 150;

function round(value: number, precision: number): number {
  const scale = 10 ** precision;
  return Math.round(value * scale) / scale;
}

export function statuteMilesToNm(miles: number): number {
  return miles / STATUTE_MILES_PER_NM;
}

export function nmToStatuteMiles(nm: number): number {
  return nm * STATUTE_MILES_PER_NM;
}

export function clampRegionProximityMiles(miles: number): number {
  return round(
    Math.max(REGION_PROXIMITY_MIN_MI, Math.min(REGION_PROXIMITY_MAX_MI, miles)),
    1,
  );
}

export function clampRegionProximityNm(nm: number): number {
  const miles = clampRegionProximityMiles(nmToStatuteMiles(nm));
  return round(statuteMilesToNm(miles), 3);
}
