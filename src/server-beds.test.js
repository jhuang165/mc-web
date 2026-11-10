// Beds on the gun server (server-beds.js): a bed click at night lays a player down (others see it lying, the tab gets you.sleep),
// by day it says so; once every player is fully asleep the night is skipped and the weather clears; Leave Bed and the morning set
// the spawn point, a respawn goes back to the bed, and a missing bed sends the player to the world spawn with tile.bed.notValid.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GunSimulation } from './multiplayer/gun-simulation.js';
import { serverWorldReady, STREAMED_BIOME, STREAMED_GENERATION } from './multiplayer/server-world.js';
import { BED, BED_TEXT, isBedOccupied } from './bed.js';
import { installGunRules } from '../server/pack-loader.js';

await serverWorldReady;
await installGunRules();
const STREAMED = { seed: 'ledoge0', biome: STREAMED_BIOME, generationVersion: STREAMED_GENERATION };
const seeded = (seed = 1) => () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 2 ** 32);
const STONE = 1, NIGHT = 18000;

// Alice (and Bob) on a stone floor in the sky; a bed north of Alice, foot at (bx, y, bz + 1), head at (bx, y, bz),
// facing 2 (the head lies at -z).
function arena({ time = NIGHT, bob = false } = {}) {
  const sim = new GunSimulation({ ...STREAMED, time }, { config: { spawnMonsters: false, spawnAnimals: false, spawnProtection: 0 }, random: seeded(7) });
  sim.mobs.ew.entities.length = 0;
  const a = sim.addPlayer('a', 'Alice', 'acct-a');
  const b = bob ? sim.addPlayer('b', 'Bob', 'acct-b') : null;
  const ax = Math.floor(a.position.x), az = Math.floor(a.position.z), y = 150;
  for (let dx = -8; dx <= 8; dx++) for (let dz = -8; dz <= 8; dz++) sim.world.put(ax + dx, y - 1, az + dz, STONE, 0);
  const bx = ax, bz = az - 2;
  sim.world.put(bx, y, bz + 1, BED, 2); sim.world.put(bx, y, bz, BED, 2 | 8);
  sim.world.put(bx + 3, y, bz + 1, BED, 2); sim.world.put(bx + 3, y, bz, BED, 2 | 8); // Bob's
  sim.teleport(a, { x: ax + 0.5, y, z: az + 0.5 });
  if (b) sim.teleport(b, { x: ax + 3.5, y, z: az + 0.5 });
  for (let i = 0; i < 3; i++) sim.tick();
  const told = [];
  sim.tell = (p, text) => told.push([p.id, text]);
  return { sim, a, b, bx, y, bz, told };
}

test('a bed by day says so; at night Alice lies down, the head is occupied, and Bob sees her lying in it', () => {
  let { sim, a, bx, y, bz, told } = arena({ time: 6000 });
  sim.useBed(a, bx, y, bz + 1);
  assert.deepEqual(told, [['a', BED_TEXT.noSleep]]);
  assert.equal(a.bed.sleeping, false);
  let b;
  ({ sim, a, b, bx, y, bz, told } = arena({ bob: true }));
  sim.useBed(a, bx, y, bz + 1); // the foot half
  assert.equal(a.bed.sleeping, true);
  assert.deepEqual(a.bed.bed, [bx, y, bz]);
  assert.ok(isBedOccupied(sim.world.getMeta(bx, y, bz)));
  assert.ok(Math.abs(a.position.y - (y + 0.5625)) < 1e-6, 'on the mattress');
  sim.tick();
  const row = sim.you(a).sleep;
  assert.deepEqual(row.bed, [bx, y, bz]);
  assert.equal(row.facing, 2);
  assert.equal(row.timer, 1);
  const seen = sim.presence().find(e => e.id === 'a').sleeping;
  assert.equal(seen.facing, 2);
  assert.ok(Math.abs(seen.z - (bz + 0.5 - 0.4)) < 1e-4 && Math.abs(seen.y - (y + 0.9375)) < 1e-4, 'the lying position');
  assert.deepEqual(seen.offset.map(v => Math.round(v * 10) / 10), [-0, 0, 1.8]);
  // Bob cannot get into her bed; walking and clicks do nothing to her while she lies.
  sim.teleport(b, { x: bx + 1.5, y, z: bz + 0.5 });
  sim.useBed(b, bx, y, bz);
  assert.deepEqual(told.at(-1), ['b', BED_TEXT.occupied]);
  assert.equal(b.bed.sleeping, false);
  a.input = { ...a.input, forward: 1 }; a.lastInput = sim.ticks;
  const at = { ...a.position };
  for (let i = 0; i < 5; i++) sim.tick();
  assert.ok(Math.abs(a.position.z - at.z) < 1e-9, 'she does not walk away');
  assert.equal(sim.queueEdit('a', { type: 'edit', place: true }), false);
});

test('one player asleep for 100 ticks skips to the next morning and clears the rain; both wake with the bed as their spawn', () => {
  const { sim, a, bx, y, bz } = arena();
  sim.weather.raining = true; sim.weather.rainTime = 5000;
  sim.useBed(a, bx, y, bz);
  for (let i = 0; i < 99; i++) sim.tick();
  assert.equal(a.bed.sleeping, true);
  assert.ok(sim.time < 24000);
  sim.tick(); sim.tick();
  assert.equal(a.bed.sleeping, false, 'woken by the morning');
  assert.ok(sim.time >= 24000 && sim.time < 24010, `the next morning: ${sim.time}`);
  assert.equal(sim.weather.raining, false);
  assert.deepEqual(a.bed.spawn, [bx, y, bz]);
  assert.ok(!isBedOccupied(sim.world.getMeta(bx, y, bz)), 'the bed is free again');
  assert.equal(sim.you(a).sleep.timer, 101, 'the fade after waking');
  for (let i = 0; i < 12; i++) sim.tick();
  assert.equal(sim.you(a).sleep, undefined, 'the fade is over');
});

test('the night goes on while anyone is awake', () => {
  const { sim, a, b, bx, y, bz } = arena({ bob: true });
  sim.useBed(a, bx, y, bz);
  for (let i = 0; i < 150; i++) sim.tick();
  assert.equal(a.bed.sleeping, true);
  assert.ok(sim.time < 24000);
  sim.teleport(b, { x: bx + 3.5, y, z: bz + 1.5 });
  sim.useBed(b, bx + 3, y, bz);
  assert.equal(b.bed.sleeping, true);
  for (let i = 0; i < 101; i++) sim.tick();
  assert.ok(sim.time >= 24000, 'both asleep: morning');
  assert.equal(a.bed.sleeping || b.bed.sleeping, false);
});

test('Leave Bed sets the spawn; Alice respawns beside her bed, and once it is gone she gets the world spawn and notValid', () => {
  const { sim, a, bx, y, bz, told } = arena();
  sim.spawnPoint = () => ({ x: bx + 40.5, y, z: bz + 40.5 }); // World.getSpawnPoint, away from the bed
  sim.useBed(a, bx, y, bz);
  sim.tick();
  assert.equal(sim.wake('a'), true);
  assert.equal(a.bed.sleeping, false);
  assert.deepEqual(a.bed.spawn, [bx, y, bz]);
  assert.ok(Math.hypot(a.position.x - (bx + 0.5), a.position.z - (bz + 0.5)) < 2.5, 'stands beside the bed');
  assert.deepEqual(sim.savePlayer(a).bed.spawn, [bx, y, bz], 'saved with the account');
  sim.teleport(a, { x: bx + 7.5, y, z: bz + 7.5 });
  a.survival.damage(1000, 'void'); sim.tick();
  assert.equal(a.dead, true);
  assert.equal(sim.respawn('a'), true);
  assert.ok(Math.hypot(a.position.x - (bx + 0.5), a.position.z - (bz + 0.5)) < 2.5, `back by the bed: ${a.position.x}, ${a.position.z}`);
  sim.world.put(bx, y, bz, 0, 0); sim.world.put(bx, y, bz + 1, 0, 0);
  a.survival.damage(1000, 'void'); sim.tick();
  assert.equal(sim.respawn('a'), true);
  assert.deepEqual(told.at(-1), ['a', BED_TEXT.notValid]);
  assert.equal(a.bed.spawn, null);
  assert.deepEqual([a.position.x, a.position.y, a.position.z], [bx + 40.5, y, bz + 40.5], 'the world spawn');
});

test('getting hurt, breaking the bed or leaving the server wakes a sleeper without setting the spawn', () => {
  let { sim, a, bx, y, bz } = arena();
  sim.useBed(a, bx, y, bz);
  a.survival.mode = 'survival'; a.survival.inventory.creative = false; a.survival.protection = 0; a.survival.hurtTicks = 0;
  a.survival.damage(2, 'generic');
  sim.tick();
  assert.equal(a.bed.sleeping, false);
  assert.equal(a.bed.spawn, null);
  ({ sim, a, bx, y, bz } = arena());
  sim.useBed(a, bx, y, bz);
  sim.world.put(bx, y, bz, 0, 0);
  sim.tick();
  assert.equal(a.bed.sleeping, false);
  assert.equal(a.bed.spawn, null);
  ({ sim, a, bx, y, bz } = arena());
  sim.useBed(a, bx, y, bz);
  sim.removePlayer('a');
  assert.ok(!isBedOccupied(sim.world.getMeta(bx, y, bz)));
  const saved = sim.accounts.get('acct-a');
  assert.equal(saved.bed.bed, null, 'not saved asleep');
  assert.ok(Math.abs(saved.position.y - (y + 0.5625)) > 0.05, 'saved standing, not on the mattress');
});
