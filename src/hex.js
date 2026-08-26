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

/** All cells of a hexagonal plate around an arbitrary centre. */
export function enumerateHexPlate(radius, center = BOARD_CENTER) {
  if (!Number.isSafeInteger(radius) || radius < 0) {
    throw new RangeError("radius must be a non-negative safe integer");
  }
  const result = [];
  for (let dq = -radius; dq <= radius; dq += 1) {
    const minDr = Math.max(-radius, -dq - radius);
    const maxDr = Math.min(radius, -dq + radius);
    for (let dr = minDr; dr <= maxDr; dr += 1) {
      result.push(hex(center.q + dq, center.r + dr));
    }
  }
  return result;
}

/** The 91 cells of the original radius-5 game plate. */
export function enumerateBoardCells() {
  return enumerateHexPlate(BOARD_RADIUS);
}

export function isHexPlateCell(index, radius, center = BOARD_CENTER) {
  if (!Number.isSafeInteger(radius) || radius < 0) return false;
  return hexDistance(index, center) <= radius;
}

export function isBoardCell(index) {
  return isHexPlateCell(index, BOARD_RADIUS);
}
