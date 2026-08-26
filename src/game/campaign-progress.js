import { CampaignProgressStore } from "../campaign-progress.js";
import { isCampaignTestMode } from "./campaign-test-mode.js";

const REGISTRY_KEY = "campaign-progress";

export function getCampaignProgress(scene) {
  let progress = scene.registry.get(REGISTRY_KEY);
  if (!progress) {
    const testMode = isCampaignTestMode();
    progress = new CampaignProgressStore({
      unlockAll: testMode,
      ...(testMode ? { storage: null } : {}),
    });
    scene.registry.set(REGISTRY_KEY, progress);
  }
  return progress;
}
