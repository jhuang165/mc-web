// Batch 67 (mpvehiclehits): lightning on boats, carts and arrows; a snowball that meets a player; explosions that release silverfish; the iron golem copy's walking dust.
// Bytecode-read facts (javap over the 1.7.10 jar) are in the track note; no sockets, no browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { World, MONSTER_EGG } from './world.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { RemoteMobs } from './multiplayer/remote-mobs.js';
import { golemDust } from './multiplayer/client-golems.js';
import { LightningBolt } from './weather.js';
import { tickWeatherSimulation } from './weather-simulation.js';
import { explodeBlocks } from './explosion.js';
import { JavaRandom } from './java-random.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const input = () => ({ type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
function fixture() {
  const world = new World('mp-vehiclehits-b67');
  for (let x = 20; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 30; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: 'survival', mobs: true });
  s.mobs.spawning = false; s.mobs.mobs.entities.length = 0;
  return s;
}
const join = (s, x = 64.5, z = 64.5) => { const p = s.addPlayer('a', 'ax', key(1)); p.position.copy({ x, y: 10, z }); p.previous.copy(p.position); s.input('a', input()); s.tick(); p.survival.protection = 0; return p; };
const bolt = (s, x, z) => new LightningBolt(x, 10, z, new JavaRandom(7), s.fire.strikes);

test('a bolt breaks a boat and a minecart in its box (50 > 40 damage) and leaves one outside; the boat drops its item', () => {
  const s = fixture(), v = s.vehicles;
  const boat = v.spawnVehicle('boat', 64.5, 10, 64.5), cart = v.spawnVehicle('minecart', 66.5, 10, 64.5), far = v.spawnVehicle('minecart', 80.5, 10, 64.5);
  s.lightning.strike(bolt(s, 64.5, 64.5));
  assert.equal(boat.dead, true);
  assert.equal(cart.dead, true);
  assert.equal(far.dead, false, 'beyond +-3 blocks');
  assert.ok(v.boats.drops.length >= 1, 'the boat item');
  assert.ok(v.carts.drops.length >= 1, 'the cart item');
});

test('a TNT cart struck by a bolt explodes (the source is fire damage)', () => {
  const s = fixture(), v = s.vehicles;
  let blasts = 0; const was = s.mobs.explode.bind(s.mobs); s.mobs.explode = ev => { blasts++; return was(ev); };
  const cart = v.spawnVehicle('tnt_minecart', 64.5, 10, 64.5);
  s.tick(); // Minecarts keeps the host of its last tick (the explosion hook)
  s.lightning.strike(bolt(s, 64.5, 64.5));
  assert.equal(cart.dead, true);
  assert.equal(blasts, 1);
});

test('an arrow in the box gets the fire counter only; a second strike on the same bolt does nothing more to a broken boat', () => {
  const s = fixture();
  const a = { x: 65, y: 11, z: 64.5, fire: 0, dead: false }, out = { x: 90, y: 11, z: 64.5, fire: 0, dead: false };
  s.dispense.arrows.list.push(a, out);
  const b = bolt(s, 64.5, 64.5), boat = s.vehicles.spawnVehicle('boat', 64.5, 10, 64.5);
  s.lightning.strike(b);
  assert.equal(a.fire, 1, 'fire 0 + 1 (a fresh entity lands on 1, it does not ignite)');
  assert.equal(out.fire, 0);
  const n = s.vehicles.boats.drops.length;
  s.lightning.strike(b);
  assert.equal(s.vehicles.boats.drops.length, n);
  assert.equal(boat.dead, true);
});

test('single player: tickWeatherSimulation hands the struck bolt to the things hook', () => {
  const s = fixture(), boat = s.vehicles.spawnVehicle('boat', 64.5, 10, 64.5);
  const b = bolt(s, 64.5, 64.5);
  tickWeatherSimulation({ world: s.world, weather: { tick() {}, struck: [b] }, mobs: null, survival: { creative: true }, things: () => ({ boats: s.vehicles.boats }) }, { x: 0, y: 0, z: 0 }, 0.6, 1.8);
  assert.equal(boat.dead, true);
});

test('a golem snowball that reaches a player is used up and does nothing: no damage, no knockback (EntityPlayer.attackEntityFrom returns false at 0)', () => {
  const s = fixture(), p = join(s), golem = s.mobs.mobs.create('snow_golem', 56.5, 10, 64.5);
  s.mobs.mobs.entities.push(golem);
  const gb = s.mobs.mobs.golemBalls, rng = gb.projectiles.rng();
  const ball = { x: 62, y: 10.8, z: 64.5, mx: 0.6, my: 0, mz: 0, kind: 'snowball', owner: golem, px: 62, py: 10.8, pz: 64.5, yaw: 90, pitch: 0, prevYaw: 90, prevPitch: 0, ticks: 20, rand: rng, random: rng, dead: false };
  gb.projectiles.balls.push(ball);
  const health = p.survival.health, v = { ...p.velocity };
  for (let i = 0; i < 4 && !ball.dead; i++) s.tick();
  assert.equal(ball.dead, true, 'the ball met the player');
  assert.equal(p.survival.health, health);
  assert.deepEqual({ x: p.velocity.x, y: p.velocity.y, z: p.velocity.z }, { x: v.x, y: v.y, z: v.z });
  // a ball that passes 4 blocks beside the player keeps flying
  const miss = { ...ball, z: 69, pz: 69, x: 62, px: 62, dead: false, ticks: 20 };
  gb.projectiles.balls.push(miss);
  s.tick();
  assert.equal(miss.dead, false);
});

test('explodeBlocks lists the monster eggs it breaks; a creeper-sized blast on the dedicated server lets that many silverfish out', () => {
  const s = fixture(), w = s.world;
  const eggs = [[64, 10, 64], [65, 10, 64], [64, 10, 65]];
  for (const [x, y, z] of eggs) w.put(x, y, z, MONSTER_EGG, 0, false);
  const probe = explodeBlocks(w, 64.5, 11, 64.5, 4, new JavaRandom(3));
  assert.ok(probe.released.length > 0 && probe.released.every(([x, y, z]) => w.get(x, y, z) === MONSTER_EGG));
  s.mobs.mobs.entities.length = 0;
  s.mobs.explode({ x: 64.5, y: 11, z: 64.5, size: 4, source: null });
  const fish = s.mobs.mobs.entities.filter(e => e.type === 'silverfish');
  assert.ok(fish.length > 0, 'silverfish came out');
  assert.equal(fish.length, eggs.filter(([x, y, z]) => w.get(x, y, z) === 0).length, 'one per destroyed egg');
  const at = fish[0];
  assert.ok(Math.abs(at.x % 1) === 0.5 && Math.abs(at.z % 1) === 0.5, 'at the egg cell centre (x + 0.5, z + 0.5)');
  s.mobs.mobs.entities.length = 0;
  const calm = explodeBlocks(w, 64.5, 11, 64.5, 4, new JavaRandom(3), { smoking: false });
  assert.deepEqual(calm.released, [], 'nothing breaks with mobGriefing off, so nothing is released');
});

test('golemDust: an iron golem copy moving faster than sqrt(2.5E-7) blocks per tick throws a blockcrack of the block below on the 1 in 5 roll; one standing still does not', () => {
  const mob = { type: 'iron_golem', health: 100 }, below = () => ({ id: 3, meta: 0 });
  const yes = { nextInt: () => 0, nextFloat: () => 0.5 };
  const d = golemDust({ x: 5, y: 10, z: 5, vx: 0.1, vz: 0 }, mob, yes, below);
  assert.equal(d.id, 3);
  assert.ok(Math.abs(d.y - 10.1) < 1e-9);
  assert.equal(golemDust({ x: 5, y: 10, z: 5, vx: 0, vz: 0 }, mob, yes, below), null);
  assert.equal(golemDust({ x: 5, y: 10, z: 5, vx: 0.1, vz: 0 }, mob, { nextInt: () => 1, nextFloat: () => 0.5 }, below), null);
  assert.equal(golemDust({ x: 5, y: 10, z: 5, vx: 0.1, vz: 0 }, { type: 'zombie', health: 20 }, yes, below), null);
  assert.equal(golemDust({ x: 5, y: 10, z: 5, vx: 0.1, vz: 0 }, mob, yes, () => null), null, 'air below');
});

test('RemoteMobs draws the dust for a walking golem copy through fx.blockParticle', () => {
  const world = new World('copy-dust'), got = [];
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) world.put(x, 9, z, 3, 0, false);
  const rm = new RemoteMobs(world, { blockParticle: (...a) => got.push(a) });
  rm.rand = { nextInt: () => 0, nextFloat: () => 0.5 };
  rm.apply([{ type: 'spawn', i: 1, mob: 'iron_golem', x: 32 * 5, y: 32 * 10, z: 32 * 5, yaw: 0, pitch: 0, headYaw: 0 }]);
  rm.tick();
  assert.equal(got.length, 0, 'at rest');
  rm.copies.get(1).client.vx = 0.15;
  rm.tick();
  assert.equal(got.length, 1);
  assert.equal(got[0][0], 3);
});
