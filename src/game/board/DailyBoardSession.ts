import type { BoardPieceInput } from "../../board.js";
import type {
  DailyProgressSnapshot,
  DailyProgressStore,
} from "../../daily-progress.js";
import type { HexCoord } from "../../hex.js";
import {
  BaseBoardAttempt,
  type BoardHintAssistance,
  type BoardHintRequestResult,
  type BoardRescueAssistance,
  type BoardRescueRequestResult,
} from "./BaseBoardAttempt.js";

export interface DailyBoardDefinition {
  readonly dateKey: string;
  readonly pieces: readonly BoardPieceInput[];
  readonly solution: readonly (readonly HexCoord[])[];
}

export type DailyCompletionResult =
  | Readonly<{ kind: "not-cleared" }>
  | Readonly<{ kind: "expired"; dateKey: string }>
  | Readonly<{
      kind: "recorded";
      dateKey: string;
      clean: boolean;
      snapshot: DailyProgressSnapshot;
    }>;

export class DailyBoardSession extends BaseBoardAttempt {
  readonly daily: Readonly<DailyBoardDefinition>;
  readonly progress: DailyProgressStore;

  constructor(
    daily: Readonly<DailyBoardDefinition>,
    progress: DailyProgressStore,
  ) {
    super(daily.pieces);
    this.daily = daily;
    this.progress = progress;
  }

  requestHint(
    assistance: BoardHintAssistance,
    preferredSolution: readonly (readonly HexCoord[])[] = this.daily.solution,
  ): Promise<BoardHintRequestResult> {
    return this.performHint(assistance, true, preferredSolution);
  }

  requestRescue(
    assistance: BoardRescueAssistance,
    preferredSolution: readonly (readonly HexCoord[])[] = this.daily.solution,
  ): Promise<BoardRescueRequestResult> {
    return this.performRescue(assistance, true, preferredSolution);
  }

  complete(currentDateKey: string): DailyCompletionResult {
    if (!this.board.won) {
      return Object.freeze({ kind: "not-cleared" as const });
    }
    if (currentDateKey !== this.daily.dateKey) {
      return Object.freeze({
        kind: "expired" as const,
        dateKey: this.daily.dateKey,
      });
    }

    const clean = this.cleanEligible;
    const snapshot = this.progress.markSolved(this.daily.dateKey, { clean });
    return Object.freeze({
      kind: "recorded" as const,
      dateKey: this.daily.dateKey,
      clean,
      snapshot,
    });
  }
}
