// Primed TNT on the gun server (server-mobs.js prime / tickTnt): flint and steel, redstone, a dispenser, fire and another
// explosion light it; it falls, explodes at the end of its 80-tick fuse, hurts and pushes players, and goes to the tabs as rows
// ([id, x, y, z, fuse]) and into the saved state.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GunSimulation } from './multiplayer/gun-simulation.js';
import { serverWorldReady, STREAMED_BIOME, STREAMED_GENERATION } from './multiplayer/server-world.js';
import { makeStack } from './inventory.js';
import { TNT_Y_OFFSET } from './explosion.js';
import { FIRE } from './world.js';
import { installGunRules } from '../server/pack-loader.js';

await serverWorldReady;
await installGunRules();
const STREAMED = { seed: 'ledoge0', biome: STREAMED_BIOME, generationVersion: STREAMED_GENERATION };
const seeded = (seed = 1) => () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 2 ** 32);
const STONE = 1, TNT = 55, FLINT = 126, DISPENSER = 115, REDSTONE_BLOCK = 123;

// Alice on a stone floor in the sky (y - 1); (x0, y, z0) is a free cell three blocks north of her.
function arena(state = {}) {
  const sim = new GunSimulation({ ...STREAMED, time: 6000, ...state }, { config: { spawnMonsters: false, spawnAnimals: false, spawnProtection: 0 }, random: seeded(7) });
  sim.mobs.ew.entities.length = 0;
  const a = sim.addPlayer('a', 'Alice', 'acct-a');
  const ax = Math.floor(a.position.x), az = Math.floor(a.position.z), y = 150;
  for (let dx = -8; dx <= 8; dx++) for (let dz = -8; dz <= 8; dz++) sim.world.put(ax + dx, y - 1, az + dz, STONE, 0);
  sim.teleport(a, { x: ax + 0.5, y, z: az + 0.5 });
  for (let i = 0; i < 3; i++) sim.tick();
  const sounds = [], sound = sim.mobs.sound.bind(sim.mobs);
  sim.mobs.sound = e => { sounds.push(e.sound); sound(e); };
  const aim = (x, y, z) => {
    const P = a.position, dx = x - P.x, dz = z - P.z, dy = y - (P.y + 1.62);
    a.yaw = Math.atan2(-dx, -dz); a.pitch = Math.atan2(dy, Math.hypot(dx, dz));
  };
  return { sim, a, ax, az, x0: ax, y, z0: az - 3, sounds, aim };
}
const floorHoles = (sim, x, y, z, r = 2) => {
  let n = 0;
  for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) if (sim.world.get(x + dx, y - 1, z + dz) === 0) n++;
  return n;
};

test('flint and steel lights a TNT block: a primed TNT, the fuse sound, then an explosion after 80 ticks that breaks the floor', () => {
  const { sim, a, x0, y, z0, sounds, aim } = arena();
  sim.world.set(x0, y, z0, TNT, true, 0);
  const inv = a.survival.inventory;
  inv.main[inv.current] = makeStack(FLINT, 1, 0);
  aim(x0 + 0.5, y + 0.5, z0 + 0.999);
  assert.equal(sim.edit(a, true), true);
  assert.equal(sim.world.get(x0, y, z0), 0, 'the block is gone');
  assert.equal(sim.mobs.primed.length, 1);
  const e = sim.mobs.primed[0];
  assert.equal(e.fuse, 80);
  assert.equal(e.by, 'a', 'Alice lit it');
  assert.ok(Math.abs(e.x - (x0 + 0.5)) < 0.05 && Math.abs(e.z - (z0 + 0.5)) < 0.05);
  assert.ok(sounds.includes('game.tnt.primed'));
  // A tab near it gets its row; the save keeps it.
  const row = sim.mobs.thrownRows(a).tnt;
  assert.equal(row.length, 1);
  assert.equal(row[0][4], 80);
  assert.equal(sim.mobs.save().tnt.length, 1);
  a.survival.mode = 'survival'; a.survival.inventory.creative = false;
  const health = a.survival.health;
  for (let i = 0; i < 82; i++) sim.tick();
  assert.equal(sim.mobs.primed.length, 0, 'exploded');
  assert.ok(floorHoles(sim, x0, y, z0) > 3, 'a crater in the floor');
  assert.ok(a.survival.health < health, `Alice is hurt: ${a.survival.health}`);
});

test('a powered TNT block lights, and a dispenser fires its TNT primed and silent', () => {
  let { sim, x0, y, z0, sounds } = arena();
  sim.world.set(x0, y, z0, TNT, true, 0);
  sim.world.set(x0 + 1, y, z0, REDSTONE_BLOCK, true, 0);
  for (let i = 0; i < 2; i++) sim.tick();
  assert.equal(sim.world.get(x0, y, z0), 0);
  assert.equal(sim.mobs.primed.length, 1);
  assert.ok(sounds.includes('game.tnt.primed'));
  ({ sim, x0, y, z0, sounds } = arena());
  sim.world.set(x0, y, z0, DISPENSER, true, 0);
  sim.world.put(x0, y, z0, DISPENSER, 5); // facing east
  (sim.tiles.dispensers[`${x0},${y},${z0}`] ??= { items: Array(9).fill(null) }).items[0] = makeStack(TNT, 1, 0);
  sim.world.set(x0, y, z0 - 1, REDSTONE_BLOCK, true, 0);
  for (let i = 0; i < 6; i++) sim.tick();
  assert.equal(sim.mobs.primed.length, 1);
  const e = sim.mobs.primed[0];
  assert.ok(Math.abs(e.x - (x0 + 1.5)) < 0.1, `in the cell in front: ${e.x}`);
  assert.ok(!sounds.includes('game.tnt.primed'), 'BehaviorDispenseTNT plays no sound');
});

test('an exploding TNT lights the TNT block beside it with a short fuse, and pushes another primed TNT', () => {
  const { sim, x0, y, z0 } = arena();
  sim.world.set(x0 + 2, y, z0, TNT, true, 0);
  const first = sim.mobs.prime(x0, y, z0), other = sim.mobs.prime(x0 - 2, y, z0);
  first.fuse = 0; other.fuse = 70;
  sim.tick();
  assert.equal(sim.world.get(x0 + 2, y, z0), 0, 'the block went');
  assert.equal(sim.mobs.primed.length, 2);
  const chained = sim.mobs.primed.find(e => e !== other);
  assert.ok(chained.fuse < 30, `a chain fuse: ${chained.fuse}`);
  assert.ok(other.vx < -0.01, `pushed west: ${other.vx}`);
});

test('fire next to a TNT block lights it', () => {
  const { sim, x0, y, z0 } = arena();
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) sim.world.set(x0 + dx, y, z0 + dz, TNT, true, 0);
  sim.world.set(x0, y + 1, z0, FIRE, true, 0);
  for (let i = 0; i < 2400 && !sim.mobs.primed.length; i++) sim.tick();
  assert.ok(sim.mobs.primed.length >= 1, 'a burnt TNT block lit');
});

test('a burning arrow Alice shoots into a TNT block lights it as hers', () => {
  const { sim, a, x0, y, z0 } = arena();
  sim.world.set(x0, y, z0, TNT, true, 0);
  const arrow = sim.mobs.arrows.shootPlayer({ x: x0 + 0.5, y: y + 0.5 - 1.62, z: z0 + 2.5 }, 180, 0, 1.5);
  Object.assign(arrow, { x: x0 + 0.5, y: y + 0.5, z: z0 + 2.5, mx: 0, my: 0, mz: -1.5, fire: 100, by: a.id });
  for (let i = 0; i < 10 && !sim.mobs.primed.length; i++) sim.tick();
  assert.equal(sim.world.get(x0, y, z0), 0, 'the block went');
  assert.equal(sim.mobs.primed.length, 1);
  assert.equal(sim.mobs.primed[0].by, 'a');
});

test('primed TNT comes back from the saved state', () => {
  const { sim, x0, y, z0 } = arena();
  sim.mobs.prime(x0, y, z0, null);
  for (let i = 0; i < 5; i++) sim.tick();
  const saved = sim.mobs.save().tnt;
  const { sim: again } = arena();
  const restored = new again.mobs.constructor(again, { tnt: saved }).primed;
  assert.equal(restored.length, 1);
  assert.equal(restored[0].fuse, saved[0].fuse);
  assert.ok(Math.abs(restored[0].y - saved[0].y) < 1e-9, 'the same box bottom');
  assert.ok(Math.abs(restored[0].y + TNT_Y_OFFSET - (saved[0].y + TNT_Y_OFFSET)) < 1e-9);
});
