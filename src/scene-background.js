import { GAMEPLAY_BACKGROUND } from "./art-assets.js";

export function preloadPaperBackground(scene) {
  if (!scene.textures.exists(GAMEPLAY_BACKGROUND.key)) {
    scene.load.image(GAMEPLAY_BACKGROUND.key, GAMEPLAY_BACKGROUND.url);
  }
}

export function createPaperBackground(scene) {
  if (!scene.textures.exists(GAMEPLAY_BACKGROUND.key)) return undefined;
  return scene.add.image(0, 0, GAMEPLAY_BACKGROUND.key).setDepth(-100);
}

export function layoutPaperBackground(image, width, height) {
  if (!image) return;
  const scale = Math.max(width / image.width, height / image.height);
  image.setPosition(width / 2, height / 2).setScale(scale);
}
