import test from "node:test";
import assert from "node:assert/strict";
import {
  RewardedAdStatus,
  YandexGamesAdapter,
} from "../src/platform/yandex-games.js";

test("explicit rewarded simulation remains available only for isolated unit tests", async () => {
  let opened = 0;
  let closed = 0;
  const adapter = new YandexGamesAdapter({
    simulateRewarded: true,
    simulationDelay: 0,
  });
  const result = await adapter.showRewarded({
    onOpen: () => opened += 1,
    onClose: () => closed += 1,
  });
  assert.equal(result.status, RewardedAdStatus.REWARDED);
  assert.equal(result.simulated, true);
  assert.equal(opened, 1);
  assert.equal(closed, 1);
});

test("a second explicitly simulated rewarded request is rejected while the first is open", async () => {
  const adapter = new YandexGamesAdapter({
    simulateRewarded: true,
    simulationDelay: 5,
  });
  const first = adapter.showRewarded();
  const second = await adapter.showRewarded();
  assert.equal(second.status, RewardedAdStatus.BUSY);
  assert.equal((await first).status, RewardedAdStatus.REWARDED);
});

test("localhost uses the SDK callbacks instead of the old custom simulation", async () => {
  let sdkCalls = 0;
  const sdk = {
    adv: {
      showRewardedVideo({ callbacks }) {
        sdkCalls += 1;
        callbacks.onOpen();
        callbacks.onRewarded();
        callbacks.onClose();
      },
    },
  };
  const adapter = new YandexGamesAdapter({
    globalObject: { YaGames: { init: async () => sdk } },
    locationObject: { hostname: "localhost", search: "" },
  });

  const result = await adapter.showRewarded();
  assert.equal(result.status, RewardedAdStatus.REWARDED);
  assert.equal(result.simulated, undefined);
  assert.equal(sdkCalls, 1);
});

test("real adapter grants a reward only after the SDK rewarded callback", async () => {
  const events = [];
  const sdk = {
    adv: {
      showRewardedVideo({ callbacks }) {
        callbacks.onOpen();
        callbacks.onRewarded();
        callbacks.onClose();
      },
    },
    features: {
      GameplayAPI: {
        stop: () => events.push("stop"),
        start: () => events.push("start"),
      },
    },
  };
  const adapter = new YandexGamesAdapter({
    globalObject: { YaGames: { init: async () => sdk } },
    simulateRewarded: false,
  });
  const result = await adapter.showRewarded();
  assert.equal(result.status, RewardedAdStatus.REWARDED);
  assert.deepEqual(events, ["stop", "start"]);
});

test("closing early and an unavailable SDK never grant a reward", async () => {
  const sdk = {
    adv: {
      showRewardedVideo({ callbacks }) {
        callbacks.onOpen();
        callbacks.onClose();
      },
    },
  };
  const closed = new YandexGamesAdapter({
    globalObject: { YaGames: { init: async () => sdk } },
    simulateRewarded: false,
  });
  assert.equal(
    (await closed.showRewarded()).status,
    RewardedAdStatus.CLOSED,
  );

  const unavailable = new YandexGamesAdapter({
    globalObject: {},
    documentObject: undefined,
    sdkUrl: null,
    simulateRewarded: false,
  });
  assert.equal(
    (await unavailable.showRewarded()).status,
    RewardedAdStatus.UNAVAILABLE,
  );
});

test("serverTime uses one cached SDK init but asks the SDK for fresh trusted time", async () => {
  let initCalls = 0;
  let timeCalls = 0;
  const values = [1_780_000_000_000, 1_780_000_010_000];
  const sdk = {
    serverTime() {
      const value = values[timeCalls];
      timeCalls += 1;
      return value;
    },
  };
  const adapter = new YandexGamesAdapter({
    globalObject: {
      YaGames: {
        init: async () => {
          initCalls += 1;
          return sdk;
        },
      },
    },
  });

  assert.equal(await adapter.serverTime(), values[0]);
  assert.equal(await adapter.serverTime(), values[1]);
  assert.equal(initCalls, 1);
  assert.equal(timeCalls, 2);
});

test("invalid or unavailable server time never falls back to device time", async () => {
  const invalid = new YandexGamesAdapter({
    globalObject: { YaGames: { init: async () => ({ serverTime: () => Number.NaN }) } },
  });
  assert.equal(await invalid.serverTime(), null);

  const unavailable = new YandexGamesAdapter({
    globalObject: {},
    documentObject: undefined,
    sdkUrl: null,
  });
  assert.equal(await unavailable.serverTime(), null);
});

test("player data uses one cached SDK player and flushes writes through setData", async () => {
  let initCalls = 0;
  let playerCalls = 0;
  const setCalls = [];
  const player = {
    async getData(keys) {
      assert.deepEqual(keys, ["gardenJsStorageV1"]);
      return { gardenJsStorageV1: { version: 1, values: { saved: "yes" } } };
    },
    async setData(data, flush) {
      setCalls.push({ data, flush });
    },
  };
  const adapter = new YandexGamesAdapter({
    globalObject: {
      YaGames: {
        init: async () => {
          initCalls += 1;
          return {
            async getPlayer(options) {
              playerCalls += 1;
              assert.deepEqual(options, { scopes: false });
              return player;
            },
          };
        },
      },
    },
  });

  assert.deepEqual(await adapter.getPlayerData(["gardenJsStorageV1"]), {
    gardenJsStorageV1: { version: 1, values: { saved: "yes" } },
  });
  assert.equal(
    await adapter.setPlayerData({ gardenJsStorageV1: { version: 1, values: {} } }, true),
    true,
  );
  assert.equal(initCalls, 1);
  assert.equal(playerCalls, 1);
  assert.deepEqual(setCalls, [
    {
      data: { gardenJsStorageV1: { version: 1, values: {} } },
      flush: true,
    },
  ]);
});

test("unavailable player data fails closed without pretending a cloud save succeeded", async () => {
  const adapter = new YandexGamesAdapter({
    globalObject: { YaGames: { init: async () => ({}) } },
  });

  assert.equal(await adapter.getPlayerData(), null);
  assert.equal(await adapter.setPlayerData({ value: 1 }, true), false);
});
