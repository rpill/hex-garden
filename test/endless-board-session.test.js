import assert from "node:assert/strict";
import test from "node:test";
import { EndlessBoardSession } from "../src/game/board/EndlessBoardSession.js";

const SNAPSHOT_A = [
  { q: 0, r: 0, type: "air" },
  { q: 1, r: 0, type: "air" },
];
const SNAPSHOT_B = [
  { q: -1, r: 0, type: "fire" },
  { q: 1, r: 0, type: "fire" },
];

test("endless run starts at zero boards and unassisted", () => {
  const session = new EndlessBoardSession();

  assert.equal(session.boardsCleared, 0);
  assert.equal(session.assisted, false);
  assert.equal(session.rescueUsed, false);
  assert.equal(session.deadEnd, false);
  assert.equal(session.history.length, 0);
});

test("clearing a board resets board history but preserves run assistance", () => {
  const session = new EndlessBoardSession();
  session.recordBeforeRemoval(SNAPSHOT_A);
  session.markHintUsed();

  session.clearBoard();

  assert.equal(session.boardsCleared, 1);
  assert.equal(session.history.length, 0);
  assert.equal(session.deadEnd, false);
  assert.equal(session.assisted, true);
});

test("Undo is free before dead end and unavailable once the visible dead end is entered", () => {
  const session = new EndlessBoardSession();
  session.recordBeforeRemoval(SNAPSHOT_A);
  session.recordBeforeRemoval(SNAPSHOT_B);

  assert.equal(session.canUndo(), true);
  const snapshot = session.undoSnapshot();
  assert.deepEqual(snapshot?.pieces, SNAPSHOT_B);
  assert.equal(session.assisted, false);
  assert.equal(session.history.length, 1);

  const deadEnd = session.enterDeadEnd();
  assert.equal(deadEnd.kind, "rescuable");
  assert.equal(session.canUndo(), false);
  assert.equal(session.undoSnapshot(), undefined);
});

test("Hint marks the entire run assisted permanently", () => {
  const session = new EndlessBoardSession();

  session.markHintUsed();
  session.clearBoard();
  session.clearBoard();

  assert.equal(session.assisted, true);
  assert.equal(session.boardsCleared, 2);
});

test("Rescue is available once and the later true dead end is terminal", () => {
  const session = new EndlessBoardSession();
  session.recordBeforeRemoval(SNAPSHOT_A);

  const firstDeadEnd = session.enterDeadEnd();
  assert.equal(firstDeadEnd.kind, "rescuable");
  assert.equal(session.canRescue(), true);
  assert.equal(session.markRescueUsed(), true);
  assert.equal(session.rescueUsed, true);
  assert.equal(session.assisted, true);
  assert.equal(session.deadEnd, false);
  assert.equal(session.canRescue(), false);

  session.clearBoard();
  session.recordBeforeRemoval(SNAPSHOT_B);
  const secondDeadEnd = session.enterDeadEnd();

  assert.equal(secondDeadEnd.kind, "terminal");
  assert.equal(secondDeadEnd.boardsCleared, 1);
  assert.equal(secondDeadEnd.assisted, true);
  assert.equal(session.deadEnd, true);
  assert.equal(session.canRescue(), false);
  assert.equal(session.canUndo(), false);
  assert.equal(session.markRescueUsed(), false);
});
