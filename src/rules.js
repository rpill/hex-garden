import {
  Atom,
  PREVIOUS_METAL,
  isElement,
  isMetal,
} from "./atom-types.js";

/** Return whether two atom types form a legal two-piece match. */
export function atomTypesMatch(a, b) {
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

export function isSingleRemoval(type) {
  return type === Atom.GOLD;
}

export function isMetalLocked(type, boardTypes) {
  if (!isMetal(type)) return false;
  for (const otherType of boardTypes) {
    if (PREVIOUS_METAL[otherType] === type) return true;
  }
  return false;
}
