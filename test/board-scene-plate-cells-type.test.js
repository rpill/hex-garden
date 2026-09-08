import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../src/game/scenes/BoardScene.ts", import.meta.url), "utf8");

test("BoardScene accepts readonly canonical plate cells from generated records", () => {
  assert.match(source, /plateCells:\s*readonly HexCoord\[\]\s*=\s*enumerateBoardCells\(\)/);
});
