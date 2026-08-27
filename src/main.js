import Phaser from "phaser";
import "./styles.css";
import { BoardScene } from "./game/scenes/BoardScene.js";
import { LevelSelectScene } from "./game/scenes/LevelSelectScene.js";
import { MenuScene } from "./game/scenes/MenuScene.js";
import { ShopScene } from "./game/scenes/ShopScene.js";

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game-root",
  backgroundColor: "#151515",
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
  scene: [MenuScene, LevelSelectScene, ShopScene, BoardScene],
});

window.addEventListener("contextmenu", (event) => event.preventDefault());
globalThis.__GARDEN_RULES_LAB__ = game;
