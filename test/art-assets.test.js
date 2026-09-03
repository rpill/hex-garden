import assert from "node:assert/strict";
import test from "node:test";

import { ATOM_NAMES, Atom } from "../src/atom-types.js";
import { atomGlyphFrame } from "../src/art-assets.js";

test("every supported atom type has a renderer glyph frame", () => {
  for (const type of Object.keys(ATOM_NAMES).map(Number)) {
    assert.equal(
      typeof atomGlyphFrame(type),
      "string",
      `missing glyph frame for atom type ${type}`,
    );
  }
  assert.equal(typeof atomGlyphFrame(Atom.QUINTESSENCE), "string");
});
