import { Atom, type AtomType } from "./atom-types.js";
import { ACTIVE_ART_THEME, type ArtThemeId } from "./art-theme.js";

export { ACTIVE_ART_THEME } from "./art-theme.js";

const CHEQUERED_ROOT = "/assets/chequered-ink";
const PHYSICAL_ROOT = "/assets/physical-premium";

function chequeredUrl(group: string, file: string): string {
  return `${CHEQUERED_ROOT}/${group}/${file}.png`;
}

function physicalUrl(file: string): string {
  return `${PHYSICAL_ROOT}/${file}`;
}

export interface ThemeColors {
  canvas: number;
  chrome: number;
  chromeRaised: number;
  line: number;
  text: string;
  textMuted: string;
  textNumber: number;
  ink: string;
  gold: string;
  goldNumber: number;
  success: string;
  successNumber: number;
  danger: string;
  dangerNumber: number;
  cellFillNumber: number;
  cellLineNumber: number;
  walnut: number;
  walnutDark: number;
  brass: number;
  brassSoft: number;
  ivory: number;
  ivoryRaised: number;
  shadow: number;
}

const THEME_PALETTES: Readonly<Record<ArtThemeId, ThemeColors>> = Object.freeze({
  premium: {
    canvas: 0x162a24,
    chrome: 0x3a2518,
    chromeRaised: 0x50301e,
    line: 0x8d6a3f,
    text: "#f3ead8",
    textMuted: "#c2b59e",
    textNumber: 0xf3ead8,
    ink: "#1a120d",
    gold: "#c69a52",
    goldNumber: 0xc69a52,
    success: "#89a76f",
    successNumber: 0x89a76f,
    danger: "#c06a5c",
    dangerNumber: 0xc06a5c,
    cellFillNumber: 0x1b342d,
    cellLineNumber: 0x79623f,
    walnut: 0x4c2e1d,
    walnutDark: 0x2b1b12,
    brass: 0xb88a45,
    brassSoft: 0xd1ae72,
    ivory: 0xe6dbc4,
    ivoryRaised: 0xf0e5cd,
    shadow: 0x080a08,
  },
  chequered: {
    canvas: 0x0c1017,
    chrome: 0x151a22,
    chromeRaised: 0x202733,
    line: 0x46515f,
    text: "#f4f6f8",
    textMuted: "#a9b2bd",
    textNumber: 0xf4f6f8,
    ink: "#10151d",
    gold: "#ffd329",
    goldNumber: 0xffd329,
    success: "#68cf75",
    successNumber: 0x68cf75,
    danger: "#ef5a50",
    dangerNumber: 0xef5a50,
    cellFillNumber: 0x141a22,
    cellLineNumber: 0x2a3440,
    walnut: 0x3a2a22,
    walnutDark: 0x1f1713,
    brass: 0x7b8794,
    brassSoft: 0xa8b2bd,
    ivory: 0x202733,
    ivoryRaised: 0x29323d,
    shadow: 0x000000,
  },
});


export const PHYSICAL_MATERIAL_FRAMES = Object.freeze({
  feltTable: "physical-felt-table",
  surfaceCard: "physical-surface-card",
  surfaceTray: "physical-surface-tray",
  surfaceButton: "physical-surface-button",
  surfaceSystem: "physical-surface-system",
  tokenBase: "physical-token-base",
  boardCell: "physical-board-cell",
  pieceBall: "physical-piece-ball",
  salt: "physical-piece-salt",
  air: "physical-piece-air",
  fire: "physical-piece-fire",
  water: "physical-piece-water",
  earth: "physical-piece-earth",
  quicksilver: "physical-piece-quicksilver",
  gold: "physical-piece-gold",
  silver: "physical-piece-silver",
  copper: "physical-piece-copper",
  iron: "physical-piece-iron",
  tin: "physical-piece-tin",
  lead: "physical-piece-lead",
  vitae: "physical-piece-vitae",
  mors: "physical-piece-mors",
  quintessence: "physical-piece-quintessence",
  coin: "physical-coin",
});

export const GAMEPLAY_FONT = Object.freeze({
  family: ACTIVE_ART_THEME === "premium"
    ? '"Trebuchet MS", "Segoe UI", Arial'
    : '"Arial Black", "Trebuchet MS", "Segoe UI"',
});
export const THEME_COLORS = Object.freeze(THEME_PALETTES[ACTIVE_ART_THEME]);

export const UI_FRAMES = Object.freeze({
  buttonIdle: "ci-button-idle",
  buttonHover: "ci-button-hover",
  buttonSelected: "ci-button-selected",
  buttonDisabled: "ci-button-disabled",
  levelIdle: "ci-level-idle",
  levelHover: "ci-level-hover",
  levelCurrent: "ci-level-current",
  levelCompleted: "ci-level-completed",
  levelLocked: "ci-level-locked",
  iconLock: "ci-icon-unavailable",
  iconPlay: "ci-icon-next",
  iconStar: "ci-icon-badge-reward",
  panelMainLarge: "ci-panel-large",
  panelMainMedium: "ci-panel-main",
  panelSide: "ci-panel-side",
  panelHeader: "ci-panel-header",
  panelStripSmall: "ci-panel-strip",
  panelStripWithIcon: "ci-panel-header",
  panelSuccess: "ci-panel-success",
  panelFailure: "ci-panel-failure",
});

export const GAMEPLAY_FRAMES = Object.freeze({
  hexIdle: "ci-cell-idle",
  hexHover: "ci-cell-hover",
  hexSelected: "ci-cell-selected",
});

export const GAMEPLAY_UI_FRAMES = Object.freeze({
  back: "ci-icon-back",
  pause: "ci-icon-pause",
  settings: "ci-icon-settings",
  shop: "ci-icon-shop",
  hint: "ci-icon-hint",
  undo: "ci-icon-undo",
  rescue: "ci-icon-rescue",
  rating: "ci-icon-rating",
  dust: "ci-icon-dust",
  success: "ci-icon-success",
  failure: "ci-icon-failure",
  retry: "ci-icon-retry",
  next: "ci-icon-next",
  check: "ci-icon-check",
  lockSmall: "ci-icon-unavailable",
  badgeCount: "ci-icon-badge-count",
  badgeReward: "ci-icon-badge-reward",
});

export const ATOM_GLYPH_FRAMES = Object.freeze({
  [Atom.SALT]: "ci-atom-salt",
  [Atom.AIR]: "ci-atom-air",
  [Atom.FIRE]: "ci-atom-fire",
  [Atom.WATER]: "ci-atom-water",
  [Atom.EARTH]: "ci-atom-earth",
  [Atom.QUICKSILVER]: "ci-atom-quicksilver",
  [Atom.GOLD]: "ci-atom-gold",
  [Atom.SILVER]: "ci-atom-silver",
  [Atom.COPPER]: "ci-atom-copper",
  [Atom.IRON]: "ci-atom-iron",
  [Atom.TIN]: "ci-atom-tin",
  [Atom.LEAD]: "ci-atom-lead",
  [Atom.VITAE]: "ci-atom-vitae",
  [Atom.MORS]: "ci-atom-mors",
  [Atom.QUINTESSENCE]: "ci-atom-quintessence",
} satisfies Record<AtomType, string>);

const ATOM_ASSET_FILES = Object.freeze({
  [Atom.SALT]: "salt",
  [Atom.AIR]: "air",
  [Atom.FIRE]: "fire",
  [Atom.WATER]: "water",
  [Atom.EARTH]: "earth",
  [Atom.QUICKSILVER]: "quicksilver",
  [Atom.GOLD]: "gold",
  [Atom.SILVER]: "silver",
  [Atom.COPPER]: "copper",
  [Atom.IRON]: "iron",
  [Atom.TIN]: "tin",
  [Atom.LEAD]: "lead",
  [Atom.VITAE]: "vitae",
  [Atom.MORS]: "mors",
  [Atom.QUINTESSENCE]: "quintessence",
} satisfies Record<AtomType, string>);

const PHYSICAL_ASSET_URLS: Readonly<Record<string, string>> = Object.freeze({
  [PHYSICAL_MATERIAL_FRAMES.feltTable]: physicalUrl("felt-table.jpg"),
  [PHYSICAL_MATERIAL_FRAMES.surfaceCard]: physicalUrl("surface-card.png"),
  [PHYSICAL_MATERIAL_FRAMES.surfaceTray]: physicalUrl("surface-tray.png"),
  [PHYSICAL_MATERIAL_FRAMES.surfaceButton]: physicalUrl("surface-button.png"),
  [PHYSICAL_MATERIAL_FRAMES.surfaceSystem]: physicalUrl("surface-system.png"),
  [PHYSICAL_MATERIAL_FRAMES.tokenBase]: physicalUrl("token-base.png"),
  [PHYSICAL_MATERIAL_FRAMES.boardCell]: physicalUrl("board-cell.png"),
  [PHYSICAL_MATERIAL_FRAMES.pieceBall]: physicalUrl("piece-ball.png"),
  [PHYSICAL_MATERIAL_FRAMES.salt]: physicalUrl("piece-salt.png"),
  [PHYSICAL_MATERIAL_FRAMES.air]: physicalUrl("piece-air.png"),
  [PHYSICAL_MATERIAL_FRAMES.fire]: physicalUrl("piece-fire.png"),
  [PHYSICAL_MATERIAL_FRAMES.water]: physicalUrl("piece-water.png"),
  [PHYSICAL_MATERIAL_FRAMES.earth]: physicalUrl("piece-earth.png"),
  [PHYSICAL_MATERIAL_FRAMES.quicksilver]: physicalUrl("piece-quicksilver.png"),
  [PHYSICAL_MATERIAL_FRAMES.gold]: physicalUrl("piece-gold.png"),
  [PHYSICAL_MATERIAL_FRAMES.silver]: physicalUrl("piece-silver.png"),
  [PHYSICAL_MATERIAL_FRAMES.copper]: physicalUrl("piece-copper.png"),
  [PHYSICAL_MATERIAL_FRAMES.iron]: physicalUrl("piece-iron.png"),
  [PHYSICAL_MATERIAL_FRAMES.tin]: physicalUrl("piece-tin.png"),
  [PHYSICAL_MATERIAL_FRAMES.lead]: physicalUrl("piece-lead.png"),
  [PHYSICAL_MATERIAL_FRAMES.vitae]: physicalUrl("piece-vitae.png"),
  [PHYSICAL_MATERIAL_FRAMES.mors]: physicalUrl("piece-mors.png"),
  [PHYSICAL_MATERIAL_FRAMES.quintessence]: physicalUrl("piece-quintessence.png"),
  [PHYSICAL_MATERIAL_FRAMES.coin]: physicalUrl("coin.png"),
});

export const ART_ASSET_URLS: Readonly<Record<string, string>> = Object.freeze({
  ...(ACTIVE_ART_THEME === "premium" ? PHYSICAL_ASSET_URLS : {}),
  [GAMEPLAY_UI_FRAMES.back]: chequeredUrl("icons", "back"),
  [GAMEPLAY_UI_FRAMES.pause]: chequeredUrl("icons", "pause"),
  [GAMEPLAY_UI_FRAMES.settings]: chequeredUrl("icons", "settings"),
  [GAMEPLAY_UI_FRAMES.shop]: chequeredUrl("icons", "shop"),
  [GAMEPLAY_UI_FRAMES.hint]: chequeredUrl("icons", "hint"),
  [GAMEPLAY_UI_FRAMES.undo]: chequeredUrl("icons", "undo"),
  [GAMEPLAY_UI_FRAMES.rescue]: chequeredUrl("icons", "rescue"),
  [GAMEPLAY_UI_FRAMES.rating]: chequeredUrl("icons", "rating"),
  [GAMEPLAY_UI_FRAMES.dust]: ACTIVE_ART_THEME === "premium"
    ? physicalUrl("coin.png")
    : chequeredUrl("icons", "dust"),
  [GAMEPLAY_UI_FRAMES.success]: chequeredUrl("icons", "success"),
  [GAMEPLAY_UI_FRAMES.failure]: chequeredUrl("icons", "failure"),
  [GAMEPLAY_UI_FRAMES.retry]: chequeredUrl("icons", "retry"),
  [GAMEPLAY_UI_FRAMES.next]: chequeredUrl("icons", "next"),
  [GAMEPLAY_UI_FRAMES.check]: chequeredUrl("icons", "check"),
  [GAMEPLAY_UI_FRAMES.lockSmall]: chequeredUrl("icons", "unavailable"),
  [GAMEPLAY_UI_FRAMES.badgeCount]: chequeredUrl("icons", "badge-count"),
  [GAMEPLAY_UI_FRAMES.badgeReward]: chequeredUrl("icons", "badge-reward"),
  ...Object.fromEntries(
    (Object.entries(ATOM_GLYPH_FRAMES) as [string, string][]).map(([type, key]) => [
      key,
      chequeredUrl("gems", ATOM_ASSET_FILES[Number(type) as AtomType]),
    ]),
  ),
});


const PHYSICAL_PIECE_FRAMES_BY_TYPE = Object.freeze({
  [Atom.SALT]: PHYSICAL_MATERIAL_FRAMES.salt,
  [Atom.AIR]: PHYSICAL_MATERIAL_FRAMES.air,
  [Atom.FIRE]: PHYSICAL_MATERIAL_FRAMES.fire,
  [Atom.WATER]: PHYSICAL_MATERIAL_FRAMES.water,
  [Atom.EARTH]: PHYSICAL_MATERIAL_FRAMES.earth,
  [Atom.QUICKSILVER]: PHYSICAL_MATERIAL_FRAMES.quicksilver,
  [Atom.GOLD]: PHYSICAL_MATERIAL_FRAMES.gold,
  [Atom.SILVER]: PHYSICAL_MATERIAL_FRAMES.silver,
  [Atom.COPPER]: PHYSICAL_MATERIAL_FRAMES.copper,
  [Atom.IRON]: PHYSICAL_MATERIAL_FRAMES.iron,
  [Atom.TIN]: PHYSICAL_MATERIAL_FRAMES.tin,
  [Atom.LEAD]: PHYSICAL_MATERIAL_FRAMES.lead,
  [Atom.VITAE]: PHYSICAL_MATERIAL_FRAMES.vitae,
  [Atom.MORS]: PHYSICAL_MATERIAL_FRAMES.mors,
  [Atom.QUINTESSENCE]: PHYSICAL_MATERIAL_FRAMES.quintessence,
} satisfies Record<AtomType, string>);

export function physicalPieceFrameForType(type: AtomType): string | undefined {
  if (ACTIVE_ART_THEME !== "premium") return undefined;
  return PHYSICAL_PIECE_FRAMES_BY_TYPE[type];
}

export function resolveUiTextColor(color: string): string {
  if (ACTIVE_ART_THEME === "chequered") return color;
  const normalized = color.toLowerCase();
  if (["#eef3f8", "#f4f6f8", "#e8edf2", "#e4edf6", "#ffffff"].includes(normalized)) {
    return THEME_COLORS.text;
  }
  if (["#9aa7b5", "#a9b2bd", "#777777", "#686868"].includes(normalized)) {
    return THEME_COLORS.textMuted;
  }
  if (["#f3c94f", "#ffd329"].includes(normalized)) return THEME_COLORS.gold;
  if (["#77dc91", "#68cf75"].includes(normalized)) return THEME_COLORS.success;
  if (["#ef5a50", "#ffb0a4"].includes(normalized)) return THEME_COLORS.danger;
  return color;
}

export function atomGlyphFrame(type: AtomType): string {
  return ATOM_GLYPH_FRAMES[type];
}

export function hexFrameForState(
  { selected = false, hovered = false }: { selected?: boolean; hovered?: boolean } = {},
): string {
  if (selected) return GAMEPLAY_FRAMES.hexSelected;
  if (hovered) return GAMEPLAY_FRAMES.hexHover;
  return GAMEPLAY_FRAMES.hexIdle;
}
