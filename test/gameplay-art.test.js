import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("gameplay atlas contract resolves the idle board frame", async () => {
  const art = await import("../src/art-assets.js").catch(() => null);
  assert.ok(art, "gameplay art catalog must exist");

  const manifestUrl = new URL(`../public${art.GAMEPLAY_ATLAS.jsonUrl}`, import.meta.url);
  const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
  const texture = manifest.textures.find(
    ({ image }) => image === art.GAMEPLAY_ATLAS.textureFile,
  );

  assert.ok(texture, "atlas JSON must reference the configured texture");
  assert.ok(
    texture.frames.some(({ filename }) => filename === art.GAMEPLAY_FRAMES.hexIdle),
    "atlas must contain the idle board-cell frame",
  );

  const backgroundUrl = new URL(
    `../public${art.GAMEPLAY_BACKGROUND.url}`,
    import.meta.url,
  );
  const background = await readFile(backgroundUrl);
  assert.deepEqual(
    [...background.subarray(0, 8)],
    [137, 80, 78, 71, 13, 10, 26, 10],
    "paper background must be a PNG",
  );
});
