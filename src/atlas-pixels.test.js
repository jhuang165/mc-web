// Atlas pixels against the unchanged 1.7.10 TextureUtil (public/research/atlas-reference.json, tools/verify-atlas.mjs): every jar block
// texture decoded with the port's exact PNG codec, its mip chain at 0, 1 and 4 levels and the Anaglyph conversion of each level hash for hash.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { decodePng } from "./png-codec.js";
import { mipChain } from "./render-settings.js";
import { anaglyphRgba, installAnaglyphUpload } from "./anaglyph.js";
import { frameTile, blit, multiplyTile, overTile, convertTile, spriteLevels, putTile } from "./atlas-pixels.js";
import { TILES } from "./block-textures.js";

const ref = JSON.parse(await readFile(new URL("../public/research/atlas-reference.json", import.meta.url)));
// RGBA bytes -> big-endian ARGB ints, hashed like the probe.
const argbHash = (rgba) => {
  const b = Buffer.alloc(rgba.length);
  for (let i = 0; i < rgba.length; i += 4) { b[i] = rgba[i + 3]; b[i + 1] = rgba[i]; b[i + 2] = rgba[i + 1]; b[i + 3] = rgba[i + 2]; }
  return createHash("sha1").update(b).digest("hex");
};
const load = async (name) => decodePng(new Uint8Array(await readFile(new URL(`../public/media/1.7.10/${name}.png`, import.meta.url))));

test("mip chains and Anaglyph conversion of every jar block texture match the unchanged TextureUtil", async () => {
  let checked = 0, translucent = 0;
  for (const t of ref.textures) {
    const png = await load(t.name.replace(/\.png$/, "")).catch(() => null);
    if (!png) continue; // not shipped (the pack set is the 1.7.10 jar's; every tile of TILES is checked below)
    const first = png.data.subarray(0, t.w * t.w * 4);
    for (const [levels, want] of Object.entries(t.levels)) {
      const chain = mipChain(first, t.w, t.w, Number(levels));
      assert.equal(chain.length, want.raw.length, `${t.name} levels ${levels}`);
      chain.forEach((l, i) => {
        assert.equal(argbHash(l.data), want.raw[i], `${t.name} L${levels} level ${i} raw`);
        assert.equal(argbHash(anaglyphRgba(Uint8Array.from(l.data))), want.conv[i], `${t.name} L${levels} level ${i} converted`);
      });
    }
    checked++; if (t.translucent) translucent++;
  }
  assert.ok(checked > 300 && translucent > 40, `${checked} textures, ${translucent} translucent`);
});

test("every atlas tile's 16 px frame and spriteLevels reproduce the native chain", async () => {
  const byName = new Map(ref.textures.map((t) => [t.name.replace(/^blocks\//, "").replace(/\.png$/, ""), t]));
  let n = 0;
  for (const name of TILES) {
    const t = byName.get(name);
    if (!t || t.w !== 16) continue;
    const png = await load("blocks/" + name), lv = spriteLevels(frameTile(png, 0), 4);
    assert.equal(lv.length, t.levels["4"].raw.length);
    lv.forEach((d, i) => { assert.equal(argbHash(d), t.levels["4"].raw[i], `${name} ${i}`); assert.equal(argbHash(convertTile(d)), t.levels["4"].conv[i], `${name} conv ${i}`); });
    n++;
  }
  assert.ok(n > 200, `${n} tiles`);
});

test("PNG decoding keeps translucent pixels the 2D canvas would round", async () => {
  const glass = await load("blocks/glass"), ice = await load("blocks/ice");
  const odd = (png) => { let c = 0; for (let i = 0; i < png.data.length; i += 4) if (png.data[i + 3] > 0 && png.data[i + 3] < 255) c++; return c; };
  assert.ok(odd(ice) > 0 || odd(glass) > 0, "a shipped texture holds partially transparent pixels");
});

test("tile helpers: frame sampling, float multiply, overlay and level placement", () => {
  const strip = { width: 2, height: 4, data: Uint8Array.from({ length: 32 }, (_, i) => i) };
  assert.deepEqual([...frameTile(strip, 1, 2)], [...strip.data.subarray(16, 32)], "second square frame");
  assert.deepEqual([...frameTile(strip, 9, 2)], [...strip.data.subarray(16, 32)], "clamped to the last frame");
  assert.deepEqual([...frameTile(strip, 0, 1)], [...strip.data.subarray(12, 16)], "nearest downscale samples the cell centre");
  const px = Uint8Array.from([200, 100, 50, 77]);
  assert.deepEqual([...multiplyTile(px, [0.5, Math.fround(0.3), 1])], [100, 30, 50, 77]);
  assert.deepEqual([...multiplyTile(Uint8Array.from([255, 255, 255, 9]), [1.2, 0, 1])], [255, 0, 255, 9], "clamps, keeps alpha");
  const base = Uint8Array.from([10, 20, 30, 255, 1, 2, 3, 0]), over = Uint8Array.from([100, 100, 100, 0, 200, 150, 100, 255]);
  assert.deepEqual([...overTile(base, over)], [10, 20, 30, 255, 200, 150, 100, 255]);
  const dst = new Uint8Array(4 * 4 * 4);
  blit(dst, 4, { width: 1, height: 1, data: Uint8Array.from([9, 8, 7, 6]) }, 0, 0, 1, 1, 1, 2, 2, 1);
  assert.deepEqual([...dst.subarray((2 * 4 + 1) * 4, (2 * 4 + 3) * 4)], [9, 8, 7, 6, 9, 8, 7, 6]);
  const atlas = [new Uint8Array(32 * 32 * 4), new Uint8Array(16 * 16 * 4)];
  putTile(atlas, 32, [new Uint8Array(16 * 16 * 4).fill(5), new Uint8Array(8 * 8 * 4).fill(7)], 16, 16);
  assert.equal(atlas[0][(16 * 32 + 16) * 4], 5); assert.equal(atlas[0][(15 * 32 + 16) * 4], 0);
  assert.equal(atlas[1][(8 * 16 + 8) * 4], 7); assert.equal(atlas[1][(7 * 16 + 8) * 4], 0);
});

test("the GL upload hook leaves arrays flagged as already converted alone and converts the rest", () => {
  const sent = [];
  const gl = { RGBA: 6408, UNSIGNED_BYTE: 5121, texImage2D: (...a) => sent.push(a), texSubImage2D: (...a) => sent.push(a) };
  const hook = installAnaglyphUpload(gl, { on: true });
  const raw = Uint8Array.from([200, 100, 50, 255]), done = Uint8Array.from([1, 2, 3, 4]); done.__agDone = true;
  gl.texImage2D(3553, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, raw);
  gl.texSubImage2D(3553, 0, 0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, done);
  assert.deepEqual([...sent[0][8]], [...anaglyphRgba(Uint8Array.from([200, 100, 50, 255]))]);
  assert.equal(sent[1][8], done, "flagged array passes through");
  assert.equal(hook.stats.converted, 1);
});

test("chunk vertex colours are Tessellator bytes: float tint x shade, then (int) (c * 255.0f) / 255", async () => {
  const { Mesher } = await import("./chunk-mesher.js");
  const f = Math.fround, m = new Mesher();
  const square = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], uv = [[0, 0], [1, 0], [1, 1], [0, 1]];
  m.quad(square, uv, 0.8, 0); // face shade 0.8f
  m.tint(0x91bd59, false); // grass-like colour multiplier, raw (no Anaglyph)
  const mult = [0x91, 0xbd, 0x59].map((c) => f(c / 255)), want = mult.map((c) => f(Math.trunc(f(f(f(0.8) * c) * 255)) / 255));
  const got = m.colors();
  assert.deepEqual([...got.subarray(0, 3)], want);
  assert.notEqual(got[0], f(f(0.8) * mult[0]), "quantised, not the raw float product");
  assert.ok(Array.from(got).every((v) => Math.round(v * 255) === v * 255 || Math.abs(Math.round(f(v * 255)) - f(v * 255)) < 1e-4), "every channel is byte / 255");
  // 1.0 stays 1.0 and values above one clamp to a byte like Tessellator.setColorOpaque
  const w = new Mesher(); w.quad(square, uv, 1, 0); w.quad(square, uv, 1.4, 0);
  assert.equal(w.colors()[0], 1); assert.equal(w.colors()[12], 1);
});
