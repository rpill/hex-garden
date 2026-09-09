import test from "node:test";
import assert from "node:assert/strict";
import {
  PlateSize,
  dailyDifficultyProfile,
  generateDailyPuzzle,
  getDailyLevel,
  replaySolution,
} from "../src/index.js";

const WEEK = [
  ["2026-09-07", "medium", PlateSize.MEDIUM],
  ["2026-09-08", "medium", PlateSize.MEDIUM],
  ["2026-09-09", "medium", PlateSize.MEDIUM],
  ["2026-09-10", "medium", PlateSize.MEDIUM],
  ["2026-09-11", "mediumHard", PlateSize.MEDIUM],
  ["2026-09-12", "hard", PlateSize.LARGE],
  ["2026-09-13", "challenge", PlateSize.LARGE],
];

test("daily difficulty follows the fixed Monday-Sunday rhythm", () => {
  for (const [dateKey, band, plateSize] of WEEK) {
    const profile = dailyDifficultyProfile(dateKey);
    assert.equal(profile.band, band);
    assert.equal(profile.plateSize, plateSize);
  }
  assert.throws(() => dailyDifficultyProfile("2026-02-30"), /date/i);
});

test("daily puzzle is shared, deterministic, canonical, and solver-certified", () => {
  const first = generateDailyPuzzle("2026-09-08");
  const second = generateDailyPuzzle("2026-09-08");

  assert.equal(first.seed, "daily-v1:2026-09-08");
  assert.equal(first.dateKey, "2026-09-08");
  assert.equal(first.band, "medium");
  assert.equal(first.plateSize, PlateSize.MEDIUM);
  assert.equal(first.plateCells.length, 61);
  assert.deepEqual(first.pieces, second.pieces);
  assert.deepEqual(first.solution, second.solution);
  assert.equal(replaySolution(first.pieces, first.solution), true);
});

test("packaged Daily runtime reconstructs a playable board without a worker request", () => {
  const record = getDailyLevel("2026-09-08");
  assert.equal(record.seed, "daily-v1:2026-09-08");
  assert.equal(record.board.size, record.pieces.length);
  assert.equal(replaySolution(record.board, record.solution), true);
});
