// What the gun server's players and mobs do to the blocks they touch (multiplayer/server-contacts.js): step sounds every 1.667
// blocks for everyone near (the walker too, whose tab does not predict its movement), redstone ore lit by a step, a punch or a
// mob and unlit by its random tick, farmland trampled by a landing, the fall sounds and landing dust, the water splash, and the
// generated plants' support (population-blocks.js). Before this the server did none of them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GunSimulation } from './multiplayer/gun-simulation.js';
import { serverWorldReady, STREAMED_BIOME, STREAMED_GENERATION } from './multiplayer/server-world.js';
import { REDSTONE_ORE, LIT_REDSTONE_ORE, WATER, DEAD_BUSH, SAND } from './world.js';
import { installGunRules } from '../server/pack-loader.js';

await serverWorldReady;
await installGunRules();
const STREAMED = { seed: 'ledoge0', biome: STREAMED_BIOME, generationVersion: STREAMED_GENERATION };
const seeded = (seed = 1) => () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 2 ** 32);
const STONE = 3, DIRT = 2, FARMLAND = 29; // internal ids (world.js BLOCKS)
const run = (sim, n) => { for (let i = 0; i < n; i++) sim.tick(); };
const walk = { forward: 1, strafe: 0, jump: false, sneak: false, sprint: false };

// Alice (and Bob, 3 blocks away) in Survival on a stone floor in the sky, facing -z.
function arena() {
  const sim = new GunSimulation({ ...STREAMED, time: 6000 }, { config: { spawnMonsters: false, spawnAnimals: false, spawnProtection: 0 }, random: seeded(11) });
  sim.mobs.ew.entities.length = 0;
  const a = sim.addPlayer('a', 'Alice', 'acct-a'), b = sim.addPlayer('b', 'Bob', 'acct-b');
  const x = Math.floor(a.position.x), z = Math.floor(a.position.z), y = 150;
  for (let dx = -10; dx <= 10; dx++) for (let dz = -24; dz <= 10; dz++) sim.world.put(x + dx, y - 1, z + dz, STONE, 0);
  for (const p of [a, b]) { p.survival.mode = 'survival'; p.survival.inventory.creative = false; p.survival.inventory.main.fill(null); p.yaw = 0; p.pitch = 0; }
  sim.teleport(a, { x: x + 0.5, y, z: z + 0.5 });
  sim.teleport(b, { x: x + 3.5, y, z: z + 0.5 });
  run(sim, 3);
  for (const p of [a, b]) sim.drainEvents(p);
  return { sim, a, b, x, y, z };
}
const sounds = (sim, p, name) => sim.drainEvents(p).filter(e => e.type === 'sound' && (!name || e.sound.startsWith(name)));
function walkFor(sim, p, ticks) { for (let i = 0; i < ticks; i++) { p.input = walk; p.lastInput = sim.ticks; sim.tick(); } p.input = { ...walk, forward: 0 }; }

test('walking plays the step sound of the block underfoot for the walker and the players near it', () => {
  const { sim, a, b } = arena();
  walkFor(sim, a, 30);
  const own = sounds(sim, a, 'step.'), heard = sounds(sim, b, 'step.');
  assert.ok(own.length >= 2, `steps heard by the walker (${own.length})`);
  assert.equal(heard.length, own.length, 'Bob hears the same steps');
  assert.ok(own.every(e => e.sound === 'step.stone' && Math.abs(e.volume - 0.15) < 0.01), JSON.stringify(own[0]));
  walkFor(sim, b, 0);
  assert.equal(sounds(sim, a, 'step.').length, 0, 'standing still makes no steps');
});

test('a step on redstone ore lights it with a sparkle, and its random tick puts it out', () => {
  const { sim, a, x, y, z } = arena();
  for (let dz = -1; dz >= -12; dz--) sim.world.put(x, y - 1, z + dz, REDSTONE_ORE, 0);
  walkFor(sim, a, 30);
  const lit = [];
  for (let dz = -1; dz >= -12; dz--) if (sim.world.get(x, y - 1, z + dz) === LIT_REDSTONE_ORE) lit.push(dz);
  assert.ok(lit.length >= 1, 'stepped-on ore is lit');
  const sparks = sim.drainEvents(a).filter(e => e.type === 'fx' && e.kind === 'particles').flatMap(e => e.list);
  assert.ok(sparks.length >= 1 && sparks.every(q => q[0] === 'reddust'), 'reddust sparkle sent');
  const at = [x, y - 1, z + lit[0]];
  assert.equal(sim.weather.blockTick(...at, LIT_REDSTONE_ORE), true);
  assert.equal(sim.world.get(...at), REDSTONE_ORE, 'BlockRedstoneOre.updateTick unlights it');
  assert.equal(sim.weather.blockTick(...at, REDSTONE_ORE), false, 'the unlit ore does not tick');
});

test('punching redstone ore in Survival lights it (BlockRedstoneOre.onBlockClicked)', () => {
  const { sim, a, x, y, z } = arena();
  sim.world.put(x, y - 1, z, REDSTONE_ORE, 0);
  a.pitch = -Math.PI / 2 + 0.01;
  sim.mine(a, true); sim.tick(); sim.mine(a, false); sim.tick();
  assert.equal(sim.world.get(x, y - 1, z), LIT_REDSTONE_ORE);
});

test('a mob walking over redstone ore lights it', () => {
  const { sim, x, y, z } = arena();
  for (let dz = -3; dz <= 3; dz++) for (let dx = 5; dx <= 9; dx++) sim.world.put(x + dx, y - 1, z + dz, REDSTONE_ORE, 0);
  const ew = sim.mobs.ew, pig = ew.create('pig', x + 7.5, y, z + 0.5);
  ew.entities.push(pig);
  let lit = 0;
  for (let i = 0; i < 400 && !lit; i++) {
    pig.vx = 0.15; pig.vz = (i % 40 < 20 ? 0.1 : -0.1); if (pig.x > x + 9) pig.x = x + 5.5;
    sim.tick();
    for (let dz = -3; dz <= 3; dz++) for (let dx = 5; dx <= 9; dx++) if (sim.world.get(x + dx, y - 1, z + dz) === LIT_REDSTONE_ORE) lit++;
  }
  assert.ok(lit > 0, 'the pig lit some ore');
});

test('a player landing on farmland tramples it, with the fall sound and landing dust for the players near', () => {
  const { sim, a, b, x, y, z } = arena();
  sim.world.put(x, y - 1, z - 3, FARMLAND, 0);
  sim.teleport(a, { x: x + 0.5, y: y + 6, z: z - 2.5 });
  run(sim, 30);
  assert.equal(sim.world.get(x, y - 1, z - 3), DIRT, 'BlockFarmland.onFallenUpon: dirt');
  const own = sim.drainEvents(a), heard = sim.drainEvents(b);
  for (const list of [own, heard]) {
    assert.ok(list.some(e => e.type === 'sound' && /fall/.test(e.sound)), 'fall sound');
    const dust = list.find(e => e.type === 'fx' && e.kind === 'landingDust');
    assert.ok(dust, 'landing dust (aux 2006)');
    assert.deepEqual([dust.x, dust.y, dust.z], [x, y - 1, z - 3]);
    assert.ok(dust.data >= 2 && dust.data <= 3, `ceil(distance - 3) = ${dust.data}`);
  }
});

test('a mob landing on farmland tramples it unless an operator turned mobGriefing off', () => {
  for (const griefing of [true, false]) {
    const { sim, x, y, z } = arena();
    if (!griefing) sim.rules.mobGriefing = false;
    sim.world.put(x + 6, y - 1, z, FARMLAND, 0);
    const ew = sim.mobs.ew, pig = ew.create('pig', x + 6.5, y + 5, z + 0.5);
    ew.entities.push(pig);
    for (let i = 0; i < 40; i++) { pig.vx = 0; pig.vz = 0; pig.x = x + 6.5; pig.z = z + 0.5; sim.tick(); }
    assert.equal(sim.world.get(x + 6, y - 1, z), griefing ? DIRT : FARMLAND, `mobGriefing ${griefing}`);
  }
});

test('jumping into water splashes for everyone near', () => {
  const { sim, a, b, x, y, z } = arena();
  for (let dx = -1; dx <= 1; dx++) for (let dz = -6; dz <= -4; dz++) { sim.world.put(x + dx, y - 1, z + dz, WATER, 0); sim.world.put(x + dx, y - 2, z + dz, STONE, 0); }
  sim.teleport(a, { x: x + 0.5, y: y + 4, z: z - 4.5 });
  for (let i = 0; i < 30; i++) sim.tick();
  for (const p of [a, b]) {
    const list = sim.drainEvents(p);
    assert.ok(list.some(e => e.type === 'sound' && e.sound === 'game.player.swim.splash'), `${p.name} hears the splash`);
    const parts = list.filter(e => e.type === 'fx' && e.kind === 'particles').flatMap(e => e.list).map(q => q[0]);
    assert.ok(parts.includes('splash') && parts.includes('bubble'), `${p.name} sees it`);
  }
});

test('a dead bush whose sand is removed pops off (population-blocks.js support on the server)', () => {
  const { sim, x, y, z } = arena();
  sim.world.set(x + 4, y, z - 6, SAND, true, 0);
  sim.world.set(x + 4, y + 1, z - 6, DEAD_BUSH, true, 0);
  run(sim, 2);
  assert.equal(sim.world.get(x + 4, y + 1, z - 6), DEAD_BUSH);
  sim.world.set(x + 4, y, z - 6, 0, true, 0);
  run(sim, 2);
  assert.equal(sim.world.get(x + 4, y + 1, z - 6), 0);
});
