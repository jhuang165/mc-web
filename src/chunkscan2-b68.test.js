// Batch 68 chunkscan2: the server's active chunk set keeps Java 8's treeified HashMap bins and the exact End origin, and farmland, crops and stems ride the random block ticks.
// active-chunks-reference.json is EXECUTED (tools/probes/ActiveChunksProbe.java, the real ChunkCoordIntPair in a real HashSet filled as ahb.C does; JDK 19).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { World, ICE } from './world.js';
import { Farming } from './farming.js';
import { Weather } from './weather.js';
import { JavaRandom } from './java-random.js';
import { JavaHashSetOrder } from './java-hashset-order.js';
import { chunkHash } from './chunk-store.js';
import { ChunkSet } from './multiplayer/server-chunks.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';

const ref = JSON.parse(readFileSync(new URL('../public/research/active-chunks-reference.json', import.meta.url), 'utf8'));
const pairs = flat => { const o = []; for (let i = 0; i < flat.length; i += 2) o.push([flat[i], flat[i + 1]]); return o; };
const ALL = ['one', 'negative', 'two', 'far', 'shrink', 'small', 'cluster', 'crowd', 'negcluster', 'radius7', 'long'];

test('every executed case replays exactly, overlapping players and treeified bins included', () => {
  for (const name of ALL) {
    const c = ref[name], set = new ChunkSet();
    for (const t of c.ticks) assert.deepEqual(set.order(t.players, c.radius), pairs(t.order), `${name}: ${JSON.stringify(t.players)}`);
  }
});

test('the overlapping cases really reach treeified bins (9 or more nodes at 64+ buckets)', () => {
  let trees = 0;
  for (const name of ['two', 'cluster']) {
    const c = ref[name], set = new ChunkSet();
    set.order(c.ticks[0].players, c.radius);
    trees += set.treeBins;
  }
  assert.ok(trees >= 2, `tree bins ${trees}`);
  // and a table under 64 buckets doubles instead (treeifyBin)
  const small = new JavaHashSetOrder();
  for (let i = 0; i < 9; i++) small.add(i, i * 16 + 0); // ids that agree modulo 16: nine in one bucket
  assert.equal(small.capacity, 32);
  assert.equal(small.table.filter(b => b.tree).length, 0);
});

test('a tree bin puts the root first', () => {
  const set = new JavaHashSetOrder();
  for (let i = 0; i < 64; i++) set.add(`pad${i}`, i * 1000003); // grow the table to 128 first
  const cap = set.capacity, spread = h => (h ^ (h >>> 16)) | 0, same = [];
  for (let h = 0; same.length < 10; h++) if ((spread(h << 3) & (cap - 1)) === 3) same.push(h << 3);
  for (const id of same) set.add(`k${id}`, id);
  const bin = set.table.find(b => b.tree);
  assert.ok(bin, 'a treeified bin');
  assert.equal(bin[0].parent, null, 'the root leads the chain');
  assert.ok(bin.length >= 10);
});

test('legacy and full End windows give the exact native set', () => {
  const c = ref.one, native = pairs(c.ticks[0].order);
  for (const [ox, oz, size] of [[-25, -96, 128], [-128, -128, 256]]) {
    const world = { size, originX: ox, originZ: oz };
    const p = { x: 4 * 16 + 8 - ox, z: 4 * 16 + 8 - oz }; // local position of the player in native chunk (4, 4)
    const got = new ChunkSet().chunks([p], world, 10);
    const want = [];
    for (const [nx, nz] of native) {
      const lx = nx * 16 - ox, lz = nz * 16 - oz;
      if (lx + 15 < 0 || lz + 15 < 0 || lx >= size || lz >= size) continue;
      const cx = Math.floor(lx / 16), cz = Math.floor(lz / 16);
      want.push(lx - cx * 16 || lz - cz * 16 ? [cx, cz, lx - cx * 16, lz - cz * 16] : [cx, cz]);
    }
    assert.deepEqual(got, want, `window ${size}`);
  }
  // the legacy window's native chunk (-2, 0) is cells -7..8: it straddles local chunks -1 and 0 (dx 9)
  const legacy = new ChunkSet().chunks([{ x: 25.5, z: 96.5 }], { size: 128, originX: -25, originZ: -96 }, 1);
  assert.deepEqual(legacy.map(e => e.join()).sort(), ['0,5,9,0', '0,6,9,0', '0,7,9,0', '1,5,9,0', '1,6,9,0', '1,7,9,0', '2,5,9,0', '2,6,9,0', '2,7,9,0']);
  assert.ok(legacy.every(e => e.length === 4 && e[2] === 9 && e[3] === 0));
  assert.equal(legacy.length, 9);
  // full window: native chunk 0 is local chunk 8, nothing off the grid
  const full = new ChunkSet().chunks([{ x: 128.5, z: 128.5 }], { size: 256, originX: -128, originZ: -128 }, 1);
  assert.ok(full.every(e => e.length === 2));
  assert.deepEqual(full.map(e => e.join()).sort(), ['7,7', '7,8', '7,9', '8,7', '8,8', '8,9', '9,7', '9,8', '9,9']);
});

test('the hash order uses native chunk coordinates in the legacy End (not local ones shifted by floor(origin / 16))', () => {
  const want = new ChunkSet().order([[0, 0]], 2).map(([x, z]) => `${x * 16 + 25},${z * 16 + 96}`);
  const got = new ChunkSet().chunks([{ x: 25.5, z: 96.5 }], { size: 512, originX: -25, originZ: -96 }, 2).map(([cx, cz, dx = 0, dz = 0]) => `${cx * 16 + dx},${cz * 16 + dz}`);
  assert.deepEqual(got, want);
});

test('Weather.tickChunk draws the cells of a straddling native chunk from its offset', () => {
  const world = new World('chunkscan2-offset');
  for (let x = 0; x < 48; x++) for (let z = 0; z < 48; z++) for (let y = 0; y < 16; y++) world.set(x, y, z, ICE);
  const w = new Weather(), seen = [];
  w.blockTick = (x, y, z) => { seen.push([x, y, z]); return true; };
  w.lcg = 12345; w.random = new JavaRandom(7);
  let lcg = w.lcg; const twin = new JavaRandom(7), want = [];
  twin.nextInt(100000); // rollLightningChunk's draw (it is not raining)
  if (twin.nextInt(16) === 0) lcg = (Math.imul(lcg, 3) + 1013904223) | 0; // the ice and snow roll
  for (let n = 0; n < 3; n++) { // section 0 is the only one with a randomly ticking block
    lcg = (Math.imul(lcg, 3) + 1013904223) | 0;
    const j = lcg >> 2, y = (j >> 16) & 15;
    want.push([9 + (j & 15), y, 16 + ((j >> 8) & 15)]);
  }
  w.tickChunk(world, 0, 1, 9, 0);
  assert.deepEqual(seen, want);
  assert.equal(want.length, 3);
  assert.ok(want.every(([x, , z]) => x >= 9 && x < 25 && z >= 16 && z < 32));
});

test('Farming.randomTick: farmland dries, a crop grows on nextInt 0, and the shared route skips the own scan', () => {
  const world = new World('chunkscan2-farm');
  world.set(10, 20, 10, 30); world.set(10, 21, 10, 31);
  const farming = new Farming(world);
  farming.lightLevel = () => 15; farming.rained = () => false; farming.random = { nextInt: () => 0 };
  farming.observe(10, 20, 10);
  assert.equal(farming.randomTick(10, 20, 10, 30), true);
  assert.equal(farming.fields.get('10,20,10'), 6, 'one step drier');
  assert.equal(farming.randomTick(10, 21, 10, 31), true);
  assert.equal(world.get(10, 21, 10), 32, 'wheat aged by one (nextInt 0 passes the 1-in-n roll)');
  assert.equal(farming.randomTick(5, 5, 5, 1), false, 'stone is not a farm block');
  // the hash scan runs only without sharedRandomTicks
  world.set(20, 20, 20, 29); farming.observe(20, 20, 20);
  farming.sharedRandomTicks = true;
  for (let t = 0; t < 80000; t++) farming.tick(t, 1);
  assert.equal(world.get(20, 20, 20), 29, 'tick() no longer scans');
  farming.sharedRandomTicks = false;
  for (let t = 0; t < 80000; t++) farming.tick(t, 1);
  assert.equal(world.get(20, 20, 20), 2, 'the single-player scan still dries it');
});

test('the dedicated server ticks farmland only inside the active chunks', () => {
  const world = new World('chunkscan2-server');
  world.spawn = () => ({ x: 8.5, y: 10, z: 8.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: 'survival', mobs: true });
  s.mobs.spawning = false; s.mobs.mobs.entities.length = 0;
  assert.equal(s.farming.sharedRandomTicks, true);
  world.set(9, 30, 9, 29); s.farming.observe(9, 30, 9);
  world.set(120, 30, 120, 29); s.farming.observe(120, 30, 120);
  s.chunkSets.radius = 2;
  const p = s.addPlayer('a', 'ax', '00000000-0000-0000-0000-000000000001'); p.position.copy({ x: 8.5, y: 40, z: 8.5 }); p.previous.copy(p.position);
  s.weather.lcg = 424242;
  const asked = [], hook = s.weather.blockTick;
  s.weather.blockTick = (x, y, z, b) => { if (b === 29) asked.push([x, z]); return hook(x, y, z, b); };
  for (let t = 0; t < 12000; t++) s.weather.tickChunks(world, s.chunkSets.chunks(0, world));
  assert.ok(asked.length > 0 && asked.every(([x, z]) => x < 48 && z < 48), 'only the near field is asked');
  assert.equal(world.get(9, 30, 9), 2, 'the near farmland dried to dirt on a random tick');
  assert.equal(world.get(120, 30, 120), 29, 'the far one never ticked');
});
