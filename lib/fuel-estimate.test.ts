// Run: npx tsx --test lib/fuel-estimate.test.ts

import { test } from "node:test";
import assert from "node:assert";
import {
  estimateFuelRemaining,
  formatFuelRemaining,
  getAircraftFuelProfile,
  normalizeTailNumber,
} from "./fuel-estimate";

test("formatFuelRemaining preserves the required visible prefix and time format", () => {
  assert.equal(formatFuelRemaining(125), "Estimated Fuel remaining - 2 Hours 5 Minutes");
  assert.equal(formatFuelRemaining(60), "Estimated Fuel remaining - 1 Hour 0 Minutes");
  assert.equal(formatFuelRemaining(1), "Estimated Fuel remaining - 0 Hours 1 Minute");
  assert.equal(formatFuelRemaining(0), "Estimated Fuel remaining - 0 Hours 0 Minutes");
});

test("normalizeTailNumber accepts small tail-number formatting differences", () => {
  assert.equal(normalizeTailNumber(" n-305 dk "), "N305DK");
  assert.equal(getAircraftFuelProfile("n305dk")?.category, "fixedWing");
  assert.equal(getAircraftFuelProfile("N00000"), null);
});

test("estimateFuelRemaining hides unknown and grounded aircraft", () => {
  assert.equal(
    estimateFuelRemaining({
      tail: "N00000",
      airborne: true,
      time_aloft_min: 5,
    }),
    null,
  );
  assert.equal(
    estimateFuelRemaining({
      tail: "N305DK",
      airborne: false,
      time_aloft_min: 5,
    }),
    null,
  );
});

test("estimateFuelRemaining clamps exhausted fuel at zero", () => {
  const estimate = estimateFuelRemaining({
    tail: "N305DK",
    airborne: true,
    time_aloft_min: 9999,
  });
  assert.equal(estimate?.label, "Estimated Fuel remaining - 0 Hours 0 Minutes");
});

test("estimateFuelRemaining uses base endurance when current data is sparse", () => {
  const estimate = estimateFuelRemaining({
    tail: "N305DK",
    airborne: true,
    time_aloft_min: 60,
  });
  assert.equal(estimate?.label, "Estimated Fuel remaining - 5 Hours 0 Minutes");
});

test("estimateFuelRemaining preserves known elapsed time when local history is short", () => {
  const estimate = estimateFuelRemaining(
    {
      tail: "N305DK",
      airborne: true,
      time_aloft_min: 60,
      ground_speed_kt: 142,
      altitude_ft: 4000,
      heading: 90,
    },
    1_000_060_000,
    [
      {
        tail: "N305DK",
        timestampMs: 1_000_000_000,
        speedKts: 142,
        altitudeFt: 4000,
        headingDeg: 90,
      },
      {
        tail: "N305DK",
        timestampMs: 1_000_060_000,
        speedKts: 142,
        altitudeFt: 4000,
        headingDeg: 90,
      },
    ],
  );
  assert.equal(estimate?.label, "Estimated Fuel remaining - 5 Hours 0 Minutes");
});
