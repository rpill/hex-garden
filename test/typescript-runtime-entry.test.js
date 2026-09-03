import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("browser worker URL targets the TypeScript source entry", async () => {
  const source = await readFile(new URL("../src/browser.ts", import.meta.url), "utf8");
  assert.match(source, /new URL\("\.\/generator-worker\.ts", import\.meta\.url\)/);
  assert.doesNotMatch(source, /new URL\("\.\/generator-worker\.js", import\.meta\.url\)/);
});

test("default browser worker construction stays visible to the Vite worker transform", async () => {
  const source = await readFile(new URL("../src/browser.ts", import.meta.url), "utf8");
  assert.match(
    source,
    /new globalThis\.Worker\(new URL\("\.\/generator-worker\.ts", import\.meta\.url\),/,
  );
});
