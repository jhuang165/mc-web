// Batch 79 explfx79: S27 block offsets on the wire, the single-player push (S27 then S12), the creeper's inline blast. Facts: .shared-memory/notes/explfx79-b79-track.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from './world.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { s27Encode, s27Decode, s27Of, s27Loopback } from './multiplayer/server-explosion-packet.js';
import { RemoteDispense } from './multiplayer/client-dispense.js';
import { applyExplosion } from './explosion-simulation.js';
import { JavaRandom } from './lighting.js';
import { Survival } from './survival.js';
import { ExplosionParticles } from './explosion-particles.js';

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
function fixture() {
  const world = new World('explfx79');
  for (let x = 0; x <= 200; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 24; y++) world.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: 'survival', mobs: false });
  const a = s.addPlayer('a', 'ax', key(1));
  a.position.copy({ x: 64.5, y: 10, z: 64.5 }); a.previous.copy(a.position);
  s.tick(); s.tick(); a.dispOut = null;
  return { s, a };
}
const fx = p => (p.dispOut ?? []).filter(m => m.type === 'dispFx').flatMap(m => m.events).filter(e => e.k === 'explode');

test('offset bytes: relative to (int) of the double centre, wrap as signed bytes, decoded around the float centre', () => {
  const list = [[10, 5, -3], [8, 5, -3], [-100, 70, 200]];
  const bl = s27Encode(9.5, 5.2, -2.5, list); // (int) = 9, 5, -2 (toward zero)
  assert.equal(atob(bl).length, 9);
  assert.deepEqual(s27Decode(9.5, 5.2, -2.5, bl).slice(0, 2), list.slice(0, 2));
  // the third cell is 109 / 65 / 202 away: the z byte wraps (202 -> -54), like the signed byte write
  assert.deepEqual(s27Decode(9.5, 5.2, -2.5, bl)[2], [-100, 70, -56]);
  assert.deepEqual(s27Decode(1, 1, 1, ''), []);
});

test('a centre that rounds up as a float shifts the decoded cells by one, as gu.a does', () => {
  const x = 5.99999999; // Math.fround(x) === 6
  assert.equal(Math.fround(x), 6);
  assert.deepEqual(s27Decode(x, 3.5, 3.5, s27Encode(x, 3.5, 3.5, [[5, 3, 3]])), [[6, 3, 3]]);
});

test('server blast: the dispFx event carries the affected cells as bytes, once per blast; !smoking carries none', () => {
  const { s, a } = fixture();
  s.mobs.explode({ x: 62.5, y: 10, z: 64.5, size: 4, source: null }); s.mobs.burst(62.5, 10, 64.5, 4);
  s.tick();
  const [e] = fx(a);
  assert.ok(e.bl && e.bl.length > 100, 'offsets present');
  const cells = s27Decode(e.x, e.y, e.z, e.bl);
  assert.ok(cells.length > 100);
  assert.ok(cells.every(c => Math.abs(c[0] - 62.5) < 12 && Math.abs(c[1] - 10) < 12));
  s.mobs.explode({ x: 62.5, y: 10, z: 64.5, size: 4, source: null, smoking: false }); s.mobs.burst(62.5, 10, 64.5, 4);
  a.dispOut = null; s.tick();
  const [q] = fx(a);
  assert.equal(s27Decode(q.x, q.y, q.z, q.bl).length, 0, 'WorldServer.newExplosion clears the list when not smoking');
  assert.equal('knock' in q || 'blocks' in q || 'wire' in q, false);
});

test('creeper blast through explodeInline sends its S27 and burst', () => {
  const { s, a } = fixture();
  s.mobs.mobs.explodeInline({ explode: { x: 66.5, y: 10, z: 64.5, size: 3, source: null, smoking: true } });
  s.tick();
  const list = fx(a);
  assert.equal(list.length, 1, 'one explode event for the creeper');
  assert.ok(list[0].mx !== undefined, 'the player in reach is pushed');
  assert.ok(list[0].bl.length > 50);
});

test('client packet handler passes the decoded cells to the explode hook', () => {
  const seen = [];
  const r = new RemoteDispense({ explode: (x, y, z, size, cells) => seen.push(cells) });
  const bl = s27Encode(10.5, 5.5, 10.5, [[10, 5, 10], [12, 6, 9]]);
  r.events([{ k: 'explode', x: 10.5, y: 5.5, z: 10.5, size: 3, bl }]);
  assert.deepEqual(seen, [[[10, 5, 10], [12, 6, 9]]]);
});

test('single player draws particles from the S27 loopback: float centre, same cells', () => {
  const w = s27Loopback(1.1, 2.2, 3.3, 4, [[1, 2, 3], [2, 2, 3]]);
  assert.equal(w.x, Math.fround(1.1)); assert.equal(w.size, 4);
  assert.deepEqual(w.list, [[1, 2, 3], [2, 2, 3]]);
  const p = new ExplosionParticles({ random: () => 0.5 });
  p.burst(w.x, w.y, w.z, w.size, w.list);
  assert.ok(p.list.length >= 4, 'explode + smoke per cell');
});

const arena = () => ({ get: () => 0, getMeta: () => 0, set: () => true, solid: () => false, numericSeed: 1 });
function blast(survival, { armor = [] } = {}) {
  const velocity = { x: 0, y: 0, z: 0 }, position = { x: 0.5, y: 64, z: 0.5 }, list = { explode() {}, list: [], tick() {}, spawn() {} };
  survival.inventory.armor = armor;
  applyExplosion({ world: arena(), random: new JavaRandom(3), mobs: { entities: [], damage() {}, hazard() {} }, items: list, xpOrbs: list, arrows: list, projectiles: list, falling: list, primed: [], survival, position, velocity, farming: { observe() {} } },
    { x: 3.5, y: 64.5, z: 0.5, size: 4 }, { burst() {}, sound() {}, updateBlocks() {}, syncChests() {}, renderVitals() {}, markDirty() {}, brokenTool() {} });
  return velocity;
}
const makeSurvival = (creative = false) => { const s = new Survival({ health: 20 }, creative ? 'creative' : 'survival'); s.protection = 0; s.difficulty = 2; return s; };

test('hurt player: S12 replaces the S27 motion with the server copy (reduced push); creative keeps the unreduced S27 push', () => {
  const hurt = makeSurvival(), serverMotion = { x: 0, y: 0, z: 0 };
  hurt.serverPlayer = { motion: serverMotion };
  const v = blast(hurt);
  assert.ok(hurt.hurtCount > 0, 'the hit landed');
  assert.deepEqual(v, { x: Math.trunc(serverMotion.x * 8000) / 8000, y: Math.trunc(serverMotion.y * 8000) / 8000, z: Math.trunc(serverMotion.z * 8000) / 8000 }, 'client motion = S12 of the server copy');
  const creative = makeSurvival(true);
  creative.serverPlayer = { motion: { x: 0, y: 0, z: 0 } };
  const c = blast(creative);
  assert.equal(c.x, Math.fround(c.x), 'S27 floats');
  assert.ok(c.x < 0 && c.y > 0, 'pushed away from the blast');
  assert.deepEqual(c, { x: Math.fround(creative.serverPlayer.motion.x), y: Math.fround(creative.serverPlayer.motion.y), z: Math.fround(creative.serverPlayer.motion.z) }, 'no Blast Protection difference without armour');
});

test('hurt-window refusal sends no S12: the unreduced S27 push stays on the client while the server copy is reduced', () => {
  const s = makeSurvival(); s.hurtTicks = 10; s.hurtAmount = 1000; // any hit is refused
  s.serverPlayer = { motion: { x: 0, y: 0, z: 0 } };
  const v = blast(s);
  assert.ok(v.x < 0);
  assert.equal(v.x, Math.fround(s.serverPlayer.motion.x));
});
