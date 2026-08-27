import test from "node:test";
import assert from "node:assert/strict";
import {
  CAMPAIGN_PROGRESS_STORAGE_KEY,
  CampaignProgressStore,
  PROGRESSION_LEVEL_COUNT,
  normalizeCampaignProgress,
} from "../src/index.js";
import { isCampaignTestMode } from "../src/game/campaign-test-mode.js";

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
  assert.equal(store.snapshot.tutorialCompleted, false);
  assert.equal(store.isUnlocked(0), true);
  assert.equal(store.isUnlocked(1), false);
  assert.equal(store.snapshot.highestUnlocked, 0);
  assert.deepEqual(store.snapshot.completedLevels, []);
  assert.equal(store.snapshot.campaignScore, 0);
});

test("completing a level persists and unlocks exactly the next level", () => {
  const storage = new MemoryStorage();
  const firstSession = new CampaignProgressStore({ storage });

  assert.throws(() => firstSession.complete(1), /locked/);
  firstSession.complete(0, { score: 1234 });
  assert.equal(firstSession.isCompleted(0), true);
  assert.equal(firstSession.isUnlocked(1), true);
  assert.equal(firstSession.isUnlocked(2), false);
  assert.equal(firstSession.snapshot.tutorialCompleted, true);
  assert.equal(firstSession.snapshot.campaignScore, 1234);
  assert.equal(firstSession.snapshot.levelScores[0], 1234);
  firstSession.complete(0, { score: 999999 });
  assert.equal(firstSession.snapshot.campaignScore, 1234);
  assert.equal(firstSession.snapshot.levelScores[0], 1234);

  const secondSession = new CampaignProgressStore({ storage });
  assert.equal(secondSession.isCompleted(0), true);
  assert.equal(secondSession.isUnlocked(1), true);
  assert.equal(secondSession.snapshot.campaignScore, 1234);
  assert.equal(
    JSON.parse(storage.getItem(CAMPAIGN_PROGRESS_STORAGE_KEY)).version,
    2,
  );
});

test("normalization keeps only a contiguous valid completion prefix", () => {
  assert.deepEqual(
    normalizeCampaignProgress({
      completedLevels: [0, 1, 3, 99, -1, 1, "2"],
    }),
    {
      version: 2,
      tutorialCompleted: true,
      completedLevels: [0, 1],
      levelScores: Array(PROGRESSION_LEVEL_COUNT).fill(0),
      campaignScore: 0,
      highestUnlocked: 2,
      campaignCompleted: false,
    },
  );
});

test("normalization migrates old progress and keeps only valid completed scores", () => {
  const normalized = normalizeCampaignProgress({
    version: 1,
    completedLevels: [0, 1],
    levelScores: [1200, 1400, 9999],
  });
  assert.deepEqual(normalized.levelScores.slice(0, 3), [1200, 1400, 0]);
  assert.equal(normalized.campaignScore, 2600);
  assert.equal(normalized.version, 2);
});

test("a migrated completed level can record its missing score exactly once", () => {
  const storage = new MemoryStorage();
  storage.setItem(
    CAMPAIGN_PROGRESS_STORAGE_KEY,
    JSON.stringify({ version: 1, completedLevels: [0] }),
  );
  const store = new CampaignProgressStore({ storage });
  assert.equal(store.snapshot.campaignScore, 0);

  store.complete(0, { score: 1250 });
  assert.equal(store.snapshot.campaignScore, 1250);
  store.complete(0, { score: 9999 });
  assert.equal(store.snapshot.campaignScore, 1250);
});

test("tutorial completion persists without completing campaign level 1", () => {
  const storage = new MemoryStorage();
  const firstSession = new CampaignProgressStore({ storage });

  firstSession.completeTutorial();
  assert.equal(firstSession.snapshot.tutorialCompleted, true);
  assert.deepEqual(firstSession.snapshot.completedLevels, []);
  assert.equal(firstSession.snapshot.campaignScore, 0);

  const secondSession = new CampaignProgressStore({ storage });
  assert.equal(secondSession.snapshot.tutorialCompleted, true);
  assert.equal(secondSession.isUnlocked(0), true);
  assert.equal(secondSession.isUnlocked(1), false);
});

test("finishing the final level marks the campaign complete without padding", () => {
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

test("test URL unlocks every level without touching persistent progress", () => {
  assert.equal(isCampaignTestMode("?test=all"), true);
  assert.equal(isCampaignTestMode("?test=campaign"), false);
  assert.equal(isCampaignTestMode(""), false);

  const storage = new MemoryStorage();
  const store = new CampaignProgressStore({
    storage,
    unlockAll: true,
  });
  assert.equal(store.testMode, true);
  assert.equal(store.isUnlocked(0), true);
  assert.equal(store.isUnlocked(PROGRESSION_LEVEL_COUNT - 1), true);
  assert.equal(store.snapshot.highestUnlocked, PROGRESSION_LEVEL_COUNT - 1);

  const testLevel = Math.min(12, PROGRESSION_LEVEL_COUNT - 1);
  store.complete(testLevel, { score: 777 });
  assert.equal(store.isCompleted(testLevel), true);
  assert.equal(store.snapshot.campaignScore, 777);
  assert.equal(storage.getItem(CAMPAIGN_PROGRESS_STORAGE_KEY), null);
});
