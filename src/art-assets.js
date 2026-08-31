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

export const ATOM_GLYPH_FRAMES = Object.freeze({
  1: "element_salt.png",
  2: "element_air.png",
  3: "element_fire.png",
  4: "element_water.png",
  5: "element_earth.png",
  6: "element_quicksilver.png",
  7: "metal_gold.png",
  8: "metal_silver.png",
  9: "metal_copper.png",
  10: "metal_iron.png",
  11: "metal_tin.png",
  12: "metal_lead.png",
  13: "element_vitae.png",
  14: "element_mors.png",
});

export function atomGlyphFrame(type) {
  return ATOM_GLYPH_FRAMES[type];
}

export function hexFrameForState({ selected = false, hovered = false } = {}) {
  if (selected) return GAMEPLAY_FRAMES.hexSelected;
  if (hovered) return GAMEPLAY_FRAMES.hexHover;
  return GAMEPLAY_FRAMES.hexIdle;
}
