import test from "node:test";
import assert from "node:assert/strict";
import {
  CAMPAIGN_LEVEL_COUNT,
  CAMPAIGN_PLATE_SCHEDULE,
  PlateSize,
  campaignPlateSize,
  enumerateHexPlate,
  plateSpec,
} from "../src/index.js";

test("canonical plates are exactly 37, 61, and 91 cells", () => {
  assert.equal(enumerateHexPlate(plateSpec(PlateSize.SMALL).radius).length, 37);
  assert.equal(enumerateHexPlate(plateSpec(PlateSize.MEDIUM).radius).length, 61);
  assert.equal(enumerateHexPlate(plateSpec(PlateSize.LARGE).radius).length, 91);
});

test("campaign plate schedule is the approved 50-level schedule", () => {
  assert.equal(CAMPAIGN_LEVEL_COUNT, 50);
  assert.equal(CAMPAIGN_PLATE_SCHEDULE.length, 50);
  assert.deepEqual(CAMPAIGN_PLATE_SCHEDULE.map((size) => plateSpec(size).cellCount), [
    37,37,37,37,37,37,37,61,37,61,
    37,61,61,37,61,61,37,61,61,61,
    61,61,37,61,61,91,61,37,61,91,
    61,37,61,91,61,61,37,91,61,91,
    61,91,37,61,91,61,37,91,61,91,
  ]);
  assert.equal(campaignPlateSize(0), PlateSize.SMALL);
  assert.equal(campaignPlateSize(49), PlateSize.LARGE);
  assert.throws(() => campaignPlateSize(-1), RangeError);
  assert.throws(() => campaignPlateSize(50), RangeError);
});
