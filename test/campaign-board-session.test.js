import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Atom } from "../src/atom-types.js";
import { getCampaignLevel } from "../src/campaign-levels.js";
import { CampaignBoardSession } from "../src/game/board/CampaignBoardSession.js";

function normalizedPieces(pieces) {
  return pieces
    .map(({ q, r, type }) => ({ q, r, type }))
    .sort((left, right) => left.q - right.q || left.r - right.r || left.type.localeCompare(right.type));
}

test("campaign session undo restores the exact fixed board and preserves Clean", () => {
  const level = getCampaignLevel(0);
  const session = new CampaignBoardSession(level);
  const initial = normalizedPieces(session.board.pieces());
  const firstMove = level.solution[0];
  assert.ok(firstMove?.length > 0);

  session.recordBeforeRemoval();
  let result;
  for (const coord of firstMove) result = session.board.select(coord);
  assert.equal(result?.kind, "removed");
  assert.notDeepEqual(normalizedPieces(session.board.pieces()), initial);
  assert.equal(session.cleanEligible, true);
  assert.equal(session.canUndo, true);

  assert.equal(session.undo(), true);
  assert.deepEqual(normalizedPieces(session.board.pieces()), initial);
  assert.equal(session.cleanEligible, true);
  assert.equal(session.history.length, 0);
});

test("hint invalidates Clean while restart restores a fresh attempt", () => {
  const level = getCampaignLevel(0);
  const session = new CampaignBoardSession(level);

  session.markHintUsed();
  assert.equal(session.cleanEligible, false);

  session.recordBeforeRemoval();
  session.restart();
  assert.equal(session.cleanEligible, true);
  assert.equal(session.rescueUsed, false);
  assert.equal(session.history.length, 0);
  assert.deepEqual(normalizedPieces(session.board.pieces()), normalizedPieces(level.pieces));
});

test("visible dead-end Rescue is one-use and invalidates Clean", () => {
  const base = getCampaignLevel(0);
  const level = {
    ...base,
    pieces: [
      { q: -3, r: 0, type: Atom.SALT },
      { q: 3, r: 0, type: Atom.SALT },
      { q: 0, r: -3, type: Atom.AIR },
      { q: 0, r: 3, type: Atom.FIRE },
    ],
    solution: [
      [
        { q: -3, r: 0 },
        { q: 0, r: -3 },
      ],
      [
        { q: 3, r: 0 },
        { q: 0, r: 3 },
      ],
    ],
  };
  const session = new CampaignBoardSession(level);

  session.recordBeforeRemoval();
  session.board.select({ q: -3, r: 0 });
  const result = session.board.select({ q: 3, r: 0 });
  assert.equal(result.kind, "removed");
  assert.equal(session.board.won, false);
  assert.equal(session.board.legalMoves().length, 0);
  assert.equal(session.canRescue, true);

  assert.equal(session.markRescueUsed(), true);
  assert.equal(session.cleanEligible, false);
  assert.equal(session.rescueUsed, true);
  assert.equal(session.canRescue, false);
  assert.equal(session.markRescueUsed(), false);
});

test("BoardScene loads Campaign through the fixed session instead of the generator worker", async () => {
  const source = await readFile(new URL("../src/game/scenes/BoardScene.ts", import.meta.url), "utf8");
  assert.match(source, /new CampaignBoardSession\(getCampaignLevel\(this\.level\)\)/);
  assert.doesNotMatch(source, /PlayMode\.CAMPAIGN\s*\?\s*await this\.generator\.generate\(this\.level\)/);
});
