import type Phaser from "phaser";
import { CampaignProgressStore } from "../campaign-progress.js";
import { getPlayerDataStorage } from "../platform/player-data-storage.js";
import { isCampaignTestMode } from "./campaign-test-mode.js";

const REGISTRY_KEY = "campaign-progress";

export function getCampaignProgress(scene: Phaser.Scene): CampaignProgressStore {
  let progress = scene.registry.get(REGISTRY_KEY) as CampaignProgressStore | undefined;
  if (!progress) {
    const testMode = isCampaignTestMode();
    const storage = getPlayerDataStorage();
    progress = new CampaignProgressStore({ storage, unlockAll: testMode });
    scene.registry.set(REGISTRY_KEY, progress);
  }
  return progress;
}
