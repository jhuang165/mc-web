import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { deflateSync } from "node:zlib";
import * as THREE from "three";
import { decodePng } from "./png-decode.js";
import { acceptedSkinSize, userSkinPixels, skinPixels, capePixels } from "./skin.js";
import { straightTexture, skinTextureOf, capeTextureOf } from "./straight-texture.js";
import { drawEntry } from "./item-atlas.js";

// Batch 75 skintex75: skins, capes and the item sheet reach the GPU as the straight-alpha pixels of the PNG file (DataTexture), not through a premultiplying 2D canvas.
const ref = JSON.parse(readFileSync(new URL("../public/research/skin-parse-reference.json", import.meta.url), "utf8"));
const argb = (b64) => { const b = Buffer.from(b64, "base64"), out = []; for (let i = 0; i < b.length; i += 4) out.push(b.readUInt32BE(i)); return out; };
const toRgba = (ints) => { const o = new Uint8Array(ints.length * 4); ints.forEach((v, i) => { o[i * 4] = v >>> 16 & 255; o[i * 4 + 1] = v >>> 8 & 255; o[i * 4 + 2] = v & 255; o[i * 4 + 3] = v >>> 24; }); return o; };
const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const o = Buffer.alloc(12 + data.length); o.writeUInt32BE(data.length, 0); o.write(type, 4, "ascii"); Buffer.from(data).copy(o, 8); o.writeUInt32BE(crc(o.subarray(4, 8 + data.length)), 8 + data.length); return o; };
// RGBA 8-bit PNG, filter 0.
function rgbaPng(rgba, w, h) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) Buffer.from(rgba.subarray(y * w * 4, (y + 1) * w * 4)).copy(raw, y * (w * 4 + 1) + 1);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const blobOf = (buf) => new Blob([buf], { type: "image/png" });

test("straightTexture: RGBA, unsigned byte, flipY, no premultiply, nearest, no mipmaps, array kept as given", () => {
  const px = new Uint8ClampedArray(4 * 2 * 4).map((_, i) => (i * 37) & 255);
  const t = straightTexture(px, 4, 2);
  assert.ok(t instanceof THREE.DataTexture);
  assert.equal(t.format, THREE.RGBAFormat); assert.equal(t.type, THREE.UnsignedByteType);
  assert.equal(t.flipY, true); assert.equal(t.premultiplyAlpha, false);
  assert.equal(t.magFilter, THREE.NearestFilter); assert.equal(t.minFilter, THREE.NearestFilter); assert.equal(t.generateMipmaps, false);
  assert.equal(t.colorSpace, new THREE.CanvasTexture(null).colorSpace, "same colour space as the canvas texture it replaces");
  assert.equal(t.flipY, new THREE.CanvasTexture(null).flipY);
  assert.deepEqual(Array.from(t.image.data), Array.from(px));
  assert.throws(() => straightTexture(px, 3, 2));
});

for (const r of ref.records.filter((x) => x.output && acceptedSkinSize(x.width, x.height))) {
  test(`skin texture upload array equals native parseUserSkin output: ${r.case}`, async () => {
    const png = rgbaPng(toRgba(argb(r.input)), r.width, r.height);
    const t = await skinTextureOf(blobOf(png));
    assert.ok(t instanceof THREE.DataTexture);
    assert.deepEqual(Array.from(t.image.data), Array.from(toRgba(argb(r.output))));
    assert.equal(t.image.width, 64); assert.equal(t.image.height, 32);
    assert.deepEqual(Array.from(await skinPixels(blobOf(png))), Array.from(userSkinPixels(toRgba(argb(r.input)), r.width, r.height)));
  });
}

test("a hat pixel kept at alpha 77 is uploaded unchanged (a canvas would premultiply it)", async () => {
  const px = new Uint8Array(64 * 32 * 4);
  px.set([200, 101, 33, 77], (4 * 64 + 40) * 4); // a hat-layer pixel (head second layer, x 32..63 y 0..15 region is hat)
  px.set([10, 20, 30, 255], 0);
  const t = await skinTextureOf(blobOf(rgbaPng(px, 64, 32)));
  const out = Array.from(t.image.data.subarray((4 * 64 + 40) * 4, (4 * 64 + 40) * 4 + 4));
  const want = Array.from(userSkinPixels(px, 64, 32).subarray((4 * 64 + 40) * 4, (4 * 64 + 40) * 4 + 4));
  assert.deepEqual(out, want);
  const mid = [200, 101, 33, 77].slice(0, 3).map((v) => Math.round(Math.round(v * 77 / 255) * 255 / 77));
  assert.notDeepEqual(mid, [200, 101, 33], "this value does move through a premultiplied store");
});

test("cape texture upload array equals the file's bytes, partial alpha included; wrong size rejected", async () => {
  const px = new Uint8Array(64 * 32 * 4).map((_, i) => (i * 53 + 7) & 255);
  const t = await capeTextureOf(blobOf(rgbaPng(px, 64, 32)));
  assert.ok(t instanceof THREE.DataTexture);
  assert.deepEqual(Array.from(t.image.data), Array.from(px));
  await assert.rejects(() => capeTextureOf(blobOf(rgbaPng(new Uint8Array(32 * 16 * 4), 32, 16))), /64 × 32/);
  await assert.rejects(() => skinTextureOf(blobOf(rgbaPng(new Uint8Array(32 * 16 * 4), 32, 16))), /64 × 32 or 64 × 64/);
});

test("the decoder refusing a file returns null (the canvas fallback then runs)", async () => {
  assert.equal(await skinPixels(new Blob([Uint8Array.of(1, 2, 3)])), null);
  assert.equal(await capePixels(new Blob([Uint8Array.of(1, 2, 3)])), null);
});

// Real assets: every item sprite with partial alpha is copied into the item sheet cell with the file's own bytes.
const itemsDir = new URL("../public/media/1.7.10/items/", import.meta.url);
test("item sheet cells hold the straight-alpha bytes of the item PNGs", async () => {
  let checked = 0, partial = 0;
  for (const file of readdirSync(itemsDir).filter((n) => n.endsWith(".png"))) {
    const png = await decodePng(new Uint8Array(readFileSync(new URL(file, itemsDir))));
    if (png.width !== 16) continue;
    const W = 32, a = { layout: { width: W, cells: new Map([["s", [16, 16, 16, 16]]]) }, pixels: new Uint8Array(W * 32 * 4) };
    drawEntry(a, { name: "s", frame: 0, img: { naturalWidth: png.width, naturalHeight: png.height, data: png.data } });
    for (let y = 0; y < 16; y++) assert.deepEqual(Array.from(a.pixels.subarray(((16 + y) * W + 16) * 4, ((16 + y) * W + 32) * 4)), Array.from(png.data.subarray(y * 64, y * 64 + 64)), `${file} row ${y}`);
    assert.equal(a.pixels[0], 0, "outside the cell stays clear");
    checked++; for (let i = 3; i < 1024; i += 4) if (png.data[i] > 0 && png.data[i] < 255) { partial++; break; }
  }
  assert.ok(checked > 100 && partial >= 5, `checked ${checked}, with partial alpha ${partial}`);
});

test("item sheet: a later frame of a strip is the strip's rows, straight", async () => {
  const png = await decodePng(new Uint8Array(readFileSync(new URL("compass.png", itemsDir))));
  const frames = png.height / png.width;
  assert.ok(frames > 1);
  const a = { layout: { width: 16, cells: new Map([["c", [0, 0, 16, 16]]]) }, pixels: new Uint8Array(16 * 16 * 4) };
  drawEntry(a, { name: "c", frame: 5, img: { naturalWidth: png.width, naturalHeight: png.height, data: png.data } });
  assert.deepEqual(Array.from(a.pixels), Array.from(png.data.subarray(5 * 1024, 6 * 1024)));
});

// Real block / entity assets with partial alpha upload as their own bytes through straightTexture.
for (const f of ["blocks/ice.png", "blocks/water_still.png", "blocks/portal.png", "blocks/glass_red.png", "entity/slime/slime.png", "misc/shadow.png", "environment/rain.png"]) {
  test(`straightTexture of ${f} equals the file's decoded bytes`, async () => {
    const png = await decodePng(new Uint8Array(readFileSync(new URL(`../public/media/1.7.10/${f}`, import.meta.url))));
    const t = straightTexture(png.data, png.width, png.height);
    assert.deepEqual(Array.from(t.image.data), Array.from(png.data));
  });
}
