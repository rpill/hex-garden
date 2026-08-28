import { LocalLeaderboardStore } from "../leaderboard.js";
import { isCampaignTestMode } from "./campaign-test-mode.js";

const REGISTRY_KEY = "leaderboard";

export function getLeaderboard(scene) {
  let leaderboard = scene.registry.get(REGISTRY_KEY);
  if (!leaderboard) {
    leaderboard = new LocalLeaderboardStore({
      ...(isCampaignTestMode() ? { storage: null } : {}),
    });
    scene.registry.set(REGISTRY_KEY, leaderboard);
  }
  return leaderboard;
}
