import { assertAtomType, ATOM_NAMES, Atom, ELEMENT_TYPES, isElement } from "./atom-types.js";
import { ADJACENT_OFFSETS, addHex, hexKey } from "./hex.js";
import { atomTypesMatch, isMetalLocked, isSingleRemoval } from "./rules.js";

function normalizeIndex(index) {
  if (!index || !Number.isInteger(index.q) || !Number.isInteger(index.r)) {
    throw new TypeError("Expected a hex index shaped like { q: integer, r: integer }");
  }
  return { q: index.q, r: index.r };
}

function clonePiece(piece) {
  return { q: piece.q, r: piece.r, type: piece.type };
}

export class SigmarsGardenBoard {
  #pieces = new Map();
  #selection = [];

  constructor(pieces = []) {
    for (const rawPiece of pieces) {
      const index = normalizeIndex(rawPiece);
      const type = assertAtomType(rawPiece.type);
      const key = hexKey(index);
      if (this.#pieces.has(key)) throw new Error(`Duplicate atom at ${key}`);
      this.#pieces.set(key, { ...index, type });
    }
  }

  get size() {
    return this.#pieces.size;
  }

  get won() {
    return this.size === 0;
  }

  get selected() {
    return this.#selection.map((key) => clonePiece(this.#pieces.get(key)));
  }

  pieces() {
    return [...this.#pieces.values()].map(clonePiece);
  }

  clone() {
    const board = new SigmarsGardenBoard(this.pieces());
    board.#selection = [...this.#selection];
    return board;
  }

  has(index) {
    return this.#pieces.has(hexKey(normalizeIndex(index)));
  }

  pieceAt(index) {
    const piece = this.#pieces.get(hexKey(normalizeIndex(index)));
    return piece ? clonePiece(piece) : undefined;
  }

  clearSelection() {
    this.#selection = [];
  }

  /**
   * An atom is geometrically free when at least three consecutive places in
   * its six-neighbour ring are empty. The ring is circular, so the run may
   * cross from the last offset back to the first. Empty cells inside and
   * outside the decorative plate are treated identically by the original.
   */
  isFree(index) {
    const normalized = normalizeIndex(index);
    const piece = this.#pieces.get(hexKey(normalized));
    if (!piece) return false;

    let run = 0;
    let longestRun = 0;
    // Two passes account for an empty run crossing the circular boundary.
    for (let pass = 0; pass < 2; pass += 1) {
      for (const offset of ADJACENT_OFFSETS) {
        if (this.#pieces.has(hexKey(addHex(normalized, offset)))) {
          run = 0;
        } else {
          run += 1;
          longestRun = Math.max(longestRun, run);
        }
      }
    }
    if (longestRun < 3) return false;

    return !isMetalLocked(
      piece.type,
      [...this.#pieces.values()].map((candidate) => candidate.type),
    );
  }

  canMatch(first, second) {
    const a = this.#pieces.get(hexKey(normalizeIndex(first)));
    const b = this.#pieces.get(hexKey(normalizeIndex(second)));
    return Boolean(a && b && a !== b && atomTypesMatch(a.type, b.type));
  }

  /** All currently legal moves. Gold is represented as a one-piece move. */
  legalMoves() {
    const freePieces = [...this.#pieces.values()].filter((piece) => this.isFree(piece));
    const moves = [];

    for (const piece of freePieces) {
      if (isSingleRemoval(piece.type)) moves.push([clonePiece(piece)]);
    }
    for (let i = 0; i < freePieces.length; i += 1) {
      for (let j = i + 1; j < freePieces.length; j += 1) {
        if (atomTypesMatch(freePieces[i].type, freePieces[j].type)) {
          moves.push([clonePiece(freePieces[i]), clonePiece(freePieces[j])]);
        }
      }
    }

    const freeByElement = new Map(
      ELEMENT_TYPES.map((type) => [
        type,
        freePieces.filter((piece) => piece.type === type),
      ]),
    );
    const quintessences = freePieces.filter(
      (piece) => piece.type === Atom.QUINTESSENCE,
    );
    if (ELEMENT_TYPES.every((type) => freeByElement.get(type).length > 0)) {
      for (const quintessence of quintessences) {
        const addElementChoices = (typeIndex, move) => {
          if (typeIndex === ELEMENT_TYPES.length) {
            moves.push(move.map(clonePiece));
            return;
          }
          for (const element of freeByElement.get(ELEMENT_TYPES[typeIndex])) {
            addElementChoices(typeIndex + 1, [...move, element]);
          }
        };
        addElementChoices(0, [quintessence]);
      }
    }
    return moves;
  }

  /**
   * Apply the original click/selection state machine.
   *
   * @returns {{kind: string, removed: object[], selected: object[]}}
   */
  select(index) {
    const normalized = normalizeIndex(index);
    const key = hexKey(normalized);
    const piece = this.#pieces.get(key);

    if (!piece) return this.#result("empty");
    if (!this.isFree(normalized)) return this.#result("locked");

    if (isSingleRemoval(piece.type)) {
      this.#pieces.delete(key);
      this.#selection = [];
      return this.#result("removed", [piece]);
    }

    if (this.#selection.includes(key)) {
      this.#selection = this.#selection.filter((selectedKey) => selectedKey !== key);
      if (
        this.#selection.length >= 2 &&
        !this.#selection.some(
          (selectedKey) => this.#pieces.get(selectedKey)?.type === Atom.QUINTESSENCE,
        )
      ) {
        this.#selection = [];
      }
      return this.#result("deselected");
    }

    if (this.#selection.length === 1) {
      const selectedKey = this.#selection[0];
      const selectedPiece = this.#pieces.get(selectedKey);
      if (selectedPiece && atomTypesMatch(selectedPiece.type, piece.type)) {
        this.#pieces.delete(selectedKey);
        this.#pieces.delete(key);
        this.#selection = [];
        return this.#result("removed", [selectedPiece, piece]);
      }
    }

    const selectedPieces = this.#selection
      .map((selectedKey) => this.#pieces.get(selectedKey))
      .filter(Boolean);
    const containsQuintessence = selectedPieces.some(
      (selectedPiece) => selectedPiece.type === Atom.QUINTESSENCE,
    );

    if (
      selectedPieces.length >= 1 &&
      containsQuintessence &&
      isElement(piece.type) &&
      !selectedPieces.some((selectedPiece) => selectedPiece.type === piece.type)
    ) {
      this.#selection.push(key);
      if (this.#selection.length === 5) {
        const removed = this.#selection.map((selectedKey) => this.#pieces.get(selectedKey));
        for (const selectedKey of this.#selection) this.#pieces.delete(selectedKey);
        this.#selection = [];
        return this.#result("removed", removed);
      }
      return this.#result("selected");
    }

    if (
      piece.type === Atom.QUINTESSENCE &&
      selectedPieces.every((selectedPiece) => isElement(selectedPiece.type))
    ) {
      this.#selection.push(key);
      return this.#result("selected");
    }

    this.#selection = [key];
    return this.#result("selected");
  }

  toJSON() {
    return {
      pieces: this.pieces().map((piece) => ({
        ...piece,
        name: ATOM_NAMES[piece.type],
      })),
      selected: this.selected,
      won: this.won,
    };
  }

  #result(kind, removed = []) {
    return {
      kind,
      removed: removed.map(clonePiece),
      selected: this.selected,
    };
  }
}
