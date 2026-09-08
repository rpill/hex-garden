import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const minimalUiUrl = new URL("../src/game/minimal-ui.ts", import.meta.url);

function readSource() {
  return fs.readFileSync(minimalUiUrl, "utf8");
}

test("minimal button hit area uses Phaser top-left local coordinates", () => {
  const source = readSource();

  assert.match(
    source,
    /hitArea\.setTo\(\s*0,\s*0,\s*this\.buttonWidth,\s*this\.buttonHeight,\s*\)/s,
  );
  assert.match(
    source,
    /new Phaser\.Geom\.Rectangle\(\s*0,\s*0,\s*this\.buttonWidth,\s*this\.buttonHeight,\s*\)/s,
  );
  assert.doesNotMatch(source, /-this\.buttonWidth\s*\/\s*2/);
  assert.doesNotMatch(source, /-this\.buttonHeight\s*\/\s*2/);
});
