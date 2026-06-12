import { haversineNm } from "./geo";
import type { Aircraft, FleetRole } from "./types";

export type RideStatus = "clear" | "watch" | "warning" | "danger";

export type RideContact = {
  plane: Aircraft;
  distanceNm: number;
  bearingDeg: number;
  relativeBearingDeg: number | null;
  cardinal: string;
};

export const RIDE_ALERT_ROLES: ReadonlySet<FleetRole> = new Set([
  "smokey",
  "patrol",
  "unknown",
]);

export function normalizeDeg(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

export function bearingDeg(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
): number {
  const fromPhi = (fromLat * Math.PI) / 180;
  const toPhi = (toLat * Math.PI) / 180;
  const deltaLambda = ((toLon - fromLon) * Math.PI) / 180;
  const y = Math.sin(deltaLambda) * Math.cos(toPhi);
  const x =
    Math.cos(fromPhi) * Math.sin(toPhi) -
    Math.sin(fromPhi) * Math.cos(toPhi) * Math.cos(deltaLambda);
  return normalizeDeg((Math.atan2(y, x) * 180) / Math.PI);
}

export function relativeBearingDeg(
  aircraftBearingDeg: number,
  riderHeadingDeg: number,
): number {
  return normalizeDeg(aircraftBearingDeg - riderHeadingDeg);
}

export function cardinalFromDeg(degrees: number): string {
  const labels = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const index = Math.round(normalizeDeg(degrees) / 45) % labels.length;
  return labels[index]!;
}

export function classifyRideStatus(distanceNm: number | null): RideStatus {
  if (distanceNm == null || distanceNm > 5) return "clear";
  if (distanceNm <= 1) return "danger";
  if (distanceNm <= 3) return "warning";
  return "watch";
}

export function rideStatusSeverity(status: RideStatus): number {
  switch (status) {
    case "danger":
      return 3;
    case "warning":
      return 2;
    case "watch":
      return 1;
    case "clear":
      return 0;
  }
}

export function isRideRelevantAircraft(
  aircraft: Aircraft,
  alertOnly = true,
): boolean {
  if (!alertOnly) return true;
  return RIDE_ALERT_ROLES.has(aircraft.role);
}

export function getRideContacts(
  aircraft: Aircraft[],
  rider: { lat: number; lon: number },
  riderHeadingDeg: number | null = null,
  alertOnly = true,
): RideContact[] {
  const contacts: RideContact[] = [];
  for (const plane of aircraft) {
    if (plane.lat == null || plane.lon == null) continue;
    if (plane.airborne === false) continue;
    if (!isRideRelevantAircraft(plane, alertOnly)) continue;
    const bearing = bearingDeg(rider.lat, rider.lon, plane.lat, plane.lon);
    contacts.push({
      plane,
      distanceNm: haversineNm(rider.lat, rider.lon, plane.lat, plane.lon),
      bearingDeg: bearing,
      relativeBearingDeg:
        riderHeadingDeg == null ? null : relativeBearingDeg(bearing, riderHeadingDeg),
      cardinal: cardinalFromDeg(bearing),
    });
  }
  contacts.sort((a, b) => a.distanceNm - b.distanceNm);
  return contacts;
}
