import test from "node:test";
import assert from "node:assert/strict";
import {
  ADJACENT_OFFSETS,
  Atom,
  GardenBoard,
  atomTypesMatch,
} from "../src/index.js";

test("matching table reproduces the rule sheet", () => {
  assert.equal(atomTypesMatch(Atom.FIRE, Atom.FIRE), true);
  assert.equal(atomTypesMatch(Atom.FIRE, Atom.WATER), false);
  assert.equal(atomTypesMatch(Atom.SALT, Atom.EARTH), true);
  assert.equal(atomTypesMatch(Atom.EARTH, Atom.SALT), true);
  assert.equal(atomTypesMatch(Atom.SALT, Atom.SALT), true);
  assert.equal(atomTypesMatch(Atom.VITAE, Atom.MORS), true);
  assert.equal(atomTypesMatch(Atom.MORS, Atom.VITAE), true);
  assert.equal(atomTypesMatch(Atom.QUICKSILVER, Atom.LEAD), true);
  assert.equal(atomTypesMatch(Atom.SILVER, Atom.QUICKSILVER), true);
  assert.equal(atomTypesMatch(Atom.QUICKSILVER, Atom.GOLD), false);
});

test("free atoms require three contiguous empty neighbours", () => {
  const center = { q: 0, r: 0 };
  const alternatingBlockers = [0, 2, 4].map((i) => ({
    q: ADJACENT_OFFSETS[i].q,
    r: ADJACENT_OFFSETS[i].r,
    type: Atom.FIRE,
  }));
  const locked = new GardenBoard([
    { ...center, type: Atom.WATER },
    ...alternatingBlockers,
  ]);
  assert.equal(locked.isFree(center), false);

  const contiguousOpening = new GardenBoard([
    { ...center, type: Atom.WATER },
    ...[0, 1, 2].map((i) => ({ ...ADJACENT_OFFSETS[i], type: Atom.FIRE })),
  ]);
  assert.equal(contiguousOpening.isFree(center), true);
});

test("the circular neighbour run can cross offset 5 to offset 0", () => {
  const center = { q: 0, r: 0 };
  const board = new GardenBoard([
    { ...center, type: Atom.WATER },
    ...[1, 2, 3].map((i) => ({ ...ADJACENT_OFFSETS[i], type: Atom.FIRE })),
  ]);
  assert.equal(board.isFree(center), true);
});

test("metals unlock strictly from lead toward gold", () => {
  const positions = {
    gold: { q: 0, r: 0 },
    silver: { q: 10, r: 0 },
    copper: { q: 20, r: 0 },
    iron: { q: 30, r: 0 },
    tin: { q: 40, r: 0 },
    lead: { q: 50, r: 0 },
  };
  const board = new GardenBoard([
    { ...positions.gold, type: Atom.GOLD },
    { ...positions.silver, type: Atom.SILVER },
    { ...positions.copper, type: Atom.COPPER },
    { ...positions.iron, type: Atom.IRON },
    { ...positions.tin, type: Atom.TIN },
    { ...positions.lead, type: Atom.LEAD },
  ]);

  assert.equal(board.isFree(positions.lead), true);
  assert.equal(board.isFree(positions.tin), false);
  assert.equal(board.isFree(positions.gold), false);
});

test("removing iron unlocks copper, while only removing silver unlocks gold", () => {
  const metals = [
    { q: 0, r: 0, type: Atom.GOLD },
    { q: 10, r: 0, type: Atom.SILVER },
    { q: 20, r: 0, type: Atom.COPPER },
    { q: 30, r: 0, type: Atom.IRON },
    { q: 40, r: 0, type: Atom.TIN },
    { q: 50, r: 0, type: Atom.LEAD },
  ];
  const quicksilver = Array.from({ length: 5 }, (_, index) => ({
    q: 70 + index * 10,
    r: 0,
    type: Atom.QUICKSILVER,
  }));
  const board = new GardenBoard([...metals, ...quicksilver]);
  const removePair = (metalIndex, quicksilverIndex) => {
    assert.equal(board.select(metals[metalIndex]).kind, "selected");
    assert.equal(board.select(quicksilver[quicksilverIndex]).kind, "removed");
  };

  removePair(5, 0); // Pb
  assert.equal(board.isFree(metals[4]), true);
  removePair(4, 1); // Sn
  assert.equal(board.isFree(metals[3]), true);
  removePair(3, 2); // Fe
  assert.equal(board.isFree(metals[2]), true);
  assert.equal(board.isFree(metals[0]), false);
  removePair(2, 3); // Cu
  assert.equal(board.isFree(metals[1]), true);
  assert.equal(board.isFree(metals[0]), false);
  removePair(1, 4); // Ag
  assert.equal(board.isFree(metals[0]), true);
});

test("selection removes pairs, replaces mismatches, and removes gold alone", () => {
  const fireA = { q: 0, r: 0 };
  const fireB = { q: 5, r: 0 };
  const water = { q: 10, r: 0 };
  const gold = { q: 15, r: 0 };
  const board = new GardenBoard([
    { ...fireA, type: Atom.FIRE },
    { ...fireB, type: Atom.FIRE },
    { ...water, type: Atom.WATER },
    { ...gold, type: Atom.GOLD },
  ]);

  assert.equal(board.select(fireA).kind, "selected");
  assert.equal(board.select(water).kind, "selected");
  assert.equal(board.selected[0].type, Atom.WATER);
  assert.equal(board.select(fireA).kind, "selected");
  const match = board.select(fireB);
  assert.equal(match.kind, "removed");
  assert.equal(match.removed.length, 2);
  assert.equal(board.size, 2);

  const goldResult = board.select(gold);
  assert.equal(goldResult.kind, "removed");
  assert.equal(goldResult.removed[0].type, Atom.GOLD);
});

test("quintessence removes with one atom of every cardinal element", () => {
  const pieces = [
    { q: 0, r: 0, type: Atom.QUINTESSENCE },
    { q: 5, r: 0, type: Atom.AIR },
    { q: 10, r: 0, type: Atom.FIRE },
    { q: 15, r: 0, type: Atom.WATER },
    { q: 20, r: 0, type: Atom.EARTH },
  ];
  const board = new GardenBoard(pieces);
  assert.equal(board.legalMoves().some((move) => move.length === 5), true);

  assert.equal(board.select(pieces[0]).kind, "selected");
  assert.equal(board.select(pieces[1]).kind, "selected");
  assert.equal(board.select(pieces[2]).kind, "selected");
  assert.equal(board.select(pieces[3]).kind, "selected");
  const result = board.select(pieces[4]);
  assert.equal(result.kind, "removed");
  assert.equal(result.removed.length, 5);
  assert.equal(board.won, true);
});
