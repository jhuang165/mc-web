// Batch 78 mpexplosion78: S27 (explosion motion per player) on the wire. Facts: .shared-memory/notes/mpexplosion78-b78-track.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from './world.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { s27Reaches, s27Of } from './multiplayer/server-explosion-packet.js';
import { RemoteDispense } from './multiplayer/client-dispense.js';

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
function fixture(far = 10) {
  const world = new World('mpexplosion78');
  for (let x = 0; x <= 200; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 24; y++) world.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: 'survival', mobs: false });
  const a = s.addPlayer('a', 'ax', key(1)), b = s.addPlayer('b', 'bx', key(2));
  a.position.copy({ x: 64.5, y: 10, z: 64.5 }); b.position.copy({ x: 64.5 + far, y: 10, z: 64.5 });
  a.previous.copy(a.position); b.previous.copy(b.position);
  s.tick(); s.tick();
  a.survival.protection = b.survival.protection = 0;
  a.dispOut = null; b.dispOut = null;
  return { s, a, b };
}
const fx = p => (p.dispOut ?? []).filter(m => m.type === 'dispFx').flatMap(m => m.events).filter(e => e.k === 'explode');

test('range: squared feet distance < 4096 on all three axes', () => {
  assert.equal(s27Reaches({ x: 0, y: 0, z: 0 }, { x: 63.9, y: 0, z: 0 }), true);
  assert.equal(s27Reaches({ x: 0, y: 0, z: 0 }, { x: 64, y: 0, z: 0 }), false);
  assert.equal(s27Reaches({ x: 0, y: 0, z: 0 }, { x: 40, y: 40, z: 40 }), false);
  assert.equal(s27Reaches({ x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }), false);
});

test('s27Of attaches the float motion of that player only', () => {
  const p = {}, q = {}, e = { k: 'explode', x: 1, y: 2, z: 3, size: 4, knock: new Map([[p, [0.1, 0.2, 0.3]]]) };
  assert.deepEqual(s27Of(e, p), { k: 'explode', x: 1, y: 2, z: 3, size: 4, mx: Math.fround(0.1), my: Math.fround(0.2), mz: Math.fround(0.3) });
  assert.equal(s27Of(e, q).mx, undefined);
  assert.equal('knock' in s27Of(e, p), false);
});

test('a blast near a player: the S27 carries his push, the far player gets the burst without motion, the unreached none', () => {
  const { s, a, b } = fixture(30);
  s.mobs.explode({ x: 62.5, y: 10, z: 64.5, size: 4, source: null }); s.mobs.burst(62.5, 10, 64.5, 4);
  s.tick();
  const ea = fx(a), eb = fx(b);
  assert.equal(ea.length, 1);
  assert.ok(ea[0].mx > 0, `pushed away from the blast: ${ea[0].mx}`);
  assert.equal(ea[0].mx, Math.fround(ea[0].mx));
  assert.equal(eb.length, 1, 'within 64 blocks: the burst');
  assert.equal(eb[0].mx, undefined, 'out of the blast radius: no motion');
  const { s: s2, b: far } = fixture(80);
  s2.mobs.explode({ x: 62.5, y: 10, z: 64.5, size: 4, source: null }); s2.mobs.burst(62.5, 10, 64.5, 4);
  s2.tick();
  assert.equal(fx(far).length, 0, '80 blocks: no S27');
});

test('S27 motion is the unreduced push; the server velocity is the same without armour, and creative players are pushed without damage', () => {
  const { s, a } = fixture();
  const before = { ...a.velocity };
  s.mobs.explode({ x: 62.5, y: 10, z: 64.5, size: 4, source: null }); s.mobs.burst(62.5, 10, 64.5, 4);
  const e = (s.dispense.fx.at(-1)), k = e.knock.get(a);
  assert.ok(k, 'knock recorded for the player');
  assert.ok(Math.abs(a.velocity.x - before.x - k[0]) < 1e-12);
  a.survival.mode = 'creative'; a.survival.health = 20;
  const hp = a.survival.health;
  s.mobs.explode({ x: 62.5, y: 10, z: 64.5, size: 4, source: null }); s.mobs.burst(62.5, 10, 64.5, 4);
  assert.equal(a.survival.health, hp, 'no damage');
  assert.ok(s.dispense.fx.at(-1).knock.get(a), 'but the push');
});

test('client: explode effect first, then the motion added as floats', () => {
  const log = [];
  const c = new RemoteDispense({ explode: (...a) => log.push(['explode', ...a]), knock: (...a) => log.push(['knock', ...a]) });
  c.events([{ k: 'explode', x: 1, y: 2, z: 3, size: 4, mx: 0.1, my: 0.2, mz: 0.3 }, { k: 'explode', x: 1, y: 2, z: 3, size: 4 }]);
  assert.deepEqual(log.map(l => l[0]), ['explode', 'knock', 'explode']);
  assert.equal(log[1][1], Math.fround(0.1));
});

// ---- relighting: one flood per merged box, bit-identical to the per-cell floods
import { LightVolume, RELIGHT } from './lighting.js';
function lcg(seed) { let s = seed >>> 0; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; }
function lightWorld(seed) {
  const r = lcg(seed), world = new World('relight78' + seed);
  for (let x = 0; x < 128; x++) for (let z = 0; z < 128; z++) for (let y = 1; y <= 30; y++) {
    const h = 14 + Math.floor(3 * Math.sin(x / 5) + 3 * Math.cos(z / 7));
    world.put(x, y, z, y <= h ? 1 : (y === h + 3 && r() < 0.02 ? 50 : y === h + 4 && r() < 0.1 ? 1 : 0), 0, false);
  }
  return world;
}
test('updateMany equals the per-cell update loop: scattered, clustered and edge changes', () => {
  for (const seed of [1, 2, 3]) {
    const r = lcg(seed * 99), wa = lightWorld(seed), wb = lightWorld(seed);
    const la = new LightVolume(wa), lb = new LightVolume(wb);
    const changes = [];
    for (let i = 0; i < 60; i++) { // a blast of cells, a lone far cell, the world edge and the corner
      const near = i < 40, x = near ? 40 + Math.floor(r() * 9) : i < 50 ? 100 + Math.floor(r() * 20) : [0, 127, 1, 126][i % 4], z = near ? 40 + Math.floor(r() * 9) : i < 50 ? 10 + Math.floor(r() * 5) : [0, 127, 126, 1][i % 4];
      const y = 10 + Math.floor(r() * 12), id = r() < 0.8 ? 0 : r() < 0.5 ? 50 : 1;
      wa.put(x, y, z, id, 0, false); wb.put(x, y, z, id, 0, false);
      changes.push([x, y, z]);
    }
    for (const [x, y, z] of changes) la.update(x, y, z);
    lb.updateMany(changes);
    assert.deepEqual(lb.sky, la.sky, 'sky ' + seed); assert.deepEqual(lb.block, la.block, 'block ' + seed); assert.deepEqual(lb.heights, la.heights, 'heights ' + seed);
  }
});

test('updateMany verify mode throws nothing on a blast and "off" is the old loop', () => {
  const was = RELIGHT.mode;
  try {
    for (const mode of ['verify', 'off']) {
      RELIGHT.mode = mode;
      const w = lightWorld(7), l = new LightVolume(w), ch = [];
      for (let x = 60; x < 66; x++) for (let z = 60; z < 66; z++) { w.put(x, 15, z, 0, 0, false); ch.push([x, 15, z]); }
      l.updateMany(ch);
    }
  } finally { RELIGHT.mode = was; }
});
