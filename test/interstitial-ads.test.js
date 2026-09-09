import test from "node:test";
import assert from "node:assert/strict";
import { YandexGamesAdapter } from "../src/platform/yandex-games.js";

test("Yandex adapter exposes a fullscreen interstitial call", () => {
  const adapter = new YandexGamesAdapter({
    globalObject: {},
    documentObject: undefined,
    sdkUrl: null,
  });
  assert.equal(typeof adapter.showFullscreen, "function");
});

test("fullscreen interstitial delegates to the SDK without owning gameplay markup", async () => {
  const events = [];
  let fullscreenCalls = 0;
  const sdk = {
    adv: {
      showFullscreenAdv({ callbacks }) {
        fullscreenCalls += 1;
        callbacks.onOpen?.();
        callbacks.onClose?.(true);
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
  });

  await adapter.showFullscreen();
  assert.equal(fullscreenCalls, 1);
  assert.deepEqual(events, []);
});

import fs from "node:fs";

const boardSceneSource = fs.readFileSync(new URL("../src/game/scenes/BoardScene.ts", import.meta.url), "utf8");

function sourceSection(start, end) {
  const from = boardSceneSource.indexOf(start);
  const to = boardSceneSource.indexOf(end, from + start.length);
  assert.notEqual(from, -1, `missing section start: ${start}`);
  assert.notEqual(to, -1, `missing section end: ${end}`);
  return boardSceneSource.slice(from, to);
}

test("completion transitions use fullscreen ads only at natural run or level boundaries", () => {
  const campaign = sourceSection("showCampaignCompletion({", "async completeDailyBoard()");
  const daily = sourceSection("async completeDailyBoard()", "continueEndlessAfterClear()");
  const endless = sourceSection("showEndlessCompletion()", "updateEndlessHud()");
  const betweenEndlessBoards = sourceSection("continueEndlessAfterClear()", "showEndlessCompletion()");

  assert.match(campaign, /runInterstitialBefore/);
  assert.match(daily, /runInterstitialBefore/);
  assert.match(endless, /runInterstitialBefore/);
  assert.doesNotMatch(betweenEndlessBoards, /runInterstitialBefore|showFullscreen/);
});

test("dead-end restart is an interstitial opportunity but ordinary restart stays direct", () => {
  const restart = sourceSection("restartLevel(): void", "startBoardIntro(");
  assert.match(restart, /actualDeadEnd/);
  assert.match(restart, /runInterstitialBefore/);
  assert.match(restart, /restartLevelNow/);
});

test("BoardScene gates fullscreen requests through the shared cooldown policy", () => {
  assert.match(boardSceneSource, /getInterstitialAdGate/);
  assert.match(boardSceneSource, /tryBegin\(/);
});

test("Campaign replay progression does not request an interstitial", () => {
  const campaign = sourceSection("showCampaignCompletion({", "async completeDailyBoard()");
  assert.match(campaign, /firstCompletion/);
  assert.match(campaign, /eligible:\s*firstCompletion/);
});
