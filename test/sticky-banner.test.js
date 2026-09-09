import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { YandexGamesAdapter } from "../src/platform/yandex-games.js";

test("sticky banner show/hide delegates to Yandex SDK and preserves call order", async () => {
  const calls = [];
  const sdk = {
    adv: {
      async showBannerAdv() {
        calls.push("show");
        return { stickyAdvIsShowing: true };
      },
      async hideBannerAdv() {
        calls.push("hide");
        return { stickyAdvIsShowing: false };
      },
    },
  };
  const adapter = new YandexGamesAdapter({
    globalObject: { YaGames: { init: async () => sdk } },
  });

  await Promise.all([
    adapter.showStickyBanner(),
    adapter.hideStickyBanner(),
  ]);

  assert.deepEqual(calls, ["show", "hide"]);
});

test("sticky banner calls are idempotent and unavailable SDK fails closed", async () => {
  const calls = [];
  const sdk = {
    adv: {
      async showBannerAdv() {
        calls.push("show");
        return { stickyAdvIsShowing: true };
      },
      async hideBannerAdv() {
        calls.push("hide");
        return { stickyAdvIsShowing: false };
      },
    },
  };
  const adapter = new YandexGamesAdapter({
    globalObject: { YaGames: { init: async () => sdk } },
  });

  await adapter.showStickyBanner();
  await adapter.showStickyBanner();
  await adapter.hideStickyBanner();
  await adapter.hideStickyBanner();
  assert.deepEqual(calls, ["show", "hide"]);

  const unavailable = new YandexGamesAdapter({
    globalObject: {},
    documentObject: undefined,
    sdkUrl: null,
  });
  await assert.doesNotReject(() => unavailable.showStickyBanner());
  await assert.doesNotReject(() => unavailable.hideStickyBanner());
});

test("non-gameplay scenes request sticky banner while Board hides it on create and resume", async () => {
  const sceneFiles = ["MenuScene.ts", "LevelSelectScene.ts", "RulesScene.ts", "SettingsScene.ts"];
  for (const file of sceneFiles) {
    const source = await readFile(new URL(`../src/game/scenes/${file}`, import.meta.url), "utf8");
    assert.match(source, /showStickyBanner\(\)/, `${file} must show the sticky banner`);
  }

  const board = await readFile(new URL("../src/game/scenes/BoardScene.ts", import.meta.url), "utf8");
  const createStart = board.indexOf("create(): void");
  const loadLevelStart = board.indexOf("async loadLevel", createStart);
  const createSection = board.slice(createStart, loadLevelStart);
  assert.match(createSection, /hideStickyBanner\(\)/);

  const resumeStart = createSection.indexOf("Phaser.Scenes.Events.RESUME");
  assert.notEqual(resumeStart, -1);
  const resumeSection = createSection.slice(resumeStart, resumeStart + 240);
  assert.match(resumeSection, /hideStickyBanner\(\)/);
});
