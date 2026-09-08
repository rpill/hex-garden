import { GardenBoard, type BoardPieceInput } from "../../board.js";
import type { CampaignLevelRecord } from "../../campaign-levels.js";
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
