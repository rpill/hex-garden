import assert from "node:assert/strict";
import test from "node:test";
import { createDailyArchiveMonth } from "../src/index.js";

const snapshot = {
  version: 1,
  entries: {
    "2026-09-01": { solved: true, clean: false, completedOnTime: true },
    "2026-09-05": { solved: true, clean: true, completedOnTime: false },
  },
  bestSolvedWeek: 2,
  bestCleanWeek: 1,
  bestStreak: 1,
};

test("archive month model uses Monday-first cells and stored solved/clean state", () => {
  const model = createDailyArchiveMonth("2026-09-09", "2026-09", snapshot);
  assert.equal(model.monthKey, "2026-09");
  assert.equal(model.cells.length, 42);

  const sep1 = model.cells.find((cell) => cell?.dateKey === "2026-09-01");
  const sep5 = model.cells.find((cell) => cell?.dateKey === "2026-09-05");
  const sep9 = model.cells.find((cell) => cell?.dateKey === "2026-09-09");
  assert.equal(sep1?.weekdayIndex, 1);
  assert.equal(sep1?.state, "solved");
  assert.equal(sep5?.state, "clean");
  assert.equal(sep9?.today, true);
  assert.equal(sep9?.enabled, true);
});

test("archive month model disables future dates and dates outside the rolling window", () => {
  const september = createDailyArchiveMonth("2026-09-09", "2026-09", snapshot);
  assert.equal(september.cells.find((cell) => cell?.dateKey === "2026-09-10")?.enabled, false);

  const june = createDailyArchiveMonth("2026-09-09", "2026-06", snapshot);
  assert.equal(june.cells.find((cell) => cell?.dateKey === "2026-06-11")?.enabled, false);
  assert.equal(june.cells.find((cell) => cell?.dateKey === "2026-06-12")?.enabled, true);
});

test("archive month paging stops at months intersecting the 90-day window", () => {
  assert.deepEqual(
    createDailyArchiveMonth("2026-09-09", "2026-06", snapshot).previousMonthKey,
    undefined,
  );
  assert.equal(
    createDailyArchiveMonth("2026-09-09", "2026-06", snapshot).nextMonthKey,
    "2026-07",
  );
  assert.equal(
    createDailyArchiveMonth("2026-09-09", "2026-09", snapshot).nextMonthKey,
    undefined,
  );
});
