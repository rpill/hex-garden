import test from "node:test";
import assert from "node:assert/strict";
import {
  Atom,
  BoardVariant,
  generateCampaignLevel,
  hexKey,
  replaySolution,
} from "../src/index.js";

function countsByType(pieces) {
  const counts = new Map();
  for (const piece of pieces) counts.set(piece.type, (counts.get(piece.type) ?? 0) + 1);
  return counts;
}

function assertCommonComposition(counts) {
  assert.equal(counts.get(Atom.AIR), 8);
  assert.equal(counts.get(Atom.FIRE), 8);
  assert.equal(counts.get(Atom.WATER), 8);
  assert.equal(counts.get(Atom.EARTH), 8);
  assert.equal(counts.get(Atom.SALT), 4);
  assert.equal(counts.get(Atom.QUICKSILVER), 5);
  for (const metal of [
    Atom.GOLD,
    Atom.SILVER,
    Atom.COPPER,
    Atom.IRON,
    Atom.TIN,
    Atom.LEAD,
  ]) {
    assert.equal(counts.get(metal), 1);
  }
}

test("standard levels have the exact 55-piece contract", () => {
  const record = generateCampaignLevel(7, {
    campaignSeed: "composition",
    variant: BoardVariant.STANDARD,
  });
  const counts = countsByType(record.pieces);
  assert.equal(record.pieces.length, 55);
  assert.equal(new Set(record.pieces.map(hexKey)).size, 55);
  assertCommonComposition(counts);
  assert.equal(counts.get(Atom.VITAE), 4);
  assert.equal(counts.get(Atom.MORS), 4);
  assert.equal(counts.get(Atom.QUINTESSENCE) ?? 0, 0);
  assert.equal(record.solution.length, 28);
});

test("quintessence levels have the exact 55-piece contract", () => {
  const record = generateCampaignLevel(7, {
    campaignSeed: "composition",
    variant: BoardVariant.QUINTESSENCE,
  });
  const counts = countsByType(record.pieces);
  assert.equal(record.pieces.length, 55);
  assert.equal(new Set(record.pieces.map(hexKey)).size, 55);
  assertCommonComposition(counts);
  assert.equal(counts.get(Atom.VITAE), 3);
  assert.equal(counts.get(Atom.MORS), 3);
  assert.equal(counts.get(Atom.QUINTESSENCE), 2);
  assert.equal(record.solution.length, 25);
  assert.equal(record.solution.filter((move) => move.length === 5).length, 2);
});

test("a long sequence in both variants replays to an empty board", () => {
  for (const variant of Object.values(BoardVariant)) {
    for (let level = 0; level < 40; level += 1) {
      const record = generateCampaignLevel(level, {
        campaignSeed: "rules-lab-v1",
        variant,
      });
      assert.equal(replaySolution(record.pieces, record.solution), true);
    }
  }
});

test("certified levels remove metals in order and leave gold for the final move", () => {
  const record = generateCampaignLevel(19, {
    campaignSeed: "metal-order",
    variant: BoardVariant.STANDARD,
  });
  const typesAt = new Map(record.pieces.map((piece) => [hexKey(piece), piece.type]));
  const metalMoves = record.solution
    .map((move) => move.map((position) => typesAt.get(hexKey(position))))
    .filter((types) => types.some((type) => [
      Atom.LEAD,
      Atom.TIN,
      Atom.IRON,
      Atom.COPPER,
      Atom.SILVER,
      Atom.GOLD,
    ].includes(type)));

  assert.deepEqual(
    metalMoves.map((types) => types.find((type) => type !== Atom.QUICKSILVER)),
    [Atom.LEAD, Atom.TIN, Atom.IRON, Atom.COPPER, Atom.SILVER, Atom.GOLD],
  );
  assert.deepEqual(metalMoves.at(-2).sort((a, b) => a - b), [Atom.QUICKSILVER, Atom.SILVER]);
  assert.deepEqual(metalMoves.at(-1), [Atom.GOLD]);
});
