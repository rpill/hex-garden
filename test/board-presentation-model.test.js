import assert from "node:assert/strict";
import test from "node:test";
import { tutorialPresentationStep } from "../src/game/presentation-model.js";
import { chooseCalloutPlacement } from "../src/game/tutorial-callout-layout.js";
import { pieceFilterEmphasis } from "../src/game/piece-visual-state.js";
import { inventoryAnchorMetrics, inventoryCountOffset } from "../src/game/presentation-layout.js";

test("tutorial exposes exactly three contextual one-sentence messages", () => {
  const steps = [0, 1, 2].map((step) => tutorialPresentationStep(step, false));
  assert.deepEqual(
    steps.map((step) => step.copy),
    [
      "Очисти поле: выбери две одинаковые доступные фишки.",
      "Три пустые клетки подряд делают фишку доступной.",
      "Здесь видно, сколько фишек каждого типа осталось.",
    ],
  );
  for (const step of steps) assert.equal(step.copy.includes("\n"), false);
  assert.throws(() => tutorialPresentationStep(3, false));
});

test("contextual tutorial callout avoids representative target bounds", () => {
  const target = { left: 150, top: 150, right: 250, bottom: 220 };
  const placement = chooseCalloutPlacement({
    targetBounds: target,
    viewport: { width: 800, height: 600 },
    callout: { width: 240, height: 64 },
    preferredSides: ["right", "top", "bottom", "left"],
  });
  assert.equal(placement.side, "right");

  const callout = {
    left: placement.x - 120,
    right: placement.x + 120,
    top: placement.y - 32,
    bottom: placement.y + 32,
  };
  const overlaps = !(
    callout.right <= target.left ||
    callout.left >= target.right ||
    callout.bottom <= target.top ||
    callout.top >= target.bottom
  );
  assert.equal(overlaps, false);
});

test("inventory filtering leaves non-matches unchanged and positively marks matches", () => {
  assert.deepEqual(
    pieceFilterEmphasis({ filterActive: false, matchesFilter: false }),
    { alphaMultiplier: 1, positiveMatch: false },
  );
  assert.deepEqual(
    pieceFilterEmphasis({ filterActive: true, matchesFilter: false }),
    { alphaMultiplier: 1, positiveMatch: false },
  );
  assert.deepEqual(
    pieceFilterEmphasis({ filterActive: true, matchesFilter: true }),
    { alphaMultiplier: 1, positiveMatch: true },
  );
});

test("inventory count sits beside the glyph on the same baseline", () => {
  const offset = inventoryCountOffset(20);
  assert.ok(offset.x > 20 * 0.5);
  assert.equal(offset.y, 0);
});

test("inventory anchor follows board bottom rather than viewport bottom", () => {
  const result = inventoryAnchorMetrics({ boardBottom: 510, panelHeight: 62, viewportHeight: 900, gap: 14 });
  assert.equal(result.top, 524);
  assert.equal(result.centerY, 555);
});
