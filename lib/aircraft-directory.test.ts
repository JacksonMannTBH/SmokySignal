import assert from "node:assert/strict";
import test from "node:test";

import {
  AIRCRAFT_DURATION_MINUTES,
  OPS_AIRCRAFT,
} from "./aircraft-directory";
import { FLEET } from "./seed";
import { isTrackedTail, TRACKED_TAILS } from "./tracked-tails";

test("operational aircraft are tracked and available to flight paths", () => {
  const fleetTails = new Set(FLEET.map((entry) => entry.tail));

  for (const tail of TRACKED_TAILS) {
    assert.equal(
      fleetTails.has(tail),
      true,
      `${tail} should be in FLEET for flight-path enumeration`,
    );
  }

  for (const aircraft of OPS_AIRCRAFT) {
    assert.equal(
      isTrackedTail(aircraft.tail),
      true,
      `${aircraft.tail} should be in TRACKED_TAILS for ADS-B polling`,
    );
    assert.ok(
      (AIRCRAFT_DURATION_MINUTES[aircraft.tail] ?? 0) > 0,
      `${aircraft.tail} should have source duration data`,
    );
  }
});
