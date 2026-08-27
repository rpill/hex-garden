import test from "node:test";
import assert from "node:assert/strict";
import {
  RewardedAdStatus,
  YandexGamesAdapter,
} from "../src/platform/yandex-games.js";

test("localhost rewarded ads use a deterministic disposable simulation", async () => {
  let opened = 0;
  let closed = 0;
  const adapter = new YandexGamesAdapter({
    locationObject: { hostname: "localhost", search: "" },
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

test("a second rewarded request is rejected while the first is open", async () => {
  const adapter = new YandexGamesAdapter({
    locationObject: { hostname: "localhost", search: "" },
    simulationDelay: 5,
  });
  const first = adapter.showRewarded();
  const second = await adapter.showRewarded();
  assert.equal(second.status, RewardedAdStatus.BUSY);
  assert.equal((await first).status, RewardedAdStatus.REWARDED);
});

test("real adapter grants a reward only after the SDK rewarded callback", async () => {
  const events = [];
  const sdk = {
    adv: {
      showRewardedVideo({ callbacks }) {
        callbacks.onOpen();
        callbacks.onRewarded();
        callbacks.onClose(true);
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
    locationObject: { hostname: "example.test", search: "" },
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
        callbacks.onClose(true);
      },
    },
  };
  const closed = new YandexGamesAdapter({
    globalObject: { YaGames: { init: async () => sdk } },
    locationObject: { hostname: "example.test", search: "" },
    simulateRewarded: false,
  });
  assert.equal(
    (await closed.showRewarded()).status,
    RewardedAdStatus.CLOSED,
  );

  const unavailable = new YandexGamesAdapter({
    globalObject: {},
    locationObject: { hostname: "example.test", search: "" },
    simulateRewarded: false,
  });
  assert.equal(
    (await unavailable.showRewarded()).status,
    RewardedAdStatus.UNAVAILABLE,
  );
});
