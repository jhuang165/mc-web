import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from './world.js';
import { lightEmission } from './lighting.js';
import { StreamingLight, nativeLightEnabled, NATIVE_LIGHT_DEFAULT } from './streaming-light.js';

// The native Overworld path (StreamingLight with native: true) against the fixed-point path and against a freshly built native volume.
const emission = (x, y, z, b) => lightEmission(b);
const world = () => { const w = new World('17', 'javaStreamed', 12); w.blockLight = () => 0; return w; };
const eq = (a, b, label) => {
  assert.ok(Buffer.from(a.inner.sky).equals(Buffer.from(b.inner.sky)), `${label}: sky`);
  assert.ok(Buffer.from(a.inner.block).equals(Buffer.from(b.inner.block)), `${label}: block`);
  assert.deepEqual([...a.inner.heights], [...b.inner.heights], `${label}: heights`);
};
const top = (w, x, z) => { let y = 255; while (y > 0 && !w.get(x, y, z)) y--; return y + 1; };
// Cells that only a chunk's missing sections can differ in are not compared: every test edits columns far from them.
const near = (w) => { const x = w.minX + 64 + 3, z = w.minZ + 64 + 5; return [x, top(w, x, z), z]; };

test('the native switch is on by default and can be overridden from the page or localStorage', () => {
  assert.equal(NATIVE_LIGHT_DEFAULT, true);
  assert.equal(nativeLightEnabled(), true);
  globalThis.location = { search: '?nativeLight=0' };
  assert.equal(nativeLightEnabled(), false);
  globalThis.location = { search: '?nativeLight=1' };
  assert.equal(nativeLightEnabled(), true);
  delete globalThis.location;
});

test('native state starts consistent: ring unloaded, sections from the blocks, missing-section rule in the arrays', () => {
  const w = world(), L = new StreamingLight(w, emission, { native: true }), n = L.native;
  assert.ok(n);
  for (let a = 0; a < 8; a++) for (let b = 0; b < 8; b++) assert.equal(n.loaded[a * 8 + b], a > 0 && b > 0 && a < 7 && b < 7 ? 1 : 0);
  for (let c = 0; c < 64; c++) {
    assert.equal(n.mask[c] & 1, 1, 'bedrock section exists');
    assert.equal(n.mask[c] >> 12, 0, 'no blocks high above the terrain');
    assert.equal(n.queued[c], 4096);
  }
  // heights and hmMin agree with the columns
  for (let c = 0; c < 64; c++) {
    let m = Infinity;
    for (let x = (c >> 3) * 16; x < (c >> 3) * 16 + 16; x++) for (let z = (c & 7) * 16; z < (c & 7) * 16 + 16; z++) m = Math.min(m, n.heights[x * 128 + z]);
    assert.equal(n.hmMin[c], m);
  }
  // an air-only section reads sky 15 above the heightMap (arrays follow the rule)
  const h = n.heights[64 * 128 + 64];
  assert.equal(L.skyAt(w.minX + 64, 250, w.minZ + 64), 15);
  assert.ok(h > 0);
});

test('placing and removing a torch and a roof in the central chunks matches the fixed-point volume', () => {
  const w = world(), L = new StreamingLight(w, emission, { native: true });
  const [x, y, z] = near(w);
  const place = (px, py, pz, b) => { const old = w.get(px, py, pz); w.set(px, py, pz, b); L.update(px, py, pz, old); L.tick(); };
  place(x, y, z, 20);
  assert.equal(L.blockAt(x, y, z), 14, 'torch block light 14');
  place(x, y + 4, z, 1);
  place(x + 1, y + 4, z, 1);
  place(x, y, z, 0);
  for (let i = 0; i < 3; i++) L.tick();
  eq(L, new StreamingLight(w, emission), 'after edits');
});

// A first block in an empty section regenerates the column map and, as in 1.7.10, leaves the cells below it unlit (the dark pit);
// the test pins that native difference from the fixed-point volume.
test('a first block in an empty section leaves the old column light stale like 1.7.10', () => {
  const w = world(), L = new StreamingLight(w, emission, { native: true });
  const [x, y, z] = near(w);
  assert.equal(y % 16, 15, 'terrain top sits under an empty section');
  const old = w.get(x, y + 5, z); w.set(x, y + 5, z, 1); L.update(x, y + 5, z, old);
  for (let i = 0; i < 4; i++) L.tick();
  assert.equal(L.skyAt(x, y + 2, z), 0, 'new section starts dark');
  assert.equal(L.skyAt(x, y, z), 15, 'the old cell below keeps its stale value');
  assert.notEqual(L.skyAt(x, y + 2, z), new StreamingLight(w, emission).skyAt(x, y + 2, z));
});

test('digging a shaft of the roof updates sky light through the tick gap recheck', () => {
  const w = world(), L = new StreamingLight(w, emission, { native: true });
  const [x, y, z] = near(w);
  for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) { const old = w.get(x + dx, y + 6, z + dz); w.set(x + dx, y + 6, z + dz, 1); L.update(x + dx, y + 6, z + dz, old); L.tick(); }
  for (let i = 0; i < 4; i++) L.tick();
  eq(L, new StreamingLight(w, emission), 'roof');
  const old = w.get(x, y + 6, z); w.set(x, y + 6, z, 0); L.update(x, y + 6, z, old);
  for (let i = 0; i < 4; i++) L.tick();
  eq(L, new StreamingLight(w, emission), 'hole');
});

test('an edit within 17 blocks of the resident-square edge is skipped like an unloaded neighbour', () => {
  const w = world(), L = new StreamingLight(w, emission, { native: true });
  const x = w.minX + 20, z = w.minZ + 64, y = top(w, x, z) + 1; // chunk 1: its reach crosses the unloaded ring
  w.set(x, y, z, 20);
  L.update(x, y, z, 0);
  assert.equal(L.blockAt(x, y, z), 0, 'no block light was spread');
  assert.equal(L.native.stats.updates, 0);
});

test('shifting keeps native per-chunk state equal to a fresh build along each axis and after long jumps', () => {
  const w = world(), L = new StreamingLight(w, emission, { native: true });
  const [x, y, z] = near(w);
  for (const [dy, b] of [[-3, 0], [-4, 20], [-2, 0]]) { const old = w.get(x, y + dy, z); w.set(x, y + dy, z, b); L.update(x, y + dy, z, old); L.tick(); }
  L.tick(); L.tick();
  for (const [px, pz] of [[64 + 16, 64], [64 + 16, 64 + 16], [64 - 32, 64 + 16], [64 + 200, 64 + 200]]) {
    assert.ok(w.streamAround(px, pz));
    L.shift();
    const F = new StreamingLight(w, emission, { native: true });
    eq(L, F, `${px},${pz}`);
    const a = L.native, b = F.native;
    assert.deepEqual([...a.mask], [...b.mask], 'mask');
    assert.deepEqual([...a.hmMin], [...b.hmMin], 'hmMin');
    assert.deepEqual([...a.loaded], [...b.loaded], 'loaded');
    assert.ok(Buffer.from(L.ids).equals(Buffer.from(F.ids)), 'id shadow');
    assert.ok(a.sky === L.inner.sky && a.block === L.inner.block && a.heights === L.inner.heights, 'arrays rebound');
  }
});

test('a deferred build runs its native steps at the end', () => {
  const w = world(), L = new StreamingLight(w, emission, { native: true, defer: true });
  assert.equal(L.native, null);
  const g = L.buildSteps(); let r; while (!(r = g.next()).done);
  assert.ok(L.native);
  eq(L, new StreamingLight(w, emission, { native: true }), 'deferred');
});
