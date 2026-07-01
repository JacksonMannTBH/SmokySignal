"use client";

import { SS_TOKENS } from "./tokens";

export const DEFAULT_PROXIMITY_NM = 5;

export type ProximityBand = "stop" | "slow" | "watch";

export type ProximityBandInfo = {
  band: ProximityBand;
  label: string;
  color: string;
  severity: number;
};

export function proximityBandForDistance(distanceNm: number): ProximityBandInfo {
  if (distanceNm <= 1) {
    return { band: "stop", label: "STOP", color: SS_TOKENS.danger, severity: 3 };
  }
  if (distanceNm <= 3) {
    return { band: "slow", label: "SLOW", color: SS_TOKENS.warn, severity: 2 };
  }
  return { band: "watch", label: "Watch", color: SS_TOKENS.sky, severity: 1 };
}
