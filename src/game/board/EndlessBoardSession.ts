import type { BoardPieceInput } from "../../board.js";
import type { BoardHistorySnapshot } from "./BaseBoardAttempt.js";

export type EndlessDeadEndResult =
  | Readonly<{ kind: "rescuable" }>
  | Readonly<{
      kind: "terminal";
      boardsCleared: number;
      assisted: boolean;
    }>;

function clonePieces(pieces: readonly BoardPieceInput[]): readonly BoardPieceInput[] {
  return Object.freeze(
    pieces.map((piece) => Object.freeze({ q: piece.q, r: piece.r, type: piece.type })),
  );
}

export class EndlessBoardSession {
  boardsCleared = 0;
  assisted = false;
  rescueUsed = false;
  deadEnd = false;
  history: BoardHistorySnapshot[] = [];

  recordBeforeRemoval(pieces: readonly BoardPieceInput[]): void {
    this.history.push(Object.freeze({ pieces: clonePieces(pieces) }));
    if (this.history.length > 64) this.history.shift();
  }

  canUndo(): boolean {
    return !this.deadEnd && this.history.length > 0;
  }

  undoSnapshot(): Readonly<BoardHistorySnapshot> | undefined {
    if (!this.canUndo()) return undefined;
    return this.history.pop();
  }

  markHintUsed(): void {
    this.assisted = true;
  }

  enterDeadEnd(): EndlessDeadEndResult {
    this.deadEnd = true;
    if (this.rescueUsed) {
      return Object.freeze({
        kind: "terminal" as const,
        boardsCleared: this.boardsCleared,
        assisted: this.assisted,
      });
    }
    return Object.freeze({ kind: "rescuable" as const });
  }

  canRescue(): boolean {
    return this.deadEnd && !this.rescueUsed;
  }

  markRescueUsed(): boolean {
    if (!this.canRescue()) return false;
    this.rescueUsed = true;
    this.assisted = true;
    this.deadEnd = false;
    return true;
  }

  clearBoard(): void {
    this.boardsCleared += 1;
    this.history = [];
    this.deadEnd = false;
  }
}
