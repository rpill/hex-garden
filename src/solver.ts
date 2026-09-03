import { GardenBoard, type BoardPiece, type BoardPieceInput, type LegalMove } from "./board.js";
import { hexKey, type HexCoord } from "./hex.js";

export const SolveStatus = Object.freeze({
  SOLVED: "solved",
  DEAD_END: "dead-end",
  UNKNOWN: "unknown",
} as const);

export type SolveStatusValue = (typeof SolveStatus)[keyof typeof SolveStatus];

export interface WinningRouteResult {
  status: SolveStatusValue;
  route: readonly (readonly BoardPiece[])[];
  visited: number;
}

export interface SolverOptions {
  preferredSolution?: readonly (readonly HexCoord[])[];
  maxVisited?: number;
  maxMilliseconds?: number;
  now?: () => number;
}

interface VisitResult {
  status: SolveStatusValue;
  route: LegalMove[];
}

export function moveKey(move: readonly HexCoord[]): string {
  return move.map(hexKey).sort().join("|");
}

function stateKey(pieces: readonly BoardPiece[]): string {
  return pieces
    .map((piece) => `${hexKey(piece)}:${piece.type}`)
    .sort()
    .join("|");
}

function removeMove(board: GardenBoard, move: readonly BoardPiece[]): GardenBoard {
  const next = new GardenBoard(board.pieces());
  let result;
  for (const piece of move) result = next.select(piece);
  if (result?.kind !== "removed") {
    throw new Error("Solver received a move that is not legal on its board");
  }
  return next;
}

function preferredMoveOrder(preferredSolution: readonly (readonly HexCoord[])[] | undefined): (move: readonly BoardPiece[]) => number {
  const exact = new Map<string, number>();
  const pieceRank = new Map<string, number>();
  (preferredSolution ?? []).forEach((move, index) => {
    exact.set(moveKey(move), index);
    for (const piece of move) {
      const key = hexKey(piece);
      if (!pieceRank.has(key)) pieceRank.set(key, index);
    }
  });
  return (move) => {
    const exactRank = exact.get(moveKey(move));
    if (exactRank !== undefined) return -1_000_000 + exactRank;
    const ranks = move.map((piece) => pieceRank.get(hexKey(piece)) ?? 100_000);
    return Math.max(...ranks) * 100 + Math.min(...ranks);
  };
}

export function findWinningRoute(
  boardOrPieces: GardenBoard | readonly BoardPieceInput[],
  {
    preferredSolution = [],
    maxVisited = 60_000,
    maxMilliseconds = 80,
    now = () => globalThis.performance?.now?.() ?? Date.now(),
  }: SolverOptions = {},
): WinningRouteResult {
  const root = boardOrPieces instanceof GardenBoard
    ? new GardenBoard(boardOrPieces.pieces())
    : new GardenBoard(boardOrPieces);
  const startedAt = now();
  const losing = new Set<string>();
  const order = preferredMoveOrder(preferredSolution);
  let visited = 0;

  const visit = (board: GardenBoard): VisitResult => {
    if (board.won) return { status: SolveStatus.SOLVED, route: [] };
    if (visited >= maxVisited || now() - startedAt >= maxMilliseconds) {
      return { status: SolveStatus.UNKNOWN, route: [] };
    }
    visited += 1;
    const key = stateKey(board.pieces());
    if (losing.has(key)) return { status: SolveStatus.DEAD_END, route: [] };
    const moves = board.legalMoves().sort((left, right) => order(left) - order(right));
    if (moves.length === 0) {
      losing.add(key);
      return { status: SolveStatus.DEAD_END, route: [] };
    }

    let unknown = false;
    for (const move of moves) {
      const child = visit(removeMove(board, move));
      if (child.status === SolveStatus.SOLVED) {
        return { status: SolveStatus.SOLVED, route: [move, ...child.route] };
      }
      if (child.status === SolveStatus.UNKNOWN) unknown = true;
    }
    if (unknown) return { status: SolveStatus.UNKNOWN, route: [] };
    losing.add(key);
    return { status: SolveStatus.DEAD_END, route: [] };
  };

  const result = visit(root);
  return Object.freeze({
    status: result.status,
    route: Object.freeze(result.route.map((move) => Object.freeze(move))),
    visited,
  });
}

export type HistorySnapshotBase = { pieces: readonly BoardPieceInput[] };

export type RescueResult<T extends HistorySnapshotBase> =
  | Readonly<{ status: typeof SolveStatus.UNKNOWN }>
  | Readonly<{ status: typeof SolveStatus.DEAD_END }>
  | Readonly<{
      status: typeof SolveStatus.SOLVED;
      index: number;
      snapshot: T;
      blockedMove: readonly BoardPieceInput[];
      route: readonly (readonly BoardPiece[])[];
    }>;

export function findLastSolvableSnapshot<T extends HistorySnapshotBase>(
  history: readonly T[],
  currentPieces: readonly BoardPieceInput[],
  options: SolverOptions = {},
): RescueResult<T> {
  let afterPieces: readonly BoardPieceInput[] = currentPieces;
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const snapshot = history[index];
    if (!snapshot) continue;
    const result = findWinningRoute(snapshot.pieces, options);
    if (result.status === SolveStatus.UNKNOWN) {
      return Object.freeze({ status: SolveStatus.UNKNOWN });
    }
    if (result.status === SolveStatus.SOLVED) {
      const afterKeys = new Set(afterPieces.map(hexKey));
      const blockedMove = snapshot.pieces.filter(
        (piece) => !afterKeys.has(hexKey(piece)),
      );
      return Object.freeze({
        status: SolveStatus.SOLVED,
        index,
        snapshot,
        blockedMove: Object.freeze(blockedMove),
        route: result.route,
      });
    }
    afterPieces = snapshot.pieces;
  }
  return Object.freeze({ status: SolveStatus.DEAD_END });
}
