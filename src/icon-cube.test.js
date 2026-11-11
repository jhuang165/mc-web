// The cube icon against tools/probes/IconEdgeProbe.java's reference (public/research/icon-edge-reference.json): matrix, covered pixels, texels.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cubeModelView, cubeFaces } from "./icon-cube.js";
import { rasterIcon, glFace } from "./atlas-texels.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/icon-edge-reference.json", import.meta.url), "utf8"));
// Each texel stores its own (u, v) so the raster tells which texel every covered pixel shows.
const tile = (() => { const t = new Uint8Array(16 * 16 * 4); for (let v = 0; v < 16; v++) for (let u = 0; u < 16; u++) t.set([u, v, 0, 255], (v * 16 + u) * 4); return t; })();
const fnv = (words) => { let h = 0xcbf29ce484222325n; for (const q of words) { h ^= BigInt(q); h = (h * 0x100000001b3n) & 0xffffffffffffffffn; } return h.toString(16); };

test("the cube model-view matrix matches the independent float32 composition", () => {
  const m = cubeModelView();
  for (let i = 0; i < 16; i++) assert.ok(Math.abs(m[i] - ref.matrix[i]) < 2e-6, `m[${i}] ${m[i]} vs ${ref.matrix[i]}`);
});

test("covered pixels and texels equal the reference for every scale and drop", () => {
  let mismatched = [];
  for (const r of ref.faces) {
    const S = r.scale, W = 16 * S, F = cubeFaces(S, r.drop), d = r.face === "top" ? 0 : r.drop;
    const out = rasterIcon(W, W, [{ tile, matrix: F[r.face], drop: d, gl: true }], 16);
    const words = []; let count = 0;
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) { const o = (y * W + x) * 4; if (out[o + 3]) { count++; words.push(x, y, out[o], out[o + 1]); } }
    if (count !== r.count || fnv(words) !== r.hash) mismatched.push(`${r.face} scale ${S} drop ${r.drop}: ${count} vs ${r.count}`);
  }
  assert.deepEqual(mismatched, [], `${mismatched.length} of ${ref.faces.length} differ`);
});

test("GL coverage is binary, uses full texel alpha and never double-covers a shared edge pixel", () => {
  const F = cubeFaces(4, 0), W = 64, owner = new Uint8Array(W * W);
  for (const k of ["west", "south", "top"]) {
    const out = rasterIcon(W, W, [{ tile, matrix: F[k], gl: true }], 16);
    for (let i = 0; i < W * W; i++) if (out[i * 4 + 3]) { assert.equal(out[i * 4 + 3], 255); owner[i]++; }
  }
  // the three faces tile the hexagon: overlaps would show as 2 (faces meet along edges)
  assert.equal(Math.max(...owner), 1);
  assert.ok(owner.reduce((s, v) => s + v, 0) > 2500);
});

test("the top-left rule gives a pixel centre on a shared edge to exactly one of two adjacent quads", () => {
  const left = glFace([1, 0, 0, 1, 0, 0], 16, 0), right = glFace([1, 0, 0, 1, 16, 0], 16, 0);
  assert.equal(left(16, 8), false); assert.equal(right(16, 8), true);
  assert.equal(left(0, 8), true);
  const top = glFace([1, 0, 0, 1, 0, 16], 16, 0), bottom = glFace([1, 0, 0, 1, 0, 0], 16, 0);
  assert.equal(bottom(8, 16), false); assert.equal(top(8, 16), true);
});
