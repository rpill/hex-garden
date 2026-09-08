import test from "node:test";
import assert from "node:assert/strict";
import {
  PlateSize,
  dailyDifficultyProfile,
  generateDailyPuzzle,
  replaySolution,
} from "../src/index.js";
import { BrowserLevelGenerator } from "../src/browser.js";

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

test("browser worker facade sends Daily requests and reconstructs the board", async () => {
  const listeners = new Map();
  let postedMessage;
  const fakeWorker = {
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    postMessage(message) {
      postedMessage = message;
      queueMicrotask(() => {
        const { board: _board, ...result } = generateDailyPuzzle(message.dateKey);
        listeners.get("message")({
          data: { requestId: message.requestId, result },
        });
      });
    },
    terminate() {},
  };

  const generator = new BrowserLevelGenerator({ workerFactory: () => fakeWorker });
  const record = await generator.generateDaily("2026-09-08");
  assert.equal(postedMessage.kind, "daily");
  assert.equal(postedMessage.dateKey, "2026-09-08");
  assert.equal(record.seed, "daily-v1:2026-09-08");
  assert.equal(record.board.size, record.pieces.length);
  assert.equal(replaySolution(record.board, record.solution), true);
  generator.terminate();
});
