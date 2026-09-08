import assert from "node:assert/strict";
import test from "node:test";
import { closeUtilityScene, openUtilityScene } from "../src/game/utility-navigation.js";

function fakeScene(key = "board") {
  const calls = [];
  const plugin = {
    key,
    isActive: () => false,
    isSleeping: () => false,
    launch: (target, data) => calls.push(["launch", target, data]),
    wake: (target, data) => calls.push(["wake", target, data]),
    bringToTop: (target) => calls.push(["bringToTop", target]),
    pause: (target) => calls.push(["pause", target ?? key]),
    resume: (target) => calls.push(["resume", target]),
    stop: (target) => calls.push(["stop", target ?? key]),
    start: (target) => calls.push(["start", target]),
  };
  return { scene: plugin, calls };
}

test("opening utility scene brings it above board before pausing board", () => {
  const scene = fakeScene("board");
  openUtilityScene(scene, "settings", { returnScene: "board" });
  assert.deepEqual(scene.calls, [
    ["launch", "settings", { returnScene: "board" }],
    ["bringToTop", "settings"],
    ["pause", "board"],
  ]);
});

test("closing utility scene stops it then resumes board", () => {
  const scene = fakeScene("settings");
  closeUtilityScene(scene, "board");
  assert.deepEqual(scene.calls, [["stop", "settings"], ["resume", "board"], ["bringToTop", "board"]]);
});
