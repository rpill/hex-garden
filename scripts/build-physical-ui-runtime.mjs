import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_PATH = path.join(ROOT, 'tools', 'physical-ui-factory', 'ui_manifest.json');
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
const sourceRoot = path.join(ROOT, manifest.sourceRoot);
const runtimeRoot = path.join(ROOT, manifest.runtimeRoot);

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const result = Buffer.alloc(12 + data.length);
  result.writeUInt32BE(data.length, 0);
  typeBuffer.copy(result, 4);
  data.copy(result, 8);
  result.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
  return result;
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

function readRgbaPng(filePath) {
  const file = fs.readFileSync(filePath);
  if (!file.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error(`${filePath}: not a PNG`);

  let offset = 8;
  let width;
  let height;
  let bitDepth;
  let colorType;
  let interlace;
  const idat = [];

  while (offset < file.length) {
    const length = file.readUInt32BE(offset);
    const type = file.toString('ascii', offset + 4, offset + 8);
    const data = file.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }

  if (!width || !height) throw new Error(`${filePath}: missing IHDR`);
  if (bitDepth !== 8 || colorType !== 6 || interlace !== 0) {
    throw new Error(`${filePath}: expected non-interlaced 8-bit RGBA PNG; got bitDepth=${bitDepth}, colorType=${colorType}, interlace=${interlace}`);
  }

  const inflated = zlib.inflateSync(Buffer.concat(idat));
  const bpp = 4;
  const stride = width * bpp;
  const rgba = Buffer.alloc(width * height * bpp);
  let inputOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[inputOffset++];
    const rowStart = y * stride;
    for (let x = 0; x < stride; x += 1) {
      const raw = inflated[inputOffset++];
      const left = x >= bpp ? rgba[rowStart + x - bpp] : 0;
      const up = y > 0 ? rgba[rowStart + x - stride] : 0;
      const upLeft = y > 0 && x >= bpp ? rgba[rowStart + x - stride - bpp] : 0;
      let value;
      if (filter === 0) value = raw;
      else if (filter === 1) value = (raw + left) & 255;
      else if (filter === 2) value = (raw + up) & 255;
      else if (filter === 3) value = (raw + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) value = (raw + paeth(left, up, upLeft)) & 255;
      else throw new Error(`${filePath}: unsupported PNG filter ${filter}`);
      rgba[rowStart + x] = value;
    }
  }
  return { width, height, rgba };
}

function sinc(x) {
  if (Math.abs(x) < 1e-8) return 1;
  const px = Math.PI * x;
  return Math.sin(px) / px;
}

function lanczos(x, a = 3) {
  const ax = Math.abs(x);
  if (ax >= a) return 0;
  return sinc(x) * sinc(x / a);
}

function contributions(srcSize, dstSize, a = 3) {
  const scale = dstSize / srcSize;
  const kernelScale = Math.min(1, scale);
  const support = a / kernelScale;
  const table = [];
  for (let d = 0; d < dstSize; d += 1) {
    const center = (d + 0.5) / scale - 0.5;
    const start = Math.max(0, Math.ceil(center - support));
    const end = Math.min(srcSize - 1, Math.floor(center + support));
    const entries = [];
    let sum = 0;
    for (let s = start; s <= end; s += 1) {
      const weight = lanczos((s - center) * kernelScale, a) * kernelScale;
      if (weight === 0) continue;
      entries.push([s, weight]);
      sum += weight;
    }
    if (Math.abs(sum) < 1e-12) entries.push([Math.max(0, Math.min(srcSize - 1, Math.round(center))), 1]);
    else for (const entry of entries) entry[1] /= sum;
    table.push(entries);
  }
  return table;
}

function resizePremultipliedLanczos(image, dstWidth, dstHeight) {
  const { width: srcWidth, height: srcHeight, rgba } = image;
  const xTable = contributions(srcWidth, dstWidth);
  const yTable = contributions(srcHeight, dstHeight);
  const horizontal = new Float32Array(dstWidth * srcHeight * 4);

  for (let y = 0; y < srcHeight; y += 1) {
    for (let dx = 0; dx < dstWidth; dx += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let alpha = 0;
      for (const [sx, weight] of xTable[dx]) {
        const si = (y * srcWidth + sx) * 4;
        const a = rgba[si + 3] / 255;
        r += (rgba[si] / 255) * a * weight;
        g += (rgba[si + 1] / 255) * a * weight;
        b += (rgba[si + 2] / 255) * a * weight;
        alpha += a * weight;
      }
      const di = (y * dstWidth + dx) * 4;
      horizontal[di] = r;
      horizontal[di + 1] = g;
      horizontal[di + 2] = b;
      horizontal[di + 3] = alpha;
    }
  }

  const out = Buffer.alloc(dstWidth * dstHeight * 4);
  for (let dy = 0; dy < dstHeight; dy += 1) {
    for (let x = 0; x < dstWidth; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let alpha = 0;
      for (const [sy, weight] of yTable[dy]) {
        const si = (sy * dstWidth + x) * 4;
        r += horizontal[si] * weight;
        g += horizontal[si + 1] * weight;
        b += horizontal[si + 2] * weight;
        alpha += horizontal[si + 3] * weight;
      }
      alpha = Math.max(0, Math.min(1, alpha));
      const di = (dy * dstWidth + x) * 4;
      if (alpha > 1e-7) {
        out[di] = Math.max(0, Math.min(255, Math.round((r / alpha) * 255)));
        out[di + 1] = Math.max(0, Math.min(255, Math.round((g / alpha) * 255)));
        out[di + 2] = Math.max(0, Math.min(255, Math.round((b / alpha) * 255)));
      }
      out[di + 3] = Math.round(alpha * 255);
    }
  }
  return { width: dstWidth, height: dstHeight, rgba: out };
}

function encodeRgbaPng(image) {
  const { width, height, rgba } = image;
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const dst = y * (stride + 1);
    raw[dst] = 0;
    rgba.copy(raw, dst + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    PNG_SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function convert(file, width, height) {
  const source = path.join(sourceRoot, file);
  if (!fs.existsSync(source)) {
    throw new Error(`Missing Blender master: ${source}. Run tools/physical-ui-factory/render_ui_preview.py in Blender first.`);
  }
  const sourceImage = readRgbaPng(source);
  const resized = resizePremultipliedLanczos(sourceImage, width, height);
  fs.mkdirSync(runtimeRoot, { recursive: true });
  fs.writeFileSync(path.join(runtimeRoot, file), encodeRgbaPng(resized));
}

for (const surface of Object.values(manifest.surfaces)) {
  convert(surface.file, surface.runtime.width, surface.runtime.height);
}
for (const icon of Object.values(manifest.icons)) {
  convert(icon.file, icon.runtime, icon.runtime);
}

const runtimeManifest = {
  version: manifest.version,
  surfaces: Object.fromEntries(Object.entries(manifest.surfaces).map(([id, value]) => [id, {
    file: value.file,
    width: value.runtime.width,
    height: value.runtime.height,
    nineSlice: value.nineSlice,
  }])),
  icons: Object.fromEntries(Object.entries(manifest.icons).map(([id, value]) => [id, {
    file: value.file,
    width: value.runtime,
    height: value.runtime,
  }])),
};
fs.writeFileSync(path.join(runtimeRoot, 'manifest.json'), `${JSON.stringify(runtimeManifest, null, 2)}\n`);
console.log(`Built ${Object.keys(manifest.surfaces).length} surfaces + ${Object.keys(manifest.icons).length} icons into ${runtimeRoot}`);
