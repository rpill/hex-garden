import test from "node:test";
import assert from "node:assert/strict";
import {
  Atom,
  PlateSize,
  endlessDifficultyBand,
  endlessPlateSize,
  generateEndlessRunLevel,
  replaySolution,
} from "../src/index.js";
import { BrowserLevelGenerator } from "../src/browser.js";

test("endless plate growth stops at the canonical 91-cell plate", () => {
  assert.deepEqual(
    Array.from({ length: 8 }, (_value, index) => endlessPlateSize(index)),
    [
      PlateSize.SMALL,
      PlateSize.SMALL,
      PlateSize.MEDIUM,
      PlateSize.MEDIUM,
      PlateSize.MEDIUM,
      PlateSize.LARGE,
      PlateSize.LARGE,
      PlateSize.LARGE,
    ],
  );
  assert.equal(endlessPlateSize(100), PlateSize.LARGE);
});

test("endless difficulty rises through fixed bands and caps at mastery", () => {
  assert.equal(endlessDifficultyBand(0), "easy");
  assert.equal(endlessDifficultyBand(1), "easy");
  assert.equal(endlessDifficultyBand(2), "medium");
  assert.equal(endlessDifficultyBand(4), "medium");
  assert.equal(endlessDifficultyBand(5), "hard");
  assert.equal(endlessDifficultyBand(9), "hard");
  assert.equal(endlessDifficultyBand(10), "mastery");
  assert.equal(endlessDifficultyBand(100), "mastery");
});

test("endless board generation is deterministic for one run seed and index", () => {
  const first = generateEndlessRunLevel(100, { runSeed: "repeatable-endless-run" });
  const second = generateEndlessRunLevel(100, { runSeed: "repeatable-endless-run" });

  assert.equal(first.level, 100);
  assert.equal(first.band, "mastery");
  assert.equal(first.plateSize, PlateSize.LARGE);
  assert.equal(first.plateRadius, 5);
  assert.equal(first.plateCells.length, 91);
  assert.equal(first.pieces.some((piece) => piece.type === Atom.QUINTESSENCE), false);
  assert.deepEqual(first.pieces, second.pieces);
  assert.deepEqual(first.solution, second.solution);
  assert.deepEqual(first.difficulty, second.difficulty);
  assert.equal(replaySolution(first.pieces, first.solution), true);
});

test("browser worker facade sends runSeed through the dedicated endless request", async () => {
  const listeners = new Map();
  let postedMessage;
  const fakeWorker = {
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    postMessage(message) {
      postedMessage = message;
      queueMicrotask(() => {
        const { board: _board, ...result } = generateEndlessRunLevel(
          message.level,
          { runSeed: message.runSeed },
        );
        listeners.get("message")({
          data: { requestId: message.requestId, result },
        });
      });
    },
    terminate() {},
  };

  const generator = new BrowserLevelGenerator({ workerFactory: () => fakeWorker });
  const record = await generator.generateEndlessRun(0, {
    runSeed: "browser-endless-run",
  });

  assert.equal(postedMessage.kind, "endless-run");
  assert.equal(postedMessage.runSeed, "browser-endless-run");
  assert.equal("campaignSeed" in postedMessage, false);
  assert.equal(record.plateCells.length, 37);
  assert.equal(replaySolution(record.board, record.solution), true);
  generator.terminate();
});
