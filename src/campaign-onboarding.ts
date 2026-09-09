import { Atom, type AtomType } from "./atom-types.js";

export interface CampaignRuleIntro {
  titleRu: string;
  titleEn: string;
  textRu: string;
  textEn: string;
  requiredTypes: readonly AtomType[];
}

function intro(
  titleRu: string,
  titleEn: string,
  textRu: string,
  textEn: string,
  requiredTypes: readonly AtomType[],
): Readonly<CampaignRuleIntro> {
  return Object.freeze({
    titleRu,
    titleEn,
    textRu,
    textEn,
    requiredTypes: Object.freeze([...requiredTypes]),
  });
}

const CAMPAIGN_RULE_INTROS: Readonly<Record<number, Readonly<CampaignRuleIntro>>> = Object.freeze({
  1: intro(
    "НОВОЕ ПРАВИЛО · СОЛЬ",
    "NEW RULE · SALT",
    "СОЛЬ (Sa) СОЕДИНЯЕТСЯ\nС ДРУГОЙ СОЛЬЮ ИЛИ С ЛЮБОЙ СТИХИЕЙ:\nAi / Fi / Wa / Ea.",
    "SALT (Sa) MATCHES\nANOTHER SALT OR ANY ELEMENT:\nAi / Fi / Wa / Ea.",
    [Atom.SALT],
  ),
  2: intro(
    "НОВОЕ ПРАВИЛО · V + M",
    "NEW RULE · V + M",
    "VITAE (V) И MORS (M)\nУДАЛЯЮТСЯ ТОЛЬКО ВМЕСТЕ.\nV + V И M + M НЕ СЧИТАЮТСЯ ПАРОЙ.",
    "VITAE (V) AND MORS (M)\nCAN ONLY BE REMOVED TOGETHER.\nV + V AND M + M ARE NOT A PAIR.",
    [Atom.VITAE, Atom.MORS],
  ),
  3: intro(
    "НОВОЕ ПРАВИЛО · РТУТЬ И СВИНЕЦ",
    "NEW RULE · QUICKSILVER AND LEAD",
    "РТУТЬ (Hg) УДАЛЯЕТ ДОСТУПНЫЙ МЕТАЛЛ.\nПЕРВЫЙ МЕТАЛЛ ЦЕПОЧКИ — СВИНЕЦ (Pb).\nНАЧНИ С ПАРЫ Hg + Pb.",
    "QUICKSILVER (Hg) REMOVES AN AVAILABLE METAL.\nTHE FIRST METAL IN THE CHAIN IS LEAD (Pb).\nSTART WITH Hg + Pb.",
    [Atom.QUICKSILVER, Atom.LEAD],
  ),
  4: intro(
    "НОВЫЙ МЕТАЛЛ · ОЛОВО",
    "NEW METAL · TIN",
    "ОЛОВО (Sn) ОТКРЫВАЕТСЯ ТОЛЬКО ПОСЛЕ Pb.\nСНАЧАЛА УБЕРИ Hg + Pb,\nПОТОМ МОЖНО УБРАТЬ Hg + Sn.",
    "TIN (Sn) UNLOCKS ONLY AFTER Pb.\nREMOVE Hg + Pb FIRST,\nTHEN Hg + Sn BECOMES AVAILABLE.",
    [Atom.TIN],
  ),
  5: intro(
    "НОВЫЙ МЕТАЛЛ · ЖЕЛЕЗО",
    "NEW METAL · IRON",
    "ЖЕЛЕЗО (Fe) ИДЁТ ПОСЛЕ Sn.\nЦЕПОЧКА ТЕПЕРЬ:\nPb → Sn → Fe.",
    "IRON (Fe) COMES AFTER Sn.\nTHE CHAIN IS NOW:\nPb → Sn → Fe.",
    [Atom.IRON],
  ),
  6: intro(
    "НОВЫЙ МЕТАЛЛ · МЕДЬ",
    "NEW METAL · COPPER",
    "МЕДЬ (Cu) ОТКРЫВАЕТСЯ ПОСЛЕ Fe.\nЦЕПОЧКА ТЕПЕРЬ:\nPb → Sn → Fe → Cu.",
    "COPPER (Cu) UNLOCKS AFTER Fe.\nTHE CHAIN IS NOW:\nPb → Sn → Fe → Cu.",
    [Atom.COPPER],
  ),
  7: intro(
    "НОВЫЙ МЕТАЛЛ · СЕРЕБРО",
    "NEW METAL · SILVER",
    "СЕРЕБРО (Ag) ОТКРЫВАЕТСЯ ПОСЛЕ Cu.\nЦЕПОЧКА ТЕПЕРЬ:\nPb → Sn → Fe → Cu → Ag.",
    "SILVER (Ag) UNLOCKS AFTER Cu.\nTHE CHAIN IS NOW:\nPb → Sn → Fe → Cu → Ag.",
    [Atom.SILVER],
  ),
  8: intro(
    "НОВОЕ ПРАВИЛО · ЗОЛОТО",
    "NEW RULE · GOLD",
    "ЗОЛОТО (Au) ОТКРЫВАЕТСЯ ПОСЛЕ Ag.\nРТУТЬ С НИМ НЕ НУЖНА:\nДОСТУПНОЕ Au УДАЛЯЕТСЯ ОДНИМ НАЖАТИЕМ.",
    "GOLD (Au) UNLOCKS AFTER Ag.\nIT DOES NOT NEED QUICKSILVER:\nAVAILABLE Au IS REMOVED WITH ONE TAP.",
    [Atom.GOLD],
  ),
});

export function campaignRuleIntroForLevel(level: number): Readonly<CampaignRuleIntro> | undefined {
  return CAMPAIGN_RULE_INTROS[level];
}
