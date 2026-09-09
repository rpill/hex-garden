import test from "node:test";
import assert from "node:assert/strict";
import {
  DAILY_ARCHIVE_DAYS,
  dailyArchiveMonthKeys,
  dailyArchiveWindow,
  dailyDateKey,
  dailyWeekKey,
  dailyWeekdayIndex,
  datesForMoscowWeek,
  isDailyArchiveDateAvailable,
  offsetDailyDateKey,
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


test("daily archive window is exactly today plus the previous 89 Moscow calendar dates", () => {
  const window = dailyArchiveWindow("2026-09-09");
  assert.equal(DAILY_ARCHIVE_DAYS, 90);
  assert.equal(window.startDateKey, "2026-06-12");
  assert.equal(window.endDateKey, "2026-09-09");
  assert.equal(window.dateKeys.length, 90);
  assert.equal(window.dateKeys[0], "2026-06-12");
  assert.equal(window.dateKeys.at(-1), "2026-09-09");
});

test("daily archive availability rejects future and older-than-window dates", () => {
  assert.equal(isDailyArchiveDateAvailable("2026-09-09", "2026-06-12"), true);
  assert.equal(isDailyArchiveDateAvailable("2026-09-09", "2026-09-09"), true);
  assert.equal(isDailyArchiveDateAvailable("2026-09-09", "2026-06-11"), false);
  assert.equal(isDailyArchiveDateAvailable("2026-09-09", "2026-09-10"), false);
});

test("daily date offsets cross month and leap boundaries in UTC calendar space", () => {
  assert.equal(offsetDailyDateKey("2026-03-01", -1), "2026-02-28");
  assert.equal(offsetDailyDateKey("2028-03-01", -1), "2028-02-29");
  assert.equal(offsetDailyDateKey("2026-12-31", 1), "2027-01-01");
});

test("daily archive month keys include only months intersecting the rolling window", () => {
  assert.deepEqual(dailyArchiveMonthKeys("2026-09-09"), [
    "2026-06",
    "2026-07",
    "2026-08",
    "2026-09",
  ]);
});
