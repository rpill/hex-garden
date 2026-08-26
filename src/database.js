import { assertAtomType } from "./atom-types.js";
import { SigmarsGardenBoard } from "./board.js";
import { BOARD_CENTER, rotateHexAround } from "./hex.js";

export const ATOMS_PER_BOARD = 55;
export const BYTES_PER_ATOM = 3;
export const BYTES_PER_BOARD = ATOMS_PER_BOARD * BYTES_PER_ATOM;
export const DATABASE_HEADER_BYTES = 4;

function asUint8Array(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  }
  throw new TypeError("Board database must be an ArrayBuffer or Uint8Array");
}

function readSignedByte(value) {
  return value > 127 ? value - 256 : value;
}

export class SigmarsGardenDatabase {
  #bytes;

  constructor(input) {
    this.#bytes = asUint8Array(input);
    if (this.#bytes.byteLength < DATABASE_HEADER_BYTES) {
      throw new Error("Sigmar's Garden database is truncated");
    }

    this.count = new DataView(
      this.#bytes.buffer,
      this.#bytes.byteOffset,
      DATABASE_HEADER_BYTES,
    ).getInt32(0, true);

    if (this.count < 0) throw new Error("Invalid negative board count");
    const expectedLength = DATABASE_HEADER_BYTES + this.count * BYTES_PER_BOARD;
    if (this.#bytes.byteLength !== expectedLength) {
      throw new Error(
        `Invalid database size: expected ${expectedLength}, got ${this.#bytes.byteLength}`,
      );
    }
  }

  readPieces(index, { rotation = 0 } = {}) {
    if (!Number.isInteger(index) || index < 0 || index >= this.count) {
      throw new RangeError(`Board index ${index} is outside 0..${this.count - 1}`);
    }
    if (!Number.isInteger(rotation)) throw new TypeError("Rotation must be an integer");

    const pieces = [];
    let offset = DATABASE_HEADER_BYTES + index * BYTES_PER_BOARD;
    for (let i = 0; i < ATOMS_PER_BOARD; i += 1) {
      const type = assertAtomType(this.#bytes[offset]);
      const source = {
        q: readSignedByte(this.#bytes[offset + 1]),
        r: readSignedByte(this.#bytes[offset + 2]),
      };
      pieces.push({ ...rotateHexAround(source, BOARD_CENTER, rotation), type });
      offset += BYTES_PER_ATOM;
    }
    return pieces;
  }

  createBoard(index, options) {
    return new SigmarsGardenBoard(this.readPieces(index, options));
  }

  randomBoard(random = Math.random) {
    const index = Math.floor(random() * this.count);
    const rotation = Math.floor(random() * 6);
    return {
      index,
      rotation,
      board: this.createBoard(index, { rotation }),
    };
  }
}

function getPieces(boardOrRecord) {
  if (boardOrRecord instanceof SigmarsGardenBoard) return boardOrRecord.pieces();
  if (Array.isArray(boardOrRecord)) return boardOrRecord;
  if (Array.isArray(boardOrRecord?.pieces)) return boardOrRecord.pieces;
  if (boardOrRecord?.board instanceof SigmarsGardenBoard) return boardOrRecord.board.pieces();
  throw new TypeError("Expected a board, piece array, or generated board record");
}

/** Encode independently generated boards in the fixed-width format understood by the loader. */
export function encodeBoardDatabase(boards) {
  const records = Array.from(boards, getPieces);
  const bytes = new Uint8Array(DATABASE_HEADER_BYTES + records.length * BYTES_PER_BOARD);
  new DataView(bytes.buffer).setInt32(0, records.length, true);

  let offset = DATABASE_HEADER_BYTES;
  for (const pieces of records) {
    if (pieces.length !== ATOMS_PER_BOARD) {
      throw new Error(`Every database board must contain ${ATOMS_PER_BOARD} atoms`);
    }
    const positions = new Set();
    for (const piece of pieces) {
      assertAtomType(piece.type);
      if (
        !Number.isInteger(piece.q) ||
        !Number.isInteger(piece.r) ||
        piece.q < -128 ||
        piece.q > 127 ||
        piece.r < -128 ||
        piece.r > 127
      ) {
        throw new RangeError("Database coordinates must fit signed bytes");
      }
      const key = `${piece.q},${piece.r}`;
      if (positions.has(key)) throw new Error(`Duplicate database position ${key}`);
      positions.add(key);
      bytes[offset] = piece.type;
      bytes[offset + 1] = piece.q & 0xff;
      bytes[offset + 2] = piece.r & 0xff;
      offset += BYTES_PER_ATOM;
    }
  }
  return bytes;
}
