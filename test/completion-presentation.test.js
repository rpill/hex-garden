import assert from "node:assert/strict";
import test from "node:test";
import { COMPLETION_DEPTHS, completionActionMetrics } from "../src/game/presentation-layout.js";

test("completion actions fit inside card with a real gap", () => {
  const metrics = completionActionMetrics(380, { primaryHeight: 40, secondaryHeight: 34, gap: 12, bottomPadding: 20 });
  const primaryBottom = metrics.primaryY + 20;
  const secondaryTop = metrics.secondaryY - 17;
  assert.ok(secondaryTop - primaryBottom >= 12);
  assert.ok(metrics.secondaryY + 17 <= 380 - 20 + 0.001);
});

test("completion progress renders above the card surface", () => {
  assert.ok(COMPLETION_DEPTHS.progress > COMPLETION_DEPTHS.card);
  assert.ok(COMPLETION_DEPTHS.card > COMPLETION_DEPTHS.dim);
});
