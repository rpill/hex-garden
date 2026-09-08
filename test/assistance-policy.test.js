import test from "node:test";
import assert from "node:assert/strict";
import { Atom } from "../src/atom-types.js";
import { PlayMode } from "../src/game/modes.js";
import { assistancePolicy } from "../src/game/board/assistance-policy.js";
import { BoardAssistance } from "../src/game/board/BoardAssistance.js";
import { RewardedAdStatus } from "../src/platform/yandex-games.js";
import { SolveStatus } from "../src/solver.js";

test("campaign levels one through five have free onboarding assistance", () => {
  for (let level = 0; level < 5; level += 1) {
    assert.equal(assistancePolicy(PlayMode.CAMPAIGN, level).rewardRequired, false);
  }
  assert.equal(assistancePolicy(PlayMode.CAMPAIGN, 5).rewardRequired, true);
});

test("tutorial is free while daily and endless always require rewarded assistance", () => {
  assert.equal(assistancePolicy(PlayMode.TUTORIAL).rewardRequired, false);
  assert.equal(assistancePolicy(PlayMode.DAILY).rewardRequired, true);
  assert.equal(assistancePolicy(PlayMode.ENDLESS).rewardRequired, true);
});

test("BoardAssistance finds a verified winning hint before any reward decision", () => {
  let rewardedCalls = 0;
  const assistance = new BoardAssistance({
    async showRewarded() {
      rewardedCalls += 1;
      return { status: RewardedAdStatus.REWARDED };
    },
  });
  const pieces = [
    { q: 0, r: 0, type: Atom.AIR },
    { q: 1, r: 0, type: Atom.AIR },
  ];

  const result = assistance.findHint(pieces);

  assert.equal(result.status, SolveStatus.SOLVED);
  assert.equal(result.route.length, 1);
  assert.equal(rewardedCalls, 0);
});

test("BoardAssistance finds the latest solvable rescue snapshot", () => {
  const assistance = new BoardAssistance({
    async showRewarded() {
      return { status: RewardedAdStatus.REWARDED };
    },
  });
  const solvable = [
    { q: 0, r: 0, type: Atom.AIR },
    { q: 1, r: 0, type: Atom.AIR },
  ];
  const history = [
    { pieces: solvable, marker: "before-mistake" },
  ];

  const result = assistance.findRescue(history, [{ q: 0, r: 0, type: Atom.AIR }]);

  assert.equal(result.status, SolveStatus.SOLVED);
  assert.equal(result.index, 0);
  assert.equal(result.snapshot.marker, "before-mistake");
});

test("confirmReward only accepts a confirmed rewarded callback", async () => {
  for (const status of [
    RewardedAdStatus.CLOSED,
    RewardedAdStatus.UNAVAILABLE,
    RewardedAdStatus.BUSY,
    RewardedAdStatus.ERROR,
  ]) {
    let calls = 0;
    const assistance = new BoardAssistance({
      async showRewarded() {
        calls += 1;
        return { status };
      },
    });
    assert.equal(await assistance.confirmReward(true), false);
    assert.equal(calls, 1);
  }

  let freeCalls = 0;
  const freeAssistance = new BoardAssistance({
    async showRewarded() {
      freeCalls += 1;
      return { status: RewardedAdStatus.REWARDED };
    },
  });
  assert.equal(await freeAssistance.confirmReward(false), true);
  assert.equal(freeCalls, 0);
});
