import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function sources(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? sources(full) : entry.name.endsWith(".ts") ? [full] : [];
  });
}

test("runtime product has no economy or shop surface", () => {
  const text = sources(fileURLToPath(new URL("../src/game", import.meta.url)))
    .map((file) => fs.readFileSync(file, "utf8"))
    .join("\n");
  assert.doesNotMatch(
    text,
    /EconomyStore|getEconomy|HINT_PRODUCTS|CAMPAIGN SCORE|МАГАЗИН|scene\.start\(["']shop/,
  );
});
