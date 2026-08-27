import { GardenBoard } from "./board.js";
import { hexKey } from "./hex.js";

export const SolveStatus = Object.freeze({
  SOLVED: "solved",
  DEAD_END: "dead-end",
  UNKNOWN: "unknown",
});

export function moveKey(move) {
  return move.map(hexKey).sort().join("|");
}

function stateKey(pieces) {
  return pieces
    .map((piece) => `${hexKey(piece)}:${piece.type}`)
    .sort()
    .join("|");
}

function removeMove(board, move) {
  const next = new GardenBoard(board.pieces());
  let result;
  for (const piece of move) result = next.select(piece);
  if (result?.kind !== "removed") {
    throw new Error("Solver received a move that is not legal on its board");
  }
  return next;
}

function preferredMoveOrder(preferredSolution) {
  const exact = new Map();
  const pieceRank = new Map();
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

export function findWinningRoute(boardOrPieces, {
  preferredSolution = [],
  maxVisited = 60_000,
  maxMilliseconds = 80,
  now = () => globalThis.performance?.now?.() ?? Date.now(),
} = {}) {
  const root = boardOrPieces instanceof GardenBoard
    ? new GardenBoard(boardOrPieces.pieces())
    : new GardenBoard(boardOrPieces);
  const startedAt = now();
  const losing = new Set();
  const order = preferredMoveOrder(preferredSolution);
  let visited = 0;

  const visit = (board) => {
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

export function findLastSolvableSnapshot(history, currentPieces, options = {}) {
  let afterPieces = currentPieces;
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const snapshot = history[index];
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
