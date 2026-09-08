import assert from "node:assert/strict";
import test from "node:test";
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
  });
  assert.equal(ten.showDaily, true);
  assert.equal(ten.showEndless, true);
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
