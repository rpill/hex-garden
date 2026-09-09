import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Atom } from "../src/atom-types.js";
import { getCampaignLevel } from "../src/campaign-levels.js";
import { CampaignBoardSession } from "../src/game/board/CampaignBoardSession.js";
import { SolveStatus } from "../src/solver.js";

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


test("unknown campaign hint does not request reward or invalidate Clean", async () => {
  const level = getCampaignLevel(0);
  const session = new CampaignBoardSession(level);
  let rewardCalls = 0;
  const assistance = {
    findHint() {
      return { status: SolveStatus.UNKNOWN, route: [], visited: 1 };
    },
    async confirmReward() {
      rewardCalls += 1;
      return true;
    },
  };

  const result = await session.requestHint(assistance, true, level.solution);

  assert.equal(result.kind, "unavailable");
  assert.equal(result.solverStatus, SolveStatus.UNKNOWN);
  assert.equal(rewardCalls, 0);
  assert.equal(session.cleanEligible, true);
});

test("verified campaign hint reveals only the first move after reward and then invalidates Clean", async () => {
  const level = getCampaignLevel(0);
  const session = new CampaignBoardSession(level);
  const route = level.solution.slice(0, 2);
  assert.ok(route.length > 0);
  let rewardCalls = 0;
  const assistance = {
    findHint() {
      return { status: SolveStatus.SOLVED, route, visited: 2 };
    },
    async confirmReward(required) {
      rewardCalls += 1;
      assert.equal(required, true);
      return true;
    },
  };

  const result = await session.requestHint(assistance, true, level.solution);

  assert.equal(result.kind, "revealed");
  assert.deepEqual(result.move, route[0]);
  assert.equal("route" in result, false);
  assert.equal(rewardCalls, 1);
  assert.equal(session.cleanEligible, false);
});

test("declined rewarded hint keeps campaign attempt Clean", async () => {
  const level = getCampaignLevel(5);
  const session = new CampaignBoardSession(level);
  let rewardCalls = 0;
  const assistance = {
    findHint() {
      return { status: SolveStatus.SOLVED, route: level.solution.slice(0, 1), visited: 1 };
    },
    async confirmReward() {
      rewardCalls += 1;
      return false;
    },
  };

  const result = await session.requestHint(assistance, true, level.solution);

  assert.equal(result.kind, "reward-denied");
  assert.equal(rewardCalls, 1);
  assert.equal(session.cleanEligible, true);
});

test("campaign rescue is not even searched before a true visible dead end", async () => {
  const level = getCampaignLevel(0);
  const session = new CampaignBoardSession(level);
  session.recordBeforeRemoval();
  let solverCalls = 0;
  let rewardCalls = 0;
  const assistance = {
    findRescue() {
      solverCalls += 1;
      return { status: SolveStatus.DEAD_END };
    },
    async confirmReward() {
      rewardCalls += 1;
      return true;
    },
  };

  assert.ok(session.board.legalMoves().length > 0);
  assert.equal(session.actualDeadEnd, false);

  const result = await session.requestRescue(assistance, true, level.solution);

  assert.equal(result.kind, "not-eligible");
  assert.equal(solverCalls, 0);
  assert.equal(rewardCalls, 0);
  assert.equal(session.cleanEligible, true);
  assert.equal(session.rescueUsed, false);
});

test("verified campaign rescue restores the solver snapshot only after reward", async () => {
  const base = getCampaignLevel(0);
  const level = {
    ...base,
    pieces: [
      { q: -3, r: 0, type: Atom.SALT },
      { q: 3, r: 0, type: Atom.SALT },
      { q: 0, r: -3, type: Atom.AIR },
      { q: 0, r: 3, type: Atom.FIRE },
    ],
  };
  const session = new CampaignBoardSession(level);
  session.recordBeforeRemoval();
  const snapshot = session.history[0];
  assert.ok(snapshot);
  session.board.select({ q: -3, r: 0 });
  const removal = session.board.select({ q: 3, r: 0 });
  assert.equal(removal.kind, "removed");
  assert.equal(session.actualDeadEnd, true);
  assert.equal(session.canRescue, true);

  let rewardCalls = 0;
  const rescueRoute = [[
    { q: -3, r: 0, type: Atom.SALT },
    { q: 0, r: -3, type: Atom.AIR },
  ]];
  const assistance = {
    findRescue(history, currentPieces) {
      assert.equal(history.length, 1);
      assert.deepEqual(normalizedPieces(currentPieces), normalizedPieces(session.board.pieces()));
      return {
        status: SolveStatus.SOLVED,
        index: 0,
        snapshot,
        blockedMove: [
          { q: -3, r: 0, type: Atom.SALT },
          { q: 3, r: 0, type: Atom.SALT },
        ],
        route: rescueRoute,
      };
    },
    async confirmReward(required) {
      rewardCalls += 1;
      assert.equal(required, true);
      return true;
    },
  };

  const result = await session.requestRescue(assistance, true, level.solution);

  assert.equal(result.kind, "restored");
  assert.equal(rewardCalls, 1);
  assert.deepEqual(normalizedPieces(session.board.pieces()), normalizedPieces(snapshot.pieces));
  assert.equal(session.history.length, 0);
  assert.equal(session.cleanEligible, false);
  assert.equal(session.rescueUsed, true);
  assert.equal(session.canRescue, false);
  assert.deepEqual(result.blockedMove.map(({ q, r }) => ({ q, r })), [
    { q: -3, r: 0 },
    { q: 3, r: 0 },
  ]);
  assert.deepEqual(result.route[0].map(({ q, r }) => ({ q, r })), [
    { q: -3, r: 0 },
    { q: 0, r: -3 },
  ]);
});

test("unverified or unrewarded campaign rescue leaves board history and attempt untouched", async () => {
  const base = getCampaignLevel(0);
  const level = {
    ...base,
    pieces: [
      { q: -3, r: 0, type: Atom.SALT },
      { q: 3, r: 0, type: Atom.SALT },
      { q: 0, r: -3, type: Atom.AIR },
      { q: 0, r: 3, type: Atom.FIRE },
    ],
  };

  for (const scenario of ["unknown", "reward-denied"]) {
    const session = new CampaignBoardSession(level);
    session.recordBeforeRemoval();
    const snapshot = session.history[0];
    assert.ok(snapshot);
    session.board.select({ q: -3, r: 0 });
    session.board.select({ q: 3, r: 0 });
    assert.equal(session.actualDeadEnd, true);

    const beforePieces = normalizedPieces(session.board.pieces());
    const beforeHistory = session.history.map((entry) => normalizedPieces(entry.pieces));
    const beforeAttempt = { ...session.attempt };
    let rewardCalls = 0;
    const assistance = {
      findRescue() {
        if (scenario === "unknown") return { status: SolveStatus.UNKNOWN };
        return {
          status: SolveStatus.SOLVED,
          index: 0,
          snapshot,
          blockedMove: [
            { q: -3, r: 0, type: Atom.SALT },
            { q: 3, r: 0, type: Atom.SALT },
          ],
          route: [],
        };
      },
      async confirmReward() {
        rewardCalls += 1;
        return false;
      },
    };

    const result = await session.requestRescue(assistance, true, level.solution);

    assert.equal(result.kind, scenario === "unknown" ? "unavailable" : "reward-denied");
    assert.equal(rewardCalls, scenario === "unknown" ? 0 : 1);
    assert.deepEqual(normalizedPieces(session.board.pieces()), beforePieces);
    assert.deepEqual(session.history.map((entry) => normalizedPieces(entry.pieces)), beforeHistory);
    assert.deepEqual(session.attempt, beforeAttempt);
  }
});

test("successful campaign rescue is one-use even after another visible dead end", async () => {
  const base = getCampaignLevel(0);
  const level = {
    ...base,
    pieces: [
      { q: -3, r: 0, type: Atom.SALT },
      { q: 3, r: 0, type: Atom.SALT },
      { q: 0, r: -3, type: Atom.AIR },
      { q: 0, r: 3, type: Atom.FIRE },
    ],
  };
  const session = new CampaignBoardSession(level);
  session.recordBeforeRemoval();
  const snapshot = session.history[0];
  assert.ok(snapshot);
  session.board.select({ q: -3, r: 0 });
  session.board.select({ q: 3, r: 0 });

  const assistance = {
    findRescue() {
      return {
        status: SolveStatus.SOLVED,
        index: 0,
        snapshot,
        blockedMove: [
          { q: -3, r: 0, type: Atom.SALT },
          { q: 3, r: 0, type: Atom.SALT },
        ],
        route: [],
      };
    },
    async confirmReward() {
      return true;
    },
  };

  assert.equal((await session.requestRescue(assistance, false, level.solution)).kind, "restored");
  session.recordBeforeRemoval();
  session.board.select({ q: -3, r: 0 });
  session.board.select({ q: 3, r: 0 });
  assert.equal(session.actualDeadEnd, true);
  assert.equal(session.canRescue, false);

  let calls = 0;
  const second = await session.requestRescue({
    findRescue() {
      calls += 1;
      return { status: SolveStatus.DEAD_END };
    },
    async confirmReward() {
      calls += 1;
      return true;
    },
  }, false, level.solution);
  assert.equal(second.kind, "not-eligible");
  assert.equal(calls, 0);
});

test("BoardScene exposes contextual campaign dead-end actions through the bottom HUD", async () => {
  const [source, hud] = await Promise.all([
    readFile(new URL("../src/game/scenes/BoardScene.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/game/board/BoardHud.ts", import.meta.url), "utf8"),
  ]);
  assert.match(source, /enterCampaignDeadEndState\(\)/);
  assert.match(source, /requestCampaignRescue\(\)/);
  assert.match(source, /setCampaignDeadEndState\(/);
  assert.doesNotMatch(source, /campaignDeadEndRestartButton/);
  assert.doesNotMatch(source, /campaignDeadEndRescueButton/);
  assert.match(source, /session\.canRescue/);
  assert.match(hud, /"ЗАНОВО"/);
  assert.match(hud, /"СПАСТИ"/);
});
