import test from "node:test";
import assert from "node:assert/strict";
import {
  CAMPAIGN_PROGRESS_STORAGE_KEY,
  CampaignProgressStore,
  normalizeCampaignProgress,
} from "../src/campaign-progress.js";
import { CAMPAIGN_LEVEL_COUNT } from "../src/plates.js";
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

test("new campaign progress starts empty and uses a new save key", () => {
  assert.equal(CAMPAIGN_PROGRESS_STORAGE_KEY, "garden-js.campaign-progress.v3");

  const storage = new MemoryStorage();
  storage.setItem("garden-js.campaign-progress.v1", JSON.stringify({ completedLevels: [0, 1, 2] }));
  storage.setItem("garden-js.campaign-progress.v2", JSON.stringify({ solvedLevels: [0, 1, 2] }));

  const store = new CampaignProgressStore({ storage });
  assert.equal(store.snapshot.version, 3);
  assert.deepEqual(store.snapshot.solvedLevels, []);
  assert.deepEqual(store.snapshot.cleanLevels, []);
  assert.equal(store.snapshot.highestUnlocked, 0);
  assert.equal(store.snapshot.campaignCompleted, false);
});

test("runtime campaign snapshot exposes progress only, never legacy score fields", () => {
  const store = new CampaignProgressStore({ storage: new MemoryStorage() });
  assert.equal("campaignScore" in store.snapshot, false);
  assert.equal("levelScores" in store.snapshot, false);
});

test("solved and clean upgrade independently", () => {
  const storage = new MemoryStorage();
  const store = new CampaignProgressStore({ storage });

  store.complete(0, { clean: false });
  assert.equal(store.isSolved(0), true);
  assert.equal(store.isClean(0), false);
  assert.equal(store.snapshot.highestUnlocked, 1);
  assert.equal(store.solvedCount, 1);
  assert.equal(store.cleanCount, 0);

  store.complete(0, { clean: true });
  assert.equal(store.isSolved(0), true);
  assert.equal(store.isClean(0), true);
  assert.equal(store.snapshot.solvedLevels.length, 1);
  assert.equal(store.solvedCount, 1);
  assert.equal(store.cleanCount, 1);

  const reloaded = new CampaignProgressStore({ storage });
  assert.equal(reloaded.isClean(0), true);
  assert.equal(reloaded.solvedCount, 1);
  assert.equal(reloaded.cleanCount, 1);
});

test("normalization keeps sorted unique valid levels and clean is always a solved subset", () => {
  assert.deepEqual(
    normalizeCampaignProgress({
      version: 3,
      tutorialCompleted: false,
      solvedLevels: [3, 0, 3, 49, -1, 50, "1"],
      cleanLevels: [49, 3, 2, 3, -1],
    }),
    {
      version: 3,
      tutorialCompleted: true,
      solvedLevels: [0, 3, 49],
      cleanLevels: [3, 49],
      highestUnlocked: 1,
      campaignCompleted: false,
    },
  );
});

test("only the contiguous solved prefix unlocks normal campaign progression", () => {
  const storage = new MemoryStorage();
  storage.setItem(
    CAMPAIGN_PROGRESS_STORAGE_KEY,
    JSON.stringify({ version: 3, solvedLevels: [0, 2], cleanLevels: [2] }),
  );
  const store = new CampaignProgressStore({ storage });

  assert.equal(store.isSolved(0), true);
  assert.equal(store.isSolved(2), true);
  assert.equal(store.isClean(2), true);
  assert.equal(store.snapshot.highestUnlocked, 1);
  assert.equal(store.isUnlocked(1), true);
  assert.equal(store.isUnlocked(2), false);
  assert.throws(() => store.complete(2), /locked/);
});

test("tutorial completion persists without solving campaign level 1", () => {
  const storage = new MemoryStorage();
  const first = new CampaignProgressStore({ storage });
  first.completeTutorial();

  assert.equal(first.snapshot.tutorialCompleted, true);
  assert.deepEqual(first.snapshot.solvedLevels, []);
  assert.deepEqual(first.snapshot.cleanLevels, []);

  const second = new CampaignProgressStore({ storage });
  assert.equal(second.snapshot.tutorialCompleted, true);
  assert.equal(second.isUnlocked(0), true);
  assert.equal(second.isUnlocked(1), false);
});

test("all 50 solved levels complete the campaign while clean remains optional", () => {
  const store = new CampaignProgressStore({ storage: new MemoryStorage() });

  for (let level = 0; level < CAMPAIGN_LEVEL_COUNT; level += 1) {
    assert.equal(store.isUnlocked(level), true);
    store.complete(level, { clean: level % 2 === 0 });
  }

  assert.equal(store.snapshot.campaignCompleted, true);
  assert.equal(store.snapshot.solvedLevels.length, CAMPAIGN_LEVEL_COUNT);
  assert.equal(store.snapshot.cleanLevels.length, CAMPAIGN_LEVEL_COUNT / 2);
  assert.equal(store.snapshot.highestUnlocked, CAMPAIGN_LEVEL_COUNT - 1);
  assert.throws(() => store.isUnlocked(CAMPAIGN_LEVEL_COUNT), RangeError);
});

test("invalid v3 browser data falls back to a playable first level", () => {
  const storage = new MemoryStorage();
  storage.setItem(CAMPAIGN_PROGRESS_STORAGE_KEY, "{not json");
  const store = new CampaignProgressStore({ storage });

  assert.equal(store.isUnlocked(0), true);
  assert.equal(store.isUnlocked(1), false);
  assert.deepEqual(store.snapshot.solvedLevels, []);
});

test("test URL unlocks all 50 levels without fabricating mastery or persisting progress", () => {
  assert.equal(isCampaignTestMode("?test=all"), true);
  assert.equal(isCampaignTestMode("?test=campaign"), false);
  assert.equal(isCampaignTestMode(""), false);

  const storage = new MemoryStorage();
  const store = new CampaignProgressStore({ storage, unlockAll: true });

  assert.equal(store.testMode, true);
  assert.equal(store.isUnlocked(0), true);
  assert.equal(store.isUnlocked(CAMPAIGN_LEVEL_COUNT - 1), true);
  assert.deepEqual(store.snapshot.solvedLevels, []);
  assert.deepEqual(store.snapshot.cleanLevels, []);
  assert.equal(store.snapshot.highestUnlocked, 0);

  const testLevel = 12;
  store.complete(testLevel, { clean: true });
  assert.equal(store.isSolved(testLevel), true);
  assert.equal(store.isClean(testLevel), true);
  assert.equal(store.snapshot.highestUnlocked, 0);
  assert.equal(storage.getItem(CAMPAIGN_PROGRESS_STORAGE_KEY), null);
});
