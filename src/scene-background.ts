import Phaser from "phaser";
import {
  ACTIVE_ART_THEME,
  PHYSICAL_MATERIAL_FRAMES,
  THEME_COLORS,
} from "./art-assets.js";

export type PaperBackground =
  | Phaser.GameObjects.Graphics
  | Phaser.GameObjects.TileSprite;

export function preloadPaperBackground(scene?: Phaser.Scene): void {
  if (!scene || ACTIVE_ART_THEME !== "premium") return;
  if (!scene.textures.exists(PHYSICAL_MATERIAL_FRAMES.feltTable)) {
    scene.load.image(
      PHYSICAL_MATERIAL_FRAMES.feltTable,
      "/assets/physical-premium/felt-table.jpg",
    );
  }
}

export function createPaperBackground(scene: Phaser.Scene): PaperBackground {
  if (ACTIVE_ART_THEME === "premium") {
    return scene.add
      .tileSprite(0, 0, 1, 1, PHYSICAL_MATERIAL_FRAMES.feltTable)
      .setOrigin(0, 0)
      .setDepth(-100);
  }
  return scene.add.graphics().setDepth(-100);
}

export interface PaperBackgroundLayoutOptions {
  bands?: boolean;
}

export function layoutPaperBackground(
  background: PaperBackground | null | undefined,
  width: number,
  height: number,
  { bands = true }: PaperBackgroundLayoutOptions = {},
): void {
  if (!background) return;

  if (background instanceof Phaser.GameObjects.TileSprite) {
    background
      .setPosition(0, 0)
      .setSize(width, height)
      .setDisplaySize(width, height)
      .setTileScale(1, 1)
      .setTint(0xffffff);
    return;
  }

  background.clear();
  background.fillStyle(THEME_COLORS.canvas, 1).fillRect(0, 0, width, height);
  if (bands) {
    background.fillStyle(THEME_COLORS.chrome, 0.18);
    background.fillRect(0, 0, width, Math.max(52, height * 0.08));
    background.fillRect(
      0,
      Math.max(0, height - Math.max(72, height * 0.1)),
      width,
      Math.max(72, height * 0.1),
    );
  }
  background.lineStyle(1, THEME_COLORS.line, 0.22);
  background.strokeRect(10, 10, Math.max(1, width - 20), Math.max(1, height - 20));
}
