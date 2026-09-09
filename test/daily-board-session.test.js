import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Atom } from "../src/atom-types.js";
import { DailyProgressStore } from "../src/daily-progress.js";
import { DailyBoardSession } from "../src/game/board/DailyBoardSession.js";
import { SolveStatus } from "../src/solver.js";

class MemoryStorage {
  data = new Map();
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { this.data.set(key, value); }
  removeItem(key) { this.data.delete(key); }
}

const DATE_KEY = "2026-09-08";

function puzzle() {
  return {
    dateKey: DATE_KEY,
    pieces: [
      { q: 0, r: 0, type: Atom.AIR },
      { q: 1, r: 0, type: Atom.AIR },
    ],
    solution: [[{ q: 0, r: 0 }, { q: 1, r: 0 }]],
  };
}

function solve(session) {
  session.recordBeforeRemoval();
  session.board.select({ q: 0, r: 0 });
  const result = session.board.select({ q: 1, r: 0 });
  assert.equal(result.kind, "removed");
  assert.equal(session.board.won, true);
}

test("DailyBoardSession module exists as the Daily attempt boundary", async () => {
  let source = "";
  try {
    source = await readFile(new URL("../src/game/board/DailyBoardSession.ts", import.meta.url), "utf8");
  } catch {
    source = "";
  }
  assert.match(source, /export class DailyBoardSession/);
});

test("Daily starts Clean-eligible with its own board", () => {
  const progress = new DailyProgressStore({ storage: new MemoryStorage() });
  const session = new DailyBoardSession(puzzle(), progress);

  assert.equal(session.cleanEligible, true);
  assert.equal(session.rescueUsed, false);
  assert.equal(session.board.size, 2);
});

test("assisted Daily solve can be replayed and upgraded to Clean", () => {
  const progress = new DailyProgressStore({ storage: new MemoryStorage() });

  const assisted = new DailyBoardSession(puzzle(), progress);
  assisted.markHintUsed();
  solve(assisted);
  const first = assisted.complete(DATE_KEY);
  assert.equal(first.kind, "recorded");
  assert.equal(first.clean, false);
  assert.deepEqual(progress.snapshot.entries[DATE_KEY], { solved: true, clean: false });

  const replay = new DailyBoardSession(puzzle(), progress);
  solve(replay);
  const second = replay.complete(DATE_KEY);
  assert.equal(second.kind, "recorded");
  assert.equal(second.clean, true);
  assert.deepEqual(progress.snapshot.entries[DATE_KEY], { solved: true, clean: true });
});

test("Daily Undo restores the board without invalidating Clean", () => {
  const progress = new DailyProgressStore({ storage: new MemoryStorage() });
  const session = new DailyBoardSession(puzzle(), progress);

  session.recordBeforeRemoval();
  session.board.select({ q: 0, r: 0 });
  session.board.select({ q: 1, r: 0 });
  assert.equal(session.canUndo, false, "won boards cannot be undone after completion");

  session.restart();
  session.recordBeforeRemoval();
  session.board.select({ q: 0, r: 0 });
  session.board.select({ q: 1, r: 0 });
  // Restore from a non-winning state using a larger puzzle in the dedicated session below.
  const larger = new DailyBoardSession({
    dateKey: DATE_KEY,
    pieces: [
      { q: -2, r: 0, type: Atom.AIR },
      { q: -1, r: 0, type: Atom.AIR },
      { q: 1, r: 0, type: Atom.FIRE },
      { q: 2, r: 0, type: Atom.FIRE },
    ],
    solution: [
      [{ q: -2, r: 0 }, { q: -1, r: 0 }],
      [{ q: 1, r: 0 }, { q: 2, r: 0 }],
    ],
  }, progress);
  larger.recordBeforeRemoval();
  larger.board.select({ q: -2, r: 0 });
  larger.board.select({ q: -1, r: 0 });
  assert.equal(larger.canUndo, true);
  assert.equal(larger.undo(), true);
  assert.equal(larger.cleanEligible, true);
  assert.equal(larger.board.size, 4);
});

test("Daily completion refuses an expired Moscow date and does not persist", () => {
  const progress = new DailyProgressStore({ storage: new MemoryStorage() });
  const session = new DailyBoardSession(puzzle(), progress);
  solve(session);

  const completion = session.complete("2026-09-09");

  assert.equal(completion.kind, "expired");
  assert.equal(progress.snapshot.entries[DATE_KEY], undefined);
});

test("Daily hint always requires rewarded confirmation and invalidates Clean only after reward", async () => {
  const progress = new DailyProgressStore({ storage: new MemoryStorage() });
  const session = new DailyBoardSession(puzzle(), progress);
  let rewardRequired;
  const result = await session.requestHint({
    findHint() {
      return { status: SolveStatus.SOLVED, route: puzzle().solution, visited: 1 };
    },
    async confirmReward(required) {
      rewardRequired = required;
      return true;
    },
  });

  assert.equal(rewardRequired, true);
  assert.equal(result.kind, "revealed");
  assert.equal(session.cleanEligible, false);
});

test("Daily Rescue is one rewarded restore per attempt", async () => {
  const progress = new DailyProgressStore({ storage: new MemoryStorage() });
  const daily = {
    dateKey: DATE_KEY,
    pieces: [
      { q: -3, r: 0, type: Atom.SALT },
      { q: 3, r: 0, type: Atom.SALT },
      { q: 0, r: -3, type: Atom.AIR },
      { q: 0, r: 3, type: Atom.FIRE },
    ],
    solution: [
      [{ q: -3, r: 0 }, { q: 0, r: -3 }],
      [{ q: 3, r: 0 }, { q: 0, r: 3 }],
    ],
  };
  const session = new DailyBoardSession(daily, progress);
  session.recordBeforeRemoval();
  const snapshot = session.history[0];
  session.board.select({ q: -3, r: 0 });
  session.board.select({ q: 3, r: 0 });
  assert.equal(session.actualDeadEnd, true);
  assert.equal(session.canRescue, true);

  let rewardRequired;
  const result = await session.requestRescue({
    findRescue() {
      return {
        status: SolveStatus.SOLVED,
        index: 0,
        snapshot,
        blockedMove: [{ q: -3, r: 0 }, { q: 3, r: 0 }],
        route: daily.solution,
      };
    },
    async confirmReward(required) {
      rewardRequired = required;
      return true;
    },
  });

  assert.equal(rewardRequired, true);
  assert.equal(result.kind, "restored");
  assert.equal(session.rescueUsed, true);
  assert.equal(session.cleanEligible, false);
  assert.equal(session.canRescue, false);
  assert.equal(session.board.size, 4);
});

test("BoardScene loads Daily from trusted Yandex time and rechecks rollover before persistence", async () => {
  const source = await readFile(new URL("../src/game/scenes/BoardScene.ts", import.meta.url), "utf8");

  assert.match(source, /getTrustedClock\(\)\.now\(\)/);
  assert.match(source, /dailyDateKey\(/);
  assert.match(source, /generateDaily\(/);
  assert.match(source, /new DailyBoardSession\(/);
  assert.match(source, /session\.complete\(/);
  assert.match(source, /NEW DAILY AVAILABLE/);
  assert.doesNotMatch(source, /Daily mode is not implemented yet/);
});

test("BoardScene routes Daily Hint, Rescue, Undo and Clean state through DailyBoardSession", async () => {
  const source = await readFile(new URL("../src/game/scenes/BoardScene.ts", import.meta.url), "utf8");

  assert.match(source, /dailySession/);
  assert.match(source, /PlayMode\.DAILY/);
  assert.match(source, /dailySession\.recordBeforeRemoval/);
  assert.match(source, /dailySession\.restart\(\)/);
  assert.match(source, /dailySession\.undo\(\)/);
  assert.match(source, /dailySession\?\.cleanEligible/);
  assert.match(source, /dailySession\.requestHint\(/);
  assert.match(source, /dailySession\.requestRescue\(/);
});
