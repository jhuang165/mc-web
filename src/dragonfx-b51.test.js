// Batch 51: the dragon beam's texture scroll uses the dragon's ticks; the tall grass / fern tint of a cart's display block (bytecode-read: bnl.a, blm.a, anz.i).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { beamTicks } from "./dragon-renderer.js";
import { displayTint } from "./cart-display-shape.js";
import { setColormaps, itemGrassColor, rgbFloats } from "./biome-colors.js";

test("beam scroll reads the dragon's tick count, not the crystal's", () => {
  assert.equal(beamTicks({ age: 40 }, { ticksExisted: 7 }, 0.25), 40.25);
  assert.equal(beamTicks(null, { ticksExisted: 7, age: 9 }, 0.5), 7.5);
  assert.equal(beamTicks(null, {}, 0.5), 0.5);
});

function rgba(buf) {
  let p = 8, width = 0, height = 0; const idat = [];
  while (p < buf.length) { const n = buf.readUInt32BE(p), t = buf.toString("ascii", p + 4, p + 8); if (t === "IHDR") { width = buf.readUInt32BE(p + 8); height = buf.readUInt32BE(p + 12); } if (t === "IDAT") idat.push(buf.subarray(p + 8, p + 8 + n)); p += 12 + n; }
  const raw = inflateSync(Buffer.concat(idat)), stride = width * 4, data = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) { const f = raw[y * (stride + 1)]; for (let x = 0; x < stride; x++) {
    const a = x >= 4 ? data[y * stride + x - 4] : 0, b = y ? data[(y - 1) * stride + x] : 0, c = x >= 4 && y ? data[(y - 1) * stride + x - 4] : 0, pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
    data[y * stride + x] = raw[y * (stride + 1) + 1 + x] + [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f]; } }
  return data;
}

test("display tint: grass tuft and fern take ColorizerGrass(0.5, 1.0), the dead shrub and others stay white", () => {
  assert.equal(displayTint(31, 1), null, "no colormaps yet: white");
  setColormaps(rgba(readFileSync(new URL("../public/media/1.7.10/colormap/grass.png", import.meta.url))), rgba(readFileSync(new URL("../public/media/1.7.10/colormap/foliage.png", import.meta.url))));
  assert.deepEqual(displayTint(31, 1), rgbFloats(itemGrassColor()));
  assert.deepEqual(displayTint(31, 2), rgbFloats(itemGrassColor()));
  assert.equal(displayTint(31, 0), null);
  assert.equal(displayTint(38, 0), null);
  assert.equal(displayTint(2, 0), null);
});
