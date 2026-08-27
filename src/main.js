import Phaser from "phaser";
import "./styles.css";
import { BoardScene } from "./game/scenes/BoardScene.js";
import { LevelSelectScene } from "./game/scenes/LevelSelectScene.js";
import { MenuScene } from "./game/scenes/MenuScene.js";
import { SettingsScene } from "./game/scenes/SettingsScene.js";
import { ShopScene } from "./game/scenes/ShopScene.js";

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game-root",
  backgroundColor: "#111714",
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
  scene: [MenuScene, LevelSelectScene, ShopScene, SettingsScene, BoardScene],
});

window.addEventListener("contextmenu", (event) => event.preventDefault());
globalThis.__GARDEN_RULES_LAB__ = game;

let viewportSyncFrame;
function syncViewport() {
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
