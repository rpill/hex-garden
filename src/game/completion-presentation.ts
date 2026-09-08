import type { MasteryRankValue } from "../mastery.js";
import { CAMPAIGN_LEVEL_COUNT } from "../plates.js";

export interface CampaignCompletionPresentationInput {
  level: number;
  clean: boolean;
  cleanCount: number;
  chapterComplete: boolean;
  chapterCleanCount?: number;
  newRank?: MasteryRankValue;
}

export interface CampaignCompletionPresentation {
  status: "clean" | "assisted";
  showTryClean: boolean;
  chapterNumber: number;
  campaignComplete: boolean;
}

function assertLevel(level: number): void {
  if (!Number.isSafeInteger(level) || level < 0 || level >= CAMPAIGN_LEVEL_COUNT) {
    throw new RangeError(`level must be an integer from 0 to ${CAMPAIGN_LEVEL_COUNT - 1}`);
  }
}

export function createCampaignCompletionPresentation(
  data: CampaignCompletionPresentationInput,
): Readonly<CampaignCompletionPresentation> {
  assertLevel(data.level);
  return Object.freeze({
    status: data.clean ? "clean" as const : "assisted" as const,
    showTryClean: !data.clean,
    chapterNumber: Math.floor(data.level / 10) + 1,
    campaignComplete: data.chapterComplete && data.level === CAMPAIGN_LEVEL_COUNT - 1,
  });
}

export interface EndlessCompletionPresentationInput {
  boardsCleared: number;
  assisted: boolean;
  bestUnassistedBoards: number;
}

export interface EndlessCompletionPresentation {
  boardsCleared: number;
  assisted: boolean;
  bestCleanBoards: number;
}

function assertBoardCount(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer`);
  }
}

export function createEndlessCompletionPresentation(
  data: EndlessCompletionPresentationInput,
): Readonly<EndlessCompletionPresentation> {
  assertBoardCount(data.boardsCleared, "boardsCleared");
  assertBoardCount(data.bestUnassistedBoards, "bestUnassistedBoards");
  if (!data.assisted && data.bestUnassistedBoards < data.boardsCleared) {
    throw new RangeError("bestUnassistedBoards must include the completed clean run");
  }

  return Object.freeze({
    boardsCleared: data.boardsCleared,
    assisted: data.assisted,
    bestCleanBoards: data.bestUnassistedBoards,
  });
}
