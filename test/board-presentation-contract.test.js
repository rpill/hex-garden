import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const forbidden = ["../../board.js", "../../solver.js", "../../progression.js"];

for (const file of ["BoardHud.ts", "BoardInventory.ts", "BoardTutorial.ts"]) {
  test(`${file} stays presentation-only`, async () => {
    const text = await readFile(new URL(`../src/game/board/${file}`, import.meta.url), "utf8");
    for (const specifier of forbidden) {
      assert.doesNotMatch(text, new RegExp(specifier.replaceAll(".", "\\.")));
    }
  });
}
