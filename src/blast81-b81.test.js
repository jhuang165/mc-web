// Batch 81 blast81: chained blasts in their native tick. EntityEnderCrystal.attackEntityFrom (wz.a(ro, F), bytecode-read) calls World.createExplosion itself, so a crystal
// another blast hurts explodes inside that blast's doExplosionA; Explosion.doExplosionB (agw.a(Z)) reads each cell when it runs, so the outer blast skips the cells the
// nested one cleared; BlockTNT.onBlockDestroyedByExplosion (aob.a(ahb,IIIagw)) spawns the primed TNT at once, and World.updateEntities walks loadedEntityList by index, so it
// updates in the same pass. The dedicated server primes chained TNT now and gives TNT primed during the entity pass its first update in that pass (ServerDispense.tickJoined).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyExplosion } from './explosion-simulation.js';
import { explodeEvent } from './living-simulation.js';
import { crystalAttack } from './ender-crystal-mobs.js';
import { JavaRandom } from './java-random.js';
import { TNT } from './world.js';
import { World } from './world.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';

const key = (x, y, z) => `${x},${y},${z}`;
function arena(initial = {}) {
  const blocks = new Map(Object.entries(initial));
  return { blocks, height: 256, get: (x, y, z) => blocks.get(key(x, y, z)) || 0, getMeta: () => 0, solid(x, y, z) { return this.get(x, y, z) !== 0; },
    set(x, y, z, id) { const had = blocks.get(key(x, y, z)) || 0; if (had === id) return false; if (id) blocks.set(key(x, y, z), id); else blocks.delete(key(x, y, z)); return true; } };
}
const list = () => { const o = { items: [], orbs: [], explode() {}, spawn() {}, spill() {}, dropBlock() {} }; return o; };
const crystal = (x, y, z) => ({ type: 'ender_crystal', x, y, z, vx: 0, vy: 0, vz: 0, health: 5, death: 0, growingAge: 0 });

function singlePlayer(blocks) {
  const world = arena(blocks), booms = [], sounds = [], primed = [];
  const mobs = { entities: [], events: [], damage(e) { return crystalAttack(this, e); }, hazard(e) { return crystalAttack(this, e); } };
  const state = { world, random: new JavaRandom(81), mobs, items: list(), xpOrbs: list(), arrows: list(), projectiles: list(), falling: null, primed,
    survival: { health: 0, furnaces: {}, chests: {} }, position: { x: 500, y: 10, z: 500 }, velocity: { x: 0, y: 0, z: 0 }, farming: { observe() {} } };
  const explodeAt = (x, y, z, size, opts) => { const out = applyExplosion(state, { x, y, z, size, ...opts }, { sound: (_n, o) => sounds.push(o.position) }); booms.push({ at: [x, y, z], out }); };
  mobs.explodeInline = (ev) => explodeEvent(ev, explodeAt);
  return { world, mobs, booms, sounds, primed };
}

test('a crystal hurt by another crystal\'s blast explodes inside it, before the outer blast reaches its block half', () => {
  const { mobs, booms, sounds } = singlePlayer({});
  const a = crystal(0.5, 10, 0.5), b = crystal(3.5, 10, 0.5);
  mobs.entities.push(a, b);
  crystalAttack(mobs, a);
  assert.equal(mobs.events.filter(e => e.explode).length, 0, 'nothing is queued for the drain');
  assert.deepEqual(booms.map(x => x.at[0]), [3.5, 0.5], 'the nested blast (b) finishes first');
  assert.deepEqual(sounds.map(p => p.x), [3.5, 0.5], 'and its random.explode plays first (doExplosionB of the inner Explosion)');
  assert.equal(b.health, 0);
  assert.equal(b.crystalGone, true);
});

test('the outer blast reads its cells after the nested one: no cell breaks twice, and a TNT block primes once', () => {
  const blocks = {};
  for (let x = -2; x <= 6; x++) for (let z = -2; z <= 3; z++) blocks[key(x, 9, z)] = 1; // a stone floor under both crystals
  blocks[key(4, 10, 1)] = TNT;
  const { mobs, booms, primed } = singlePlayer(blocks);
  const a = crystal(0.5, 10, 0.5), b = crystal(3.5, 10, 0.5);
  mobs.entities.push(a, b);
  crystalAttack(mobs, a);
  const [inner, outer] = booms.map(x => x.out);
  const innerCells = new Set(inner.explosion.broken.map(c => key(c.x, c.y, c.z)));
  assert.ok(innerCells.size > 0);
  assert.equal(outer.explosion.broken.filter(c => innerCells.has(key(c.x, c.y, c.z))).length, 0, 'the outer doExplosionB sees air where the inner blast was');
  assert.ok(outer.explosion.list.some(([x, y, z]) => innerCells.has(key(x, y, z))), 'the outer ray list still names those cells (S27 offsets)');
  assert.equal(primed.length, 1, 'the TNT block became one primed TNT');
  assert.deepEqual([inner.chainedTnt.length, outer.chainedTnt.length], [1, 0]);
  assert.equal(outer.tntProcessed.length, 0, 'the TNT the inner blast primed is not in the outer blast\'s entity list');
});

test('a bare EntityWorld host (no explodeInline) still queues the crystal\'s explosion', () => {
  const mobs = { events: [] }, c = crystal(0, 0, 0);
  assert.equal(crystalAttack(mobs, c), true);
  assert.equal(mobs.events.filter(e => e.explode).length, 1);
});

// --- the dedicated server ---
const pid = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const input = () => ({ type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
function server() {
  const world = new World('blast81-b81');
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: 'creative', mobs: false });
  s.addPlayer('a', 'Alice', pid(1));
  return { s, world };
}
const groundAt = (world, x, z) => { for (let y = 120; y > 0; y--) if (world.get(x, y, z)) return y; return 0; };

test('server: a TNT block in a blast becomes primed TNT (it used to vanish), and it updates in the tick of the blast', () => {
  const { s, world } = server();
  const x = 70, z = 70, y = groundAt(world, x, z) + 1;
  world.set(x + 1, y, z, TNT, true, 0);
  const d = s.dispense, made = [];
  const prime = d.prime.bind(d);
  d.prime = (...a) => { const e = prime(...a); made.push({ e, fuse: e.fuse }); return e; };
  d.prime(x + 0.5, y + 0.5, z + 0.5, false, { fuse: 0 }); // goes off in the next TNT pass
  made.length = 0;
  s.input('a', input()); s.tick();
  assert.equal(world.get(x + 1, y, z), 0, 'the TNT block is gone');
  assert.equal(made.length, 1, 'and primed (BlockTNT.onBlockDestroyedByExplosion)');
  const { e, fuse } = made[0];
  assert.ok(fuse >= 10 && fuse < 30, 'fuse rand.nextInt(20) + 10');
  assert.equal(e.fuse, fuse - 1, 'it had its first update in the same tick (appended to the entity list being walked)');
  assert.ok(d.primed.includes(e));
});

test('server: a crystal hurt by a TNT blast explodes inside it, and the TNT that blast primes updates in that tick', () => {
  const { s, world } = server();
  const x = 80, z = 80, y = groundAt(world, x, z) + 1;
  const mobs = s.mobs.mobs, c = mobs.addEntity?.('ender_crystal', x + 3.5, y, z + 0.5) ?? null;
  const crystalEntity = c ?? (() => { const e = crystal(x + 3.5, y, z + 0.5); mobs.entities.push(e); return e; })();
  world.set(x + 6, y, z, TNT, true, 0);
  const d = s.dispense, made = [];
  const prime = d.prime.bind(d);
  d.prime = (...a) => { const e = prime(...a); made.push({ e, fuse: e.fuse }); return e; };
  const blasts = [], explode = s.mobs.explode.bind(s.mobs);
  s.mobs.explode = (ev) => { blasts.push('start ' + Math.floor(ev.x)); explode(ev); blasts.push('end ' + Math.floor(ev.x)); };
  d.prime(x + 0.5, y + 0.5, z + 0.5, false, { fuse: 0 });
  made.length = 0;
  s.input('a', input()); s.tick();
  assert.equal(crystalEntity.health, 0, 'the crystal was hurt by the TNT blast');
  assert.deepEqual(blasts, [`start ${x}`, `start ${x + 3}`, `end ${x + 3}`, `end ${x}`], 'its blast ran in the same tick, nested in the TNT one');
  assert.equal(mobs.events.filter(e => e.explode).length, 0);
  const chained = made.find(m => Math.floor(m.e.x) === x + 6);
  assert.ok(chained, 'the crystal blast primed the TNT block');
  assert.equal(chained.e.fuse, chained.fuse - 1, 'which updated in this tick');
});
