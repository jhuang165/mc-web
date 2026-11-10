// DOM icons from exact bytes (atlas-texels.js rasterIcon / encodePngStored): translucent texels survive the icon and the PNG unchanged.
import test from "node:test";
import assert from "node:assert/strict";
import { rasterIcon, encodePngStored, pngDataUrl, hasTranslucent, frameTile } from "./atlas-texels.js";
import { decodePng } from "./png-codec.js";

// A 16 px tile with a translucent gradient: alpha 1..254 over the cells, colours that premultiplied storage would round.
const tile = (() => { const t = new Uint8Array(16 * 16 * 4); for (let i = 0; i < 256; i++) { t[i * 4] = (i * 7 + 3) & 255; t[i * 4 + 1] = (i * 13 + 5) & 255; t[i * 4 + 2] = (i * 29 + 11) & 255; t[i * 4 + 3] = 1 + (i % 254); } return t; })();

test("encodePngStored round-trips every byte, including low-alpha colours", async () => {
  const data = Uint8Array.from({ length: 64 * 70 * 4 }, (_, i) => (i * 37 + (i >> 8)) & 255), png = await decodePng(encodePngStored(64, 70, data));
  assert.equal(png.width, 64); assert.equal(png.height, 70);
  assert.deepEqual(Buffer.from(png.data), Buffer.from(data));
  assert.ok(pngDataUrl(encodePngStored(2, 2, new Uint8Array(16))).startsWith("data:image/png;base64,iVBOR"));
});

test("a flat icon (58 px nearest scale) carries each translucent texel's exact bytes", () => {
  assert.ok(hasTranslucent(tile));
  const out = rasterIcon(64, 70, [{ tile, matrix: [58 / 16, 0, 0, 58 / 16, 3, 5] }]), want = frameTile({ width: 16, height: 16, data: tile }, 0, 58);
  for (let y = 0; y < 58; y++) for (let x = 0; x < 58; x++) {
    const o = ((y + 5) * 64 + x + 3) * 4, w = (y * 58 + x) * 4;
    assert.deepEqual([...out.subarray(o, o + 4)], [...want.subarray(w, w + 4)], `pixel ${x},${y}`);
  }
  assert.equal(out[3], 0); // outside the picture stays clear
});

test("a shaded face scales the colour only (black source-atop), alpha stays", () => {
  const out = rasterIcon(16, 16, [{ tile, matrix: [1, 0, 0, 1, 0, 0], shade: 0.2 }]);
  for (let i = 0; i < 256; i++) {
    for (let k = 0; k < 3; k++) assert.equal(out[i * 4 + k], Math.round(Math.fround(tile[i * 4 + k] * Math.fround(0.8))));
    assert.equal(out[i * 4 + 3], tile[i * 4 + 3]);
  }
});

test("the cube projection keeps interior texels exact and anti-aliases only the slanted edges", () => {
  const out = rasterIcon(64, 70, [{ tile, matrix: [1.75, 1, 0, 2, 4, 18] }]);
  let exact = 0, partial = 0;
  for (let py = 0; py < 70; py++) for (let px = 0; px < 64; px++) {
    const o = (py * 64 + px) * 4;
    if (!out[o + 3]) continue;
    const lx = (px + 0.5 - 4) / 1.75, ly = (py + 0.5 - 18 - lx) / 2, t = (Math.min(15, Math.floor(ly)) * 16 + Math.min(15, Math.floor(lx))) * 4;
    if (lx < 0 || lx >= 16 || ly < 0 || ly >= 16) { partial++; continue; }
    if (out[o + 3] === tile[t + 3]) { assert.deepEqual([...out.subarray(o, o + 3)], [...tile.subarray(t, t + 3)], `pixel ${px},${py}`); exact++; } else partial++;
  }
  assert.ok(exact > 600 && partial < exact, `${exact} exact, ${partial} edge pixels`);
});
