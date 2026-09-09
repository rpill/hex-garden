import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { YandexGamesAdapter } from "../src/platform/yandex-games.js";

function sdkHarness() {
  const events = [];
  const listeners = new Map();
  const sdk = {
    features: {
      LoadingAPI: { ready: () => events.push("ready") },
      GameplayAPI: {
        start: () => events.push("start"),
        stop: () => events.push("stop"),
      },
    },
    on(name, callback) {
      listeners.set(name, callback);
    },
    off(name, callback) {
      if (listeners.get(name) === callback) listeners.delete(name);
    },
  };
  return { sdk, events, listeners };
}

test("Yandex readiness and gameplay markup are idempotent", async () => {
  const { sdk, events } = sdkHarness();
  const adapter = new YandexGamesAdapter({
    globalObject: { YaGames: { init: async () => sdk } },
  });

  await adapter.notifyGameReady();
  await adapter.notifyGameReady();
  await adapter.notifyGameplayStart();
  await adapter.notifyGameplayStart();
  await adapter.notifyGameplayStop();
  await adapter.notifyGameplayStop();
  await adapter.notifyGameplayStart();

  assert.deepEqual(events, ["ready", "start", "stop", "start"]);
});

test("adapter subscribes and unsubscribes game_api_pause/resume as one pair", async () => {
  const { sdk, listeners } = sdkHarness();
  const adapter = new YandexGamesAdapter({
    globalObject: { YaGames: { init: async () => sdk } },
  });
  const calls = [];

  const unsubscribe = await adapter.subscribeGamePauseResume({
    onPause: () => calls.push("pause"),
    onResume: () => calls.push("resume"),
  });

  assert.equal(typeof unsubscribe, "function");
  listeners.get("game_api_pause")?.();
  listeners.get("game_api_resume")?.();
  assert.deepEqual(calls, ["pause", "resume"]);

  unsubscribe?.();
  assert.equal(listeners.has("game_api_pause"), false);
  assert.equal(listeners.has("game_api_resume"), false);
});

test("platform lifecycle pauses loop and audio, then restores the previous mute state", async () => {
  let lifecycleModule;
  try {
    lifecycleModule = await import("../src/platform/game-lifecycle.js");
  } catch {
    assert.fail("game-lifecycle module must exist");
  }
  const { GameLifecycleController } = lifecycleModule;
  const callbacks = {};
  const markup = [];
  const adapter = {
    async subscribeGamePauseResume({ onPause, onResume }) {
      callbacks.pause = onPause;
      callbacks.resume = onResume;
      return () => {};
    },
    async notifyGameplayStart() { markup.push("start"); },
    async notifyGameplayStop() { markup.push("stop"); },
  };
  const calls = [];
  const game = {
    loop: {
      sleep: () => calls.push("sleep"),
      wake: () => calls.push("wake"),
    },
    sound: { mute: false },
  };
  const lifecycle = new GameLifecycleController({ adapter, documentObject: undefined });
  await lifecycle.initialize();
  lifecycle.attachGame(game);
  lifecycle.setGameplayActive(true);
  await lifecycle.flush();

  callbacks.pause();
  assert.equal(game.sound.mute, true);
  assert.deepEqual(calls, ["sleep"]);

  callbacks.resume();
  await lifecycle.flush();
  assert.equal(game.sound.mute, false);
  assert.deepEqual(calls, ["sleep", "wake"]);
  assert.deepEqual(markup, ["start"]);
});

test("a platform pause received before Phaser attaches is applied on attach", async () => {
  let lifecycleModule;
  try {
    lifecycleModule = await import("../src/platform/game-lifecycle.js");
  } catch {
    assert.fail("game-lifecycle module must exist");
  }
  const { GameLifecycleController } = lifecycleModule;
  const callbacks = {};
  const adapter = {
    async subscribeGamePauseResume({ onPause, onResume }) {
      callbacks.pause = onPause;
      callbacks.resume = onResume;
      return () => {};
    },
    async notifyGameplayStart() {},
    async notifyGameplayStop() {},
  };
  const lifecycle = new GameLifecycleController({ adapter, documentObject: undefined });
  await lifecycle.initialize();
  callbacks.pause();

  const calls = [];
  const game = {
    loop: { sleep: () => calls.push("sleep"), wake: () => calls.push("wake") },
    sound: { mute: false },
  };
  lifecycle.attachGame(game);

  assert.deepEqual(calls, ["sleep"]);
  assert.equal(game.sound.mute, true);
});

test("BoardScene owns gameplay markup around board readiness, pause and terminal states", async () => {
  const source = await readFile(new URL("../src/game/scenes/BoardScene.ts", import.meta.url), "utf8");
  assert.match(source, /getGameLifecycleController/);
  assert.match(source, /setGameplayActive\(false\)/);
  assert.match(source, /syncGameplayLifecycle\(\)/);
  assert.match(source, /Scenes\.Events\.PAUSE/);
  assert.match(source, /Scenes\.Events\.RESUME/);
});

test("opening a covered utility from pause does not briefly resume gameplay", async () => {
  const source = await readFile(new URL("../src/game/scenes/BoardScene.ts", import.meta.url), "utf8");
  assert.match(source, /closePauseMenu\(\{ syncGameplay: false \}\)/);
  assert.match(source, /closePauseMenu\(\{ syncGameplay = true \}/);
});
