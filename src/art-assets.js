const ASSET_ROOT = "/assets/mechanized-magic";

function assetUrl(group, file) {
  return `${ASSET_ROOT}/${group}/${file}.png`;
}

export const GAMEPLAY_FONT = Object.freeze({
  family: '"Arial Black", "Trebuchet MS", "Segoe UI"',
});

export const THEME_COLORS = Object.freeze({
  canvas: 0x090d14,
  chrome: 0x111823,
  chromeRaised: 0x182231,
  line: 0x475363,
  text: "#eef3f8",
  textMuted: "#9aa7b5",
  ink: "#10151d",
  gold: "#f3c94f",
  goldNumber: 0xf3c94f,
  success: "#77dc91",
  successNumber: 0x77dc91,
  danger: "#ff6b67",
  dangerNumber: 0xff6b67,
});

export const UI_FRAMES = Object.freeze({
  buttonIdle: "mm-button-idle",
  buttonHover: "mm-button-hover",
  buttonSelected: "mm-button-selected",
  buttonDisabled: "mm-button-disabled",
  levelIdle: "mm-level-idle",
  levelHover: "mm-level-hover",
  levelCurrent: "mm-level-current",
  levelCompleted: "mm-level-completed",
  levelLocked: "mm-level-locked",
  iconLock: "mm-icon-lock",
  iconPlay: "mm-icon-next",
  iconStar: "mm-icon-badge-reward",
  panelMainLarge: "mm-panel-large",
  panelMainMedium: "mm-panel-main",
  panelSide: "mm-panel-side",
  panelHeader: "mm-panel-header",
  panelStripSmall: "mm-panel-strip",
  panelStripWithIcon: "mm-panel-header",
  panelSuccess: "mm-panel-success",
  panelFailure: "mm-panel-failure",
});

export const GAMEPLAY_FRAMES = Object.freeze({
  hexIdle: "mm-cell-idle",
  hexHover: "mm-cell-hover",
  hexSelected: "mm-cell-selected",
});

export const GAMEPLAY_UI_FRAMES = Object.freeze({
  back: "mm-icon-back",
  pause: "mm-icon-pause",
  settings: "mm-icon-settings",
  hint: "mm-icon-hint",
  undo: "mm-icon-undo",
  rescue: "mm-icon-rescue",
  rating: "mm-icon-rating",
  dust: "mm-icon-dust",
  shop: "mm-icon-shop",
  success: "mm-icon-success",
  failure: "mm-icon-failure",
  retry: "mm-icon-retry",
  next: "mm-icon-next",
  check: "mm-icon-check",
  lockSmall: "mm-icon-lock",
  badgeCount: "mm-icon-badge-count",
  badgeReward: "mm-icon-badge-reward",
});

export const ATOM_GLYPH_FRAMES = Object.freeze({
  1: "mm-atom-salt",
  2: "mm-atom-air",
  3: "mm-atom-fire",
  4: "mm-atom-water",
  5: "mm-atom-earth",
  6: "mm-atom-quicksilver",
  7: "mm-atom-gold",
  8: "mm-atom-silver",
  9: "mm-atom-copper",
  10: "mm-atom-iron",
  11: "mm-atom-tin",
  12: "mm-atom-lead",
  13: "mm-atom-vitae",
  14: "mm-atom-mors",
  15: "mm-atom-quintessence",
});

const ATOM_ASSET_NAMES = Object.freeze({
  1: "salt",
  2: "air",
  3: "fire",
  4: "water",
  5: "earth",
  6: "quicksilver",
  7: "gold",
  8: "silver",
  9: "copper",
  10: "iron",
  11: "tin",
  12: "lead",
  13: "vitae",
  14: "mors",
  15: "quintessence",
});

export const MECHANIZED_ASSET_URLS = Object.freeze({
  [UI_FRAMES.buttonIdle]: assetUrl("hud", "button-idle"),
  [UI_FRAMES.buttonHover]: assetUrl("hud", "button-hover"),
  [UI_FRAMES.buttonSelected]: assetUrl("hud", "button-selected"),
  [UI_FRAMES.buttonDisabled]: assetUrl("hud", "button-disabled"),
  [UI_FRAMES.levelIdle]: assetUrl("hud", "level-idle"),
  [UI_FRAMES.levelHover]: assetUrl("hud", "level-hover"),
  [UI_FRAMES.levelCurrent]: assetUrl("hud", "level-current"),
  [UI_FRAMES.levelCompleted]: assetUrl("hud", "level-completed"),
  [UI_FRAMES.levelLocked]: assetUrl("hud", "level-locked"),
  [UI_FRAMES.panelMainLarge]: assetUrl("hud", "panel-large"),
  [UI_FRAMES.panelMainMedium]: assetUrl("hud", "panel-main"),
  [UI_FRAMES.panelSide]: assetUrl("hud", "panel-side"),
  [UI_FRAMES.panelHeader]: assetUrl("hud", "panel-header"),
  [UI_FRAMES.panelStripSmall]: assetUrl("hud", "panel-strip"),
  [UI_FRAMES.panelSuccess]: assetUrl("hud", "panel-success"),
  [UI_FRAMES.panelFailure]: assetUrl("hud", "panel-failure"),
  [GAMEPLAY_FRAMES.hexIdle]: assetUrl("hud", "cell-idle"),
  [GAMEPLAY_FRAMES.hexHover]: assetUrl("hud", "cell-hover"),
  [GAMEPLAY_FRAMES.hexSelected]: assetUrl("hud", "cell-selected"),
  [GAMEPLAY_UI_FRAMES.back]: assetUrl("icons", "back"),
  [GAMEPLAY_UI_FRAMES.pause]: assetUrl("icons", "pause"),
  [GAMEPLAY_UI_FRAMES.settings]: assetUrl("icons", "settings"),
  [GAMEPLAY_UI_FRAMES.hint]: assetUrl("icons", "hint"),
  [GAMEPLAY_UI_FRAMES.undo]: assetUrl("icons", "undo"),
  [GAMEPLAY_UI_FRAMES.rescue]: assetUrl("icons", "rescue"),
  [GAMEPLAY_UI_FRAMES.rating]: assetUrl("icons", "rating"),
  [GAMEPLAY_UI_FRAMES.dust]: assetUrl("icons", "dust"),
  [GAMEPLAY_UI_FRAMES.shop]: assetUrl("icons", "shop"),
  [GAMEPLAY_UI_FRAMES.success]: assetUrl("icons", "success"),
  [GAMEPLAY_UI_FRAMES.failure]: assetUrl("icons", "failure"),
  [GAMEPLAY_UI_FRAMES.retry]: assetUrl("icons", "retry"),
  [GAMEPLAY_UI_FRAMES.next]: assetUrl("icons", "next"),
  [GAMEPLAY_UI_FRAMES.check]: assetUrl("icons", "check"),
  [GAMEPLAY_UI_FRAMES.lockSmall]: assetUrl("icons", "lock"),
  [GAMEPLAY_UI_FRAMES.badgeCount]: assetUrl("icons", "badge-count"),
  [GAMEPLAY_UI_FRAMES.badgeReward]: assetUrl("icons", "badge-reward"),
  ...Object.fromEntries(
    Object.entries(ATOM_GLYPH_FRAMES).map(([type, key]) => [
      key,
      assetUrl("atoms", ATOM_ASSET_NAMES[type]),
    ]),
  ),
});

export function atomGlyphFrame(type) {
  return ATOM_GLYPH_FRAMES[type];
}

export function hexFrameForState({ selected = false, hovered = false } = {}) {
  if (selected) return GAMEPLAY_FRAMES.hexSelected;
  if (hovered) return GAMEPLAY_FRAMES.hexHover;
  return GAMEPLAY_FRAMES.hexIdle;
}
