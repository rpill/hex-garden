export const GAMEPLAY_ATLAS = Object.freeze({
  key: "gameplay-atlas",
  jsonUrl: "/assets/hex-garden/gameplay-atlas.json",
  baseUrl: "/assets/hex-garden",
  textureFile: "gameplay-atlas.png",
});

export const UI_ATLAS = Object.freeze({
  key: "ui-atlas",
  jsonUrl: "/assets/hex-garden/ui-atlas.json",
  baseUrl: "/assets/hex-garden",
  textureFile: "ui-atlas.png",
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

export const UI_FRAMES = Object.freeze({
  buttonIdle: "button_idle.png",
  buttonHover: "button_hover.png",
  buttonSelected: "button_selected.png",
  buttonDisabled: "button_disabled.png",
  levelIdle: "level_idle.png",
  levelHover: "level_hover.png",
  levelCurrent: "level_current.png",
  levelCompleted: "level_completed.png",
  levelLocked: "level_locked.png",
  iconLock: "icon_lock.png",
  iconPlay: "icon_play.png",
  iconStar: "icon_star.png",
  panelMainLarge: "panel_main_large.png",
  panelMainMedium: "panel_main_medium.png",
  panelSide: "panel_side.png",
  panelHeader: "panel_header.png",
  panelStripSmall: "panel_strip_small.png",
  panelStripWithIcon: "panel_strip_with_icon.png",
  panelSuccess: "panel_success.png",
  panelFailure: "panel_failure.png",
});

export const GAMEPLAY_UI_FRAMES = Object.freeze({
  back: "back.png",
  pause: "pause.png",
  settings: "settings.png",
  hint: "hint.png",
  undo: "undo.png",
  rescue: "rescue.png",
  rating: "rating.png",
  dust: "dust.png",
  success: "icon_success_trophy.png",
  failure: "icon_failure.png",
  retry: "icon_retry.png",
  next: "icon_next.png",
  check: "icon_check.png",
  lockSmall: "icon_lock_small.png",
  badgeCount: "badge_count.png",
  badgeReward: "badge_reward.png",
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
