/**
 * Atom identifiers used by the original board database.
 *
 * The numeric IDs are part of the on-disk format. Keep them stable even if a
 * UI chooses different display names.
 */
export const Atom = Object.freeze({
  SALT: 1,
  AIR: 2,
  FIRE: 3,
  WATER: 4,
  EARTH: 5,
  QUICKSILVER: 6,
  GOLD: 7,
  SILVER: 8,
  COPPER: 9,
  IRON: 10,
  TIN: 11,
  LEAD: 12,
  VITAE: 13,
  MORS: 14,
  QUINTESSENCE: 16,
} as const);

export type AtomType = (typeof Atom)[keyof typeof Atom];

export const ELEMENT_TYPES = Object.freeze([
  Atom.AIR,
  Atom.FIRE,
  Atom.WATER,
  Atom.EARTH,
] as const satisfies readonly AtomType[]);

export const METAL_TYPES = Object.freeze([
  Atom.GOLD,
  Atom.SILVER,
  Atom.COPPER,
  Atom.IRON,
  Atom.TIN,
  Atom.LEAD,
] as const satisfies readonly AtomType[]);

const elementSet = new Set<AtomType>(ELEMENT_TYPES);
const metalSet = new Set<AtomType>(METAL_TYPES);

/**
 * A metal is locked while the next less-refined metal is still on the board.
 * Gold <- silver <- copper <- iron <- tin <- lead.
 */
export const PREVIOUS_METAL = Object.freeze({
  [Atom.SILVER]: Atom.GOLD,
  [Atom.COPPER]: Atom.SILVER,
  [Atom.IRON]: Atom.COPPER,
  [Atom.TIN]: Atom.IRON,
  [Atom.LEAD]: Atom.TIN,
} satisfies Partial<Record<AtomType, AtomType>>);

export const ATOM_NAMES = Object.freeze({
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

export function isElement(type: AtomType): boolean {
  return elementSet.has(type);
}

export function isMetal(type: AtomType): boolean {
  return metalSet.has(type);
}

export function assertAtomType(type: unknown): AtomType {
  if (typeof type !== "number" || !Object.hasOwn(ATOM_NAMES, type)) {
    throw new RangeError(`Unknown Garden atom type: ${String(type)}`);
  }
  return type as AtomType;
}
