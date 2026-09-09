import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { buttonVisualState } from "../src/game/presentation-model.js";
import { createHomeModel } from "../src/game/home-model.js";
import { homeLayoutMetrics } from "../src/game/navigation-layout.js";

test("level hover preserves semantic state and stays subtle", () => {
  for (const semanticState of ["completed", "current", "idle"]) {
    const state = buttonVisualState({ semanticState, hovered: true, enabled: semanticState !== "locked" });
    assert.equal(state.semanticState, semanticState);
    assert.ok(state.scale >= 1 && state.scale <= 1.025);
    assert.ok(state.alpha >= 0.82 && state.alpha <= 1);
  }
});

test("disabled state stays disabled while hovered", () => {
  const state = buttonVisualState({ semanticState: "locked", hovered: true, enabled: false });
  assert.equal(state.semanticState, "locked");
  assert.equal(state.enabled, false);
  assert.ok(state.alpha < 0.75);
});


test("home hides unreached modes instead of showing locked cards", () => {
  const fresh = createHomeModel({
    tutorialCompleted: false,
    solvedLevels: [],
    cleanLevels: [],
  });
  assert.equal(fresh.firstLaunch, true);
  assert.deepEqual(fresh.continueTarget, { kind: "campaign", level: 0 });
  assert.equal(fresh.rank, "novice");
  assert.equal(fresh.showDaily, false);
  assert.equal(fresh.showEndless, false);

  const five = createHomeModel({
    tutorialCompleted: true,
    solvedLevels: [0, 1, 2, 3, 4],
    cleanLevels: [0, 1],
  });
  assert.equal(five.firstLaunch, false);
  assert.equal(five.solvedCount, 5);
  assert.equal(five.cleanCount, 2);
  assert.equal(five.showDaily, true);
  assert.equal(five.showEndless, false);

  const ten = createHomeModel({
    tutorialCompleted: true,
    solvedLevels: Array.from({ length: 10 }, (_, level) => level),
    cleanLevels: [],
  }, {
    endless: { bestUnassistedBoards: 8 },
  });
  assert.equal(ten.showDaily, true);
  assert.equal(ten.showEndless, true);
  assert.deepEqual(ten.endless, { bestBoards: 8 });
});

test("home Continue switches from campaign progress to Clean mastery", () => {
  const solvedLevels = Array.from({ length: 50 }, (_, level) => level);
  const mastery = createHomeModel({
    tutorialCompleted: true,
    solvedLevels,
    cleanLevels: [0, 1, 3, 4],
  });
  assert.deepEqual(mastery.continueTarget, { kind: "mastery", level: 2 });

  const complete = createHomeModel({
    tutorialCompleted: true,
    solvedLevels,
    cleanLevels: solvedLevels,
  });
  assert.deepEqual(complete.continueTarget, { kind: "complete" });
  assert.equal(complete.rank, "master");
});

test("home layout keeps the primary action dominant on portrait and short landscape", () => {
  for (const [width, height] of [[390, 844], [844, 390]]) {
    const layout = homeLayoutMetrics(width, height);
    assert.equal(layout.centerX, width / 2);
    assert.ok(layout.primaryWidth > layout.secondaryWidth);
    assert.ok(layout.primaryHeight > layout.secondaryHeight);
    assert.ok(layout.primaryY > layout.progressY);
    assert.ok(layout.secondaryY > layout.primaryY);
  }
});

test("home daily model maps today and the seven Moscow-week states", () => {
  const campaign = {
    tutorialCompleted: true,
    solvedLevels: [0, 1, 2, 3, 4],
    cleanLevels: [0, 1],
  };
  const dateKey = "2026-09-09";
  const dateKeys = [
    "2026-09-07",
    "2026-09-08",
    "2026-09-09",
    "2026-09-10",
    "2026-09-11",
    "2026-09-12",
    "2026-09-13",
  ];

  const daily = (todayState) => ({
    dateKey,
    weekSummary: {
      weekKey: "2026-09-07",
      days: dateKeys.map((day) => ({
        dateKey: day,
        state: day === dateKey ? todayState : day === "2026-09-07" ? "clean" : "missing",
      })),
      solvedCount: todayState === "missing" ? 1 : 2,
      cleanCount: todayState === "clean" ? 2 : 1,
    },
  });

  const open = createHomeModel(campaign, { daily: daily("missing") });
  assert.equal(open.showDaily, true);
  assert.equal(open.daily.todayState, "open");
  assert.deepEqual(open.daily.weekStates.map((day) => day.dateKey), dateKeys);
  assert.deepEqual(
    open.daily.weekStates.map((day) => day.state),
    ["clean", "open", "open", "open", "open", "open", "open"],
  );

  const solved = createHomeModel(campaign, { daily: daily("solved") });
  assert.equal(solved.daily.todayState, "solved");

  const clean = createHomeModel(campaign, { daily: daily("clean") });
  assert.equal(clean.daily.todayState, "clean");
  assert.equal(clean.daily.solvedCount, 2);
  assert.equal(clean.daily.cleanCount, 2);
});

test("home Daily card uses trusted Yandex time and starts Daily mode", () => {
  const menuSource = readFileSync(new URL("../src/game/scenes/MenuScene.ts", import.meta.url), "utf8");
  assert.match(menuSource, /getTrustedClock\(\)\.now\(\)/);
  assert.match(menuSource, /dailyDateKey\(trustedNow\)/);
  assert.match(menuSource, /ЕЖЕДНЕВНАЯ ЗАДАЧА/);
  assert.match(menuSource, /PlayMode\.DAILY/);
  assert.doesNotMatch(menuSource, /Date\.now\(\)/);
});

test("home Endless card shows the canonical clean boards-cleared best and starts Endless", () => {
  const menuSource = readFileSync(new URL("../src/game/scenes/MenuScene.ts", import.meta.url), "utf8");
  assert.match(menuSource, /getEndlessProgress/);
  assert.match(menuSource, /model\.endless/);
  assert.match(menuSource, /BEST/);
  assert.match(menuSource, /PlayMode\.ENDLESS/);
  assert.doesNotMatch(menuSource, /multiplier/i);
  assert.match(menuSource, /this\.model\.showEndless[\s\S]{0,260}id: "leaderboard"/);
  assert.match(menuSource, /scene\.start\("leaderboard"\)/);
});

test("Daily completion shows current week and optional Try Clean secondary action", () => {
  const boardSource = readFileSync(new URL("../src/game/scenes/BoardScene.ts", import.meta.url), "utf8");
  const overlaySource = readFileSync(new URL("../src/game/completion-overlay.ts", import.meta.url), "utf8");
  assert.match(boardSource, /weekSummary\(completion\.dateKey\)/);
  assert.match(boardSource, /ПОПРОБОВАТЬ ЧИСТО/);
  assert.match(boardSource, /onSecondary/);
  assert.match(overlaySource, /secondaryLabel/);
  assert.match(overlaySource, /#onSecondary/);
});
