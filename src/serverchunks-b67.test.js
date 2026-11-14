// Batch 67 serverchunks: the dedicated server ticks only the chunks around its players (World.activeChunkSet), in native HashSet order.
// active-chunks-reference.json is EXECUTED (tools/probes/ActiveChunksProbe.java: the real ChunkCoordIntPair in a real HashSet filled as ahb.C does).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { World } from './world.js';
import { chunkHash } from './chunk-store.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { ChunkSet, ServerChunkSets, VIEW_DISTANCE } from './multiplayer/server-chunks.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';

const ref = JSON.parse(readFileSync(new URL('../public/research/active-chunks-reference.json', import.meta.url), 'utf8'));
const pairs = flat => { const o = []; for (let i = 0; i < flat.length; i += 2) o.push([flat[i], flat[i + 1]]); return o; };
const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const input = () => ({ type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
const fixture = () => {
  const world = new World('serverchunks-b67');
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: 'survival', mobs: true });
  s.mobs.spawning = false; s.mobs.mobs.entities.length = 0;
  return s;
};
const join = (s, id, n, x, z, y = 10) => { const p = s.addPlayer(id, id + 'x', key(n)); p.position.copy({ x, y, z }); p.previous.copy(p.position); s.input(id, input()); return p; };

const bucketOf = (x, z, cap) => { const h = chunkHash(x, z); return (h ^ (h >>> 16)) & (cap - 1); };
test('the set order replays the executed HashSet: one player, negative chunks, far players, and a table kept across clear()', () => {
  assert.equal(ref.one.radius, 10);
  for (const name of ['one', 'negative', 'far', 'shrink', 'small']) {
    const c = ref[name], set = new ChunkSet();
    for (const t of c.ticks) assert.deepEqual(set.order(t.players, c.radius), pairs(t.order), `${name}: ${JSON.stringify(t.players)}`);
  }
});

test('overlapping players: the bucket sequence and every bucket\'s members match the executed HashSet; only the order inside a treeified bin (9 or more nodes) is not modelled', () => {
  const c = ref.two, set = new ChunkSet();
  for (const t of c.ticks) {
    const mine = set.order(t.players, c.radius), want = pairs(t.order), cap = set.capacity;
    assert.equal(mine.length, want.length);
    assert.deepEqual(mine.map(([x, z]) => bucketOf(x, z, cap)), want.map(([x, z]) => bucketOf(x, z, cap)));
    const bins = new Map();
    want.forEach(([x, z], i) => { const b = bucketOf(x, z, cap); (bins.get(b) ?? bins.set(b, []).get(b)).push(`${x},${z}`); });
    let at = 0, differing = 0;
    for (const [, members] of bins) {
      const got = mine.slice(at, at + members.length).map(String);
      if (got.join('|') !== members.join('|')) { differing++; assert.ok(members.length >= 9, 'only a treeified bin may differ'); assert.deepEqual([...got].sort(), [...members].sort()); }
      at += members.length;
    }
    assert.ok(differing <= 10);
  }
});

test('the server radius is the view distance (10), not the 7 of other versions', () => {
  assert.equal(VIEW_DISTANCE, 10);
  assert.equal(new ServerChunkSets({ players: new Map() }).radius, 10);
});

test('chunks outside the finite window are skipped, the rest keep their native order', () => {
  const set = new ChunkSet(), full = new ChunkSet().order([[0, 0]], 3), clipped = set.chunks([{ x: 8, z: 8 }], { size: 128 }, 3);
  assert.deepEqual(clipped, full.filter(([x, z]) => x >= 0 && z >= 0 && x < 8 && z < 8));
  assert.equal(clipped.length, 16); // chunks 0..3 square
  const end = new ChunkSet().chunks([{ x: 5, z: 5 }], { size: 256, originX: -128, originZ: -128 }, 10);
  assert.equal(end.length, 11 * 11); // the corner player of a 16 x 16 chunk window
  assert.equal(new ChunkSet().chunks([], { size: 128 }).length, 0);
});

test('a chunk beyond every player radius gets no random ticks; each dimension uses its own players', () => {
  const players = new Map([
    ['a', { dimension: 0, position: { x: 8, z: 8 } }],
    ['b', { dimension: 0, position: { x: 250, z: 250 } }],
    ['n', { dimension: -1, position: { x: 100, z: 100 } }],
  ]);
  const sets = new ServerChunkSets({ players }, 2), world = { size: 512 };
  const over = sets.chunks(0, world).map(c => c.join()).sort(), expect = [];
  for (const [cx, cz] of [[0, 0], [15, 15]]) for (let x = cx - 2; x <= cx + 2; x++) for (let z = cz - 2; z <= cz + 2; z++) if (x >= 0 && z >= 0) expect.push(`${x},${z}`);
  assert.deepEqual(over, [...new Set(expect)].sort());
  assert.ok(!over.includes('8,8'), 'the middle chunk is outside both radii');
  const nether = sets.chunks(-1, world);
  assert.equal(nether.length, 25);
  assert.ok(nether.some(([x, z]) => x === 6 && z === 6));
  assert.equal(sets.chunks(1, world).length, 0, 'nobody in the End');
});

test('the server tick rolls lightning and random ticks per active chunk: none with nobody joined, one square per player after', () => {
  const s = fixture(), w = s.weather, seen = [], tick = w.tickChunk.bind(w);
  w.tickChunk = (world, cx, cz) => { seen.push([cx, cz]); return tick(world, cx, cz); };
  s.tick();
  assert.equal(seen.length, 0, 'an empty server ticks no chunk');
  join(s, 'a', 1, 64.5, 64.5);
  seen.length = 0; s.tick();
  assert.equal(seen.length, 64); // radius 10 covers the whole 8 x 8 chunk window
  assert.deepEqual(seen.map(c => c.join()), s.chunkSets.chunks(0, s.world).map(c => c.join()));
  // the lightning draw (nextInt(100000)) happens once per active chunk
  Object.assign(w, { raining: true, thundering: true, rain: 1, thunder: 1, rainTime: 99999, thunderTime: 99999 });
  const r = w.random, next = r.nextInt.bind(r); let draws = 0;
  r.nextInt = n => { if (n === 100000) draws++; return next(n); };
  s.tick();
  assert.equal(draws, 64);
});

test('a smaller server radius leaves far chunks without random ticks', () => {
  const s = fixture(); join(s, 'a', 1, 8.5, 8.5);
  s.chunkSets.radius = 2;
  const w = s.weather, seen = [], tick = w.tickChunk.bind(w);
  w.tickChunk = (world, cx, cz) => { seen.push(cx + ',' + cz); return tick(world, cx, cz); };
  s.tick();
  assert.equal(seen.length, 9); // chunks 0..2 square (the player stands in chunk 0, the rest is off the window)
  assert.ok(!seen.includes('7,7'));
});
