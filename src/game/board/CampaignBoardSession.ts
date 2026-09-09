import type { CampaignLevelRecord } from "../../campaign-levels.js";
import type { HexCoord } from "../../hex.js";
import {
  BaseBoardAttempt,
  type BoardHintAssistance,
  type BoardHintRequestResult,
  type BoardRescueAssistance,
  type BoardRescueRequestResult,
} from "./BaseBoardAttempt.js";

export type {
  BoardHistorySnapshot,
} from "./BaseBoardAttempt.js";

export type CampaignHintAssistance = BoardHintAssistance;
export type CampaignRescueAssistance = BoardRescueAssistance;
export type CampaignHintRequestResult = BoardHintRequestResult;
export type CampaignRescueRequestResult = BoardRescueRequestResult;

export interface CampaignCompletionMetadata {
  level: number;
  clean: boolean;
}

export class CampaignBoardSession extends BaseBoardAttempt {
  readonly level: Readonly<CampaignLevelRecord>;

  constructor(level: Readonly<CampaignLevelRecord>) {
    super(level.pieces);
    this.level = level;
  }

  requestHint(
    assistance: CampaignHintAssistance,
    rewardRequired: boolean,
    preferredSolution: readonly (readonly HexCoord[])[] = [],
  ): Promise<CampaignHintRequestResult> {
    return this.performHint(assistance, rewardRequired, preferredSolution);
  }

  requestRescue(
    assistance: CampaignRescueAssistance,
    rewardRequired: boolean,
    preferredSolution: readonly (readonly HexCoord[])[] = [],
  ): Promise<CampaignRescueRequestResult> {
    return this.performRescue(assistance, rewardRequired, preferredSolution);
  }

  get completion(): Readonly<CampaignCompletionMetadata> {
    return Object.freeze({
      level: this.level.level,
      clean: this.cleanEligible,
    });
  }
}
