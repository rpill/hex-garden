import test from "node:test";
import assert from "node:assert/strict";
import { YandexGamesAdapter } from "../src/platform/yandex-games.js";

function adapterWithSdk(sdk) {
  return new YandexGamesAdapter({ globalObject: { YaGames: { init: async () => sdk } }, sdkUrl: null });
}

test("requestPlayerAuthorization refreshes the cached Player after successful auth", async () => {
  let authorized = false;
  let getPlayerCalls = 0;
  const sdk = {
    getPlayer: async () => {
      getPlayerCalls += 1;
      return { isAuthorized: () => authorized };
    },
    auth: { openAuthDialog: async () => { authorized = true; } },
  };
  const adapter = adapterWithSdk(sdk);

  assert.equal(await adapter.isPlayerAuthorized(), false);
  assert.equal(await adapter.requestPlayerAuthorization(), "authorized");
  assert.equal(await adapter.isPlayerAuthorized(), true);
  assert.equal(getPlayerCalls, 2);
});

test("requestPlayerAuthorization returns guest after a closed dialog", async () => {
  const sdk = {
    getPlayer: async () => ({ isAuthorized: () => false }),
    auth: { openAuthDialog: async () => {} },
  };
  const adapter = adapterWithSdk(sdk);
  assert.equal(await adapter.requestPlayerAuthorization(), "guest");
});

test("requestPlayerAuthorization returns unavailable when auth API is missing", async () => {
  const adapter = adapterWithSdk({ getPlayer: async () => ({ isAuthorized: () => false }) });
  assert.equal(await adapter.requestPlayerAuthorization(), "unavailable");
});

test("getLeaderboardEntries normalizes guest top entries without requesting auth", async () => {
  let authCalls = 0;
  const sdk = {
    auth: { openAuthDialog: async () => { authCalls += 1; } },
    leaderboards: {
      getEntries: async (_name, options) => {
        assert.deepEqual(options, { quantityTop: 10, includeUser: false });
        return {
          entries: [
            { rank: 1, score: 34, player: { publicName: "A", uniqueID: "u1" } },
            { rank: 2, score: 31, player: { publicName: "", uniqueID: "u2" } },
          ],
        };
      },
    },
  };
  const adapter = adapterWithSdk(sdk);
  assert.deepEqual(await adapter.getLeaderboardEntries("endless_clean_boards", 10), {
    status: "ready",
    entries: [
      { rank: 1, score: 34, publicName: "A", uniqueId: "u1" },
      { rank: 2, score: 31, publicName: "", uniqueId: "u2" },
    ],
  });
  assert.equal(authCalls, 0);
});

test("protected leaderboard calls check method availability before invoking SDK", async () => {
  const checked = [];
  let playerEntryCalls = 0;
  let scoreCalls = 0;
  const sdk = {
    isAvailableMethod: async (name) => { checked.push(name); return false; },
    leaderboards: {
      getPlayerEntry: async () => { playerEntryCalls += 1; },
      setScore: async () => { scoreCalls += 1; },
    },
  };
  const adapter = adapterWithSdk(sdk);
  assert.deepEqual(await adapter.getLeaderboardPlayerEntry("endless_clean_boards"), { status: "unavailable", entry: null });
  assert.equal(await adapter.setLeaderboardScore("endless_clean_boards", 10), false);
  assert.deepEqual(checked, ["leaderboards.getPlayerEntry", "leaderboards.setScore"]);
  assert.equal(playerEntryCalls, 0);
  assert.equal(scoreCalls, 0);
});

test("missing player entry maps to not-present", async () => {
  const sdk = {
    isAvailableMethod: async () => true,
    leaderboards: {
      getPlayerEntry: async () => { throw { code: "LEADERBOARD_PLAYER_NOT_PRESENT" }; },
    },
  };
  const adapter = adapterWithSdk(sdk);
  assert.deepEqual(await adapter.getLeaderboardPlayerEntry("endless_clean_boards"), { status: "not-present", entry: null });
});

test("leaderboard failures and malformed entries fail closed", async () => {
  const unavailable = adapterWithSdk({ leaderboards: { getEntries: async () => { throw { status: 404 }; } } });
  assert.deepEqual(await unavailable.getLeaderboardEntries("missing"), { status: "unavailable", entries: [] });

  const malformed = adapterWithSdk({ leaderboards: { getEntries: async () => ({ entries: [{ rank: -1, score: NaN, player: {} }] }) } });
  assert.deepEqual(await malformed.getLeaderboardEntries("broken"), { status: "unavailable", entries: [] });
});
