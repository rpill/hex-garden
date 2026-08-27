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

test("opening progression creates early choices and requires Salt wildcards", () => {
  const elementDefinitions = Array.from({ length: 8 }, (_value, level) =>
    getProgressionLevelDefinition(level),
  );
  assert.deepEqual(
    elementDefinitions.map((definition) => definition.elementCount),
    [4, 4, 4, 4, 4, 4, 4, 4],
  );
  assert.deepEqual(
    elementDefinitions.map((definition) => definition.ordinaryMoveCount),
    [10, 10, 10, 10, 10, 10, 10, 10],
  );

  const saltDefinitions = Array.from({ length: 8 }, (_value, index) =>
    getProgressionLevelDefinition(index + 8),
  );
  assert.deepEqual(
    saltDefinitions.map((definition) => definition.elementCount),
    [4, 4, 4, 4, 4, 4, 4, 4],
  );
  assert.deepEqual(
    saltDefinitions.map((definition) => definition.saltPairCount),
    [0, 0, 1, 1, 1, 2, 2, 2],
  );
  assert.deepEqual(
    saltDefinitions.map((definition) => definition.saltElementPairCount),
    [1, 2, 3, 4, 4, 4, 4, 4],
  );
  assert.deepEqual(
    saltDefinitions.map((definition) => definition.ordinaryMoveCount),
    [12, 13, 14, 15, 16, 16, 16, 16],
  );

  const levels = Array.from({ length: 16 }, (_value, level) =>
    generateProgressionLevel(level, { campaignSeed: "rules-lab-v1" }),
  );
  assert.equal(levels[0].difficulty.moveCount, 10);
  assert.ok(levels[0].difficulty.randomRouteWinProbability < 0.9);
  assert.notEqual(levels[0].difficulty.shortestDeadEndMove, null);
  assert.ok(levels[0].difficulty.initialLegalMoveCount > 1);
  assert.equal(
    levels.slice(0, 8).every(
      (record) => new Set(record.pieces.map((piece) => piece.type)).size === 4,
    ),
    true,
  );

  assert.equal(
    levels.slice(0, 8).every((record) => record.shape === "campaign-r3-curated"),
    true,
  );
  assert.deepEqual(
    levels.slice(0, 8).map((record) => ({
      first: record.difficulty.firstDeceptiveDecisionStep,
      steps: record.difficulty.deceptiveDecisionSteps,
      losing: record.difficulty.deceptiveLosingMovesAlongCertificate,
    })),
    [
      { first: 3, steps: 1, losing: 1 },
      { first: 3, steps: 2, losing: 2 },
      { first: 2, steps: 3, losing: 3 },
      { first: 3, steps: 2, losing: 2 },
      { first: 2, steps: 1, losing: 1 },
      { first: 1, steps: 1, losing: 1 },
      { first: 2, steps: 4, losing: 4 },
      { first: 2, steps: 3, losing: 7 },
    ],
  );
  for (let level = 1; level < 8; level += 1) {
    assert.ok(
      levels[level].difficulty.randomRouteWinProbability <=
        levels[level - 1].difficulty.randomRouteWinProbability,
    );
  }

  for (const record of levels.slice(8)) {
    const saltCount = record.pieces.filter(
      (piece) => piece.type === Atom.SALT,
    ).length;
    const oddElementCount = [
      Atom.AIR,
      Atom.FIRE,
      Atom.WATER,
      Atom.EARTH,
    ].filter(
      (type) =>
        record.pieces.filter((piece) => piece.type === type).length % 2 === 1,
    ).length;
    assert.equal(
      saltCount,
      record.definition.saltElementPairCount +
        record.definition.saltPairCount * 2,
    );
    assert.equal(oddElementCount, record.definition.saltElementPairCount);
    assert.ok(record.difficulty.sampledRouteWinProbability < 0.55);
  }

  assert.equal(
    levels.slice(0, 9).every(
      (record) => record.difficulty.routeAnalysisComplete,
    ),
    true,
  );
  assert.equal(
    levels.slice(9).every(
      (record) => !record.difficulty.routeAnalysisComplete,
    ),
    true,
  );
});

test("opening seed changes presentation without changing authored pressure", () => {
  for (let level = 0; level < 8; level += 1) {
    const first = generateProgressionLevel(level, {
      campaignSeed: "opening-a",
    });
    const second = generateProgressionLevel(level, {
      campaignSeed: "opening-b",
    });

    assert.notDeepEqual(first.pieces, second.pieces);
    assert.equal(replaySolution(first.pieces, first.solution), true);
    assert.equal(replaySolution(second.pieces, second.solution), true);
    assert.deepEqual(
      {
        win: first.difficulty.randomRouteWinProbability,
        first: first.difficulty.firstDeceptiveDecisionStep,
        steps: first.difficulty.deceptiveDecisionSteps,
        losing: first.difficulty.deceptiveLosingMovesAlongCertificate,
      },
      {
        win: second.difficulty.randomRouteWinProbability,
        first: second.difficulty.firstDeceptiveDecisionStep,
        steps: second.difficulty.deceptiveDecisionSteps,
        losing: second.difficulty.deceptiveLosingMovesAlongCertificate,
      },
    );
  }
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
