import test from "node:test";
import assert from "node:assert/strict";
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

