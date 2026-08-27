import { Atom } from "./atom-types.js";

const introduction = (text, requiredTypes) =>
  Object.freeze({ text, requiredTypes: Object.freeze(requiredTypes) });

export const CAMPAIGN_MECHANIC_INTRODUCTIONS = Object.freeze({
  1: introduction(
    "NEW: SALT\n\nSALT PAIRS WITH SALT\nOR WITH ANY ELEMENT",
    [Atom.SALT],
  ),
  2: introduction(
    "NEW: VITAE + MORS\n\nTHEY CAN ONLY BE REMOVED\nTOGETHER AS OPPOSITES",
    [Atom.VITAE, Atom.MORS],
  ),
  3: introduction(
    "NEW: LEAD + Hg\n\nQUICKSILVER PAIRS WITH LEAD\nREMOVE THEM TOGETHER",
    [Atom.LEAD, Atom.QUICKSILVER],
  ),
  4: introduction(
    "NEW: TIN + Hg\n\nTIN STAYS LOCKED\nUNTIL ALL LEAD IS REMOVED",
    [Atom.TIN, Atom.QUICKSILVER],
  ),
  5: introduction(
    "NEW: IRON + Hg\n\nIRON STAYS LOCKED\nUNTIL ALL TIN IS REMOVED",
    [Atom.IRON, Atom.QUICKSILVER],
  ),
  6: introduction(
    "NEW: COPPER + Hg\n\nCOPPER STAYS LOCKED\nUNTIL ALL IRON IS REMOVED",
    [Atom.COPPER, Atom.QUICKSILVER],
  ),
  7: introduction(
    "NEW: SILVER + Hg\n\nSILVER STAYS LOCKED\nUNTIL ALL COPPER IS REMOVED",
    [Atom.SILVER, Atom.QUICKSILVER],
  ),
  8: introduction(
    "NEW: GOLD\n\nGOLD UNLOCKS AFTER SILVER\nAND A FREE GOLD IS REMOVED ALONE",
    [Atom.GOLD],
  ),
  12: introduction(
    "NEW: QUINTESSENCE\n\nREMOVE Q TOGETHER WITH\nAIR + FIRE + WATER + EARTH",
    [Atom.QUINTESSENCE, Atom.AIR, Atom.FIRE, Atom.WATER, Atom.EARTH],
  ),
});

export function mechanicIntroductionForLevel(level) {
  return CAMPAIGN_MECHANIC_INTRODUCTIONS[level];
}
