import { Atom } from "./atom-types.js";

const introduction = (text, textEn, requiredTypes) =>
  Object.freeze({ text, textEn, requiredTypes: Object.freeze(requiredTypes) });

export const CAMPAIGN_MECHANIC_INTRODUCTIONS = Object.freeze({
  1: introduction(
    "НОВОЕ: СОЛЬ (Sa)\n\nСОЛЬ СОЕДИНЯЕТСЯ С СОЛЬЮ\nИЛИ С ЛЮБОЙ СТИХИЕЙ",
    "NEW: SALT (Sa)\n\nSALT MATCHES SALT\nOR ANY ELEMENT",
    [Atom.SALT],
  ),
  2: introduction(
    "НОВОЕ: ЖИЗНЬ (V) + СМЕРТЬ (M)\n\nОНИ УДАЛЯЮТСЯ\nТОЛЬКО ВМЕСТЕ",
    "NEW: VITAE (V) + MORS (M)\n\nTHEY CAN ONLY BE\nREMOVED TOGETHER",
    [Atom.VITAE, Atom.MORS],
  ),
  3: introduction(
    "НОВОЕ: СВИНЕЦ (Pb) + РТУТЬ (Hg)\n\nРТУТЬ СОЕДИНЯЕТСЯ СО СВИНЦОМ\nИ УДАЛЯЕТСЯ ВМЕСТЕ С НИМ",
    "NEW: LEAD (Pb) + QUICKSILVER (Hg)\n\nQUICKSILVER MATCHES LEAD\nAND REMOVES IT",
    [Atom.LEAD, Atom.QUICKSILVER],
  ),
  4: introduction(
    "НОВОЕ: ОЛОВО (Sn) + РТУТЬ (Hg)\n\nОЛОВО ЗАБЛОКИРОВАНО, ПОКА\nНЕ УДАЛЁН ВЕСЬ СВИНЕЦ (Pb)",
    "NEW: TIN (Sn) + QUICKSILVER (Hg)\n\nTIN STAYS LOCKED UNTIL\nALL LEAD (Pb) IS REMOVED",
    [Atom.TIN, Atom.QUICKSILVER],
  ),
  5: introduction(
    "НОВОЕ: ЖЕЛЕЗО (Fe) + РТУТЬ (Hg)\n\nЖЕЛЕЗО ЗАБЛОКИРОВАНО, ПОКА\nНЕ УДАЛЕНО ВСЁ ОЛОВО (Sn)",
    "NEW: IRON (Fe) + QUICKSILVER (Hg)\n\nIRON STAYS LOCKED UNTIL\nALL TIN (Sn) IS REMOVED",
    [Atom.IRON, Atom.QUICKSILVER],
  ),
  6: introduction(
    "НОВОЕ: МЕДЬ (Cu) + РТУТЬ (Hg)\n\nМЕДЬ ЗАБЛОКИРОВАНА, ПОКА\nНЕ УДАЛЕНО ВСЁ ЖЕЛЕЗО (Fe)",
    "NEW: COPPER (Cu) + QUICKSILVER (Hg)\n\nCOPPER STAYS LOCKED UNTIL\nALL IRON (Fe) IS REMOVED",
    [Atom.COPPER, Atom.QUICKSILVER],
  ),
  7: introduction(
    "НОВОЕ: СЕРЕБРО (Ag) + РТУТЬ (Hg)\n\nСЕРЕБРО ЗАБЛОКИРОВАНО, ПОКА\nНЕ УДАЛЕНА ВСЯ МЕДЬ (Cu)",
    "NEW: SILVER (Ag) + QUICKSILVER (Hg)\n\nSILVER STAYS LOCKED UNTIL\nALL COPPER (Cu) IS REMOVED",
    [Atom.SILVER, Atom.QUICKSILVER],
  ),
  8: introduction(
    "НОВОЕ: ЗОЛОТО (Au)\n\nЗОЛОТО ОТКРЫВАЕТСЯ ПОСЛЕ СЕРЕБРА (Ag)\nИ УДАЛЯЕТСЯ БЕЗ ПАРЫ",
    "NEW: GOLD (Au)\n\nGOLD UNLOCKS AFTER SILVER (Ag)\nAND IS REMOVED WITHOUT A PAIR",
    [Atom.GOLD],
  ),
});

export function mechanicIntroductionForLevel(level) {
  return CAMPAIGN_MECHANIC_INTRODUCTIONS[level];
}
