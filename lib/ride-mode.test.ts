// Run: npx tsx --test lib/ride-mode.test.ts

import { test } from "node:test";
import assert from "node:assert";
import {
  bearingDeg,
  cardinalFromDeg,
  classifyRideStatus,
  relativeBearingDeg,
} from "./ride-mode";

function assertAbout(actual: number, expected: number, tolerance = 0.5) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

test("bearingDeg returns true-north clockwise bearings", () => {
  assertAbout(bearingDeg(47, -122, 48, -122), 0);
  assertAbout(bearingDeg(47, -122, 47, -121), 90);
  assertAbout(bearingDeg(47, -122, 46, -122), 180);
  assertAbout(bearingDeg(47, -122, 47, -123), 270);
});

test("relativeBearingDeg normalizes aircraft bearing against rider heading", () => {
  assert.equal(relativeBearingDeg(90, 0), 90);
  assert.equal(relativeBearingDeg(90, 90), 0);
  assert.equal(relativeBearingDeg(350, 10), 340);
  assert.equal(relativeBearingDeg(10, 350), 20);
});

test("cardinalFromDeg returns eight-way direction labels", () => {
  assert.equal(cardinalFromDeg(0), "N");
  assert.equal(cardinalFromDeg(45), "NE");
  assert.equal(cardinalFromDeg(90), "E");
  assert.equal(cardinalFromDeg(135), "SE");
  assert.equal(cardinalFromDeg(180), "S");
  assert.equal(cardinalFromDeg(225), "SW");
  assert.equal(cardinalFromDeg(270), "W");
  assert.equal(cardinalFromDeg(315), "NW");
});

test("classifyRideStatus follows ride-mode distance thresholds", () => {
  assert.equal(classifyRideStatus(null), "clear");
  assert.equal(classifyRideStatus(5.1), "clear");
  assert.equal(classifyRideStatus(5), "watch");
  assert.equal(classifyRideStatus(3.1), "watch");
  assert.equal(classifyRideStatus(3), "warning");
  assert.equal(classifyRideStatus(1.1), "warning");
  assert.equal(classifyRideStatus(1), "danger");
  assert.equal(classifyRideStatus(0.5), "danger");
});
