// Batch 32: LightVolume.relightSteps got faster (air above a column filled in one call, word-wise column compare, shift/mask cell index).
// The light it leaves and the changed box it returns must be what a plain cell-by-cell compare and a fresh build give.
import test from "node:test";
import assert from "node:assert/strict";
import { LightVolume } from "./lighting.js";
import { SIZE } from "./world.js";

const H = 256;
let seed = 11;
const rnd = () => (seed = (Math.imul(seed, 1664525) + 1013904223) | 0) >>> 0;
const makeWorld = () => {
  const cols = new Map();
  for (let x = 0; x < SIZE; x++) for (let z = 0; z < SIZE; z++) {
    if (rnd() % 97 === 0) continue; // a missing column reads as air
    const c = new Uint8Array(H), top = 40 + (rnd() % 60);
    c.fill(1, 0, top);
    if (rnd() % 7 === 0) c[top + (rnd() % 5)] = [50, 8, 18, 89, 1][rnd() % 5]; // torch, water, leaves, glowstone, stone
    if (rnd() % 11 === 0) c.fill(0, 20, 30);
    if (rnd() % 400 === 0) c[200] = 1;
    cols.set(x * SIZE + z, c);
  }
  return { height: H, hasNoSky: false, columnBlocks: (x, z) => cols.get(x * SIZE + z) ?? null, get: (x, y, z) => cols.get(x * SIZE + z)?.[y] ?? 0 };
};
const boxOf = (v, sky, block, x0, x1, z0, z1) => {
  let box = null;
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) for (let y = 0; y < H; y++) {
    const i = (x * SIZE + z) * H + y;
    if (v.sky[i] === sky[i] && v.block[i] === block[i]) continue;
    if (!box) box = { x0: x, x1: x, y0: y, y1: y, z0: z, z1: z };
    else { box.x1 = x; box.z0 = Math.min(box.z0, z); box.z1 = Math.max(box.z1, z); box.y0 = Math.min(box.y0, y); box.y1 = Math.max(box.y1, y); }
  }
  return box;
};

test("relight returns the exact changed box and leaves the light of a fresh build", () => {
  const w = makeWorld(), v = new LightVolume(w);
  let nonNull = 0;
  for (let r = 0; r < 8; r++) {
    const x0 = rnd() % (SIZE - 40), z0 = rnd() % (SIZE - 40), x1 = x0 + 15 + (rnd() % 25), z1 = z0 + 15 + (rnd() % 25);
    for (let i = 0; i < 20; i++) { const x = x0 + 8 + (rnd() % (x1 - x0 - 16)), z = z0 + 8 + (rnd() % (z1 - z0 - 16)), y = 30 + (rnd() % 60), c = w.columnBlocks(x, z); if (c) c[y] = [0, 1, 50, 8][rnd() % 4]; }
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) v.column(x, z);
    const sky = v.sky.slice(), block = v.block.slice();
    const box = v.relight(x0, x1, z0, z1);
    assert.deepEqual(box, boxOf(v, sky, block, x0, x1, z0, z1), `round ${r}: box`);
    if (box) nonNull++;
    // Light cannot travel 15 blocks, so the relit area and 15 more on each side must equal a fresh build there.
    const fresh = new LightVolume(w);
    for (let x = Math.max(0, x0 - 14); x <= Math.min(SIZE - 1, x1 + 14); x++) for (let z = Math.max(0, z0 - 14); z <= Math.min(SIZE - 1, z1 + 14); z++) {
      const a = (x * SIZE + z) * H, b = a + H;
      assert.ok(Buffer.from(v.sky.subarray(a, b)).equals(Buffer.from(fresh.sky.subarray(a, b))) && Buffer.from(v.block.subarray(a, b)).equals(Buffer.from(fresh.block.subarray(a, b))), `round ${r}: column ${x},${z}`);
    }
    // Keep the volume a fixed point everywhere for the next round (the edits sit away from the box edge, but later boxes overlap).
    v.sky.set(fresh.sky); v.block.set(fresh.block); v.heights.set(fresh.heights);
  }
  assert.ok(nonNull >= 4, `${nonNull} rounds changed light`);
});
