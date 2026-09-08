import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";
import test from "node:test";

const pieceFiles = [
  "piece-salt.png",
  "piece-air.png",
  "piece-fire.png",
  "piece-water.png",
  "piece-earth.png",
  "piece-quicksilver.png",
  "piece-gold.png",
  "piece-silver.png",
  "piece-copper.png",
  "piece-iron.png",
  "piece-tin.png",
  "piece-lead.png",
  "piece-vitae.png",
  "piece-mors.png",
  "piece-quintessence.png",
];

async function requireFrozenRaster(t, file) {
  const url = new URL(`../public/assets/physical-premium/${file}`, import.meta.url);
  try {
    await access(url);
    return true;
  } catch {
    t.skip("frozen physical premium output is not part of the live functional checkout");
    return false;
  }
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

async function readRgbaPng(file) {
  const buf = await readFile(new URL(`../public/assets/physical-premium/${file}`, import.meta.url));
  assert.equal(buf.toString("ascii", 1, 4), "PNG", `${file} must be PNG`);
  let offset = 8;
  let width;
  let height;
  let bitDepth;
  let colorType;
  const idat = [];
  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString("ascii", offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + len;
  }
  assert.equal(bitDepth, 8, `${file} must use 8-bit channels`);
  assert.equal(colorType, 6, `${file} must be RGBA PNG`);
  const raw = inflateSync(Buffer.concat(idat));
  const bpp = 4;
  const stride = width * bpp;
  const pixels = Buffer.alloc(width * height * bpp);
  let rawOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[rawOffset++];
    const row = raw.subarray(rawOffset, rawOffset + stride);
    rawOffset += stride;
    for (let x = 0; x < stride; x += 1) {
      const left = x >= bpp ? pixels[y * stride + x - bpp] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const upLeft = y > 0 && x >= bpp ? pixels[(y - 1) * stride + x - bpp] : 0;
      let value;
      switch (filter) {
        case 0: value = row[x]; break;
        case 1: value = (row[x] + left) & 0xff; break;
        case 2: value = (row[x] + up) & 0xff; break;
        case 3: value = (row[x] + Math.floor((left + up) / 2)) & 0xff; break;
        case 4: value = (row[x] + paeth(left, up, upLeft)) & 0xff; break;
        default: throw new Error(`${file}: unsupported PNG filter ${filter}`);
      }
      pixels[y * stride + x] = value;
    }
  }
  return { width, height, pixels };
}

function alphaBounds(image, threshold = 8) {
  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const alpha = image.pixels[(y * image.width + x) * 4 + 3];
      if (alpha <= threshold) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  assert.ok(maxX >= 0, "image must contain visible pixels");
  return { minX, minY, maxX, maxY };
}

function assertCentered(file, image, tolerancePx) {
  const bounds = alphaBounds(image);
  const bboxCx = (bounds.minX + bounds.maxX) / 2;
  const bboxCy = (bounds.minY + bounds.maxY) / 2;
  const canvasCx = (image.width - 1) / 2;
  const canvasCy = (image.height - 1) / 2;
  assert.ok(Math.abs(bboxCx - canvasCx) <= tolerancePx, `${file} alpha bbox is horizontally off-center: ${bboxCx} vs ${canvasCx}`);
  assert.ok(Math.abs(bboxCy - canvasCy) <= tolerancePx, `${file} alpha bbox is vertically off-center: ${bboxCy} vs ${canvasCy}`);
  return bounds;
}

test("frozen premium board-cell raster keeps its contract when present", async (t) => {
  if (!(await requireFrozenRaster(t, "board-cell.png"))) return;
  const image = await readRgbaPng("board-cell.png");
  assert.equal(image.width, image.height);
  const bounds = assertCentered("board-cell.png", image, image.width * 0.006);
  const visibleWidthRatio = (bounds.maxX - bounds.minX + 1) / image.width;
  const visibleHeightRatio = (bounds.maxY - bounds.minY + 1) / image.height;
  assert.ok(visibleWidthRatio >= 0.73 && visibleWidthRatio <= 0.76, `board-cell visible width ratio ${visibleWidthRatio}`);
  assert.ok(visibleHeightRatio >= 0.84 && visibleHeightRatio <= 0.87, `board-cell visible height ratio ${visibleHeightRatio}`);
});

test("frozen premium piece sprites keep their raster contract when present", async (t) => {
  if (!(await requireFrozenRaster(t, pieceFiles[0]))) return;
  let referenceSize;
  for (const file of pieceFiles) {
    const image = await readRgbaPng(file);
    assert.equal(image.width, image.height, `${file} square canvas`);
    referenceSize ??= image.width;
    assert.equal(image.width, referenceSize, `${file} canvas size`);
    const bounds = assertCentered(file, image, image.width * 0.006);
    const visibleWidthRatio = (bounds.maxX - bounds.minX + 1) / image.width;
    const visibleHeightRatio = (bounds.maxY - bounds.minY + 1) / image.height;
    assert.ok(visibleWidthRatio >= 0.57 && visibleWidthRatio <= 0.60, `${file} visible width ratio ${visibleWidthRatio}`);
    assert.ok(visibleHeightRatio >= 0.57 && visibleHeightRatio <= 0.60, `${file} visible height ratio ${visibleHeightRatio}`);
  }
});
