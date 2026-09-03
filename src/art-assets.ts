import { Atom, type AtomType } from "./atom-types.js";

const ASSET_ROOT = "/assets/chequered-ink";
function assetUrl(group: string, file: string): string { return `${ASSET_ROOT}/${group}/${file}.png`; }

export const GAMEPLAY_FONT = Object.freeze({ family: '"Arial Black", "Trebuchet MS", "Segoe UI"' });
export const THEME_COLORS = Object.freeze({
  canvas: 0x0c1017, chrome: 0x151a22, chromeRaised: 0x202733, line: 0x46515f,
  text: "#f4f6f8", textMuted: "#a9b2bd", ink: "#10151d", gold: "#ffd329", goldNumber: 0xffd329,
  success: "#68cf75", successNumber: 0x68cf75, danger: "#ef5a50", dangerNumber: 0xef5a50,
});
export const UI_FRAMES = Object.freeze({
  buttonIdle: "ci-button-idle", buttonHover: "ci-button-hover", buttonSelected: "ci-button-selected", buttonDisabled: "ci-button-disabled",
  levelIdle: "ci-level-idle", levelHover: "ci-level-hover", levelCurrent: "ci-level-current", levelCompleted: "ci-level-completed", levelLocked: "ci-level-locked",
  iconLock: "ci-icon-unavailable", iconPlay: "ci-icon-next", iconStar: "ci-icon-badge-reward",
  panelMainLarge: "ci-panel-large", panelMainMedium: "ci-panel-main", panelSide: "ci-panel-side", panelHeader: "ci-panel-header",
  panelStripSmall: "ci-panel-strip", panelStripWithIcon: "ci-panel-header", panelSuccess: "ci-panel-success", panelFailure: "ci-panel-failure",
});
export const GAMEPLAY_FRAMES = Object.freeze({ hexIdle: "ci-cell-idle", hexHover: "ci-cell-hover", hexSelected: "ci-cell-selected" });
export const GAMEPLAY_UI_FRAMES = Object.freeze({
  back: "ci-icon-back", pause: "ci-icon-pause", settings: "ci-icon-settings", hint: "ci-icon-hint", undo: "ci-icon-undo", rescue: "ci-icon-rescue",
  rating: "ci-icon-rating", dust: "ci-icon-dust", success: "ci-icon-success", failure: "ci-icon-failure", retry: "ci-icon-retry", next: "ci-icon-next",
  check: "ci-icon-check", lockSmall: "ci-icon-unavailable", badgeCount: "ci-icon-badge-count", badgeReward: "ci-icon-badge-reward",
});

export const ATOM_GLYPH_FRAMES = Object.freeze({
  [Atom.SALT]: "ci-atom-salt", [Atom.AIR]: "ci-atom-air", [Atom.FIRE]: "ci-atom-fire", [Atom.WATER]: "ci-atom-water", [Atom.EARTH]: "ci-atom-earth",
  [Atom.QUICKSILVER]: "ci-atom-quicksilver", [Atom.GOLD]: "ci-atom-gold", [Atom.SILVER]: "ci-atom-silver", [Atom.COPPER]: "ci-atom-copper",
  [Atom.IRON]: "ci-atom-iron", [Atom.TIN]: "ci-atom-tin", [Atom.LEAD]: "ci-atom-lead", [Atom.VITAE]: "ci-atom-vitae", [Atom.MORS]: "ci-atom-mors",
  [Atom.QUINTESSENCE]: "ci-atom-quintessence",
} satisfies Record<AtomType, string>);

const ATOM_ASSET_FILES = Object.freeze({
  [Atom.SALT]: "salt", [Atom.AIR]: "air", [Atom.FIRE]: "fire", [Atom.WATER]: "water", [Atom.EARTH]: "earth", [Atom.QUICKSILVER]: "quicksilver",
  [Atom.GOLD]: "gold", [Atom.SILVER]: "silver", [Atom.COPPER]: "copper", [Atom.IRON]: "iron", [Atom.TIN]: "tin", [Atom.LEAD]: "lead",
  [Atom.VITAE]: "vitae", [Atom.MORS]: "mors", [Atom.QUINTESSENCE]: "quintessence",
} satisfies Record<AtomType, string>);

export const ART_ASSET_URLS: Readonly<Record<string, string>> = Object.freeze({
  [GAMEPLAY_UI_FRAMES.back]: assetUrl("icons", "back"), [GAMEPLAY_UI_FRAMES.pause]: assetUrl("icons", "pause"),
  [GAMEPLAY_UI_FRAMES.settings]: assetUrl("icons", "settings"), [GAMEPLAY_UI_FRAMES.hint]: assetUrl("icons", "hint"),
  [GAMEPLAY_UI_FRAMES.undo]: assetUrl("icons", "undo"), [GAMEPLAY_UI_FRAMES.rescue]: assetUrl("icons", "rescue"),
  [GAMEPLAY_UI_FRAMES.rating]: assetUrl("icons", "rating"), [GAMEPLAY_UI_FRAMES.dust]: assetUrl("icons", "dust"),
  [GAMEPLAY_UI_FRAMES.success]: assetUrl("icons", "success"), [GAMEPLAY_UI_FRAMES.failure]: assetUrl("icons", "failure"),
  [GAMEPLAY_UI_FRAMES.retry]: assetUrl("icons", "retry"), [GAMEPLAY_UI_FRAMES.next]: assetUrl("icons", "next"),
  [GAMEPLAY_UI_FRAMES.check]: assetUrl("icons", "check"), [GAMEPLAY_UI_FRAMES.lockSmall]: assetUrl("icons", "unavailable"),
  [GAMEPLAY_UI_FRAMES.badgeCount]: assetUrl("icons", "badge-count"), [GAMEPLAY_UI_FRAMES.badgeReward]: assetUrl("icons", "badge-reward"),
  ...Object.fromEntries((Object.entries(ATOM_GLYPH_FRAMES) as [string, string][]).map(([type, key]) => [key, assetUrl("gems", ATOM_ASSET_FILES[Number(type) as AtomType])])),
});

export function atomGlyphFrame(type: AtomType): string { return ATOM_GLYPH_FRAMES[type]; }
export function hexFrameForState({ selected = false, hovered = false }: { selected?: boolean; hovered?: boolean } = {}): string {
  if (selected) return GAMEPLAY_FRAMES.hexSelected;
  if (hovered) return GAMEPLAY_FRAMES.hexHover;
  return GAMEPLAY_FRAMES.hexIdle;
}
