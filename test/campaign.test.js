import test from "node:test";
import assert from "node:assert/strict";
import {
  CAMPAIGN_LEVEL_COUNT,
  CAMPAIGN_LEVELS,
  campaignPlateSize,
  getCampaignLevel,
  generateCampaignLevel,
  hexKey,
  plateSpec,
  replaySolution,
} from "../src/index.js";
import { BrowserLevelGenerator } from "../src/browser.js";

test("campaign is fifty fixed certificate-solvable levels", () => {
  assert.equal(CAMPAIGN_LEVELS.length, CAMPAIGN_LEVEL_COUNT);
  for (let level = 0; level < CAMPAIGN_LEVEL_COUNT; level += 1) {
    const record = getCampaignLevel(level);
    const expected = plateSpec(campaignPlateSize(level));
    assert.equal(record.level, level);
    assert.equal(record.plateRadius, expected.radius);
    assert.equal(record.plateCells.length, expected.cellCount);
    assert.equal(replaySolution(record.pieces, record.solution), true);
    const plate = new Set(record.plateCells.map(hexKey));
    assert.equal(record.pieces.every((piece) => plate.has(hexKey(piece))), true);
    assert.deepEqual(getCampaignLevel(level).pieces, record.pieces);
  }
});

test("campaign fixed-data access rejects levels outside 0..49", () => {
  assert.throws(() => getCampaignLevel(-1), RangeError);
  assert.throws(() => getCampaignLevel(CAMPAIGN_LEVEL_COUNT), RangeError);
});


test("frozen campaign records are available without a Worker global", () => {
  const workerDescriptor = Object.getOwnPropertyDescriptor(globalThis, "Worker");
  try {
    Object.defineProperty(globalThis, "Worker", {
      configurable: true,
      writable: true,
      value: undefined,
    });
    const record = getCampaignLevel(0);
    assert.equal(record.level, 0);
    assert.equal(replaySolution(record.pieces, record.solution), true);
  } finally {
    if (workerDescriptor) {
      Object.defineProperty(globalThis, "Worker", workerDescriptor);
    } else {
      delete globalThis.Worker;
    }
  }
});

test("browser campaign facade resolves frozen data without posting to the worker", async () => {
  const listeners = new Map();
  let postCount = 0;
  const fakeWorker = {
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    postMessage(message) {
      postCount += 1;
      const { board: _board, ...result } = generateCampaignLevel(message.level);
      queueMicrotask(() => {
        listeners.get("message")?.({
          data: { requestId: message.requestId, result },
        });
      });
    },
    terminate() {},
  };

  const generator = new BrowserLevelGenerator({ workerFactory: () => fakeWorker });
  const record = await generator.generate(0);

  assert.equal(postCount, 0);
  assert.equal(record.shape, "canonical");
  assert.equal(record.variant, "standard");
  assert.equal(replaySolution(record.board, record.solution), true);
  generator.terminate();
});
