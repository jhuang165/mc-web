// Batch 81 mpperf81: the allocation cuts in the move (per-id cell boxes, pooled box lists, moveEntity scratch, water/lava/burning pre-tests, per-mob move records)
// give the reference results; MC_MPPERF81=verify throws on a difference.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fast81, cellBoxesOf, blockBoxes81, BoxPool, dryBox, lavaIn, burningIn } from './mpperf81-fast.js';
import { blockBoxesReference } from './mpperf79-fast.js';
import { World, BLOCKS, collisionBoxes, WATER, LAVA, FIRE } from './world.js';
import { waterAcceleration, entityWaterBox, inLava } from './fluids.js';
import { boundingBoxBurning, contract } from './fire.js';
import { moveEntity } from './entities.js';
import { buildTerrainPen } from './mpperf81-scene.js';
import { buildPlayersScene, drain, lcg } from './mpperf77-scene.js';

const withMode = (mode, fn) => { const was = fast81.mode; fast81.mode = mode; try { return fn(); } finally { fast81.mode = was; } };
// A real World with every block id at random metadata over a stone floor, plus water, lava and fire cells.
function soup(r, span = 20, height = 6) {
  const w = new World('mpperf81-test');
  for (let x = 0; x < span; x++) for (let z = 0; z < span; z++) {
    w.put(x, 0, z, 1, 0, false);
    for (let y = 1; y < height; y++) {
      const q = r();
      if (q < 0.45) continue;
      const id = q < 0.5 ? WATER : q < 0.53 ? LAVA : q < 0.55 ? FIRE : 1 + Math.floor(r() * (BLOCKS.length - 1));
      w.put(x, y, z, id, Math.floor(r() * 16), false);
    }
  }
  return w;
}
const randomBox = (r, span, height) => {
  const x = r() * span, y = r() * height, z = r() * span, wd = 0.2 + r() * 2.5, h = 0.2 + r() * 3;
  return [x - wd / 2, y, z - wd / 2, x + wd / 2, y + h, z + wd / 2];
};
const same = (a, b) => a.length === b.length && a.every((x, k) => x.length === b[k].length && x.every((v, j) => Object.is(v, b[k][j])));

test('cellBoxesOf: constant ids give the cell function answer anywhere; ids that read metadata, neighbours or have side effects are not constant', () => {
  const r = lcg(81), w = soup(r);
  let constant = 0;
  for (let id = 1; id < BLOCKS.length; id++) {
    const c = cellBoxesOf(id, collisionBoxes);
    if (!c) continue;
    constant++;
    for (let n = 0; n < 6; n++) {
      const x = Math.floor(r() * 20), y = 1 + Math.floor(r() * 5), z = Math.floor(r() * 20);
      w.put(x, y, z, id, Math.floor(r() * 16), false);
      assert.ok(same(c, collisionBoxes(w, x, y, z)), `id ${id}`);
    }
  }
  assert.ok(constant > 60, `constant ids ${constant}`);
  assert.deepEqual(cellBoxesOf(1, collisionBoxes), [[0, 0, 0, 1, 1, 1]]);
  assert.equal(cellBoxesOf(134, collisionBoxes), null); // the brewing stand marks a collision pass (brewing.js): always through the cell function
  assert.equal(cellBoxesOf(0, collisionBoxes), null);
});

test('blockBoxes81 (plain and pooled, real World and a ring-style view) appends exactly the reference boxes', () => {
  const r = lcg(82), w = soup(r), view = Object.create(w);
  view.get = (x, y, z) => w.get(x, y, z);
  const pool = new BoxPool();
  for (const world of [w, view])
    for (let n = 0; n < 3000; n++) {
      const b = randomBox(r, 20, 6).map((v) => (n % 3 === 0 ? Math.round(v * 16) / 16 : v)), ref = blockBoxesReference(world, b, [], collisionBoxes); // a third on the 1/16 grid: boxes that touch exactly
      for (const mode of ['on', 'verify']) {
        pool.reset();
        const lead = [[9, 9, 9, 9, 9, 9]];
        withMode(mode, () => blockBoxes81(world, b, lead, collisionBoxes, n % 2 ? pool : null));
        assert.ok(same(lead.slice(1), ref));
      }
    }
});

test('dryBox, lavaIn and burningIn equal waterAcceleration, inLava and boundingBoxBurning', () => {
  const r = lcg(83), w = soup(r);
  let dry = 0, wet = 0;
  for (let n = 0; n < 5000; n++) {
    const b = randomBox(r, 20, 6);
    for (const mode of ['on', 'verify']) withMode(mode, () => {
      const ref = waterAcceleration(w, entityWaterBox(b));
      if (dryBox(w, ...b)) { dry++; assert.equal(ref.wet, false); assert.deepEqual(ref.push, [0, 0, 0]); } else wet++;
      assert.equal(lavaIn(w, ...b), inLava(w, b));
      assert.equal(burningIn(w, b), boundingBoxBurning((x, y, z) => w.get(x, y, z), contract(b)));
    });
  }
  assert.ok(dry > 500 && wet > 500, `${dry} ${wet}`);
  assert.equal(withMode('off', () => dryBox(w, 1, 1, 1, 2, 2, 2)), false); // off always asks the reference
});

// The fields moveEntity writes.
const FIELDS = ['x', 'y', 'z', 'vx', 'vy', 'vz', 'onGround', 'collidedH', 'fallDistance', 'fire', 'inWeb', 'ySize', 'bb'];
test('moveEntity: off, on and verify move the same entities the same way (soup, step-ups, kept boxes, nested hooks)', () => {
  const runs = {};
  for (const mode of ['off', 'on', 'verify']) {
    const r = lcg(84), w = soup(r), out = [];
    withMode(mode, () => {
      const ents = Array.from({ length: 40 }, (_, i) => ({ x: 2 + r() * 16, y: 1 + Math.floor(r() * 4), z: 2 + r() * 16, vx: 0, vy: 0, vz: 0, onGround: r() < 0.7, fallDistance: 0, living: i % 3 !== 0, sneaking: i % 7 === 0, ySize: i % 5 === 0 ? 0.1 : undefined, inWater: false }));
      for (const [i, e] of ents.entries()) if (i % 9 === 0) { const wd = [0.6, 0.9, 1.4, 0.3][i % 4] / 2; e.bb = [e.x - wd, e.y, e.z - wd, e.x + wd, e.y + 1, e.z + wd]; } // entities that keep their own box (Entity.boundingBox)
      const other = { x: 10, y: 3, z: 10, vx: 0, vy: 0, vz: 0, onGround: false, fallDistance: 0 };
      for (let t = 0; t < 60; t++)
        for (const [i, e] of ents.entries()) {
          const hooks = { living: e.living, hurt: (s, n) => { out.push(`h${i}${s}${n}`); if (s === 'cactus') moveEntity(w, other, 0.6, 1.8, 0.1, -0.2, 0.05); }, get wet() { return false; }, fizz: () => out.push(`f${i}`) };
          const wd = [0.6, 0.9, 1.4, 0.3][i % 4], ht = i % 8 === 3 && t % 3 === 0 ? 1.1 : [1.8, 0.9, 2.9, 0.7][i % 4]; // some heights change (the kept box is then rebuilt)
          if (t % 17 === 0 && i % 4 === 1) e.x += 0.3; // a teleport-like nudge: the kept box no longer sits on the position
          const landed = moveEntity(w, e, wd, ht, (r() - 0.5) * 0.6, (r() - 0.6) * 0.8, (r() - 0.5) * 0.6, i % 6 === 0 ? 0 : 0.5, i % 2 ? hooks : undefined);
          out.push(landed, ...FIELDS.map((k) => e[k]), (e.y + ht) % 1); // the top edge too: a stale kept box would show there
        }
      out.push(...FIELDS.map((k) => other[k]));
    });
    runs[mode] = JSON.stringify(out);
  }
  assert.equal(runs.on, runs.off);
  assert.equal(runs.verify, runs.off);
});

// Seeded whole-tick state, as mpperf78-b78.test.js: Math.random replaced, the packets and every mob's state hashed.
const stateOf = (build, mode, ticks) => withMode(mode, () => {
  const realRandom = Math.random, rs = lcg(12345);
  Math.random = () => rs();
  try {
    const s = build(), h = createHash('sha256');
    for (let i = 0; i < ticks; i++) { h.update(JSON.stringify(s.tick())); h.update(JSON.stringify(drain(s))); }
    for (const e of s.mobs.mobs.entities) h.update(`${e.type}|${e.x}|${e.y}|${e.z}|${e.vx}|${e.vy}|${e.vz}|${e.health}|${e.onGround}|${e.collidedH}|${e.fallDistance}|${e.fire};`);
    return h.digest('hex');
  } finally { Math.random = realRandom; }
});

test('seeded scenes: off, on and verify give the same state, twice in one process (mixed terrain pen, players field)', () => {
  const scenes = [() => buildTerrainPen({ mobs: 70, pen: 10, seed: 3 }), () => buildPlayersScene({ players: 4, mobs: 60, seed: 2 })];
  for (let round = 0; round < 2; round++)
    for (const build of scenes) {
      const off = stateOf(build, 'off', 40);
      assert.equal(stateOf(build, 'on', 40), off);
      assert.equal(stateOf(build, 'verify', 40), off); // verify throws on the first difference
      assert.equal(stateOf(build, 'on', 40), off);
    }
});
