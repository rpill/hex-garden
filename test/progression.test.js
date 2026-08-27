import test from "node:test";
import assert from "node:assert/strict";
import { BrowserLevelGenerator } from "../src/browser.js";
import {
  ADJACENT_OFFSETS,
  Atom,
  PROGRESSION_LEVEL_COUNT,
  ProgressionChapter,
  addHex,
  enumerateHexPlate,
  generateProgressionLevel,
  getProgressionLevelDefinition,
  hexKey,
  replaySolution,
} from "../src/index.js";

test("standard mechanics arrive before the board capacity expands", () => {
  const boundaries = [
    [0, ProgressionChapter.ELEMENTS, 37],
    [1, ProgressionChapter.SALT, 37],
    [2, ProgressionChapter.OPPOSITES, 37],
    [3, ProgressionChapter.METALS, 37],
    [9, ProgressionChapter.FULL_GARDEN, 37],
    [16, ProgressionChapter.FULL_GARDEN, 61],
    [38, ProgressionChapter.FULL_GARDEN, 91],
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
    assert.ok(first.plateCells.length <= first.definition.plateCellCount);
    assert.ok(first.plateCells.length >= first.pieces.length);
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

test("campaign unlocks the complete standard rules without Q", () => {
  const elements = generateProgressionLevel(0, { campaignSeed: "mechanics" });
  assert.equal(
    elements.pieces.every((piece) =>
      [Atom.AIR, Atom.FIRE, Atom.WATER, Atom.EARTH].includes(piece.type),
    ),
    true,
  );

  const salt = generateProgressionLevel(1, { campaignSeed: "mechanics" });
  assert.equal(salt.pieces.some((piece) => piece.type === Atom.SALT), true);
  assert.equal(salt.pieces.some((piece) => piece.type === Atom.VITAE), false);

  const opposites = generateProgressionLevel(2, { campaignSeed: "mechanics" });
  assert.equal(opposites.pieces.some((piece) => piece.type === Atom.VITAE), true);
  assert.equal(opposites.pieces.some((piece) => piece.type === Atom.MORS), true);
  assert.equal(opposites.pieces.some((piece) => piece.type === Atom.LEAD), false);

  const metals = generateProgressionLevel(3, { campaignSeed: "mechanics" });
  assert.equal(metals.pieces.some((piece) => piece.type === Atom.LEAD), true);
  assert.equal(
    metals.pieces.some((piece) => piece.type === Atom.QUICKSILVER),
    true,
  );
  assert.equal(metals.pieces.some((piece) => piece.type === Atom.TIN), false);

  const lateCampaign = generateProgressionLevel(59, {
    campaignSeed: "mechanics",
  });
  assert.equal(
    lateCampaign.pieces.some((piece) => piece.type === Atom.QUINTESSENCE),
    false,
  );
  assert.equal(lateCampaign.variant, "standard");
});

test("campaign introduces a required new rule almost every early level", () => {
  const levels = Array.from({ length: 13 }, (_value, level) =>
    generateProgressionLevel(level, { campaignSeed: "rules-lab-v1" }),
  );

  assert.equal(levels[0].difficulty.moveCount, 10);
  assert.ok(levels[0].difficulty.randomRouteWinProbability < 0.9);
  assert.notEqual(levels[0].difficulty.shortestDeadEndMove, null);
  assert.equal(
    levels[0].pieces.every((piece) =>
      [Atom.AIR, Atom.FIRE, Atom.WATER, Atom.EARTH].includes(piece.type),
    ),
    true,
  );
  assert.equal(levels[0].shape, "campaign-r3-curated");
  assert.equal(levels[1].pieces.some((piece) => piece.type === Atom.SALT), true);
  assert.equal(levels[2].pieces.some((piece) => piece.type === Atom.VITAE), true);
  assert.equal(levels[2].pieces.some((piece) => piece.type === Atom.MORS), true);

  const introducedMetals = [
    Atom.LEAD,
    Atom.TIN,
    Atom.IRON,
    Atom.COPPER,
    Atom.SILVER,
    Atom.GOLD,
  ];
  for (let index = 0; index < introducedMetals.length; index += 1) {
    const record = levels[index + 3];
    assert.equal(record.definition.metalDepth, index + 1);
    assert.equal(
      record.pieces.some((piece) => piece.type === introducedMetals[index]),
      true,
    );
    assert.equal(
      record.pieces.some((piece) => piece.type === Atom.QUICKSILVER),
      true,
    );
  }

  assert.equal(levels[9].definition.chapter, ProgressionChapter.FULL_GARDEN);
  assert.equal(levels[12].definition.chapter, ProgressionChapter.FULL_GARDEN);
  assert.equal(
    levels.some((record) =>
      record.pieces.some((piece) => piece.type === Atom.QUINTESSENCE),
    ),
    false,
  );
  assert.equal(
    levels.every((record) => replaySolution(record.pieces, record.solution)),
    true,
  );
});

test("campaign difficulty grows through real silhouette families instead of Q", () => {
  const shapedLevels = Array.from({ length: 29 }, (_value, index) =>
    generateProgressionLevel(index + 9, { campaignSeed: "shape-contract" }),
  );
  const expectedFamilies = [
    "compact",
    "wide",
    "diagonal",
    "branches",
    "hollow",
  ];

  for (const family of expectedFamilies) {
    assert.equal(
      shapedLevels.some((record) => record.shape.includes(family)),
      true,
    );
  }
  for (const record of shapedLevels) {
    assert.equal(record.plateCells.length, record.pieces.length);
    assert.equal(record.variant, "standard");
    assert.equal(
      record.pieces.some((piece) => piece.type === Atom.QUINTESSENCE),
      false,
    );
    if (record.shape.includes("hollow")) {
      const plate = new Set(record.plateCells.map(hexKey));
      const hasEnclosedHole = enumerateHexPlate(record.plateRadius).some(
        (cell) =>
          !plate.has(hexKey(cell)) &&
          ADJACENT_OFFSETS.every((offset) =>
            plate.has(hexKey(addHex(cell, offset))),
          ),
      );
      assert.equal(hasEnclosedHole, true);
    }
  }

  const fullLevels = Array.from({ length: 22 }, (_value, index) =>
    generateProgressionLevel(index + 38, { campaignSeed: "shape-contract" }),
  );
  assert.ok(new Set(fullLevels.map((record) => record.shape)).size >= 3);
  assert.equal(
    fullLevels.every(
      (record) =>
        record.variant === "standard" &&
        record.pieces.length === 55 &&
        record.plateCells.length === 55,
    ),
    true,
  );
});

test("authored level 1 changes presentation without changing pressure", () => {
  for (let level = 0; level < 1; level += 1) {
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
      assert.ok(level < 8);
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
  assert.equal(record.definition.plateCellCount, 61);
  assert.equal(record.plateCells.length, record.pieces.length);
  assert.equal(replaySolution(record.board, record.solution), true);
  generator.terminate();
});
