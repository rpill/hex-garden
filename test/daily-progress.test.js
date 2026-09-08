import test from "node:test";
import assert from "node:assert/strict";
import {
  DAILY_PROGRESS_STORAGE_KEY,
  DailyProgressStore,
  normalizeDailyProgress,
} from "../src/index.js";

class MemoryStorage {
  values = new Map();

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

test("daily progress persists solved and upgrades the same date to clean without downgrade", () => {
  assert.equal(DAILY_PROGRESS_STORAGE_KEY, "garden-js.daily-progress.v1");
  const storage = new MemoryStorage();
  const first = new DailyProgressStore({ storage });

  first.markSolved("2026-09-08", { clean: false });
  assert.deepEqual(first.snapshot.entries["2026-09-08"], { solved: true, clean: false });

  first.markSolved("2026-09-08", { clean: true });
  first.markSolved("2026-09-08", { clean: false });
  assert.deepEqual(first.snapshot.entries["2026-09-08"], { solved: true, clean: true });

  const reloaded = new DailyProgressStore({ storage });
  assert.deepEqual(reloaded.snapshot.entries["2026-09-08"], { solved: true, clean: true });
});

test("week summary returns Monday through Sunday states and solved/clean totals", () => {
  const store = new DailyProgressStore({ storage: new MemoryStorage() });
  store.markSolved("2026-09-07", { clean: false }); // Monday
  store.markSolved("2026-09-09", { clean: true });  // Wednesday
  store.markSolved("2026-09-13", { clean: false }); // Sunday

  assert.deepEqual(store.weekSummary("2026-09-10"), {
    weekKey: "2026-09-07",
    days: [
      { dateKey: "2026-09-07", state: "solved" },
      { dateKey: "2026-09-08", state: "missing" },
      { dateKey: "2026-09-09", state: "clean" },
      { dateKey: "2026-09-10", state: "missing" },
      { dateKey: "2026-09-11", state: "missing" },
      { dateKey: "2026-09-12", state: "missing" },
      { dateKey: "2026-09-13", state: "solved" },
    ],
    solvedCount: 3,
    cleanCount: 1,
  });
});

test("best weekly aggregates survive pruning of old daily entries", () => {
  const storage = new MemoryStorage();
  const store = new DailyProgressStore({ storage });

  // Historic Monday-Sunday week with five clean clears.
  for (let day = 5; day <= 11; day += 1) {
    store.markSolved(`2026-01-${String(day).padStart(2, "0")}`, { clean: day <= 9 });
  }

  // Add 90 newer entries so the historic week must be pruned.
  const start = new Date("2026-03-01T00:00:00Z");
  let lastKey = "";
  for (let index = 0; index < 90; index += 1) {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    lastKey = date.toISOString().slice(0, 10);
    store.markSolved(lastKey, { clean: index % 3 === 0 });
  }

  store.prune(lastKey);
  const snapshot = store.snapshot;
  assert.equal(Object.keys(snapshot.entries).length, 90);
  assert.equal(snapshot.entries["2026-01-05"], undefined);
  assert.equal(snapshot.bestSolvedWeek, 7);
  assert.equal(snapshot.bestCleanWeek, 5);

  const reloaded = new DailyProgressStore({ storage });
  assert.equal(Object.keys(reloaded.snapshot.entries).length, 90);
  assert.equal(reloaded.snapshot.bestSolvedWeek, 7);
  assert.equal(reloaded.snapshot.bestCleanWeek, 5);
});

test("normalization rejects malformed entries and preserves valid aggregate bests", () => {
  assert.deepEqual(
    normalizeDailyProgress({
      version: 1,
      entries: {
        "2026-09-08": { solved: true, clean: false },
        "2026-09-09": { solved: true, clean: true },
        "not-a-date": { solved: true, clean: true },
        "2026-09-10": { solved: false, clean: true },
      },
      bestSolvedWeek: 6,
      bestCleanWeek: 4,
    }),
    {
      version: 1,
      entries: {
        "2026-09-08": { solved: true, clean: false },
        "2026-09-09": { solved: true, clean: true },
      },
      bestSolvedWeek: 6,
      bestCleanWeek: 4,
    },
  );
});
