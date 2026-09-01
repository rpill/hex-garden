import { THEME_COLORS } from "./art-assets.js";

export function preloadPaperBackground() {}

export function createPaperBackground(scene) {
  return scene.add.graphics().setDepth(-100);
}

export function layoutPaperBackground(graphics, width, height) {
  if (!graphics) return;
  graphics.clear();
  graphics.fillStyle(THEME_COLORS.canvas, 1).fillRect(0, 0, width, height);
  graphics.lineStyle(1, THEME_COLORS.line, 0.11);
  const step = Math.max(48, Math.min(84, Math.round(Math.min(width, height) / 9)));
  for (let x = step / 2; x < width; x += step) {
    graphics.lineBetween(x, 0, x, height);
  }
  for (let y = step / 2; y < height; y += step) {
    graphics.lineBetween(0, y, width, y);
  }
  graphics.lineStyle(2, THEME_COLORS.goldNumber, 0.14);
  graphics.strokeRect(8, 8, Math.max(1, width - 16), Math.max(1, height - 16));
}
