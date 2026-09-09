import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { utilityReturnPlan } from "../src/game/presentation-model.js";

const mainSource = fs.readFileSync(new URL("../src/main.ts", import.meta.url), "utf8");
const menuSource = fs.readFileSync(new URL("../src/game/scenes/MenuScene.ts", import.meta.url), "utf8");
const sceneSource = fs.existsSync(new URL("../src/game/scenes/LeaderboardScene.ts", import.meta.url))
  ? fs.readFileSync(new URL("../src/game/scenes/LeaderboardScene.ts", import.meta.url), "utf8")
  : "";

test("leaderboard is a resumable utility root", () => {
  assert.deepEqual(utilityReturnPlan("leaderboard"), { kind: "resume", scene: "leaderboard" });
});

test("main registers LeaderboardScene before BoardScene", () => {
  assert.match(mainSource, /import \{ LeaderboardScene \} from "\.\/game\/scenes\/LeaderboardScene\.js"/);
  assert.match(mainSource, /RulesScene,\s*LeaderboardScene,\s*BoardScene/);
});

test("Home context menu exposes leaderboard only behind Endless unlock", () => {
  assert.match(menuSource, /this\.model\.showEndless/);
  assert.match(menuSource, /id:\s*"leaderboard"/);
  assert.match(menuSource, /this\.english \? "LEADERBOARD" : "РЕЙТИНГ"/);
  assert.match(menuSource, /this\.scene\.start\("leaderboard"\)/);
});

test("leaderboard scene shell owns the leaderboard scene key", () => {
  assert.match(sceneSource, /super\("leaderboard"\)/);
});

const rulesSource = fs.readFileSync(new URL("../src/game/scenes/RulesScene.ts", import.meta.url), "utf8");
const settingsSource = fs.readFileSync(new URL("../src/game/scenes/SettingsScene.ts", import.meta.url), "utf8");

test("leaderboard scene loads once from create and shows sticky banner", () => {
  assert.match(sceneSource, /create\(\): void[\s\S]*showStickyBanner\(\)/);
  assert.match(sceneSource, /create\(\): void[\s\S]*this\.loadLeaderboard\(\)/);
  const layoutBody = sceneSource.match(/layout\(\): void \{([\s\S]*?)\n  \}/)?.[1] ?? "";
  assert.doesNotMatch(layoutBody, /\.load\(/);
});

test("leaderboard scene contains guest auth, unavailable retry, and local best states", () => {
  assert.match(sceneSource, /bestUnassistedBoards/);
  assert.match(sceneSource, /ВОЙТИ В ЯНДЕКС/);
  assert.match(sceneSource, /SIGN IN TO YANDEX/);
  assert.match(sceneSource, /участвовать в рейтинге|participate in the leaderboard/i);
  assert.match(sceneSource, /ПОВТОРИТЬ/);
  assert.match(sceneSource, /RETRY/);
  assert.match(sceneSource, /status === "unavailable"/);
  assert.match(sceneSource, /view\.top\.length === 0/);
  assert.match(sceneSource, /view\.authorized/);
});

test("authorization is invoked only from explicit sign-in handler with local clean best", () => {
  assert.match(sceneSource, /signInButton = makeMinimalButton\([\s\S]*this\.signIn\(\)/);
  assert.match(sceneSource, /async signIn\(\)[\s\S]*authorizeAndSync\(\s*this\.endlessProgress\.snapshot\.bestUnassistedBoards,?\s*\)/);
});

test("leaderboard context menu opens Rules and Settings with leaderboard return root", () => {
  assert.match(sceneSource, /id:\s*"rules"[\s\S]*openUtilityScene\(this, "rules", \{ returnScene: "leaderboard" \}\)/);
  assert.match(sceneSource, /id:\s*"settings"[\s\S]*openUtilityScene\(this, "settings", \{ returnScene: "leaderboard" \}\)/);
  assert.match(sceneSource, /id:\s*"home"[\s\S]*this\.scene\.start\("menu"\)/);
  assert.match(rulesSource, /RETURN_SCENES = new Set<UtilityRootSceneKey>\(\[[^\]]*"leaderboard"/);
  assert.match(settingsSource, /RETURN_SCENES = new Set<UtilityRootSceneKey>\(\[[^\]]*"leaderboard"/);
});

test("blank public names use localized fallback and avatars are not requested", () => {
  assert.match(sceneSource, /publicName\.trim\(\) \|\| \(this\.english \? "PLAYER" : "ИГРОК"\)/);
  assert.doesNotMatch(sceneSource, /avatar|getPhoto|getAvatar/i);
});
