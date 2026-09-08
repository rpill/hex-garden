import assert from "node:assert/strict";
import test from "node:test";

import {
  pieceFeedbackKind,
  pieceFilterEmphasis,
  resolvePieceVisualState,
} from "../src/game/piece-visual-state.js";

test("piece visual states are semantic locked available and selected states", () => {
  const locked = resolvePieceVisualState({ free: false });
  const available = resolvePieceVisualState({ free: true });
  const selected = resolvePieceVisualState({ free: true, selected: true });

  assert.equal(locked.kind, "locked");
  assert.equal(available.kind, "available");
  assert.equal(selected.kind, "selected");
  assert.ok(locked.alpha < available.alpha);
  assert.equal(available.scale, 1);
  assert.equal(selected.scale, 1.03);
  assert.ok(selected.depth > available.depth);
  assert.ok(available.depth > locked.depth);
});

test("hover stays subtle without inventing another availability state", () => {
  const available = resolvePieceVisualState({ free: true });
  const hovered = resolvePieceVisualState({ free: true, hovered: true });

  assert.equal(hovered.kind, "available");
  assert.ok(hovered.scale > available.scale);
  assert.ok(hovered.scale < 1.03);
  assert.ok(hovered.depth >= available.depth);
});

test("direct hint and blocked feedback stays separate from availability state", () => {
  assert.equal(pieceFeedbackKind({ hinted: true }), "hinted");
  assert.equal(pieceFeedbackKind({ blocked: true }), "blocked");
  assert.equal(pieceFeedbackKind({ hinted: true, blocked: true }), "blocked");
  assert.equal(pieceFeedbackKind({}), null);
});

test("panel filtering never dims pieces and only flags positive matches", () => {
  assert.deepEqual(
    pieceFilterEmphasis({ filterActive: true, matchesFilter: false }),
    { alphaMultiplier: 1, positiveMatch: false },
  );
  assert.deepEqual(
    pieceFilterEmphasis({ filterActive: true, matchesFilter: true }),
    { alphaMultiplier: 1, positiveMatch: true },
  );
});
