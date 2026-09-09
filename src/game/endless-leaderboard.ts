import type Phaser from "phaser";
import { EndlessLeaderboardService } from "../endless-leaderboard.js";
import { getYandexGamesAdapter } from "../platform/yandex-games.js";

const REGISTRY_KEY = "endless-leaderboard";

export function getEndlessLeaderboard(scene: Phaser.Scene): EndlessLeaderboardService {
  let service = scene.registry.get(REGISTRY_KEY) as EndlessLeaderboardService | undefined;
  if (!service) {
    service = new EndlessLeaderboardService({ platform: getYandexGamesAdapter() });
    scene.registry.set(REGISTRY_KEY, service);
  }
  return service;
}
