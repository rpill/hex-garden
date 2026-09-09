import assert from "node:assert/strict";
import test from "node:test";
import {
  Atom,
  ELEMENT_TYPES,
  getCampaignLevel,
  replaySolution,
} from "../src/index.js";

const elements = new Set(ELEMENT_TYPES);
const types = (level) => new Set(getCampaignLevel(level).pieces.map((piece) => piece.type));
const hasOnly = (actual, allowed) => [...actual].every((type) => allowed.has(type));
const set = (...values) => new Set(values);
const union = (...sets) => new Set(sets.flatMap((value) => [...value]));

const SALT = set(Atom.SALT);
const OPPOSITES = set(Atom.VITAE, Atom.MORS);
const HG = set(Atom.QUICKSILVER);
const PB = set(Atom.LEAD);
const SN = set(Atom.TIN);
const FE = set(Atom.IRON);
const CU = set(Atom.COPPER);
const AG = set(Atom.SILVER);
const AU = set(Atom.GOLD);

test("Campaign levels 1-10 introduce the rule vocabulary one step at a time", () => {
  const expected = [
    union(elements),
    union(elements, SALT),
    union(elements, SALT, OPPOSITES),
    union(elements, SALT, OPPOSITES, HG, PB),
    union(elements, SALT, OPPOSITES, HG, PB, SN),
    union(elements, SALT, OPPOSITES, HG, PB, SN, FE),
    union(elements, SALT, OPPOSITES, HG, PB, SN, FE, CU),
    union(elements, SALT, OPPOSITES, HG, PB, SN, FE, CU, AG),
    union(elements, SALT, OPPOSITES, HG, PB, SN, FE, CU, AG, AU),
    union(elements, SALT, OPPOSITES, HG, PB, SN, FE, CU, AG, AU),
  ];

  const introduced = [
    [],
    [Atom.SALT],
    [Atom.VITAE, Atom.MORS],
    [Atom.QUICKSILVER, Atom.LEAD],
    [Atom.TIN],
    [Atom.IRON],
    [Atom.COPPER],
    [Atom.SILVER],
    [Atom.GOLD],
    [],
  ];

  for (let level = 0; level < 10; level += 1) {
    const actual = types(level);
    assert.equal(hasOnly(actual, expected[level]), true, `L${level + 1} contains a mechanic scheduled for later`);
    for (const type of introduced[level]) {
      assert.equal(actual.has(type), true, `L${level + 1} must introduce atom ${type}`);
    }
    assert.equal(replaySolution(getCampaignLevel(level).pieces, getCampaignLevel(level).solution), true);
  }
});

test("opening campaign occupancy grows gradually instead of jumping around", () => {
  const counts = Array.from({ length: 10 }, (_, level) => getCampaignLevel(level).pieces.length);
  for (let index = 1; index < counts.length; index += 1) {
    assert.ok(counts[index] >= counts[index - 1] - 1, `L${index + 1} should not sharply shrink from L${index}`);
  }
  assert.ok(counts[9] > counts[0], "L10 exam should contain more pieces than L1");
});
