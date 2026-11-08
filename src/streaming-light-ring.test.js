import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from './world.js';
import { DimensionWorld } from './dimension-world.js';
import { lightEmission } from './lighting.js';
import { StreamingLight } from './streaming-light.js';

// Batch 27: edits the native light refused near the window ring (replayed once their columns are light-resident), edits written with no
// updateBlock call (the world's block tap), the 64-cell chunk resend, and the Nether / End on the native engine.
const emission = (x, y, z, b) => lightEmission(b);
const world = () => { const w = new World('17', 'javaStreamed', 12); w.blockLight = () => 0; return w; };
const top = (w, x, z) => { let y = 255; while (y > 0 && !w.get(x, y, z)) y--; return y + 1; };
const TORCH = 20;

test('a torch near the window edge gets its light once a shift makes the neighbourhood resident (the refused update is replayed)', () => {
  const w = world(), L = new StreamingLight(w, emission, { native: true });
  const x = w.minX + 20, z = w.minZ + 64, y = top(w, x, z) + 1; // chunk 1: its 17-block reach crosses the unloaded ring
  w.set(x, y, z, TORCH); L.update(x, y, z, 0); L.tick();
  assert.equal(L.blockAt(x, y, z), 0, 'refused while the ring column is not resident');
  assert.ok(w.streamAround(64 - 16, 64)); // the window moves one chunk towards -x: the torch is now in chunk 2
  L.shift();
  assert.equal(L.blockAt(x, y, z), 14);
  assert.equal(L.blockAt(x + 1, y, z), 13);
  assert.equal(L.blockAt(x - 3, y, z), 11);
  assert.ok(L.native.stats.replayed > 0);
});

test('a torch in a ring column that becomes resident builds its mesh light: the edit is in the world and in the light', () => {
  const w = world(), L = new StreamingLight(w, emission, { native: true });
  const x = w.minX - 40, z = w.minZ + 64, y = 70; // outside the window: journalled like a ring edit
  w.rememberEdit(x, y, z, TORCH);
  assert.ok(w.streamAround(64 - 48, 64)); // the window moves three chunks towards -x, so x is resident again
  L.shift();
  assert.equal(w.get(x, y, z), TORCH);
  L.tick();
  assert.equal(L.blockAt(x, y, z), 14, 'torch light exists in the resident column');
});

test('world.set with no updateBlock still lights: the block tap marks the cell and the id shadow follows', () => {
  const w = world(), L = new StreamingLight(w, emission, { native: true });
  const x = w.minX + 64 + 3, z = w.minZ + 64 + 5, y = top(w, x, z);
  w.set(x, y, z, TORCH); // no L.update
  L.tick();
  assert.equal(L.blockAt(x, y, z), 14);
  assert.equal(L.ids[((x - L.x) * 128 + (z - L.z)) * w.height + y], TORCH, 'shadow follows the world');
  w.set(x, y, z, 0); L.tick();
  assert.equal(L.blockAt(x, y, z), 0);
  assert.equal(L.ids[((x - L.x) * 128 + (z - L.z)) * w.height + y], 0);
});

test('64 distinct changed cells in one chunk (one tick) make the chunk resend: relight checks reset', () => {
  const run = (n) => {
    const w = world(), L = new StreamingLight(w, emission, { native: true });
    const x0 = w.minX + 64 + 2, z0 = w.minZ + 64 + 2, y = top(w, x0, z0) + 12;
    for (let i = 0; i < n; i++) w.set(x0 + (i & 7), y, z0 + (i >> 3), 1);
    for (let i = 0; i < 70; i++) w.set(x0, y, z0, i & 1 ? 1 : 0); // repeats of a cell are not distinct
    L.tick();
    return L.resends;
  };
  assert.equal(run(63), 0);
  assert.equal(run(64), 1);
});

const floor = (w, x, z) => { for (let y = 40; y < 100; y++) if (!w.get(x, y, z) && w.get(x, y - 1, z)) return y; return -1; };
for (const dim of [-1, 1]) {
  test(`dimension ${dim} runs on NativeLight with the native hasNoSky: block light follows torches, sky stays 0 in built sections`, () => {
    const w = new DimensionWorld('12345', dim);
    assert.ok(w.streamAround(dim === 1 ? 100 : 0, 0));
    assert.equal(w.hasNoSky, true);
    const L = new StreamingLight(w, emission, { native: true });
    assert.ok(L.native && L.noSky);
    const px = w.minX + 64 + 3, pz = w.minZ + 64 + 5;
    let y = -1, x = px;
    for (let dx = 0; dx < 40 && y < 0; dx++) { x = px + dx; y = floor(w, x, pz); }
    assert.ok(y > 0, 'a floor cell exists');
    const base = L.blockAt(x, y, pz); // lava or glowstone may already light the cell
    w.set(x, y, pz, TORCH); L.update(x, y, pz, 0); L.tick();
    assert.equal(L.blockAt(x, y, pz), 14);
    assert.equal(L.skyAt(x, y - 1, pz), 0);
    w.set(x, y, pz, 0); L.update(x, y, pz, TORCH); L.tick();
    assert.equal(L.blockAt(x, y, pz), base);
  });
}

test('the nativeLight fallback keeps the fixed-point volume for the Nether and builds no native state', () => {
  const w = new DimensionWorld('12345', -1);
  w.streamAround(0, 0);
  const L = new StreamingLight(w, emission, { native: false });
  assert.equal(L.native, null);
  assert.equal(w.blockTap, null);
  const px = w.minX + 64 + 3, pz = w.minZ + 64 + 5, y = floor(w, px, pz);
  w.set(px, y, pz, TORCH); L.update(px, y, pz, 0); L.tick();
  assert.equal(L.blockAt(px, y, pz), 14);
});
