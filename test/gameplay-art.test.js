import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("gameplay atlas contract resolves board interaction frames and local UI font", async () => {
  const art = await import("../src/art-assets.js").catch(() => null);
  assert.ok(art, "gameplay art catalog must exist");

  const manifestUrl = new URL(`../public${art.GAMEPLAY_ATLAS.jsonUrl}`, import.meta.url);
  const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
  const texture = manifest.textures.find(
    ({ image }) => image === art.GAMEPLAY_ATLAS.textureFile,
  );

  assert.ok(texture, "atlas JSON must reference the configured texture");
  for (const frame of [
    art.GAMEPLAY_FRAMES.hexIdle,
    art.GAMEPLAY_FRAMES.hexHover,
    art.GAMEPLAY_FRAMES.hexSelected,
  ]) {
    assert.ok(
      texture.frames.some(({ filename }) => filename === frame),
      `atlas must contain the ${frame} board-cell frame`,
    );
  }

  const font = await readFile(
    new URL(`../public${art.GAMEPLAY_FONT.url}`, import.meta.url),
  );
  assert.ok(font.byteLength > 0, "local UI font must be bundled");

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

test("selected hex frame takes priority over hover and shared Phaser text uses the local font", async () => {
  const art = await import("../src/art-assets.js");
  const { makeText } = await import("../src/game/ui.js");
  const calls = [];
  const value = {
    setResolution() {
      return this;
    },
  };
  const scene = {
    add: {
      text(x, y, text, config) {
        calls.push({ x, y, text, config });
        return value;
      },
    },
  };

  assert.equal(
    art.hexFrameForState({ selected: true, hovered: true }),
    "hex_selected.png",
    "selection must take precedence over hover",
  );
  assert.equal(
    art.hexFrameForState({ selected: false, hovered: true }),
    "hex_hover.png",
  );
  makeText(scene, "HEX GARDEN", 16);
  assert.equal(calls[0].config.fontFamily, 'Neucha, Arial, "Segoe UI", sans-serif');
});
