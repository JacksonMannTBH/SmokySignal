export const AIRCRAFT_PATH_COLORS = [
  "#d55e00",
  "#0072b2",
  "#009e73",
  "#cc79a7",
  "#e69f00",
  "#56b4e9",
  "#7f3c8d",
  "#c1121f",
] as const;

export function aircraftColorIndex(tail: string | null | undefined): number {
  const text = (tail ?? "").toUpperCase();
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash % AIRCRAFT_PATH_COLORS.length;
}

export function aircraftColorForTail(tail: string | null | undefined): string {
  return AIRCRAFT_PATH_COLORS[aircraftColorIndex(tail)]!;
}
