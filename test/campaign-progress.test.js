import test from "node:test";
import assert from "node:assert/strict";
import {
  CAMPAIGN_PROGRESS_STORAGE_KEY,
  CampaignProgressStore,
  PROGRESSION_LEVEL_COUNT,
  normalizeCampaignProgress,
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

test("only the first campaign level is unlocked initially", () => {
  const store = new CampaignProgressStore({ storage: new MemoryStorage() });
  assert.equal(store.isUnlocked(0), true);
  assert.equal(store.isUnlocked(1), false);
  assert.equal(store.snapshot.highestUnlocked, 0);
  assert.deepEqual(store.snapshot.completedLevels, []);
});

test("completing a level persists and unlocks exactly the next level", () => {
  const storage = new MemoryStorage();
  const firstSession = new CampaignProgressStore({ storage });

  assert.throws(() => firstSession.complete(1), /locked/);
  firstSession.complete(0);
  assert.equal(firstSession.isCompleted(0), true);
  assert.equal(firstSession.isUnlocked(1), true);
  assert.equal(firstSession.isUnlocked(2), false);

  const secondSession = new CampaignProgressStore({ storage });
  assert.equal(secondSession.isCompleted(0), true);
  assert.equal(secondSession.isUnlocked(1), true);
  assert.equal(
    JSON.parse(storage.getItem(CAMPAIGN_PROGRESS_STORAGE_KEY)).version,
    1,
  );
});

test("normalization keeps only a contiguous valid completion prefix", () => {
  assert.deepEqual(
    normalizeCampaignProgress({
      completedLevels: [0, 1, 3, 99, -1, 1, "2"],
    }),
    {
      version: 1,
      completedLevels: [0, 1],
      highestUnlocked: 2,
      campaignCompleted: false,
    },
  );
});

test("finishing level 60 marks the campaign complete without level 61", () => {
  const storage = new MemoryStorage();
  const store = new CampaignProgressStore({ storage });
  for (let level = 0; level < PROGRESSION_LEVEL_COUNT; level += 1) {
    assert.equal(store.isUnlocked(level), true);
    store.complete(level);
  }

  assert.equal(store.snapshot.highestUnlocked, PROGRESSION_LEVEL_COUNT - 1);
  assert.equal(store.snapshot.campaignCompleted, true);
  assert.equal(store.snapshot.completedLevels.length, PROGRESSION_LEVEL_COUNT);
  assert.throws(() => store.isUnlocked(PROGRESSION_LEVEL_COUNT), RangeError);
});

test("invalid browser data falls back to a playable first level", () => {
  const storage = new MemoryStorage();
  storage.setItem(CAMPAIGN_PROGRESS_STORAGE_KEY, "{not json");
  const store = new CampaignProgressStore({ storage });
  assert.equal(store.isUnlocked(0), true);
  assert.equal(store.isUnlocked(1), false);
});
