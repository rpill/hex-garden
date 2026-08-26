import test from "node:test";
import assert from "node:assert/strict";
import { BrowserLevelGenerator } from "../src/browser.js";
import {
  Atom,
  PROGRESSION_LEVEL_COUNT,
  ProgressionChapter,
  generateProgressionLevel,
  getProgressionLevelDefinition,
  hexKey,
  replaySolution,
} from "../src/index.js";

test("progression has six fixed chapters and expands 37 -> 61 -> 91 cells", () => {
  const boundaries = [
    [0, ProgressionChapter.ELEMENTS, 37],
    [8, ProgressionChapter.SALT, 37],
    [16, ProgressionChapter.OPPOSITES, 61],
    [26, ProgressionChapter.METALS, 61],
    [38, ProgressionChapter.FULL_GARDEN, 91],
    [50, ProgressionChapter.QUINTESSENCE, 91],
  ];

  for (const [level, chapter, plateCellCount] of boundaries) {
    const definition = getProgressionLevelDefinition(level);
    assert.equal(definition.chapter, chapter);
    assert.equal(definition.plateCellCount, plateCellCount);
  }
  assert.throws(() => getProgressionLevelDefinition(-1), RangeError);
  assert.throws(
    () => getProgressionLevelDefinition(PROGRESSION_LEVEL_COUNT),
    RangeError,
  );
});

test("all 60 progression levels are deterministic and certificate-solvable", () => {
  for (let level = 0; level < PROGRESSION_LEVEL_COUNT; level += 1) {
    const options = { campaignSeed: "progression-contract" };
    const first = generateProgressionLevel(level, options);
    const second = generateProgressionLevel(level, options);

    assert.deepEqual(first.pieces, second.pieces);
    assert.deepEqual(first.solution, second.solution);
    assert.equal(first.plateCells.length, first.definition.plateCellCount);
    assert.equal(
      first.pieces.every((piece) =>
        first.plateCells.some((cell) => hexKey(cell) === hexKey(piece)),
      ),
      true,
    );
    assert.equal(replaySolution(first.pieces, first.solution), true);
    assert.equal(first.difficulty.pieceCount, first.pieces.length);
    assert.equal(Number.isFinite(first.difficulty.averageLegalMoveCount), true);
    assert.ok(first.difficulty.minimumLegalMoveCount >= 1);
  }
});

test("mechanics unlock by chapter without changing the endless contracts", () => {
  const elements = generateProgressionLevel(0, { campaignSeed: "mechanics" });
  assert.equal(
    elements.pieces.every((piece) =>
      [Atom.AIR, Atom.FIRE, Atom.WATER, Atom.EARTH].includes(piece.type),
    ),
    true,
  );

  const salt = generateProgressionLevel(8, { campaignSeed: "mechanics" });
  assert.equal(salt.pieces.some((piece) => piece.type === Atom.SALT), true);
  assert.equal(salt.pieces.some((piece) => piece.type === Atom.VITAE), false);

  const opposites = generateProgressionLevel(16, { campaignSeed: "mechanics" });
  assert.equal(opposites.pieces.some((piece) => piece.type === Atom.VITAE), true);
  assert.equal(opposites.pieces.some((piece) => piece.type === Atom.MORS), true);
  assert.equal(opposites.pieces.some((piece) => piece.type === Atom.LEAD), false);

  const metals = generateProgressionLevel(26, { campaignSeed: "mechanics" });
  assert.equal(metals.pieces.some((piece) => piece.type === Atom.LEAD), true);
  assert.equal(metals.pieces.some((piece) => piece.type === Atom.TIN), false);

  const quintessence = generateProgressionLevel(50, {
    campaignSeed: "mechanics",
  });
  assert.equal(
    quintessence.pieces.some((piece) => piece.type === Atom.QUINTESSENCE),
    true,
  );
});

test("opening progression adds novelty quickly and introduces Salt as a slope", () => {
  const elementDefinitions = Array.from({ length: 8 }, (_value, level) =>
    getProgressionLevelDefinition(level),
  );
  assert.deepEqual(
    elementDefinitions.map((definition) => definition.elementCount),
    [1, 2, 3, 4, 4, 4, 4, 4],
  );
  assert.deepEqual(
    elementDefinitions.map((definition) => definition.ordinaryMoveCount),
    [4, 5, 6, 7, 8, 9, 10, 11],
  );

  const saltDefinitions = Array.from({ length: 8 }, (_value, index) =>
    getProgressionLevelDefinition(index + 8),
  );
  assert.deepEqual(
    saltDefinitions.map((definition) => definition.elementCount),
    [1, 2, 2, 3, 3, 4, 4, 4],
  );
  assert.deepEqual(
    saltDefinitions.map((definition) => definition.saltPairCount),
    [1, 1, 1, 1, 1, 1, 2, 2],
  );
  assert.deepEqual(
    saltDefinitions.map((definition) => definition.ordinaryMoveCount),
    [8, 8, 9, 10, 10, 11, 12, 13],
  );

  const levels = Array.from({ length: 16 }, (_value, level) =>
    generateProgressionLevel(level, { campaignSeed: "rules-lab-v1" }),
  );
  assert.equal(levels[0].difficulty.moveCount, 4);
  assert.equal(levels[0].difficulty.randomRouteWinProbability, 1);
  assert.equal(levels[0].difficulty.shortestDeadEndMove, null);
  assert.ok(levels[0].difficulty.initialLegalMoveCount > 1);
  assert.equal(levels[0].difficulty.initialMeaningfulMoveCount, 1);

  const firstSalt = levels[8].difficulty;
  const secondSalt = levels[9].difficulty;
  const thirdSalt = levels[10].difficulty;
  assert.equal(firstSalt.randomRouteWinProbability, 1);
  assert.equal(firstSalt.shortestDeadEndMove, null);
  assert.ok(
    secondSalt.randomRouteWinProbability <
      firstSalt.randomRouteWinProbability,
  );
  assert.ok(
    thirdSalt.randomRouteWinProbability <
      secondSalt.randomRouteWinProbability,
  );
  assert.ok(secondSalt.shortestDeadEndMove >= 6);
  assert.ok(thirdSalt.shortestDeadEndMove >= 7);
  assert.equal(
    levels.slice(0, 15).every(
      (record) => record.difficulty.routeAnalysisComplete,
    ),
    true,
  );
  assert.equal(levels[15].difficulty.routeAnalysisComplete, false);
});

test("exact route analysis stays off the full-size synchronous generation path", () => {
  const record = generateProgressionLevel(16, {
    campaignSeed: "route-analysis-limit",
  });
  assert.ok(record.pieces.length > 30);
  assert.equal(record.difficulty.routeAnalysisComplete, false);
  assert.equal(record.difficulty.randomRouteWinProbability, null);
  assert.equal(record.difficulty.reachableStateCount, null);
});

test("gold appears only after the complete metal chain and is certified last", () => {
  for (let level = 0; level < PROGRESSION_LEVEL_COUNT; level += 1) {
    const record = generateProgressionLevel(level, {
      campaignSeed: "gold-contract",
    });
    const gold = record.pieces.find((piece) => piece.type === Atom.GOLD);
    if (!gold) {
      assert.ok(level < 36);
      continue;
    }

    for (const metal of [
      Atom.LEAD,
      Atom.TIN,
      Atom.IRON,
      Atom.COPPER,
      Atom.SILVER,
    ]) {
      assert.equal(record.pieces.some((piece) => piece.type === metal), true);
    }
    assert.deepEqual(record.solution.at(-1), [{ q: gold.q, r: gold.r }]);
  }
});


test("browser worker facade keeps progression requests separate from endless", async () => {
  const listeners = new Map();
  let postedMessage;
  const fakeWorker = {
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    postMessage(message) {
      postedMessage = message;
      queueMicrotask(() => {
        const { board: _board, ...result } = generateProgressionLevel(
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
  const record = await generator.generateProgression(16, {
    campaignSeed: "browser-progression",
  });
  assert.equal(postedMessage.kind, "progression");
  assert.equal(record.plateCells.length, 61);
  assert.equal(replaySolution(record.board, record.solution), true);
  generator.terminate();
});
