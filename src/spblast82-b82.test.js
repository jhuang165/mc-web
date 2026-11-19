// Batch 82 spblast82: blast order and pushes.
// - EntityLargeFireball.onImpact (zg.a, bytecode-read) calls World.newExplosion inside the ball's own update, and EntityWither.updateAITasks (xc.bn) inside the wither's:
//   a host with explodeInline runs both where the entity stands in the walk (they were queued for the drain after the walk).
// - Explosion's fire roll draws on its own unseeded new Random() (agw.<init>): drawn from Math.random for flaming blasts, never from the clock.
// - Explosion.doExplosionA (agw.a()) hurts and pushes every entity of its list: the dedicated server now pushes items, orbs, carts and the rest, and both sides push
//   fireballs, skulls, rockets, eyes of ender and fishing hooks and break leash knots (explosion-extras.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyExplosion, explodeNonLiving } from './explosion-simulation.js';
import { explosionBlocks, explosionOutcome } from './explosion.js';
import { explodeFireballs } from './explosion-extras.js';
import { Fireballs } from './fireballs.js';
import { witherAITick } from './wither-boss-mobs.js';
import { JavaRandom } from './java-random.js';
import { World } from './world.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';
import { lookVector } from './blaze-ghast.js';
import { mhSin, mhCos } from './lighting.js';

const key = (x, y, z) => `${x},${y},${z}`;
function arena(initial = {}) {
  const blocks = new Map(Object.entries(initial));
  return { blocks, height: 256, get: (x, y, z) => blocks.get(key(x, y, z)) || 0, getMeta: () => 0, solid(x, y, z) { return this.get(x, y, z) !== 0; },
    set(x, y, z, id) { const had = blocks.get(key(x, y, z)) || 0; if (had === id) return false; if (id) blocks.set(key(x, y, z), id); else blocks.delete(key(x, y, z)); return true; } };
}
const floor = () => { const b = {}; for (let x = -4; x <= 4; x++) for (let z = -4; z <= 4; z++) b[key(x, 9, z)] = 1; return b; };
const list = () => ({ items: [], orbs: [], explode() {}, spawn() {}, spill() {}, dropBlock() {} });
const lcg = (seed) => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
function withRandom(seed, fn) {
  const real = Math.random, now = Date.now;
  Math.random = lcg(seed);
  Date.now = () => { throw new Error('a blast read the clock'); };
  try { return fn(); } finally { Math.random = real; Date.now = now; }
}

test('the fire roll of a flaming blast repeats under a seeded Math.random and never reads the clock (explosionOutcome default and applyExplosion)', () => {
  const world = arena(floor());
  const run = () => withRandom(82, () => explosionOutcome(world, explosionBlocks(world, 0.5, 10, 0.5, 3, new JavaRandom(5)), 3, new JavaRandom(5), { flaming: true, opaque: (id) => id === 1 }).fires);
  const a = run(), b = run();
  assert.ok(a.length > 0, 'some cells catch fire');
  assert.deepEqual(a, b);
  const sp = () => withRandom(7, () => {
    const lit = [];
    applyExplosion({ world: arena(floor()), random: new JavaRandom(9), mobs: { entities: [], events: [] }, items: list(), xpOrbs: list(), arrows: list(), projectiles: list(), falling: null, primed: [],
      survival: { health: 0, furnaces: {}, chests: {} }, position: { x: 500, y: 10, z: 500 }, velocity: { x: 0, y: 0, z: 0 }, farming: { observe() {} } },
    { x: 0.5, y: 10, z: 0.5, size: 3, flaming: true }, { ignite: (x, y, z) => { lit.push(key(x, y, z)); return true; } });
    return lit;
  });
  const c = sp();
  assert.ok(c.length > 0);
  assert.deepEqual(c, sp());
  assert.doesNotMatch(readFileSync(new URL('./explosion.js', import.meta.url), 'utf8'), /Date\.now/);
});

test('a non-flaming blast draws nothing from Math.random for the fire roll', () => {
  const world = arena(floor());
  let draws = 0;
  const real = Math.random;
  Math.random = () => { draws++; return 0.5; };
  try { explosionOutcome(world, explosionBlocks(world, 0.5, 10, 0.5, 3, new JavaRandom(5)), 3, new JavaRandom(5), { opaque: (id) => id === 1 }); } finally { Math.random = real; }
  assert.equal(draws, 0);
});

// --- the pushes ---
const stillMobs = () => ({ entities: [], events: [], world: null, isActive: () => true, ai: null, random: () => 0.5 });
test('single player: a blast pushes fireballs (a wither skull follows the small ball rule), rockets, eyes and hooks, and breaks leash knots', () => {
  const world = arena({}), mobs = stillMobs();
  mobs._fireballs = new Fireballs(mobs);
  const large = mobs._fireballs.launch({ large: true, x: 3, y: 10, z: 0, exact: [0, 0, 1] }), small = mobs._fireballs.launch({ large: false, x: -3, y: 10, z: 0, exact: [0, 0, 1] });
  const killed = [];
  mobs.knotList = [{ x: 1, y: 9, z: 0, dead: false }, { x: 40, y: 9, z: 0, dead: false }];
  mobs.knotAttack = (k) => { k.dead = true; killed.push(k); return true; };
  const rocket = { x: 0, y: 12, z: 0, mx: 0, my: 0.05, mz: 0, box: [-0.125, 12, -0.125, 0.125, 12.25, 0.125], dead: false };
  const eye = { x: 0, y: 10, z: 3, vx: 0, vy: 0, vz: 0, dead: false };
  const hook = { x: 0, y: 10, z: -3, vx: 0, vy: 0, vz: 0, bb: [-0.125, 10, -3.125, 0.125, 10.25, -2.875], dead: false };
  explodeNonLiving({ world, mobs, items: list(), xpOrbs: list(), arrows: list(), projectiles: list(), rockets: { rockets: [rocket] }, eyes: { eyes: [eye] }, hooks: [hook] }, 0.5, 10, 0.5, 4);
  assert.ok(large.vx > 0 && large.velocityChanged, 'the large ball is pushed away and setBeenAttacked');
  assert.ok(small.vx < 0 && !small.velocityChanged, 'the small ball is pushed; zi.a returns false before setBeenAttacked');
  assert.ok(rocket.my > 0.05 && rocket.velocityChanged);
  assert.ok(eye.vz > 0 && hook.vz < 0);
  assert.deepEqual(killed, [mobs.knotList[0]], 'only the knot in reach breaks');
});

test('a large fireball in a blast with a placer takes the placer\'s look (ze.a with "explosion.player"), then the push', () => {
  const world = arena({}), mobs = stillMobs();
  mobs._fireballs = new Fireballs(mobs);
  const b = mobs._fireballs.launch({ large: true, x: 3, y: 10, z: 0.5, exact: [0, 0, 1] });
  const creeper = { type: 'creeper', x: 0.5, y: 9, z: 0.5, rotationYaw: 90, rotationPitch: 0 };
  explodeFireballs(mobs._fireballs, world, 0.5, 10, 0.5, 3, creeper, creeper);
  const look = lookVector(90, 0, mhSin, mhCos);
  assert.equal(b.owner, creeper);
  assert.ok(Math.abs(b.ax - look[0] * 0.1) < 1e-12 && Math.abs(b.az - look[2] * 0.1) < 1e-12, 'the acceleration is the look * 0.1');
  assert.ok(b.vx !== look[0], 'the push is added on top of the look motion');
});

// --- the dedicated server ---
const pid = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const input = () => ({ type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
const groundAt = (world, x, z) => { for (let y = 120; y > 0; y--) if (world.get(x, y, z)) return y; return 0; };
function server() {
  const world = new World('spblast82-b82');
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: 'creative', mobs: false });
  s.addPlayer('a', 'Alice', pid(1));
  return { s, world };
}

test('server: a blast pushes dropped items, orbs and minecarts, and a cart it breaks drops at once', () => {
  const { s, world } = server();
  const x = 90, z = 90;
  let y = 0;
  for (let dx = -7; dx <= 7; dx++) for (let dz = -7; dz <= 7; dz++) y = Math.max(y, groundAt(world, x + dx, z + dz) + 4); // all in open air: full exposure
  s.items.spawn({ id: 4, count: 1, damage: 0 }, x + 5.5, y + 0.2, z + 0.5, { delay: 10, motion: [0, 0, 0] });
  const item = s.items.items.at(-1);
  s.serverItems.xp.spawn(3, { x: x + 0.5, y: y + 0.5, z: z + 5.5 });
  const orb = s.serverItems.xp.orbs.at(-1), ov = orb.vz;
  const far = s.vehicles.spawnVehicle('minecart', x - 5.5, y, z + 0.5), near = s.vehicles.spawnVehicle('minecart', x + 0.5, y, z + 1.5);
  const fvx = far.vx, before = s.items.items.length;
  s.mobs.explode({ x: x + 0.5, y: y + 0.5, z: z + 0.5, size: 4, source: null });
  assert.ok(item.dead || item.mx > 0, 'the item is pushed (or blown up)');
  assert.ok(orb.dead || orb.vz > ov, 'the orb is pushed');
  assert.ok(far.vx < fvx && far.rolling === 10, 'the far cart wobbles and is pushed');
  assert.equal(near.dead, true, 'the near cart breaks');
  assert.ok(s.items.items.length > before, 'and its minecart item is spawned in the blast');
});

test('server: a ghast fireball explodes inside its own update in the entity walk, not after it', () => {
  const { s, world } = server();
  const p = [...s.players.values()][0], mobs = s.dispense.mobs;
  const gx = Math.floor(p.position.x) + 6, gz = Math.floor(p.position.z), gy = groundAt(world, gx, gz);
  const ball = mobs.fireballs.launch({ large: true, owner: null, x: gx + 0.5, y: gy + 1.4, z: gz + 0.5, exact: [0, -1, 0] });
  const seen = [], inline = mobs.explodeInline;
  mobs.explodeInline = (ev) => { seen.push({ slot: mobs.slot, flaming: ev.explode.flaming }); return inline(ev); };
  for (let i = 0; i < 6 && !ball.dead; i++) { s.input('a', input()); s.tick(); }
  assert.equal(ball.dead, true, 'the ball hit the ground');
  assert.equal(seen.length, 1);
  assert.equal(seen[0].slot, ball, 'the blast ran during the ball\'s own turn in the walk');
  assert.equal(seen[0].flaming, true);
  assert.equal(mobs.events.filter(e => e.explode).length, 0, 'nothing left for the drain');
});

test('the wither\'s spawn blast runs inline when the host can (EntityWither.updateAITasks -> newExplosion, then level event 1013); a bare host queues it', () => {
  const run = (inline) => {
    const order = [], m = { events: [], ai: { player: null } };
    if (inline) m.explodeInline = (ev) => order.push('blast ' + ev.explode.size);
    const levelPush = m.events.push.bind(m.events);
    m.events.push = (...a) => { for (const e of a) order.push(e.explode ? 'queued' : 'event'); return levelPush(...a); };
    witherAITick({ e: { type: 'wither', x: 0, y: 64, z: 0, invul: 1, age: 3, health: 100 }, ai: { ew: m } });
    return order;
  };
  assert.deepEqual(run(true).slice(0, 1), ['blast 7']);
  assert.ok(!run(true).includes('queued'));
  assert.equal(run(false)[0], 'queued');
});
