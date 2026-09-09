import test from "node:test";
import assert from "node:assert/strict";
import { EndlessLeaderboardService, ENDLESS_CLEAN_LEADERBOARD_NAME } from "../src/endless-leaderboard.js";

function entry(rank, score, publicName = "P") {
  return { rank, score, publicName, uniqueId: `u${rank}` };
}

function fakePlatform({ authorized = false, top = [], topStatus = "ready", remotePlayer = null, personalStatus } = {}) {
  const platform = {
    authorized,
    setScoreCalls: [],
    async isPlayerAuthorized() { return this.authorized; },
    async requestPlayerAuthorization() { return this.authorized ? "authorized" : "guest"; },
    async getLeaderboardEntries(name, quantityTop) {
      assert.equal(name, ENDLESS_CLEAN_LEADERBOARD_NAME);
      assert.equal(quantityTop, 10);
      return topStatus === "ready" ? { status: "ready", entries: top } : { status: "unavailable", entries: [] };
    },
    async getLeaderboardPlayerEntry(name) {
      assert.equal(name, ENDLESS_CLEAN_LEADERBOARD_NAME);
      if (personalStatus === "unavailable") return { status: "unavailable", entry: null };
      if (remotePlayer) return { status: "ready", entry: remotePlayer };
      return { status: "not-present", entry: null };
    },
    async setLeaderboardScore(name, score) {
      this.setScoreCalls.push([name, score]);
      remotePlayer = entry(9, score);
      return true;
    },
  };
  return platform;
}

test("guest load returns public top 10 without personal entry", async () => {
  const platform = fakePlatform({ authorized: false, top: [entry(1, 34)] });
  const service = new EndlessLeaderboardService({ platform });
  assert.deepEqual(await service.load(), { status: "ready", authorized: false, top: [entry(1, 34)], player: null });
});

test("authorizeAndSync never downgrades a higher remote score", async () => {
  const platform = fakePlatform({ authorized: true, remotePlayer: entry(7, 25) });
  const service = new EndlessLeaderboardService({ platform });
  await service.authorizeAndSync(17);
  assert.deepEqual(platform.setScoreCalls, []);
});

test("authorizeAndSync publishes a higher positive local best", async () => {
  const platform = fakePlatform({ authorized: true, remotePlayer: entry(7, 12) });
  const service = new EndlessLeaderboardService({ platform });
  await service.authorizeAndSync(17);
  assert.deepEqual(platform.setScoreCalls, [[ENDLESS_CLEAN_LEADERBOARD_NAME, 17]]);
});

test("zero local with no remote entry does not publish", async () => {
  const platform = fakePlatform({ authorized: true });
  const service = new EndlessLeaderboardService({ platform });
  await service.authorizeAndSync(0);
  assert.deepEqual(platform.setScoreCalls, []);
});

test("missing remote plus positive local publishes", async () => {
  const platform = fakePlatform({ authorized: true });
  const service = new EndlessLeaderboardService({ platform });
  await service.authorizeAndSync(8);
  assert.deepEqual(platform.setScoreCalls, [[ENDLESS_CLEAN_LEADERBOARD_NAME, 8]]);
});

test("cancelled authorization remains guest and does not publish", async () => {
  const platform = fakePlatform({ authorized: false, top: [entry(1, 5)] });
  const service = new EndlessLeaderboardService({ platform });
  const view = await service.authorizeAndSync(17);
  assert.equal(view.authorized, false);
  assert.deepEqual(platform.setScoreCalls, []);
});

test("public top failure is unavailable while personal failure does not erase ready top", async () => {
  const failed = new EndlessLeaderboardService({ platform: fakePlatform({ topStatus: "unavailable" }) });
  assert.deepEqual(await failed.load(), { status: "unavailable", authorized: false, top: [], player: null });

  const platform = fakePlatform({ authorized: true, top: [entry(1, 9)], personalStatus: "unavailable" });
  const view = await new EndlessLeaderboardService({ platform }).load();
  assert.deepEqual(view, { status: "ready", authorized: true, top: [entry(1, 9)], player: null });
});

test("publishImprovedCleanBest never publishes for guests and does not repeat same write", async () => {
  const guest = fakePlatform({ authorized: false });
  const guestService = new EndlessLeaderboardService({ platform: guest });
  assert.equal(await guestService.publishImprovedCleanBest(17), false);
  assert.deepEqual(guest.setScoreCalls, []);

  const platform = fakePlatform({ authorized: true, remotePlayer: entry(3, 12) });
  const service = new EndlessLeaderboardService({ platform });
  assert.equal(await service.publishImprovedCleanBest(17), true);
  assert.equal(await service.publishImprovedCleanBest(17), false);
  assert.deepEqual(platform.setScoreCalls, [[ENDLESS_CLEAN_LEADERBOARD_NAME, 17]]);
});

test("invalid local best is rejected", async () => {
  const service = new EndlessLeaderboardService({ platform: fakePlatform() });
  await assert.rejects(() => service.authorizeAndSync(-1), RangeError);
  await assert.rejects(() => service.publishImprovedCleanBest(1.5), RangeError);
});
