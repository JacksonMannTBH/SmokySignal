export type AircraftVehicleType = "Helicopter" | "Plane";

const HELICOPTER_MODEL_PATTERN =
  /\b(Bell|UH-|Hughes|Eurocopter|Airbus AS|AS350|H125|H135|H145|MD|JetRanger|Iroquois|Dolphin)\b/i;

export function aircraftVehicleType(
  model: string | null | undefined,
): AircraftVehicleType {
  if (!model) return "Plane";
  return HELICOPTER_MODEL_PATTERN.test(model) ? "Helicopter" : "Plane";
}
