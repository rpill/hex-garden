import test from "node:test";
import assert from "node:assert/strict";
import {
  Atom,
  PlateSize,
  generatePuzzleCandidate,
  hexKey,
  replaySolution,
} from "../src/index.js";
import { BrowserLevelGenerator } from "../src/browser.js";

const fullStandardComposition = Object.freeze({
  saltPairCount: 1,
  saltElementPairCount: 1,
  oppositePairCount: 2,
  metalDepth: 6,
});

test("canonical candidate exposes the full plate even when occupancy is smaller", () => {
  const record = generatePuzzleCandidate({
    seed: "canonical-medium",
    plateSize: PlateSize.MEDIUM,
    targetPieceCount: 43,
    composition: fullStandardComposition,
  });
  assert.equal(record.plateCells.length, 61);
  assert.equal(record.pieces.length, 43);
  const plate = new Set(record.plateCells.map(hexKey));
  assert.equal(record.pieces.every((piece) => plate.has(hexKey(piece))), true);
  assert.equal(replaySolution(record.pieces, record.solution), true);
  assert.equal(record.pieces.some((piece) => piece.type === Atom.GOLD), true);
  assert.equal(record.shape, undefined);
});

test("candidate generation rejects impossible parity/count requests", () => {
  assert.throws(() => generatePuzzleCandidate({
    seed: "bad-count",
    plateSize: PlateSize.SMALL,
    targetPieceCount: 22,
    composition: fullStandardComposition,
  }), /piece count/i);
});


test("browser worker facade sends generic candidate requests", async () => {
  const listeners = new Map();
  let postedMessage;
  const fakeWorker = {
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    postMessage(message) {
      postedMessage = message;
      queueMicrotask(() => {
        const { board: _board, ...result } = generatePuzzleCandidate(message.options);
        listeners.get("message")({
          data: { requestId: message.requestId, result },
        });
      });
    },
    terminate() {},
  };

  const generator = new BrowserLevelGenerator({ workerFactory: () => fakeWorker });
  const record = await generator.generatePuzzleCandidate({
    seed: "browser-candidate",
    plateSize: PlateSize.SMALL,
    targetPieceCount: 31,
    composition: fullStandardComposition,
  });
  assert.equal(postedMessage.kind, "puzzle-candidate");
  assert.equal(record.plateCells.length, 37);
  assert.equal(record.board.size, 31);
  assert.equal(replaySolution(record.board, record.solution), true);
  generator.terminate();
});
