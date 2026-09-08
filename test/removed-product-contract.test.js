import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function sources(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? sources(full) : entry.name.endsWith(".ts") ? [full] : [];
  });
}

test("runtime product has no economy or shop surface", () => {
  const text = sources(fileURLToPath(new URL("../src/game", import.meta.url)))
    .map((file) => fs.readFileSync(file, "utf8"))
    .join("\n");
  assert.doesNotMatch(
    text,
    /EconomyStore|getEconomy|HINT_PRODUCTS|CAMPAIGN SCORE|МАГАЗИН|scene\.start\(["']shop/,
  );
});

test("runtime product has no legacy score or public leaderboard surface", () => {
  const gameText = sources(fileURLToPath(new URL("../src/game", import.meta.url)))
    .map((file) => fs.readFileSync(file, "utf8"))
    .join("\n");
  const entryText = ["../src/main.ts", "../src/index.ts"]
    .map((file) => fs.readFileSync(fileURLToPath(new URL(file, import.meta.url)), "utf8"))
    .join("\n");
  const text = `${gameText}\n${entryText}`;
  assert.doesNotMatch(
    text,
    /CAMPAIGN SCORE|STREAK MULTIPLIER|RANKING|РЕЙТИНГ|scoreRemovedAtoms|LocalLeaderboardStore|LeaderboardScene|scene\.start\(["']leaderboard/,
  );
});

test("runtime product has no legacy mechanic progression or shape-family generation surface", () => {
  const root = fileURLToPath(new URL("../src", import.meta.url));
  assert.equal(fs.existsSync(path.join(root, "progression.ts")), false);
  assert.equal(fs.existsSync(path.join(root, "mechanic-introductions.ts")), false);

  const generatorText = fs.readFileSync(path.join(root, "generator.ts"), "utf8");
  const browserText = fs.readFileSync(path.join(root, "browser.ts"), "utf8");
  const workerText = fs.readFileSync(path.join(root, "generator-worker.ts"), "utf8");
  const indexText = fs.readFileSync(path.join(root, "index.ts"), "utf8");
  const boardText = fs.readFileSync(path.join(root, "game/scenes/BoardScene.ts"), "utf8");
  const text = `${generatorText}\n${browserText}\n${workerText}\n${indexText}\n${boardText}`;

  assert.doesNotMatch(
    text,
    /BoardShape|generateSolvableBoard|generateProgression|getProgressionLevelDefinition|ProgressionChapter|mechanicIntroductionForLevel|kind:\s*["']progression["']/,
  );
});
