import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  ELEMENT_TYPES,
  TUTORIAL_GUIDED_MOVE_COUNT,
  campaignPostCompletionDestination,
  createTutorialLevel,
  findLongestEmptyNeighbourRun,
  replaySolution,
} from "../src/index.js";

test("tutorial demonstrates all four elements on a certified canonical 37-cell plate", () => {
  const record = createTutorialLevel();
  const counts = new Map();
  for (const piece of record.pieces) {
    counts.set(piece.type, (counts.get(piece.type) ?? 0) + 1);
  }

  assert.equal(record.shape, "tutorial-r3");
  assert.equal(record.plateRadius, 3);
  assert.equal(record.plateCells.length, 37);
  assert.equal(record.solution.length, 4);
  assert.equal(TUTORIAL_GUIDED_MOVE_COUNT, 3);
  assert.deepEqual(
    ELEMENT_TYPES.map((type) => counts.get(type)),
    [2, 2, 2, 2],
  );
  assert.equal(replaySolution(record.pieces, record.solution), true);
  const blocked = record.board
    .pieces()
    .find((piece) => !record.board.isFree(piece));
  assert.ok(blocked);
  assert.ok(
    findLongestEmptyNeighbourRun(record.pieces, record.solution[0][0]).length >=
      3,
  );
  assert.ok(findLongestEmptyNeighbourRun(record.pieces, blocked).length < 3);
});

test("campaign post-completion routing exposes first-session milestones without a treadmill", () => {
  assert.deepEqual(campaignPostCompletionDestination(3), { kind: "next", level: 4 });
  assert.deepEqual(campaignPostCompletionDestination(4), { kind: "home", reveal: "daily" });
  assert.deepEqual(campaignPostCompletionDestination(9), { kind: "home", reveal: "endless" });
  assert.deepEqual(campaignPostCompletionDestination(19), { kind: "chapter-next", level: 20 });
  assert.deepEqual(campaignPostCompletionDestination(29), { kind: "chapter-next", level: 30 });
  assert.deepEqual(campaignPostCompletionDestination(39), { kind: "chapter-next", level: 40 });
  assert.deepEqual(campaignPostCompletionDestination(49), { kind: "home", reveal: "campaign-complete" });
});

test("tutorial guide stays passive and completion restarts directly into campaign level 1", async () => {
  const [tutorialSource, boardSource] = await Promise.all([
    readFile(new URL("../src/game/board/BoardTutorial.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/game/scenes/BoardScene.ts", import.meta.url), "utf8"),
  ]);

  assert.match(tutorialSource, /from "\.\.\/minimal-ui\.js"/);
  assert.doesNotMatch(tutorialSource, /\.setInteractive\(/);
  assert.doesNotMatch(tutorialSource, /\.disableInteractive\(/);
  assert.match(
    boardSource,
    /this\.progress\.completeTutorial\(\);[\s\S]{0,220}this\.scene\.restart\(\{ mode: PlayMode\.CAMPAIGN, level: 0 \}\)/,
  );
  assert.doesNotMatch(boardSource, /showTutorialCompletion\(\)/);
});
