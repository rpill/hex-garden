import assert from "node:assert/strict";
import test from "node:test";
import { tutorialPresentationStep } from "../src/game/presentation-model.js";
import { pieceAlphaForFilter } from "../src/game/piece-visual-state.js";
import { inventoryAnchorMetrics } from "../src/game/presentation-layout.js";

test("tutorial has exactly three calm presentation steps", () => {
  const steps = [0,1,2].map((step) => tutorialPresentationStep(step, false));
  assert.deepEqual(steps.map((step) => step.header), [
    "ОБУЧЕНИЕ · ШАГ 1/3",
    "ОБУЧЕНИЕ · ШАГ 2/3",
    "ОБУЧЕНИЕ · ШАГ 3/3",
  ]);
  for (const step of steps) {
    assert.ok(step.copy.length > 0);
    assert.equal(step.copy.includes("\n"), false);
  }
  assert.throws(() => tutorialPresentationStep(3, false));
});

test("inventory filtering dims non-matches instead of highlighting matches", () => {
  assert.equal(pieceAlphaForFilter({ filterActive: false, matchesFilter: false, locked: false }), 1);
  assert.equal(pieceAlphaForFilter({ filterActive: true, matchesFilter: true, locked: false }), 1);
  assert.ok(pieceAlphaForFilter({ filterActive: true, matchesFilter: false, locked: false }) < 1);
  assert.ok(pieceAlphaForFilter({ filterActive: false, matchesFilter: true, locked: true }) < 0.6);
});

test("inventory anchor follows board bottom rather than viewport bottom", () => {
  const result = inventoryAnchorMetrics({ boardBottom: 510, panelHeight: 62, viewportHeight: 900, gap: 14 });
  assert.equal(result.top, 524);
  assert.equal(result.centerY, 555);
});
