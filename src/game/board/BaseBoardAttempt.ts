import { GardenBoard, type BoardPieceInput } from "../../board.js";
import type { HexCoord } from "../../hex.js";
import {
  SolveStatus,
  type RescueResult,
  type SolveStatusValue,
  type WinningRouteResult,
} from "../../solver.js";
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

export interface BoardHintAssistance {
  findHint(
    pieces: readonly BoardPieceInput[],
    preferredSolution?: readonly (readonly HexCoord[])[],
  ): WinningRouteResult;
  confirmReward(required: boolean, kind?: "hint" | "rescue"): Promise<boolean>;
}

export interface BoardRescueAssistance {
  findRescue<T extends BoardHistorySnapshot>(
    history: readonly T[],
    pieces: readonly BoardPieceInput[],
    preferredSolution?: readonly (readonly HexCoord[])[],
  ): RescueResult<T>;
  confirmReward(required: boolean, kind?: "hint" | "rescue"): Promise<boolean>;
}

export type BoardRescueRequestResult =
  | Readonly<{ kind: "not-eligible" }>
  | Readonly<{ kind: "unavailable"; solverStatus: SolveStatusValue }>
  | Readonly<{ kind: "reward-denied" }>
  | Readonly<{
      kind: "restored";
      blockedMove: readonly HexCoord[];
      route: readonly (readonly HexCoord[])[];
    }>;

export type BoardHintRequestResult =
  | Readonly<{ kind: "unavailable"; solverStatus: SolveStatusValue }>
  | Readonly<{ kind: "reward-denied" }>
  | Readonly<{ kind: "revealed"; move: readonly HexCoord[] }>;

function clonePieces(pieces: readonly BoardPieceInput[]): BoardPieceInput[] {
  return pieces.map((piece) => ({ q: piece.q, r: piece.r, type: piece.type }));
}

export class BaseBoardAttempt {
  readonly initialPieces: readonly BoardPieceInput[];
  attempt: Readonly<AttemptState> = createAttemptState();
  history: BoardHistorySnapshot[] = [];
  board: GardenBoard;

  constructor(initialPieces: readonly BoardPieceInput[]) {
    this.initialPieces = Object.freeze(clonePieces(initialPieces));
    this.board = new GardenBoard(this.initialPieces);
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
    this.board = new GardenBoard(this.initialPieces);
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

  protected async performHint(
    assistance: BoardHintAssistance,
    rewardRequired: boolean,
    preferredSolution: readonly (readonly HexCoord[])[] = [],
  ): Promise<BoardHintRequestResult> {
    const result = assistance.findHint(this.board.pieces(), preferredSolution);
    const firstMove = result.route[0];
    if (result.status !== SolveStatus.SOLVED || !firstMove || firstMove.length === 0) {
      return Object.freeze({
        kind: "unavailable" as const,
        solverStatus: result.status,
      });
    }

    const confirmed = await assistance.confirmReward(rewardRequired, "hint");
    if (!confirmed) return Object.freeze({ kind: "reward-denied" as const });

    this.markHintUsed();
    return Object.freeze({
      kind: "revealed" as const,
      move: Object.freeze(firstMove.map(({ q, r }) => Object.freeze({ q, r }))),
    });
  }

  protected async performRescue(
    assistance: BoardRescueAssistance,
    rewardRequired: boolean,
    preferredSolution: readonly (readonly HexCoord[])[] = [],
  ): Promise<BoardRescueRequestResult> {
    if (!this.canRescue) {
      return Object.freeze({ kind: "not-eligible" as const });
    }

    const result = assistance.findRescue(
      this.history,
      this.board.pieces(),
      preferredSolution,
    );
    if (result.status !== SolveStatus.SOLVED) {
      return Object.freeze({
        kind: "unavailable" as const,
        solverStatus: result.status,
      });
    }

    const confirmed = await assistance.confirmReward(rewardRequired, "rescue");
    if (!confirmed) {
      return Object.freeze({ kind: "reward-denied" as const });
    }

    this.board = new GardenBoard(result.snapshot.pieces);
    this.history.splice(result.index);
    this.attempt = markAttemptRescueUsed(this.attempt);

    return Object.freeze({
      kind: "restored" as const,
      blockedMove: Object.freeze(
        result.blockedMove.map(({ q, r }) => Object.freeze({ q, r })),
      ),
      route: Object.freeze(
        result.route.map((move) =>
          Object.freeze(move.map(({ q, r }) => Object.freeze({ q, r }))),
        ),
      ),
    });
  }
}
