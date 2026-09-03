import type Phaser from "phaser";
import { THEME_COLORS } from "./art-assets.js";

export function preloadPaperBackground(_scene?: Phaser.Scene): void {}

export function createPaperBackground(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
  return scene.add.graphics().setDepth(-100);
}

export interface PaperBackgroundLayoutOptions {
  bands?: boolean;
}

export function layoutPaperBackground(
  graphics: Phaser.GameObjects.Graphics | null | undefined,
  width: number,
  height: number,
  { bands = true }: PaperBackgroundLayoutOptions = {},
): void {
  if (!graphics) return;
  graphics.clear();
  graphics.fillStyle(THEME_COLORS.canvas, 1).fillRect(0, 0, width, height);
  if (bands) {
    graphics.fillStyle(THEME_COLORS.chrome, 0.18);
    graphics.fillRect(0, 0, width, Math.max(52, height * 0.08));
    graphics.fillRect(
      0,
      Math.max(0, height - Math.max(72, height * 0.1)),
      width,
      Math.max(72, height * 0.1),
    );
  }
  graphics.lineStyle(1, THEME_COLORS.line, 0.22);
  graphics.strokeRect(10, 10, Math.max(1, width - 20), Math.max(1, height - 20));
}
