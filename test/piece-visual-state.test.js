import assert from "node:assert/strict";
import test from "node:test";

import { pieceFeedbackKind, pieceFilterEmphasis } from "../src/game/piece-visual-state.js";

test("piece feedback reserves rings for direct hint/block feedback", () => {
  assert.equal(pieceFeedbackKind({ panelMatch: true }), null);
  assert.equal(pieceFeedbackKind({ hinted: true }), "hinted");
  assert.equal(pieceFeedbackKind({ blocked: true }), "blocked");
});

test("piece feedback priority keeps blocked above hint and ignores panel filtering", () => {
  assert.equal(
    pieceFeedbackKind({ panelMatch: true, hinted: true, blocked: true }),
    "blocked",
  );
  assert.equal(
    pieceFeedbackKind({ panelMatch: true, hinted: true, blocked: false }),
    "hinted",
  );
  assert.equal(pieceFeedbackKind({}), null);
});

import { resolvePieceVisualState } from "../src/game/piece-visual-state.js";

test("board visual state keeps hover subtle and hint stronger/distinct", () => {
  const idle = resolvePieceVisualState({ free: true });
  const hover = resolvePieceVisualState({ free: true, hovered: true });
  const selected = resolvePieceVisualState({ free: true, selected: true });
  const hinted = resolvePieceVisualState({ free: true, hinted: true, now: 250 });

  assert.equal(idle.kind, "idle");
  assert.equal(hover.kind, "hover");
  assert.ok(hover.scale > 1 && hover.scale <= 1.05);
  assert.ok(hover.haloAlpha < selected.haloAlpha);
  assert.equal(hinted.kind, "hinted");
  assert.ok(hinted.haloAlpha > hover.haloAlpha);
});

test("blocked feedback wins over hint/selection and locked pieces stay muted", () => {
  const blocked = resolvePieceVisualState({
    free: false,
    selected: true,
    hinted: true,
    blocked: true,
    now: 0,
  });
  assert.equal(blocked.kind, "blocked");
  assert.ok(blocked.alpha < 0.7);
});


test("panel filtering never reduces piece alpha and only flags matches", () => {
  assert.deepEqual(pieceFilterEmphasis({ filterActive: true, matchesFilter: false }), { alphaMultiplier: 1, positiveMatch: false });
  assert.deepEqual(pieceFilterEmphasis({ filterActive: true, matchesFilter: true }), { alphaMultiplier: 1, positiveMatch: true });
});
