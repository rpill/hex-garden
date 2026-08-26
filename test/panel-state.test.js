import test from "node:test";
import assert from "node:assert/strict";
import {
  Atom,
  PANEL_METAL_TYPES,
  createPanelState,
  panelTypesForVariant,
} from "../src/index.js";

function pieces(...types) {
  return types.map((type, index) => ({ q: index, r: 0, type }));
}

test("standard panel reports inventory and exposes the metal chain", () => {
  const boardPieces = pieces(
    Atom.SALT,
    Atom.SALT,
    Atom.AIR,
    Atom.FIRE,
    Atom.FIRE,
    Atom.QUICKSILVER,
    ...PANEL_METAL_TYPES,
  );
  const state = createPanelState(boardPieces, { variant: "standard" });
  const byType = new Map(state.entries.map((entry) => [entry.type, entry]));

  assert.equal(state.entries.length, 12);
  assert.equal(byType.get(Atom.SALT).count, 2);
  assert.equal(byType.get(Atom.FIRE).count, 2);
  assert.equal(byType.get(Atom.QUICKSILVER).count, 1);
  assert.equal(byType.get(Atom.AIR).warning, true);
  assert.equal(byType.get(Atom.FIRE).warning, false);
  assert.equal(state.currentMetal, Atom.LEAD);
  assert.equal(byType.get(Atom.LEAD).current, true);
  assert.equal(byType.get(Atom.TIN).locked, true);
  assert.equal(byType.get(Atom.GOLD).countVisible, false);
});

test("removing a metal advances the panel from lead toward gold", () => {
  const remainingMetals = PANEL_METAL_TYPES.filter((type) => type !== Atom.LEAD);
  const state = createPanelState(pieces(...remainingMetals), {
    variant: "standard",
  });
  const byType = new Map(state.entries.map((entry) => [entry.type, entry]));

  assert.equal(byType.get(Atom.LEAD).depleted, true);
  assert.equal(state.currentMetal, Atom.TIN);
  assert.equal(byType.get(Atom.TIN).current, true);
  assert.equal(byType.get(Atom.IRON).locked, true);
  assert.equal(byType.get(Atom.GOLD).locked, true);
});

test("quintessence variant swaps the counted Hg slot for Q", () => {
  const types = panelTypesForVariant("quintessence");
  assert.equal(types.includes(Atom.QUINTESSENCE), true);
  assert.equal(types.includes(Atom.QUICKSILVER), false);

  const state = createPanelState(
    pieces(Atom.AIR, Atom.QUINTESSENCE, Atom.QUICKSILVER),
    { variant: "quintessence", activeType: Atom.QUINTESSENCE },
  );
  const byType = new Map(state.entries.map((entry) => [entry.type, entry]));
  assert.equal(byType.get(Atom.QUINTESSENCE).count, 1);
  assert.equal(byType.get(Atom.QUINTESSENCE).selected, true);
  assert.equal(byType.get(Atom.AIR).warning, false);
});
