import { GardenBoard, type BoardPieceInput } from "../../board.js";
import type { CampaignLevelRecord } from "../../campaign-levels.js";
import type { HexCoord } from "../../hex.js";
import { SolveStatus, type SolveStatusValue, type WinningRouteResult } from "../../solver.js";
import {
  canRescueAttempt,
  createAttemptState,
  isActualDeadEnd,
  markRescueUsed as markAttemptRescueUsed,
  markSolverAssisted,
  restartAttempt,
  type AttemptState,
} from "./attempt-state.js";

export interface BoardHistorySnapshot {
  pieces: readonly BoardPieceInput[];
}

export interface CampaignCompletionMetadata {
  level: number;
  clean: boolean;
}

export interface CampaignHintAssistance {
  findHint(
    pieces: readonly BoardPieceInput[],
    preferredSolution?: readonly (readonly HexCoord[])[],
  ): WinningRouteResult;
  confirmReward(required: boolean): Promise<boolean>;
}

export type CampaignHintRequestResult =
  | Readonly<{
      kind: "unavailable";
      solverStatus: SolveStatusValue;
    }>
  | Readonly<{
      kind: "reward-denied";
    }>
  | Readonly<{
      kind: "revealed";
      move: readonly HexCoord[];
    }>;

function clonePieces(pieces: readonly BoardPieceInput[]): BoardPieceInput[] {
  return pieces.map((piece) => ({ q: piece.q, r: piece.r, type: piece.type }));
}

export class CampaignBoardSession {
  readonly level: Readonly<CampaignLevelRecord>;
  attempt: Readonly<AttemptState> = createAttemptState();
  history: BoardHistorySnapshot[] = [];
  board: GardenBoard;

  constructor(level: Readonly<CampaignLevelRecord>) {
    this.level = level;
    this.board = new GardenBoard(level.pieces);
  }

  recordBeforeRemoval(
    pieces: readonly BoardPieceInput[] = this.board.pieces(),
  ): void {
    this.history.push(Object.freeze({ pieces: Object.freeze(clonePieces(pieces)) }));
    if (this.history.length > 64) this.history.shift();
  }

  get actualDeadEnd(): boolean {
    return isActualDeadEnd({
      won: this.board.won,
      legalMoveCount: this.board.legalMoves().length,
    });
  }

  get canUndo(): boolean {
    return this.history.length > 0 && !this.board.won && !this.actualDeadEnd;
  }

  undo(): boolean {
    if (!this.canUndo) return false;
    const snapshot = this.history.pop();
    if (!snapshot) return false;
    this.board = new GardenBoard(snapshot.pieces);
    return true;
  }

  restart(): void {
    this.board = new GardenBoard(this.level.pieces);
    this.history = [];
    this.attempt = restartAttempt(this.attempt);
  }


  async requestHint(
    assistance: CampaignHintAssistance,
    rewardRequired: boolean,
    preferredSolution: readonly (readonly HexCoord[])[] = [],
  ): Promise<CampaignHintRequestResult> {
    const result = assistance.findHint(this.board.pieces(), preferredSolution);
    const firstMove = result.route[0];
    if (result.status !== SolveStatus.SOLVED || !firstMove || firstMove.length === 0) {
      return Object.freeze({
        kind: "unavailable" as const,
        solverStatus: result.status,
      });
    }

    const confirmed = await assistance.confirmReward(rewardRequired);
    if (!confirmed) return Object.freeze({ kind: "reward-denied" as const });

    this.markHintUsed();
    return Object.freeze({
      kind: "revealed" as const,
      move: Object.freeze(firstMove.map(({ q, r }) => Object.freeze({ q, r }))),
    });
  }

  markHintUsed(): void {
    this.attempt = markSolverAssisted(this.attempt);
  }

  get canRescue(): boolean {
    return this.history.length > 0 && canRescueAttempt(this.attempt, {
      won: this.board.won,
      legalMoveCount: this.board.legalMoves().length,
    });
  }

  markRescueUsed(): boolean {
    if (!this.canRescue) return false;
    this.attempt = markAttemptRescueUsed(this.attempt);
    return true;
  }

  get cleanEligible(): boolean {
    return this.attempt.cleanEligible;
  }

  get rescueUsed(): boolean {
    return this.attempt.rescueUsed;
  }

  get completion(): Readonly<CampaignCompletionMetadata> {
    return Object.freeze({
      level: this.level.level,
      clean: this.cleanEligible,
    });
  }
}
