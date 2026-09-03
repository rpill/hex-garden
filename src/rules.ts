import {
  Atom,
  PREVIOUS_METAL,
  isElement,
  isMetal,
  type AtomType,
} from "./atom-types.js";

/** Return whether two atom types form a legal two-piece match. */
export function atomTypesMatch(a: AtomType, b: AtomType): boolean {
  if (isElement(a) && a === b) return true;
  if (a === Atom.SALT && (b === Atom.SALT || isElement(b))) return true;
  if (b === Atom.SALT && isElement(a)) return true;
  if (
    (a === Atom.VITAE && b === Atom.MORS) ||
    (a === Atom.MORS && b === Atom.VITAE)
  ) {
    return true;
  }

  // Every metal except gold has an entry in PREVIOUS_METAL.
  if (a === Atom.QUICKSILVER && Object.hasOwn(PREVIOUS_METAL, b)) return true;
  if (b === Atom.QUICKSILVER && Object.hasOwn(PREVIOUS_METAL, a)) return true;
  return false;
}

export function isSingleRemoval(type: AtomType): boolean {
  return type === Atom.GOLD;
}

export function isMetalLocked(type: AtomType, boardTypes: readonly AtomType[]): boolean {
  if (!isMetal(type)) return false;
  for (const otherType of boardTypes) {
    if (PREVIOUS_METAL[otherType as keyof typeof PREVIOUS_METAL] === type) return true;
  }
  return false;
}
