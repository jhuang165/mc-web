// Batch 95 mpperf95: the flat explosion position set reproduces java.util.HashSet<ChunkPosition> order exactly; explosionBlocks off / on / verify agree; bench hashes unchanged.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fast95, FlatPositionSet95 } from "./mpperf95-fast.js";
import { PositionSet, explosionBlocks } from "./explosion.js";
import { JavaRandom } from "./lighting.js";
import { lcg } from "./mpperf77-scene.js";

const withMode = (mode, fn) => { const was = fast95.mode; fast95.mode = mode; try { return fn(); } finally { fast95.mode = was; } };
const flatList = (adds) => { const s = FlatPositionSet95.acquire(); try { const r = adds.map(([x, y, z]) => s.add(x, y, z)); return { r, list: s.list(), size: s.size, tree: s.treeified }; } finally { s.release(); } };
const refList = (adds) => { const s = new PositionSet(); const r = adds.map(([x, y, z]) => s.add(x, y, z)); return { r, list: s.list(), size: s.size, tree: s.treeified }; };

test("flat set: same add results, size, order and treeified flag as PositionSet", () => {
  const rnd = lcg(7);
  const cases = [];
  for (const n of [1, 5, 13, 30, 100, 700, 3000, 9000]) {
    for (const span of [3, 8, 20, 40]) cases.push(Array.from({ length: n }, () => [Math.floor(rnd() * span) - span / 2 | 0, Math.floor(rnd() * span), Math.floor(rnd() * span) - 5]));
  }
  cases.push(Array.from({ length: 4000 }, (_, i) => [i * 7919, (i * 31) % 255, 0 - i - 1])); // far from the origin, negative z
  for (const adds of cases) assert.deepEqual(flatList(adds), refList(adds));
  // a dense cube (what explosions add) and colliding hashes: x moves by 981131, y by -8976890 keep the same hash
  const cube = []; for (let x = -9; x < 9; x++) for (let y = 0; y < 18; y++) for (let z = -9; z < 9; z++) cube.push([x, y, z]);
  assert.deepEqual(flatList(cube), refList(cube));
  const clash = Array.from({ length: 40 }, (_, i) => [i * 981131, 0 - i * 8976890 | 0, 0]);
  assert.deepEqual(flatList(clash), refList(clash));
  for (let n = 6; n <= 14; n++) { // the add that makes a bin 9 long in a small table resizes at that moment: the final table size shows in the order
    const some = [...Array.from({ length: n }, (_, i) => [i * 981131, 0 - i * 8976890 | 0, 0]), [1, 2, 3], [4, 5, 6], [7, 8, 9], [-3, 1, 2]];
    assert.deepEqual(flatList(some), refList(some));
  }
  assert.equal(refList(clash).tree, true, "the clash case does reach a 9-entry bin in a table of 64 or more");
});

test("flat set: nested acquire is refused until released", () => {
  const a = FlatPositionSet95.acquire();
  assert.equal(FlatPositionSet95.acquire(), null);
  a.release();
  const b = FlatPositionSet95.acquire(); assert.ok(b); b.release();
});

test("explosionBlocks: off = on = verify over sizes, terrain and a nested call", () => {
  const world = { get: (x, y, z) => (y < 4 ? 1 : (x * 3 + z * 5 + y) % 11 === 0 ? 4 : (x + z) % 7 === 0 && y < 7 ? 3 : 0) };
  const run = (mode, size, seed) => withMode(mode, () => { const r = new JavaRandom(seed); const l = explosionBlocks(world, 3, 5, -2, size, r, undefined); return JSON.stringify([l, l.treeified, r.nextInt(1000000)]); });
  const before = fast95.flat;
  for (const size of [1, 3, 4, 5, 7.5])
    for (const seed of [1, 99, 123456]) {
      const off = run("off", size, seed);
      assert.equal(run("on", size, seed), off);
      assert.equal(run("verify", size, seed), off);
    }
  assert.ok(fast95.flat > before, "the flat set was used");
  const held = FlatPositionSet95.acquire(); // an outer holder: the explosion falls back to the reference set
  try { const r = new JavaRandom(5); assert.equal(JSON.stringify(withMode("on", () => explosionBlocks(world, 0, 5, 0, 4, r))), JSON.stringify(withMode("off", () => explosionBlocks(world, 0, 5, 0, 4, new JavaRandom(5))))); } finally { held.release(); }
});

test("bench hashes are identical off / on / verify and the bench prints mode95", () => {
  const hashes = (mode, scene) => { const o = spawnSync(process.execPath, ["tools/bench-alloc81.mjs", `--scene=${scene}`, "--state", "--ticks=50", "--mobs=30"], { env: { ...process.env, MC_MPPERF95: mode }, encoding: "utf8" }).stdout; return o.slice(o.indexOf("[")); };
  for (const scene of ["pen", "travel"]) { const off = hashes("off", scene); assert.match(off, /^\["/); assert.equal(hashes("on", scene), off); assert.equal(hashes("verify", scene), off); }
  assert.match(spawnSync(process.execPath, ["tools/bench-alloc81.mjs", "--scene=pen", "--state", "--ticks=50", "--mobs=20"], { env: { ...process.env, MC_MPPERF95: "off" }, encoding: "utf8" }).stdout, /mode95=off/);
});
