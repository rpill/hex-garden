import { EconomyStore } from "../economy.js";
import { getProgressionLevelDefinition } from "../progression.js";
import { getCampaignProgress } from "./campaign-progress.js";

const REGISTRY_KEY = "economy";
export const CAMPAIGN_TEST_DUST = 999_999;

export function getEconomy(scene) {
  let economy = scene.registry.get(REGISTRY_KEY);
  if (!economy) {
    const progress = getCampaignProgress(scene);
    economy = new EconomyStore({
      ...(progress.testMode
        ? { storage: null, startingDust: CAMPAIGN_TEST_DUST }
        : {}),
    });
    scene.registry.set(REGISTRY_KEY, economy);
  }

  const completedLevels = getCampaignProgress(scene).snapshot.completedLevels;
  for (const level of completedLevels) {
    economy.claimCampaignLevel(
      level,
      getProgressionLevelDefinition(level).plateCellCount,
    );
  }
  return economy;
}
