import test from "node:test";
import assert from "node:assert/strict";
import { Atom } from "../src/atom-types.js";
import { GardenBoard } from "../src/board.js";
import { generateCampaignLevel } from "../src/campaign.js";
import { replaySolution } from "../src/generator.js";
import { generateProgressionLevel } from "../src/progression.js";
import {
  SolveStatus,
  findLastSolvableSnapshot,
  findWinningRoute,
  moveKey,
} from "../src/solver.js";

function afterMove(pieces, move) {
  const board = new GardenBoard(pieces);
  for (const piece of move) board.select(piece);
  return board.pieces();
}

test("solver returns a certified move that leads to a full clear", () => {
  const record = generateCampaignLevel(0, { campaignSeed: "solver-test" });
  const result = findWinningRoute(record.pieces, {
    preferredSolution: record.solution,
    maxMilliseconds: 500,
  });
  assert.equal(result.status, SolveStatus.SOLVED);
  assert.equal(result.route.length, record.solution.length);
  assert.equal(replaySolution(record.pieces, result.route), true);
});

test("solver proves a position can be doomed even while it has a legal move", () => {
  const pieces = [
    { q: 5, r: 5, type: Atom.AIR },
    { q: 6, r: 5, type: Atom.AIR },
    { q: 4, r: 5, type: Atom.AIR },
  ];
  const board = new GardenBoard(pieces);
  assert.ok(board.legalMoves().length > 0);
  assert.equal(findWinningRoute(board).status, SolveStatus.DEAD_END);
});

test("an intentionally tiny budget reports unknown instead of a false dead end", () => {
  const record = generateCampaignLevel(1, { campaignSeed: "solver-budget" });
  const result = findWinningRoute(record.pieces, {
    maxVisited: 0,
  });
  assert.equal(result.status, SolveStatus.UNKNOWN);
});

test("rescue finds the last solvable state and identifies the move to block", () => {
  const record = generateProgressionLevel(1, {
    campaignSeed: "solver-rescue",
  });
  const board = new GardenBoard(record.pieces);
  const losingMove = board.legalMoves().find((move) =>
    findWinningRoute(afterMove(record.pieces, move), {
      preferredSolution: record.solution,
      maxMilliseconds: 500,
    }).status === SolveStatus.DEAD_END,
  );
  assert.ok(losingMove, "curated challenge should expose a losing opening");
  const deadPieces = afterMove(record.pieces, losingMove);
  const rescue = findLastSolvableSnapshot(
    [{ pieces: record.pieces }],
    deadPieces,
    { preferredSolution: record.solution, maxMilliseconds: 500 },
  );
  assert.equal(rescue.status, SolveStatus.SOLVED);
  assert.equal(moveKey(rescue.blockedMove), moveKey(losingMove));
  assert.equal(replaySolution(record.pieces, rescue.route), true);
});
