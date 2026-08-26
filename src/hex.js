export const ADJACENT_OFFSETS = Object.freeze([
  Object.freeze({ q: 1, r: 0 }),
  Object.freeze({ q: 0, r: 1 }),
  Object.freeze({ q: -1, r: 1 }),
  Object.freeze({ q: -1, r: 0 }),
  Object.freeze({ q: 0, r: -1 }),
  Object.freeze({ q: 1, r: -1 }),
]);

export const BOARD_CENTER = Object.freeze({ q: 5, r: 0 });
export const BOARD_RADIUS = 5;

function cleanZero(value) {
  return Object.is(value, -0) ? 0 : value;
}

export function hex(q, r) {
  if (!Number.isInteger(q) || !Number.isInteger(r)) {
    throw new TypeError("Hex coordinates must be integers");
  }
  return { q: cleanZero(q), r: cleanZero(r) };
}

export function hexKey({ q, r }) {
  return `${q},${r}`;
}

export function addHex(a, b) {
  return { q: cleanZero(a.q + b.q), r: cleanZero(a.r + b.r) };
}

export function subtractHex(a, b) {
  return { q: cleanZero(a.q - b.q), r: cleanZero(a.r - b.r) };
}

export function hexDistance(a, b) {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  const ds = -a.q - a.r - (-b.q - b.r);
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(ds)) / 2;
}

/** Rotate an axial coordinate clockwise in 60-degree steps around the origin. */
export function rotateHex(index, turns) {
  let normalized = ((turns % 6) + 6) % 6;
  let q = index.q;
  let r = index.r;

  while (normalized-- > 0) {
    [q, r] = [-r, q + r];
  }
  return { q: cleanZero(q), r: cleanZero(r) };
}

export function rotateHexAround(index, pivot, turns) {
  return addHex(rotateHex(subtractHex(index, pivot), turns), pivot);
}

/** The 91 cells of the radius-5 hexagonal game plate. */
export function enumerateBoardCells() {
  const result = [];
  for (let q = 0; q <= BOARD_RADIUS * 2; q += 1) {
    const minR = Math.max(-q, -BOARD_RADIUS);
    const maxR = Math.min(BOARD_RADIUS * 2 - q, BOARD_RADIUS);
    for (let r = minR; r <= maxR; r += 1) result.push(hex(q, r));
  }
  return result;
}

export function isBoardCell(index) {
  return hexDistance(index, BOARD_CENTER) <= BOARD_RADIUS;
}
