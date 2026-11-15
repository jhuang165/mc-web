// Batch 75 mppushgrid75: the push grid (push-grid.js) gives the same candidates in the same order as the full scan, and a busy server tick is unchanged by it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { PushGrid, pushGridConfig, beginPushGrid, endPushGrid, pushCandidates } from './push-grid.js';
import { World } from './world.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';

const lcg = (seed) => { let s = seed >>> 0; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; };
const brute = (list, x, z) => list.filter((o) => Math.abs(o.x - x) <= 12 && Math.abs(o.z - z) <= 12);
const within = (o, x, z) => Math.abs(o.x - x) <= 12 && Math.abs(o.z - z) <= 12;

test('grid candidates are a list-order superset of the 12-block scan, also after moves and across cell borders', () => {
  const r = lcg(3), list = Array.from({ length: 300 }, () => ({ x: r() * 150 - 10, z: r() * 150 - 10 }));
  const g = new PushGrid(list);
  for (let round = 0; round < 40; round++) {
    for (let i = 0; i < 30; i++) { const o = list[Math.floor(r() * list.length)]; o.x += (r() - 0.5) * 40; o.z += (r() - 0.5) * 40; g.touch(o); }
    for (let q = 0; q < 20; q++) {
      const s = list[Math.floor(r() * list.length)], got = g.query(s.x, s.z);
      assert.deepEqual(got.filter((o) => within(o, s.x, s.z)), brute(list, s.x, s.z));
      assert.deepEqual(got, [...got].sort((a, b) => list.indexOf(a) - list.indexOf(b)), 'list order');
    }
  }
  // exactly 12 blocks away on a cell border is still found
  const a = { x: 8, z: 8 }, b = { x: 20, z: -4 }, small = new PushGrid([a, b]);
  assert.deepEqual(small.query(8, 8), [a, b]);
});

test('an entity moved without touch is missed (the guard is markMoved), a changed list falls back', () => {
  const list = Array.from({ length: 10 }, (_, i) => ({ x: i * 40, z: 0 })), g = new PushGrid(list);
  list[9].x = 0; // moved off its turn, nobody told the grid
  assert.ok(!g.query(0, 0).includes(list[9]));
  g.touch(list[9]);
  assert.ok(g.query(0, 0).includes(list[9]));
  list.push({ x: 0, z: 0 });
  assert.equal(g.query(0, 0), null, 'length changed');
  const h = new PushGrid(list); [list[0], list[1]] = [list[1], list[0]];
  assert.equal(h.query(0, 0), null, 'entries moved in the list');
});

test('pushCandidates is null outside a mob loop and below the size cut', () => {
  pushGridConfig.mode = 'on';
  const list = Array.from({ length: 300 }, (_, i) => ({ x: i, z: 0 }));
  assert.equal(pushCandidates(list, list[0]), null);
  beginPushGrid();
  try {
    assert.ok(pushCandidates(list, list[0]).length > 1);
    assert.equal(pushCandidates(list.slice(0, 20), list[0]), null);
  } finally { endPushGrid(); }
  assert.equal(pushCandidates(list, list[0]), null);
});

const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
function scene(mode) {
  pushGridConfig.mode = mode;
  const realRandom = Math.random, rs = lcg(77); Math.random = () => rs();
  try {
    const world = new World('pushgrid75');
    for (let x = 4; x < 100; x++) for (let z = 4; z < 100; z++) { world.put(x, 9, z, 1, 0, false); for (let y = 10; y <= 20; y++) world.put(x, y, z, 0, 0, false); }
    world.spawn = () => ({ x: 50.5, y: 10, z: 50.5 });
    const s = new DedicatedSimulation({}, { world, gameMode: 'survival', mobs: true, rules: { chunkStream: false } });
    s.gameRules.doMobSpawning = 'false'; s.gameRules.doDaylightCycle = 'false'; s.difficulty = 2; s.mobs.mobs.difficulty = 2; s.time = 18000;
    const p = s.addPlayer('p', 'p', key(1)); p.position.copy({ x: 50.5, y: 10, z: 50.5 }); p.previous.copy(p.position);
    s.input('p', { type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
    s.mobs.mobs.entities.length = 0;
    const r = lcg(5), kinds = ['zombie', 'pig', 'cow', 'sheep', 'chicken', 'spider', 'villager'];
    for (let i = 0; i < 230; i++) { const m = s.mobs.mobs.create(kinds[i % kinds.length], 8 + r() * 84, 10, 8 + r() * 84); m.persistent = true; s.mobs.mobs.entities.push(m); }
    const h = createHash('sha256');
    for (let i = 0; i < 25; i++) { s.tick(); p.mobPackets = null; p.chunkOut = null; }
    for (const e of s.mobs.mobs.entities) h.update(`${e.type}|${e.x}|${e.y}|${e.z}|${e.health}|${e.vx}|${e.vz};`);
    return h.digest('hex');
  } finally { Math.random = realRandom; pushGridConfig.mode = 'on'; }
}
test('230 mobs for 25 ticks end in the same state with the grid, verified against the full scan, and without it', () => {
  const off = scene('off');
  assert.equal(scene('verify'), off);
  assert.equal(scene('on'), off);
});
