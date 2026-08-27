import test from "node:test";
import assert from "node:assert/strict";
import {
  Atom,
  ENDLESS_COMPACT_LEVEL_COUNT,
  ENDLESS_LARGE_START_LEVEL,
  ENDLESS_MEDIUM_LEVEL_COUNT,
  endlessRunPhase,
  generateEndlessRunLevel,
  replaySolution,
} from "../src/index.js";
import { BrowserLevelGenerator } from "../src/browser.js";

test("endless run grows from 37 to 61 and then 91 cells", () => {
  assert.equal(ENDLESS_COMPACT_LEVEL_COUNT, 2);
  assert.equal(ENDLESS_MEDIUM_LEVEL_COUNT, 3);
  assert.equal(ENDLESS_LARGE_START_LEVEL, 5);
  assert.deepEqual(
    [0, 1, 2, 4, 5, 20].map(endlessRunPhase),
    ["compact", "compact", "medium", "medium", "large", "large"],
  );

  const expected = [
    { level: 0, radius: 3, cells: 37, pieces: 33 },
    { level: 1, radius: 3, cells: 37, pieces: 33 },
    { level: 2, radius: 4, cells: 61, pieces: 35 },
    { level: 4, radius: 4, cells: 61, pieces: 47 },
    { level: 5, radius: 5, cells: 91, pieces: 55 },
  ];
  for (const sample of expected) {
    const record = generateEndlessRunLevel(sample.level, {
      campaignSeed: "endless-stages",
    });
    assert.equal(record.plateRadius, sample.radius);
    assert.equal(record.plateCells.length, sample.cells);
    assert.equal(record.pieces.length, sample.pieces);
    assert.equal(record.pieces.some((piece) => piece.type === Atom.QUINTESSENCE), false);
    assert.equal(replaySolution(record.pieces, record.solution), true);
  }
});

test("endless run stages are deterministic", () => {
  for (const level of [0, 2, 5, 9]) {
    const options = { campaignSeed: "repeatable-endless-run" };
    const first = generateEndlessRunLevel(level, options);
    const second = generateEndlessRunLevel(level, options);
    assert.deepEqual(first.pieces, second.pieces);
    assert.deepEqual(first.solution, second.solution);
  }
});

test("browser worker facade sends the dedicated endless-run request", async () => {
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
          { campaignSeed: message.campaignSeed },
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
    campaignSeed: "browser-endless-run",
  });
  assert.equal(postedMessage.kind, "endless-run");
  assert.equal(record.plateCells.length, 37);
  assert.equal(replaySolution(record.board, record.solution), true);
  generator.terminate();
});
