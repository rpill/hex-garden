import type Phaser from "phaser";
import { EndlessProgressStore } from "../endless-progress.js";
import { getPlayerDataStorage } from "../platform/player-data-storage.js";

const REGISTRY_KEY = "endless-progress";

export function getEndlessProgress(scene: Phaser.Scene): EndlessProgressStore {
  let progress = scene.registry.get(REGISTRY_KEY) as EndlessProgressStore | undefined;
  if (!progress) {
    const storage = getPlayerDataStorage();
    progress = new EndlessProgressStore({ storage });
    scene.registry.set(REGISTRY_KEY, progress);
  }
  return progress;
}
