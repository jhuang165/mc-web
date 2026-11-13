// Batch 62 lead: the hooks between tracks that no single track could test (mpprojectiles' lanes x mpnether2's per-dimension dispense instance).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from './world.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { ServerProjectiles } from './multiplayer/server-projectiles.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const NETHERRACK = 150;
const input = () => ({ type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
function flat() {
  const w = new World('b62-lead');
  for (let x = 40; x <= 90; x++) for (let z = 40; z <= 90; z++) for (let y = 9; y <= 30; y++) w.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  w.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  return w;
}
// `a` in the Nether on a netherrack slab at y 69, `b` in the Overworld.
function fixture(saved = {}) {
  const s = new DedicatedSimulation(saved, { world: flat(), gameMode: 'survival', mobs: false });
  const a = s.addPlayer('a', 'Alice', key(1)), b = s.addPlayer('b', 'Bob', key(2));
  b.position.copy({ x: 64.5, y: 10, z: 64.5 }); b.previous.copy(b.position);
  s.dimensions.arrive(a, -1, { at: { x: 64.5, y: 70, z: 64.5 } });
  const n = s.dimensions.nether;
  for (let x = 40; x <= 90; x++) for (let z = 40; z <= 90; z++) for (let y = 60; y <= 90; y++) n.world.put(x, y, z, y === 69 ? NETHERRACK : 0, 0, false);
  s.input('a', input()); s.input('b', input());
  return { s, a, b, n };
}
const fly = (lane, x, y, z) => { const r = lane.arrows.make({ x, y, z, mx: 0, my: 0, mz: 0.2, yaw: 0, pitch: 0 }, lane.arrows.rng(), { shooter: null, pickup: 1 }); lane.arrows.list.push(r); return r; };
const ents = p => (p.dispOut ?? []).filter(m => m.type === 'dispEnts');

test('the Nether has its own full projectile instance; each player gets one snapshot, of their own dimension', { timeout: 120000 }, () => {
  const { s, a, b, n } = fixture();
  assert.ok(n.dispense instanceof ServerProjectiles, 'bows and throws work in the Nether (shootBow, throwHeld)');
  assert.equal(n.dispense.dim, -1);
  assert.equal(s.dispense.laneFor(-1), n.dispense, 'the Overworld routes a Nether lane to the Nether instance');
  assert.equal(s.dimensions.within(a, () => s.dispense), n.dispense, 'a Nether player\'s action sees the Nether instance');
  fly(n.dispense, 64.5, 71, 60.5); fly(s.dispense, 64.5, 11, 60.5);
  a.dispOut = null; b.dispOut = null;
  s.tick();
  const ea = ents(a), eb = ents(b);
  assert.equal(ea.length, 1, 'one dispEnts for the Nether player (ids would collide across two instances)');
  assert.equal(eb.length, 1);
  assert.ok(ea[0].ents.every(e => e.y > 60), 'the Nether player sees only the Nether arrow');
  assert.ok(eb[0].ents.every(e => e.y < 30), 'the Overworld player sees only the Overworld arrow');
});

test('a Nether arrow is saved with the Overworld instance and restored into the Nether instance', { timeout: 120000 }, () => {
  const { s, n } = fixture();
  const arrow = fly(n.dispense, 64.5, 71, 60.5);
  arrow.mz = 0; arrow.my = 0;
  const saved = s.dispense.save();
  assert.ok(saved?.lanes?.['-1']?.arrows?.length === 1, 'lane -1 saved');
  const t = new DedicatedSimulation({ projectiles: saved }, { world: flat(), gameMode: 'survival', mobs: false });
  assert.equal(t.dispense.extra.get(-1)?.arrows.list.length, 1, 'held in a stand-in lane until the Nether is built (load used to drop dim -1)');
  const c = t.addPlayer('c', 'Cara', key(3));
  t.dimensions.arrive(c, -1, { at: { x: 64.5, y: 70, z: 64.5 } });
  assert.equal(t.dispense.extra.size, 0, 'adopted');
  assert.equal(t.dimensions.nether.dispense.arrows.list.length, 1, 'the Nether instance flies it');
});
