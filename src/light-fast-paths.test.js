import test from 'node:test';
import assert from 'node:assert/strict';
import { LightVolume, lightEmission } from './lighting.js';
import { SIZE } from './world.js';

// LightVolume reads a world with columnBlocks a column at a time: the air above a column's top block is filled at once, column()
// scans the column's array, and the change box compares four cells at a time. A world without columnBlocks takes the per-cell
// world.get path. Both must give the same light, heights and change boxes, and the box must be exactly the cells that changed.
const H = 48;
function makeWorld(seed, columns) {
  let s = seed >>> 0;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const blocks = new Uint8Array(SIZE * SIZE * H);
  for (let x = 0; x < SIZE; x++) for (let z = 0; z < SIZE; z++) {
    const top = 12 + Math.floor(8 * Math.sin(x / 9) + 6 * Math.cos(z / 7) + rnd() * 3), base = (x * SIZE + z) * H;
    for (let y = 0; y < top; y++) blocks[base + y] = y === top - 1 ? 2 : rnd() < 0.08 ? 0 : 1; // stone with pockets, grass on top
    if (rnd() < 0.01) blocks[base + top] = 50; // torches on the surface
    if (rnd() < 0.006) for (let y = top; y < top + 6; y++) blocks[base + y] = y > top + 3 ? 18 : 17; // trees: logs under leaves
    if (rnd() < 0.004) blocks[base + top + 10] = 89; // floating glowstone
    if (rnd() < 0.003) blocks[base + H - 1] = 20; // glass at the build limit
  }
  const world = { height: H, blocks, get: (x, y, z) => (x < 0 || z < 0 || x >= SIZE || z >= SIZE || y < 0 || y >= H ? 0 : blocks[(x * SIZE + z) * H + y]) };
  if (columns) world.columnBlocks = (x, z) => (x < 0 || z < 0 || x >= SIZE || z >= SIZE ? null : blocks.subarray((x * SIZE + z) * H, (x * SIZE + z + 1) * H));
  return world;
}
const emission = (x, y, z, b) => lightEmission(b);
const same = (a, b, label) => {
  assert.ok(Buffer.from(a.sky).equals(Buffer.from(b.sky)), `${label}: sky`);
  assert.ok(Buffer.from(a.block).equals(Buffer.from(b.block)), `${label}: block`);
  assert.deepEqual([...a.heights], [...b.heights], `${label}: heights`);
};
// The box of cells whose sky or block light differs between two snapshots, scanned cell by cell.
function diffBox(beforeSky, beforeBlock, v) {
  let box = null;
  for (let x = 0; x < SIZE; x++) for (let z = 0; z < SIZE; z++) for (let y = 0; y < H; y++) {
    const i = (x * SIZE + z) * H + y;
    if (beforeSky[i] === v.sky[i] && beforeBlock[i] === v.block[i]) continue;
    if (!box) box = { x0: x, x1: x, y0: y, y1: y, z0: z, z1: z };
    else { box.x1 = x; box.z0 = Math.min(box.z0, z); box.z1 = Math.max(box.z1, z); box.y0 = Math.min(box.y0, y); box.y1 = Math.max(box.y1, y); }
  }
  return box;
}

test('column-array light equals the per-cell world.get light through builds, edits and relights', () => {
  for (const seed of [1, 7, 42]) {
    const wa = makeWorld(seed, true), wb = makeWorld(seed, false), a = new LightVolume(wa, emission), b = new LightVolume(wb, emission);
    same(a, b, `seed ${seed} build`);
    let s = seed * 977;
    const rnd = (n) => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) % n);
    for (let e = 0; e < 40; e++) {
      const x = rnd(SIZE), z = rnd(SIZE), y = rnd(H), id = [0, 0, 1, 50, 89, 20, 18][rnd(7)];
      wa.blocks[(x * SIZE + z) * H + y] = wb.blocks[(x * SIZE + z) * H + y] = id;
      const sky = a.sky.slice(), block = a.block.slice(), boxA = a.update(x, y, z), boxB = b.update(x, y, z);
      assert.deepEqual(boxA, boxB, `seed ${seed} edit ${e}: box`);
      assert.deepEqual(boxA, diffBox(sky, block, a), `seed ${seed} edit ${e}: box is the changed cells`);
      same(a, b, `seed ${seed} edit ${e}`);
    }
    // A strip relight over cleared light (what a window shift leaves in its new columns) refills the same values.
    a.sky.fill(0, 100 * SIZE * H); a.block.fill(0, 100 * SIZE * H); b.sky.fill(0, 100 * SIZE * H); b.block.fill(0, 100 * SIZE * H);
    for (let x = 100; x < SIZE; x++) for (let z = 0; z < SIZE; z++) { a.column(x, z); b.column(x, z); }
    const sky = a.sky.slice(), block = a.block.slice(), boxA = a.relight(85, SIZE - 1, 0, SIZE - 1), boxB = b.relight(85, SIZE - 1, 0, SIZE - 1);
    assert.deepEqual(boxA, boxB, `seed ${seed} strip: box`);
    assert.deepEqual(boxA, diffBox(sky, block, a), `seed ${seed} strip: box is the changed cells`);
    same(a, b, `seed ${seed} strip`);
  }
});

test('an unaligned light array takes the per-cell change scan and gives the same box', () => {
  const wa = makeWorld(5, true), a = new LightVolume(wa, emission), b = new LightVolume(makeWorld(5, true), emission);
  const shifted = (arr) => { const buf = new Uint8Array(arr.length + 1); buf.set(arr, 1); return buf.subarray(1); }; // byteOffset 1
  b.sky = shifted(b.sky); b.block = shifted(b.block);
  for (const v of [a, b]) { v.world.blocks[(64 * SIZE + 64) * H + 30] = 89; }
  assert.deepEqual(a.update(64, 30, 64), b.update(64, 30, 64));
  same(a, b, 'unaligned');
});
