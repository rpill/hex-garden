import test from "node:test";
import assert from "node:assert/strict";
import {
  BoardVariant,
  generateCampaignLevel,
  replaySolution,
} from "../src/index.js";
import { BrowserLevelGenerator } from "../src/browser.js";

test("campaign levels are unlimited, deterministic, and independently addressable", () => {
  const options = { campaignSeed: "release-1" };
  const level = generateCampaignLevel(123_456, options);
  assert.deepEqual(level.pieces, generateCampaignLevel(123_456, options).pieces);
  assert.notDeepEqual(level.pieces, generateCampaignLevel(123_457, options).pieces);
  assert.equal(replaySolution(level.board, level.solution), true);
});

test("a sequence of standard and quintessence campaign levels is solvable", () => {
  for (let level = 0; level < 20; level += 1) {
    const variant = level % 5 === 4 ? BoardVariant.QUINTESSENCE : BoardVariant.STANDARD;
    const record = generateCampaignLevel(level, {
      campaignSeed: "mixed-campaign",
      variant,
    });
    assert.equal(replaySolution(record.pieces, record.solution), true);
  }
});

test("browser worker facade reconstructs a playable board", async () => {
  const listeners = new Map();
  const fakeWorker = {
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    postMessage(message) {
      queueMicrotask(() => {
        const { board: _board, ...result } = generateCampaignLevel(message.level, {
          campaignSeed: message.campaignSeed,
          variant: message.variant,
        });
        listeners.get("message")({
          data: { requestId: message.requestId, result },
        });
      });
    },
    terminate() {},
  };
  const generator = new BrowserLevelGenerator({ workerFactory: () => fakeWorker });
  const record = await generator.generate(42, { campaignSeed: "browser" });
  assert.equal(record.board.size, 55);
  assert.equal(replaySolution(record.board, record.solution), true);
  generator.terminate();
});
