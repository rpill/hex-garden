import { GardenBoard, type BoardPieceInput } from "./board.js";
import { hexKey, type HexCoord } from "./hex.js";

export const BoardVariant = Object.freeze({
  STANDARD: "standard",
  QUINTESSENCE: "quintessence",
} as const);
export type BoardVariantValue = (typeof BoardVariant)[keyof typeof BoardVariant];

export type RandomSource = () => number;
export type SolutionMove = HexCoord[];
export type Solution = SolutionMove[];

function hashSeed(seed: unknown): number {
  const text = String(seed);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Deterministic Mulberry32 PRNG suitable for reproducible board generation. */
export function createSeededRandom(seed: unknown): RandomSource {
  let state = hashSeed(seed);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Replay a supplied solution and throw on the first invalid move. */
export function replaySolution(
  boardOrPieces: GardenBoard | readonly BoardPieceInput[],
  solution: readonly (readonly HexCoord[])[],
): true {
  const board = boardOrPieces instanceof GardenBoard ? boardOrPieces.clone() : new GardenBoard(boardOrPieces);

  solution.forEach((move, moveIndex) => {
    let lastResult;
    for (const index of move) {
      lastResult = board.select(index);
      if (lastResult.kind === "locked" || lastResult.kind === "empty") {
        throw new Error(`Generated solution failed at move ${moveIndex}: ${lastResult.kind} at ${hexKey(index)}`);
      }
    }
    if (lastResult?.kind !== "removed") throw new Error(`Generated solution failed to remove move ${moveIndex}`);
  });

  if (!board.won) throw new Error(`Generated solution left ${board.size} atoms`);
  return true;
}
