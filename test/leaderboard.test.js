import test from "node:test";
import assert from "node:assert/strict";
import {
  LEADERBOARD_STORAGE_KEY,
  LocalLeaderboardStore,
  normalizeLeaderboardProfile,
} from "../src/leaderboard.js";

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

test("local leaderboard combines campaign score with the best endless run", () => {
  const board = new LocalLeaderboardStore({ storage: memoryStorage() });
  board.syncCampaignScore(3200);
  const first = board.submitEndlessScore(1800);
  const lower = board.submitEndlessScore(900);
  assert.equal(first.accepted, true);
  assert.equal(lower.accepted, false);
  assert.deepEqual(board.snapshot, {
    version: 1,
    campaignScore: 3200,
    endlessBest: 1800,
    totalScore: 5000,
  });
});

test("assisted endless scores never enter the local leaderboard", () => {
  const board = new LocalLeaderboardStore({ storage: memoryStorage() });
  const result = board.submitEndlessScore(999999, { assisted: true });
  assert.equal(result.accepted, false);
  assert.equal(board.snapshot.endlessBest, 0);
});

test("standings always include the local player even below the visible top", () => {
  const board = new LocalLeaderboardStore({ storage: memoryStorage() });
  const standings = board.standings({ limit: 5, playerName: "ВЫ" });
  assert.equal(standings.entries.length, 5);
  assert.equal(standings.entries.at(-1).isPlayer, true);
  assert.equal(standings.playerEntry.rank > 5, true);
});

test("leaderboard profile is normalized and persisted", () => {
  const storage = memoryStorage({
    [LEADERBOARD_STORAGE_KEY]: JSON.stringify({ campaignScore: -4, endlessBest: 700 }),
  });
  const board = new LocalLeaderboardStore({ storage });
  assert.equal(board.snapshot.campaignScore, 0);
  assert.equal(board.snapshot.endlessBest, 700);
  assert.deepEqual(normalizeLeaderboardProfile({ campaignScore: 10, endlessBest: NaN }), {
    version: 1,
    campaignScore: 10,
    endlessBest: 0,
  });
});
