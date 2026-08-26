import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  ATOMS_PER_BOARD,
  Atom,
  BYTES_PER_BOARD,
  DATABASE_HEADER_BYTES,
  SigmarsGardenDatabase,
} from "../src/index.js";

function syntheticDatabase() {
  const bytes = new Uint8Array(DATABASE_HEADER_BYTES + BYTES_PER_BOARD);
  new DataView(bytes.buffer).setInt32(0, 1, true);
  const types = [
    ...Array(4).fill(Atom.SALT),
    ...Array(8).fill(Atom.AIR),
    ...Array(8).fill(Atom.FIRE),
    ...Array(8).fill(Atom.WATER),
    ...Array(8).fill(Atom.EARTH),
    ...Array(5).fill(Atom.QUICKSILVER),
    Atom.GOLD,
    Atom.SILVER,
    Atom.COPPER,
    Atom.IRON,
    Atom.TIN,
    Atom.LEAD,
    ...Array(4).fill(Atom.VITAE),
    ...Array(4).fill(Atom.MORS),
  ];
  assert.equal(types.length, ATOMS_PER_BOARD);

  for (let i = 0; i < types.length; i += 1) {
    const offset = DATABASE_HEADER_BYTES + i * 3;
    bytes[offset] = types[i];
    bytes[offset + 1] = i;
    bytes[offset + 2] = 0;
  }
  return bytes;
}

test("database parser reads the original fixed-width binary format", () => {
  const database = new SigmarsGardenDatabase(syntheticDatabase());
  assert.equal(database.count, 1);
  assert.equal(database.readPieces(0).length, ATOMS_PER_BOARD);
  assert.equal(database.createBoard(0).size, ATOMS_PER_BOARD);
  assert.throws(() => database.readPieces(1), RangeError);
});

test("database parser rejects size/header mismatches", () => {
  const truncated = syntheticDatabase().slice(0, -1);
  assert.throws(() => new SigmarsGardenDatabase(truncated), /Invalid database size/);
});

const installedDatabase = String.raw`D:\Games\The Zachtronics Solitaire Collection\Content\solitaire.dat`;
const installedAlternateDatabase = String.raw`D:\Games\The Zachtronics Solitaire Collection\Content\solitaire2.dat`;

test(
  "integration: the installed 50,000-board database is compatible",
  { skip: !existsSync(installedDatabase) },
  () => {
    const database = new SigmarsGardenDatabase(readFileSync(installedDatabase));
    assert.equal(database.count, 50_000);
    const pieces = database.readPieces(0, { rotation: 5 });
    assert.equal(pieces.length, 55);
    assert.equal(new Set(pieces.map(({ q, r }) => `${q},${r}`)).size, 55);

    const counts = Object.groupBy(pieces, (piece) => piece.type);
    assert.equal(counts[Atom.SALT].length, 4);
    assert.equal(counts[Atom.QUICKSILVER].length, 5);
    assert.equal(counts[Atom.GOLD].length, 1);
    assert.equal(counts[Atom.VITAE].length, 4);
    assert.equal(counts[Atom.MORS].length, 4);
  },
);

test(
  "integration: the alternate 5,000-board database and quintessence are compatible",
  { skip: !existsSync(installedAlternateDatabase) },
  () => {
    const database = new SigmarsGardenDatabase(readFileSync(installedAlternateDatabase));
    assert.equal(database.count, 5_000);
    const pieces = database.readPieces(0);
    assert.equal(pieces.filter((piece) => piece.type === Atom.QUINTESSENCE).length, 2);
    assert.equal(pieces.filter((piece) => piece.type === Atom.VITAE).length, 3);
    assert.equal(pieces.filter((piece) => piece.type === Atom.MORS).length, 3);
  },
);
