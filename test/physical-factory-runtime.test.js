import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../public/assets/physical-premium/", import.meta.url);

const expectedFiles = [
  "board-cell.png",
  "piece-salt.png", "piece-air.png", "piece-fire.png", "piece-water.png", "piece-earth.png",
  "piece-quicksilver.png", "piece-gold.png", "piece-silver.png", "piece-copper.png",
  "piece-iron.png", "piece-tin.png", "piece-lead.png", "piece-vitae.png", "piece-mors.png",
  "piece-quintessence.png",
];

test("checked-in physical premium rasters match the current factory manifest", async () => {
  const manifest = JSON.parse(await readFile(new URL("asset-factory-manifest.json", root), "utf8"));
  assert.equal(manifest.factory_version, 11);
  assert.equal(manifest.manifest_version, 11);
  assert.equal(manifest.render_size, 1024);
  assert.deepEqual(manifest.files, expectedFiles);

  for (const file of expectedFiles) {
    const entry = manifest.assets[file];
    assert.ok(entry, `${file} manifest entry`);
    const bytes = await readFile(new URL(file, root));
    const digest = createHash("sha256").update(bytes).digest("hex");
    assert.equal(digest, entry.png_sha256, `${file} PNG hash mismatch`);
    assert.match(entry.source_sha256, /^[0-9a-f]{64}$/);
  }
});
