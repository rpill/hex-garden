import test from "node:test";
import assert from "node:assert/strict";
import {
  CAMPAIGN_MECHANIC_INTRODUCTIONS,
  generateProgressionLevel,
  mechanicIntroductionForLevel,
  replaySolution,
} from "../src/index.js";

test("every early mechanic card describes atoms required by that level", () => {
  const levels = Object.keys(CAMPAIGN_MECHANIC_INTRODUCTIONS).map(Number);
  assert.deepEqual(levels, [1, 2, 3, 4, 5, 6, 7, 8, 12]);

  for (const level of levels) {
    const introduction = mechanicIntroductionForLevel(level);
    const record = generateProgressionLevel(level, {
      campaignSeed: "mechanic-introduction-contract",
    });
    const presentTypes = new Set(record.pieces.map((piece) => piece.type));

    assert.ok(introduction.text.length > 0);
    assert.equal(
      introduction.requiredTypes.every((type) => presentTypes.has(type)),
      true,
    );
    assert.equal(replaySolution(record.pieces, record.solution), true);
  }
});

test("mechanic cards do not expose internal English atom names", () => {
  const internalNames =
    /\b(?:NEW|SALT|VITAE|MORS|LEAD|TIN|IRON|COPPER|SILVER|GOLD|QUICKSILVER|QUINTESSENCE)\b/i;

  for (const introduction of Object.values(
    CAMPAIGN_MECHANIC_INTRODUCTIONS,
  )) {
    assert.doesNotMatch(introduction.text, internalNames);
  }

  assert.match(mechanicIntroductionForLevel(3).text, /СВИНЕЦ \(Pb\)/);
  assert.match(mechanicIntroductionForLevel(3).text, /РТУТЬ \(Hg\)/);
  assert.match(mechanicIntroductionForLevel(4).text, /ОЛОВО \(Sn\)/);
  assert.match(mechanicIntroductionForLevel(4).text, /СВИНЕЦ \(Pb\)/);
});
