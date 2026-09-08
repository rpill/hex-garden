import test from "node:test";
import assert from "node:assert/strict";
import {
  dailyDateKey,
  dailyWeekKey,
  dailyWeekdayIndex,
  datesForMoscowWeek,
} from "../src/index.js";

test("daily boundary is midnight Moscow", () => {
  assert.equal(dailyDateKey(new Date("2026-09-07T20:59:59Z")), "2026-09-07");
  assert.equal(dailyDateKey(new Date("2026-09-07T21:00:00Z")), "2026-09-08");
});

test("Moscow week indexes Monday as zero", () => {
  assert.equal(dailyWeekdayIndex(new Date("2026-09-07T12:00:00Z")), 0);
  assert.equal(dailyWeekdayIndex(new Date("2026-09-13T12:00:00Z")), 6);
});

test("week key is the Moscow Monday date and changes at local Monday midnight", () => {
  assert.equal(dailyWeekKey(new Date("2026-09-13T20:59:59Z")), "2026-09-07");
  assert.equal(dailyWeekKey(new Date("2026-09-13T21:00:00Z")), "2026-09-14");
});

test("current Moscow week enumerates Monday through Sunday date keys", () => {
  assert.deepEqual(datesForMoscowWeek(new Date("2026-09-08T12:00:00Z")), [
    "2026-09-07",
    "2026-09-08",
    "2026-09-09",
    "2026-09-10",
    "2026-09-11",
    "2026-09-12",
    "2026-09-13",
  ]);
});
