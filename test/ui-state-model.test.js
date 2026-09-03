import assert from "node:assert/strict";
import test from "node:test";
import { buttonVisualState } from "../src/game/presentation-model.js";

test("level hover preserves semantic state and stays subtle", () => {
  for (const semanticState of ["completed", "current", "idle"]) {
    const state = buttonVisualState({ semanticState, hovered: true, enabled: semanticState !== "locked" });
    assert.equal(state.semanticState, semanticState);
    assert.ok(state.scale >= 1 && state.scale <= 1.025);
    assert.ok(state.alpha >= 0.82 && state.alpha <= 1);
  }
});

test("disabled state stays disabled while hovered", () => {
  const state = buttonVisualState({ semanticState: "locked", hovered: true, enabled: false });
  assert.equal(state.semanticState, "locked");
  assert.equal(state.enabled, false);
  assert.ok(state.alpha < 0.75);
});
