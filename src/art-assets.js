export const GAMEPLAY_ATLAS = Object.freeze({
  key: "gameplay-atlas",
  jsonUrl: "/assets/hex-garden/gameplay-atlas.json",
  baseUrl: "/assets/hex-garden",
  textureFile: "gameplay-atlas.png",
});

export const GAMEPLAY_BACKGROUND = Object.freeze({
  key: "paper-background",
  url: "/assets/hex-garden/paper_background.png",
});

export const GAMEPLAY_FONT = Object.freeze({
  family: "Neucha",
  url: "/assets/fonts/Neucha.ttf",
});

export const GAMEPLAY_FRAMES = Object.freeze({
  hexIdle: "hex_idle.png",
  hexHover: "hex_hover.png",
  hexSelected: "hex_selected.png",
});

export function hexFrameForState({ selected = false, hovered = false } = {}) {
  if (selected) return GAMEPLAY_FRAMES.hexSelected;
  if (hovered) return GAMEPLAY_FRAMES.hexHover;
  return GAMEPLAY_FRAMES.hexIdle;
}
