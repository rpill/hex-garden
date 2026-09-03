import { Atom, isElement, isMetal, type AtomType } from "./atom-types.js";
import { GardenBoard, type BoardPiece } from "./board.js";
import type { BoardVariantValue } from "./generator.js";

export const PANEL_METAL_TYPES = Object.freeze([Atom.LEAD, Atom.TIN, Atom.IRON, Atom.COPPER, Atom.SILVER, Atom.GOLD] as const);
export const PANEL_COMMON_TYPES = Object.freeze([Atom.SALT, Atom.AIR, Atom.FIRE, Atom.WATER, Atom.EARTH] as const);
const PANEL_OPPOSITE_TYPES = Object.freeze([Atom.VITAE, Atom.MORS] as const);

type PieceSource = GardenBoard | readonly BoardPiece[];
function piecesFrom(boardOrPieces: PieceSource | null | undefined): readonly BoardPiece[] {
  if (!boardOrPieces) return [];
  return boardOrPieces instanceof GardenBoard ? boardOrPieces.pieces() : boardOrPieces;
}

export function panelTypesForVariant(variant: BoardVariantValue, initialBoardOrPieces?: PieceSource): AtomType[] {
  const supportedTypes: AtomType[] = [
    ...PANEL_COMMON_TYPES, ...(variant === "quintessence" ? [Atom.QUINTESSENCE] : []), ...PANEL_OPPOSITE_TYPES, Atom.QUICKSILVER, ...PANEL_METAL_TYPES,
  ];
  if (initialBoardOrPieces === undefined) return supportedTypes;
  const initialTypes = new Set(piecesFrom(initialBoardOrPieces).map((piece) => piece.type));
  return supportedTypes.filter((type) => initialTypes.has(type));
}

export interface PanelEntry {
  type: AtomType; count: number; countVisible: boolean; depleted: boolean; locked: boolean; current: boolean; selected: boolean; warning: boolean;
}
export interface PanelState { counts: Map<AtomType, number>; currentMetal: AtomType | undefined; entries: readonly Readonly<PanelEntry>[]; }
export interface PanelStateOptions { variant?: BoardVariantValue; activeType?: AtomType | null; types?: readonly AtomType[]; }

export function createPanelState(boardOrPieces: PieceSource, options: PanelStateOptions = {}): Readonly<PanelState> {
  const pieces = piecesFrom(boardOrPieces);
  const counts = new Map<AtomType, number>();
  for (const piece of pieces) counts.set(piece.type, (counts.get(piece.type) ?? 0) + 1);
  const variant = options.variant ?? "standard";
  const activeType = options.activeType ?? null;
  const visibleTypes = options.types ?? panelTypesForVariant(variant);
  const quintessenceCount = counts.get(Atom.QUINTESSENCE) ?? 0;
  const currentMetal = PANEL_METAL_TYPES.find((type) => (counts.get(type) ?? 0) > 0);
  const entries = visibleTypes.map((type): Readonly<PanelEntry> => {
    const count = counts.get(type) ?? 0;
    const metal = isMetal(type); const depleted = count === 0; const locked = metal && !depleted && type !== currentMetal;
    const warning = (type === Atom.SALT && count % 2 === 1) || (isElement(type) && (count + quintessenceCount) % 2 === 1);
    return Object.freeze({ type, count, countVisible: !metal, depleted, locked, current: metal && !depleted && type === currentMetal, selected: type === activeType, warning });
  });
  return Object.freeze({ counts, currentMetal, entries: Object.freeze(entries) });
}
