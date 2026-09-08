import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { BOARD_CENTER, hexDistance, hexKey } from "../src/hex.js";
import {
  BoardIntroAnimator,
  boardIntroTiming,
  spiralRevealOrder,
} from "../src/game/board/BoardIntroAnimator.js";

const sample = [
  { q: 5, r: 0 },
  { q: 6, r: 0 },
  { q: 5, r: 1 },
  { q: 4, r: 1 },
  { q: 3, r: 2 },
  { q: 7, r: -2 },
];

test("spiral reveal order is deterministic and nondecreasing by centre distance", () => {
  const first = spiralRevealOrder(sample);
  const second = spiralRevealOrder([...sample].reverse());
  assert.deepEqual(first.map(hexKey), second.map(hexKey));

  const distances = first.map((position) => hexDistance(position, BOARD_CENTER));
  for (let index = 1; index < distances.length; index += 1) {
    assert.ok(distances[index] >= distances[index - 1]);
  }
  assert.equal(hexKey(first[0]), hexKey(BOARD_CENTER));
});

test("spiral reveal order contains every input position exactly once", () => {
  const ordered = spiralRevealOrder(sample);
  assert.equal(ordered.length, sample.length);
  assert.equal(new Set(ordered.map(hexKey)).size, sample.length);
});

test("finish consumes an active intro once and reveals everything", () => {
  const timers = [];
  const scene = {
    time: {
      delayedCall(_delay, callback) {
        const timer = { removed: false, callback, remove() { this.removed = true; } };
        timers.push(timer);
        return timer;
      },
    },
  };
  let completed = 0;
  const animator = new BoardIntroAnimator({
    scene,
    positions: sample,
    onChange() {},
    onComplete() { completed += 1; },
  });
  animator.start();
  assert.equal(animator.active, true);
  assert.equal(animator.finish(), true);
  assert.equal(animator.active, false);
  assert.equal(animator.revealedKeys.size, sample.length);
  assert.equal(animator.finish(), false);
  assert.equal(completed, 1);
});


test("BoardScene starts intro from load/restart paths and consumes piece input", async () => {
  const source = await readFile(
    new URL("../src/game/scenes/BoardScene.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /startBoardIntro\(/);
  assert.match(source, /consumeBoardIntroInput\(/);
  assert.doesNotMatch(source, /openUtilityScene[\s\S]{0,500}startBoardIntro\(/);
});

test("Campaign board intro starts immediately without a mechanic-progression gate", async () => {
  const source = await readFile(
    new URL("../src/game/scenes/BoardScene.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /pendingBoardIntro|mechanicCardVisible|showMechanicCardForLevel/);
  assert.match(source, /this\.updateTutorialGuide\(\);[\s\S]{0,140}this\.startBoardIntro\(introProfile\);/);
});


test("fresh and restart intro profiles use perceptible target durations", () => {
  const small = boardIntroTiming(8, "fresh");
  const ordinary = boardIntroTiming(24, "fresh");
  const full = boardIntroTiming(55, "fresh");
  const restart = boardIntroTiming(24, "restart");

  assert.ok(small.totalDurationMs >= 1600 && small.totalDurationMs <= 1900);
  assert.ok(ordinary.totalDurationMs >= 2300 && ordinary.totalDurationMs <= 3000);
  assert.ok(full.totalDurationMs >= 2500 && full.totalDurationMs <= 3200);
  assert.ok(restart.totalDurationMs >= 800 && restart.totalDurationMs <= 1000);
  assert.ok(restart.totalDurationMs < ordinary.totalDurationMs * 0.5);
  assert.ok(small.pieceTweenMs >= 180 && small.pieceTweenMs <= 220);
  assert.ok(ordinary.pieceTweenMs >= 180 && ordinary.pieceTweenMs <= 220);
});



test("intro timing includes the final piece entrance tween inside the target duration", () => {
  for (const [count, profile] of [[8, "fresh"], [24, "fresh"], [55, "fresh"], [24, "restart"]]) {
    const timing = boardIntroTiming(count, profile);
    const lastRevealAt = timing.staggerMs * Math.max(0, count - 1);
    assert.ok(Math.abs(lastRevealAt + timing.pieceTweenMs - timing.totalDurationMs) < 0.001);
  }
});

test("piece entrance progress eases from hidden to complete before intro finishes", () => {
  const timers = [];
  const scene = {
    time: {
      now: 1000,
      delayedCall(delay, callback) {
        const timer = { delay, removed: false, callback, remove() { this.removed = true; } };
        timers.push(timer);
        return timer;
      },
    },
  };
  const animator = new BoardIntroAnimator({
    scene,
    positions: sample.slice(0, 3),
    onChange() {},
    onComplete() {},
  });
  animator.start("fresh");
  const firstReveal = timers.find((timer) => timer.delay === 0);
  assert.ok(firstReveal);
  firstReveal.callback();
  const firstKey = hexKey(spiralRevealOrder(sample.slice(0, 3))[0]);
  assert.equal(animator.entranceProgress(firstKey, 1000), 0);
  assert.ok(animator.entranceProgress(firstKey, 1100) > 0);
  assert.equal(animator.entranceProgress(firstKey, 1200), 1);
  const timing = boardIntroTiming(3, "fresh");
  assert.ok(timers.some((timer) => Math.abs(timer.delay - timing.totalDurationMs) < 0.001));
});

test("BoardScene uses fresh intro for new fields and restart profile for reset", async () => {
  const source = await readFile(
    new URL("../src/game/scenes/BoardScene.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /loadLevel\(introProfile: BoardIntroProfile = "fresh"\)/);
  assert.match(source, /startBoardIntro\(introProfile\)/);
  assert.match(source, /startBoardIntro\("restart"\)/);
  assert.match(source, /entranceProgress\(key, this\.time\.now\)/);
  assert.match(source, /view\.container[\s\S]{0,180}\.setScale\(visualState\.scale \* introScale\)/);
  assert.match(source, /view\.container[\s\S]{0,220}\.setAlpha\(alpha\)/);
  assert.doesNotMatch(source, /view\.tokenBase|filterGlow/);
  assert.match(source, /override update\(\): void \{[\s\S]{0,160}introAnimator\?\.active[\s\S]{0,160}render\(\)/);
});
