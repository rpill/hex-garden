import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  DAILY_LEVEL_PACK_END_DATE_KEY,
  DAILY_LEVEL_PACK_START_DATE_KEY,
  FROZEN_DAILY_LEVEL_COUNT,
  dailyDifficultyProfile,
  getDailyLevel,
  replaySolution,
} from "../src/index.js";

const EXPECTED_START = "2026-01-01";
const EXPECTED_END = "2027-12-31";
const EXPECTED_COUNT = 730;

for (const dateKey of [EXPECTED_START, "2026-09-09", "2027-12-31", EXPECTED_END]) {
  test(`frozen Daily ${dateKey} is packaged and solvable`, () => {
    const level = getDailyLevel(dateKey);
    const profile = dailyDifficultyProfile(dateKey);

    assert.equal(level.dateKey, dateKey);
    assert.equal(level.seed, `daily-v1:${dateKey}`);
    assert.match(level.candidateSeed, new RegExp(`^daily-v1:${dateKey}:candidate:\\d+$`));
    assert.equal(level.band, profile.band);
    assert.equal(level.plateSize, profile.plateSize);
    assert.equal(level.pieces.length, profile.targetPieceCount);
    assert.equal(replaySolution(level.pieces, level.solution), true);
    assert.equal(level.board.won, false);
  });
}

test("frozen Daily pack covers both full calendar years used by this release", () => {
  assert.equal(DAILY_LEVEL_PACK_START_DATE_KEY, EXPECTED_START);
  assert.equal(DAILY_LEVEL_PACK_END_DATE_KEY, EXPECTED_END);
  assert.equal(FROZEN_DAILY_LEVEL_COUNT, EXPECTED_COUNT);
});


test("frozen Daily preserves its deterministic certified candidate", () => {
  assert.equal(
    getDailyLevel("2026-09-08").candidateSeed,
    "daily-v1:2026-09-08:candidate:9",
  );
});

test("frozen Daily lookup rejects dates not shipped in this build", () => {
  assert.throws(() => getDailyLevel("2025-12-31"), /not included|pack/i);
  assert.throws(() => getDailyLevel("2028-01-01"), /not included|pack/i);
});

test("Daily pack stays compact by deriving plate data instead of repeating it per day", async () => {
  const raw = await readFile(new URL("../src/data/daily-levels.json", import.meta.url), "utf8");
  assert.doesNotMatch(raw, /plateCells|plateRadius|difficulty|metrics/);
});

test("frozen Daily pack reflects ranked candidate selection instead of always taking candidate zero", async () => {
  const raw = JSON.parse(await readFile(new URL("../src/data/daily-levels.json", import.meta.url), "utf8"));
  const candidateIndexes = raw.levels.map((record) => record[0]);
  const distinct = new Set(candidateIndexes);
  const nonZeroCount = candidateIndexes.filter((index) => index !== 0).length;

  assert.ok(distinct.size >= 6, `expected at least 6 selected candidate indexes, got ${distinct.size}`);
  assert.ok(nonZeroCount >= Math.floor(candidateIndexes.length * 0.5), `expected ranked selection to choose non-zero candidates often, got ${nonZeroCount}/${candidateIndexes.length}`);
});
