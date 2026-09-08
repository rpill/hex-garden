import test from "node:test";
import assert from "node:assert/strict";
import {
  Atom,
  BoardVariant,
  CAMPAIGN_LEVEL_COUNT,
  campaignPlateSize,
  generateCampaignLevel,
  hexKey,
  plateSpec,
  replaySolution,
} from "../src/index.js";

const METAL_ORDER = [
  Atom.LEAD,
  Atom.TIN,
  Atom.IRON,
  Atom.COPPER,
  Atom.SILVER,
  Atom.GOLD,
];

test("frozen campaign occupancy stays inside each canonical plate contract", () => {
  for (let level = 0; level < CAMPAIGN_LEVEL_COUNT; level += 1) {
    const record = generateCampaignLevel(level);
    const spec = plateSpec(campaignPlateSize(level));
    assert.ok(record.pieces.length >= spec.minPieces, `level ${level + 1} minimum occupancy`);
    assert.ok(record.pieces.length <= spec.maxPieces, `level ${level + 1} maximum occupancy`);
    assert.equal(new Set(record.pieces.map(hexKey)).size, record.pieces.length);
    assert.equal(record.pieces.some((piece) => piece.type === Atom.QUINTESSENCE), false);
    assert.equal(replaySolution(record.pieces, record.solution), true);
  }
});

test("legacy campaign seed and variant options no longer change frozen content", () => {
  const baseline = generateCampaignLevel(7);
  const legacyStandard = generateCampaignLevel(7, {
    campaignSeed: "composition-a",
    variant: BoardVariant.STANDARD,
  });
  const legacyQuintessence = generateCampaignLevel(7, {
    campaignSeed: "composition-b",
    variant: BoardVariant.QUINTESSENCE,
  });

  assert.deepEqual(legacyStandard.pieces, baseline.pieces);
  assert.deepEqual(legacyStandard.solution, baseline.solution);
  assert.deepEqual(legacyQuintessence.pieces, baseline.pieces);
  assert.deepEqual(legacyQuintessence.solution, baseline.solution);
  assert.equal(legacyQuintessence.variant, BoardVariant.STANDARD);
});

test("campaign certificates that contain metals remove them in progression order", () => {
  let checked = 0;
  for (let level = 0; level < CAMPAIGN_LEVEL_COUNT; level += 1) {
    const record = generateCampaignLevel(level);
    const typesAt = new Map(record.pieces.map((piece) => [hexKey(piece), piece.type]));
    const metalMoves = record.solution
      .map((move) => move.map((position) => typesAt.get(hexKey(position))))
      .filter((types) => types.some((type) => METAL_ORDER.includes(type)));
    if (metalMoves.length === 0) continue;

    const removedMetals = metalMoves.map((types) =>
      types.find((type) => type !== Atom.QUICKSILVER),
    );
    assert.deepEqual(
      removedMetals,
      METAL_ORDER.slice(0, removedMetals.length),
      `level ${level + 1} metal order`,
    );
    if (removedMetals.at(-1) === Atom.GOLD) {
      assert.deepEqual(metalMoves.at(-2).sort((a, b) => a - b), [Atom.QUICKSILVER, Atom.SILVER]);
      assert.deepEqual(metalMoves.at(-1), [Atom.GOLD]);
    }
    checked += 1;
  }
  assert.ok(checked > 0, "expected frozen campaign to contain metal-chain levels");
});
