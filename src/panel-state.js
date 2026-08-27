import { Atom, isElement, isMetal } from "./atom-types.js";

export const PANEL_METAL_TYPES = Object.freeze([
  Atom.LEAD,
  Atom.TIN,
  Atom.IRON,
  Atom.COPPER,
  Atom.SILVER,
  Atom.GOLD,
]);

export const PANEL_COMMON_TYPES = Object.freeze([
  Atom.SALT,
  Atom.AIR,
  Atom.FIRE,
  Atom.WATER,
  Atom.EARTH,
]);

const PANEL_OPPOSITE_TYPES = Object.freeze([Atom.VITAE, Atom.MORS]);

export function panelTypesForVariant(variant, initialBoardOrPieces) {
  const supportedTypes = [
    ...PANEL_COMMON_TYPES,
    ...(variant === "quintessence" ? [Atom.QUINTESSENCE] : []),
    ...PANEL_OPPOSITE_TYPES,
    Atom.QUICKSILVER,
    ...PANEL_METAL_TYPES,
  ];
  if (initialBoardOrPieces === undefined) return supportedTypes;
  const initialTypes = new Set(
    piecesFrom(initialBoardOrPieces).map((piece) => piece.type),
  );
  return supportedTypes.filter((type) => initialTypes.has(type));
}

function piecesFrom(boardOrPieces) {
  if (!boardOrPieces) return [];
  return typeof boardOrPieces.pieces === "function"
    ? boardOrPieces.pieces()
    : boardOrPieces;
}

/**
 * Renderer-independent state for the bottom atom inventory.
 *
 * The parity warning mirrors the useful information in the original panel:
 * salt must be consumed in pairs or compensate an odd element, while a
 * remaining quintessence can consume one of every element.
 */
export function createPanelState(boardOrPieces, options = {}) {
  const pieces = piecesFrom(boardOrPieces);
  const counts = new Map();
  for (const piece of pieces) {
    counts.set(piece.type, (counts.get(piece.type) ?? 0) + 1);
  }

  const variant = options.variant ?? "standard";
  const activeType = options.activeType ?? null;
  const visibleTypes =
    options.types ?? panelTypesForVariant(variant);
  const quintessenceCount = counts.get(Atom.QUINTESSENCE) ?? 0;
  const currentMetal = PANEL_METAL_TYPES.find(
    (type) => (counts.get(type) ?? 0) > 0,
  );

  const entries = visibleTypes.map((type) => {
    const count = counts.get(type) ?? 0;
    const metal = isMetal(type);
    const depleted = count === 0;
    const locked = metal && !depleted && type !== currentMetal;
    const warning =
      (type === Atom.SALT && count % 2 === 1) ||
      (isElement(type) && (count + quintessenceCount) % 2 === 1);

    return Object.freeze({
      type,
      count,
      countVisible: !metal,
      depleted,
      locked,
      current: metal && !depleted && type === currentMetal,
      selected: type === activeType,
      warning,
    });
  });

  return Object.freeze({
    counts,
    currentMetal,
    entries: Object.freeze(entries),
  });
}
