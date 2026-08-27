import { Atom } from "./atom-types.js";

const introduction = (text, requiredTypes) =>
  Object.freeze({ text, requiredTypes: Object.freeze(requiredTypes) });

export const CAMPAIGN_MECHANIC_INTRODUCTIONS = Object.freeze({
  1: introduction(
    "НОВОЕ: СОЛЬ (Sa)\n\nСОЛЬ СОЕДИНЯЕТСЯ С СОЛЬЮ\nИЛИ С ЛЮБОЙ СТИХИЕЙ",
    [Atom.SALT],
  ),
  2: introduction(
    "НОВОЕ: ЖИЗНЬ (V) + СМЕРТЬ (M)\n\nОНИ УДАЛЯЮТСЯ\nТОЛЬКО ВМЕСТЕ",
    [Atom.VITAE, Atom.MORS],
  ),
  3: introduction(
    "НОВОЕ: СВИНЕЦ (Pb) + РТУТЬ (Hg)\n\nРТУТЬ СОЕДИНЯЕТСЯ СО СВИНЦОМ\nИ УДАЛЯЕТСЯ ВМЕСТЕ С НИМ",
    [Atom.LEAD, Atom.QUICKSILVER],
  ),
  4: introduction(
    "НОВОЕ: ОЛОВО (Sn) + РТУТЬ (Hg)\n\nОЛОВО ЗАБЛОКИРОВАНО, ПОКА\nНЕ УДАЛЁН ВЕСЬ СВИНЕЦ (Pb)",
    [Atom.TIN, Atom.QUICKSILVER],
  ),
  5: introduction(
    "НОВОЕ: ЖЕЛЕЗО (Fe) + РТУТЬ (Hg)\n\nЖЕЛЕЗО ЗАБЛОКИРОВАНО, ПОКА\nНЕ УДАЛЕНО ВСЁ ОЛОВО (Sn)",
    [Atom.IRON, Atom.QUICKSILVER],
  ),
  6: introduction(
    "НОВОЕ: МЕДЬ (Cu) + РТУТЬ (Hg)\n\nМЕДЬ ЗАБЛОКИРОВАНА, ПОКА\nНЕ УДАЛЕНО ВСЁ ЖЕЛЕЗО (Fe)",
    [Atom.COPPER, Atom.QUICKSILVER],
  ),
  7: introduction(
    "НОВОЕ: СЕРЕБРО (Ag) + РТУТЬ (Hg)\n\nСЕРЕБРО ЗАБЛОКИРОВАНО, ПОКА\nНЕ УДАЛЕНА ВСЯ МЕДЬ (Cu)",
    [Atom.SILVER, Atom.QUICKSILVER],
  ),
  8: introduction(
    "НОВОЕ: ЗОЛОТО (Au)\n\nЗОЛОТО ОТКРЫВАЕТСЯ ПОСЛЕ СЕРЕБРА (Ag)\nИ УДАЛЯЕТСЯ БЕЗ ПАРЫ",
    [Atom.GOLD],
  ),
  12: introduction(
    "НОВОЕ: КВИНТЭССЕНЦИЯ (Q)\n\nУДАЛИТЕ Q ВМЕСТЕ С ЧЕТЫРЬМЯ СТИХИЯМИ:\nВОЗДУХ + ОГОНЬ + ВОДА + ЗЕМЛЯ",
    [Atom.QUINTESSENCE, Atom.AIR, Atom.FIRE, Atom.WATER, Atom.EARTH],
  ),
});

export function mechanicIntroductionForLevel(level) {
  return CAMPAIGN_MECHANIC_INTRODUCTIONS[level];
}
