import { CampaignProgressStore } from "../campaign-progress.js";

const REGISTRY_KEY = "campaign-progress";

export function getCampaignProgress(scene) {
  let progress = scene.registry.get(REGISTRY_KEY);
  if (!progress) {
    progress = new CampaignProgressStore();
    scene.registry.set(REGISTRY_KEY, progress);
  }
  return progress;
}
