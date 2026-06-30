import assert from "node:assert/strict";
import { test } from "node:test";
import { averageGroundSpeedKt } from "./flights";
import type { TrackPoint } from "./tracks";

function point(ts: number, spd: number | null): TrackPoint {
  return {
    lat: 47,
    lon: -122,
    alt: null,
    spd,
    trk: null,
    ts,
  };
}

test("averageGroundSpeedKt time-weights consecutive speed samples", () => {
  const avg = averageGroundSpeedKt([
    point(0, 60),
    point(10, 120),
    point(70, 120),
  ]);

  assert.ok(avg != null);
  assert.equal(Math.round(avg), 116);
});

test("averageGroundSpeedKt falls back to sample average for isolated samples", () => {
  const avg = averageGroundSpeedKt([
    point(10, 80),
    point(10, 100),
  ]);

  assert.equal(avg, 90);
});

test("averageGroundSpeedKt ignores missing speeds and returns null when unavailable", () => {
  assert.equal(averageGroundSpeedKt([point(0, null), point(10, null)]), null);
  assert.equal(averageGroundSpeedKt([point(0, 70), point(10, null)]), 70);
});
