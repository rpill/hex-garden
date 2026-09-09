import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/game/scenes/BoardScene.ts", import.meta.url), "utf8");

test("BoardScene obtains the shared Endless leaderboard service", () => {
  assert.match(source, /import \{ getEndlessLeaderboard \} from "\.\.\/endless-leaderboard\.js"/);
  assert.match(source, /endlessLeaderboard!:\s*ReturnType<typeof getEndlessLeaderboard>/);
  assert.match(source, /this\.endlessLeaderboard = getEndlessLeaderboard\(this\)/);
});

test("Endless completion publishes only a strict new clean best", () => {
  const body = source.match(/showEndlessCompletion\(\): void \{([\s\S]*?)\n  \}\n\n  updateEndlessHud/)?.[1] ?? "";
  assert.match(body, /const previousCleanBest = this\.endlessProgress\.snapshot\.bestUnassistedBoards/);
  assert.match(body, /const result = this\.endlessProgress\.submit\(/);
  assert.match(body, /if \(!session\.assisted && result\.bestUnassistedBoards > previousCleanBest\)/);
  assert.match(body, /void this\.endlessLeaderboard\.publishImprovedCleanBest\(result\.bestUnassistedBoards\)/);
});

test("completion overlay is shown without awaiting leaderboard publication", () => {
  const body = source.match(/showEndlessCompletion\(\): void \{([\s\S]*?)\n  \}\n\n  updateEndlessHud/)?.[1] ?? "";
  const publishIndex = body.indexOf("publishImprovedCleanBest");
  const overlayIndex = body.indexOf("this.completionOverlay.show");
  assert.ok(publishIndex >= 0 && overlayIndex > publishIndex);
  assert.doesNotMatch(body, /await\s+this\.endlessLeaderboard/);
});

test("BoardScene never calls raw leaderboard SDK methods", () => {
  assert.doesNotMatch(source, /getLeaderboardEntries|getLeaderboardPlayerEntry|setLeaderboardScore/);
});
