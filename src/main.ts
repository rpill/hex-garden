import Phaser from "phaser";
import "./styles.css";
import { THEME_COLORS } from "./art-assets.js";
import { getYandexGamesAdapter } from "./platform/yandex-games.js";
import { initializePlayerDataStorage } from "./platform/player-data-storage.js";
import { BoardScene } from "./game/scenes/BoardScene.js";
import { LevelSelectScene } from "./game/scenes/LevelSelectScene.js";
import { LeaderboardScene } from "./game/scenes/LeaderboardScene.js";
import { MenuScene } from "./game/scenes/MenuScene.js";
import { SettingsScene } from "./game/scenes/SettingsScene.js";

declare global {
  // Development handle used by the browser test bench.
  var __GARDEN_RULES_LAB__: Phaser.Game | undefined;
}

async function startGarden(): Promise<void> {
  const platform = getYandexGamesAdapter();
  await platform.initialize();
  await initializePlayerDataStorage(platform);

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game-root",
    backgroundColor: THEME_COLORS.canvas,
    antialias: true,
    render: {
      antialiasGL: true,
      roundPixels: false,
    },
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: "100%",
      height: "100%",
    },
    input: {
      activePointers: 3,
      touch: { capture: true },
    },
    scene: [MenuScene, LevelSelectScene, SettingsScene, LeaderboardScene, BoardScene],
  });

  window.addEventListener("contextmenu", (event) => event.preventDefault());
  globalThis.__GARDEN_RULES_LAB__ = game;

  let viewportSyncFrame = 0;
  function syncViewport(): void {
    cancelAnimationFrame(viewportSyncFrame);
    viewportSyncFrame = requestAnimationFrame(() => {
      const width = Math.max(1, document.documentElement.clientWidth);
      const height = Math.max(1, globalThis.visualViewport?.height ?? globalThis.innerHeight);
      game.scale.resize(width, height);
    });
  }

  globalThis.addEventListener("resize", syncViewport);
  globalThis.visualViewport?.addEventListener("resize", syncViewport);
  globalThis.screen?.orientation?.addEventListener("change", () => {
    syncViewport();
    globalThis.setTimeout(syncViewport, 160);
  });
}

void startGarden();
