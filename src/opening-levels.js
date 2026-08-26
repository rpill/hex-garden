import { Atom } from "./atom-types.js";

const A = Atom.AIR;
const F = Atom.FIRE;
const W = Atom.WATER;
const E = Atom.EARTH;

const piece = (q, r, type) => Object.freeze({ q, r, type });
const position = (q, r) => Object.freeze({ q, r });
const move = (...positions) => Object.freeze(positions);
const opening = (pieces, solution) =>
  Object.freeze({
    pieces: Object.freeze(pieces),
    solution: Object.freeze(solution),
  });

// Hand-authored opening boards. Levels 1-3 teach the matching vocabulary;
// levels 4-8 introduce positional traps with a deliberately smooth curve.
export const CURATED_OPENING_LEVELS = Object.freeze([
  opening(
    [
      piece(6, 1, A), piece(4, 0, A), piece(6, -1, A), piece(5, 1, A),
      piece(4, 1, A), piece(5, -1, A), piece(6, 0, A), piece(5, 0, A),
    ],
    [
      move(position(6, 1), position(4, 0)),
      move(position(6, -1), position(5, 1)),
      move(position(4, 1), position(5, -1)),
      move(position(6, 0), position(5, 0)),
    ],
  ),
  opening(
    [
      piece(7, -3, F), piece(5, -2, F), piece(7, -1, A), piece(4, -1, A),
      piece(6, -2, A), piece(7, -2, A), piece(6, -1, A), piece(4, 0, A),
      piece(6, 0, F), piece(5, -1, F), piece(5, 1, F), piece(5, 0, F),
    ],
    [
      move(position(7, -3), position(5, -2)),
      move(position(7, -1), position(4, -1)),
      move(position(6, -2), position(7, -2)),
      move(position(6, -1), position(4, 0)),
      move(position(6, 0), position(5, -1)),
      move(position(5, 1), position(5, 0)),
    ],
  ),
  opening(
    [
      piece(4, 2, A), piece(7, 0, A), piece(3, 2, W), piece(3, -1, W),
      piece(3, 0, F), piece(7, -1, F), piece(6, -2, A), piece(5, -2, A),
      piece(6, -1, F), piece(6, 0, F), piece(4, -1, W), piece(5, 1, W),
      piece(4, 0, A), piece(4, 1, A), piece(5, -1, W), piece(5, 0, W),
    ],
    [
      move(position(4, 2), position(7, 0)),
      move(position(3, 2), position(3, -1)),
      move(position(3, 0), position(7, -1)),
      move(position(6, -2), position(5, -2)),
      move(position(6, -1), position(6, 0)),
      move(position(4, -1), position(5, 1)),
      move(position(4, 0), position(4, 1)),
      move(position(5, -1), position(5, 0)),
    ],
  ),
  opening(
    [
      piece(7, -3, A), piece(4, 2, A), piece(5, -3, E), piece(3, 2, E),
      piece(6, -3, W), piece(7, -2, W), piece(7, 0, E), piece(6, -2, E),
      piece(7, -1, A), piece(3, 1, A), piece(5, -2, F), piece(3, 0, F),
      piece(4, -1, A), piece(4, 1, A), piece(5, 1, W), piece(6, 0, W),
      piece(6, -1, F), piece(5, -1, F), piece(4, 0, E), piece(5, 0, E),
    ],
    [
      move(position(7, -3), position(4, 2)),
      move(position(5, -3), position(3, 2)),
      move(position(6, -3), position(7, -2)),
      move(position(7, 0), position(6, -2)),
      move(position(7, -1), position(3, 1)),
      move(position(5, -2), position(3, 0)),
      move(position(4, -1), position(4, 1)),
      move(position(5, 1), position(6, 0)),
      move(position(6, -1), position(5, -1)),
      move(position(4, 0), position(5, 0)),
    ],
  ),
  opening(
    [
      piece(8, -3, A), piece(6, -3, A), piece(7, -3, F), piece(3, 2, F),
      piece(4, -2, W), piece(3, 0, W), piece(4, 2, A), piece(5, -2, A),
      piece(6, -2, F), piece(4, -1, F), piece(5, -1, W), piece(7, -2, W),
      piece(7, -1, F), piece(6, -1, F), piece(3, 1, E), piece(4, 0, E),
      piece(4, 1, E), piece(6, 0, E), piece(5, 0, A), piece(5, 1, A),
    ],
    [
      move(position(8, -3), position(6, -3)),
      move(position(7, -3), position(3, 2)),
      move(position(4, -2), position(3, 0)),
      move(position(4, 2), position(5, -2)),
      move(position(6, -2), position(4, -1)),
      move(position(5, -1), position(7, -2)),
      move(position(7, -1), position(6, -1)),
      move(position(3, 1), position(4, 0)),
      move(position(4, 1), position(6, 0)),
      move(position(5, 0), position(5, 1)),
    ],
  ),
  opening(
    [
      piece(2, 3, F), piece(3, 3, F), piece(2, 0, A), piece(2, 2, A),
      piece(3, -1, W), piece(4, -2, W), piece(2, 1, F), piece(5, -2, F),
      piece(3, 2, E), piece(3, 0, E), piece(4, -1, E), piece(6, -1, E),
      piece(3, 1, F), piece(4, 2, F), piece(4, 1, A), piece(5, 1, A),
      piece(6, 0, W), piece(4, 0, W), piece(5, -1, W), piece(5, 0, W),
    ],
    [
      move(position(2, 3), position(3, 3)),
      move(position(2, 0), position(2, 2)),
      move(position(3, -1), position(4, -2)),
      move(position(2, 1), position(5, -2)),
      move(position(3, 2), position(3, 0)),
      move(position(4, -1), position(6, -1)),
      move(position(3, 1), position(4, 2)),
      move(position(4, 1), position(5, 1)),
      move(position(6, 0), position(4, 0)),
      move(position(5, -1), position(5, 0)),
    ],
  ),
  opening(
    [
      piece(8, -2, W), piece(5, 3, W), piece(4, 3, W), piece(7, -2, W),
      piece(7, 1, E), piece(8, -1, E), piece(6, 2, E), piece(7, -1, E),
      piece(5, 2, F), piece(6, 1, F), piece(6, -2, A), piece(5, -2, A),
      piece(4, 2, W), piece(6, -1, W), piece(6, 0, E), piece(4, 0, E),
      piece(4, 1, F), piece(5, 1, F), piece(5, 0, A), piece(5, -1, A),
    ],
    [
      move(position(8, -2), position(5, 3)),
      move(position(4, 3), position(7, -2)),
      move(position(7, 1), position(8, -1)),
      move(position(6, 2), position(7, -1)),
      move(position(5, 2), position(6, 1)),
      move(position(6, -2), position(5, -2)),
      move(position(4, 2), position(6, -1)),
      move(position(6, 0), position(4, 0)),
      move(position(4, 1), position(5, 1)),
      move(position(5, 0), position(5, -1)),
    ],
  ),
  opening(
    [
      piece(7, 1, E), piece(8, -3, E), piece(8, -2, E), piece(7, -3, E),
      piece(6, -3, A), piece(8, -1, A), piece(6, 1, F), piece(3, 1, F),
      piece(7, -2, E), piece(8, 0, E), piece(3, 2, A), piece(7, -1, A),
      piece(7, 0, W), piece(6, -2, W), piece(5, -1, A), piece(4, 1, A),
      piece(6, -1, W), piece(6, 0, W), piece(4, 0, F), piece(5, 0, F),
    ],
    [
      move(position(7, 1), position(8, -3)),
      move(position(8, -2), position(7, -3)),
      move(position(6, -3), position(8, -1)),
      move(position(6, 1), position(3, 1)),
      move(position(7, -2), position(8, 0)),
      move(position(3, 2), position(7, -1)),
      move(position(7, 0), position(6, -2)),
      move(position(5, -1), position(4, 1)),
      move(position(6, -1), position(6, 0)),
      move(position(4, 0), position(5, 0)),
    ],
  ),
]);
