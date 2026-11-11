// The gun server's last three achievements (multiplayer/server-stats.js, server-stations.js): Beaconator for the players in
// the box of a beacon whose pyramid has just reached 4 levels, The Beginning? for the players within 50 of a Wither built
// from soul sand and skulls, and Diamonds to you! for the player who threw (Q) a diamond that someone else picks up.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GunSimulation } from './multiplayer/gun-simulation.js';
import { serverWorldReady, STREAMED_BIOME, STREAMED_GENERATION } from './multiplayer/server-world.js';
import { makeStack } from './inventory.js';
import { BEACON, fullBeaconReach } from './pyramid.js';
import { ACHIEVEMENTS } from './achievements.js';
import { ITEM_SKULL, SKULL, SKULLS } from './skull.js';
import { SOUL_SAND } from './nether-blocks.js';
import { ItemEntities } from './item-entities.js';
import { installGunRules } from '../server/pack-loader.js';

await serverWorldReady;
await installGunRules();
const STREAMED = { seed: 'ledoge0', biome: STREAMED_BIOME, generationVersion: STREAMED_GENERATION };
const quiet = { spawnMonsters: false, spawnAnimals: false, spawnProtection: 0 };
const run = (sim, n) => { for (let i = 0; i < n; i++) sim.tick(); };
const seeded = (seed = 1) => () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 2 ** 32);
const IRON_BLOCK = 26, DIAMOND = 303;

// Alice, Bob and Carol in Survival on a stone platform in the sky, with every achievement but `id` already unlocked (the parents).
function sky(id) {
  const sim = new GunSimulation({ ...STREAMED, time: 6000 }, { config: quiet, random: seeded(7) });
  sim.mobs.ew.entities.length = 0;
  const players = [['a', 'Alice'], ['b', 'Bob'], ['c', 'Carol']].map(([k, name]) => sim.addPlayer(k, name, `acct-${k}`));
  const [a] = players, x0 = Math.floor(a.position.x), z0 = Math.floor(a.position.z), y = 150;
  for (let dx = -6; dx <= 6; dx++) for (let dz = -6; dz <= 6; dz++) sim.world.put(x0 + dx, y - 1, z0 + dz, 1, 0);
  for (const p of players) {
    sim.teleport(p, { x: x0 + 0.5, y, z: z0 + 0.5 });
    p.survival.mode = 'survival'; p.survival.inventory.creative = false; p.survival.inventory.main.fill(null);
    for (const ach of ACHIEVEMENTS) if (ach.id !== id) p.achievements.unlocked.add(ach.id);
  }
  run(sim, 3);
  return { sim, players, x0, z0, y };
}

test('the Beaconator box is the beacon cell grown by 10 across and from 5 below to 1 above', () => {
  const tile = { x: 100, y: 64, z: -40 };
  assert.ok(fullBeaconReach(tile, { x: 110.2, y: 64, z: -40 }), 'the box edge, inside by the half width');
  assert.ok(!fullBeaconReach(tile, { x: 110.4, y: 64, z: -40 }), 'just outside x + 10');
  assert.ok(!fullBeaconReach(tile, { x: 89.6, y: 64, z: -40 }), 'just outside x - 10');
  assert.ok(fullBeaconReach(tile, { x: 100, y: 57.3, z: -40 }), 'the head inside y - 5');
  assert.ok(!fullBeaconReach(tile, { x: 100, y: 57.1, z: -40 }), 'below');
  assert.ok(!fullBeaconReach(tile, { x: 100, y: 65, z: -40 }), 'the feet at y + 1');
});

test('a beacon whose pyramid reaches 4 levels gives Beaconator to the players in its box, once', () => {
  const { sim, players: [a, b, c], x0, z0, y } = sky('fullBeacon');
  const bx = x0, by = y + 4, bz = z0 - 1;
  for (let l = 1; l <= 4; l++) for (let dx = -l; dx <= l; dx++) for (let dz = -l; dz <= l; dz++) sim.world.set(bx + dx, by - l, bz + dz, IRON_BLOCK, true, 0);
  sim.world.set(bx, by, bz, BEACON, true, 0);
  run(sim, 1);
  assert.ok(sim.play.stations.beacons.get(bx, by, bz), 'the beacon tile');
  sim.teleport(a, { x: bx + 3.5, y: by + 1, z: bz + 0.5 }); // on the pyramid's top layer
  for (let yy = by - 2; yy <= by; yy++) sim.world.set(bx + 3, yy, bz + 3, 1, true, 0); // a pillar on the third layer
  sim.teleport(b, { x: bx + 3.5, y: by + 1, z: bz + 3.5 }); // on the pillar, the feet at the box top
  sim.teleport(c, { x: bx + 5.5, y: by - 4, z: bz + 5.5 }); // on the platform beside the base, 4 below
  run(sim, 81);
  assert.equal(sim.play.stations.beacons.get(bx, by, bz).levels, 4);
  assert.ok(a.achievements.has('fullBeacon'), 'Alice on top');
  assert.ok(!b.achievements.has('fullBeacon'), 'Bob above the box');
  assert.ok(c.achievements.has('fullBeacon'), 'Carol beside the base');
  // The next checks keep 4 levels: no new award, even for a player who walks in afterwards.
  sim.teleport(b, { x: bx + 3.5, y: by + 1, z: bz + 0.5 });
  run(sim, 81);
  assert.ok(!b.achievements.has('fullBeacon'), 'no award while the pyramid stays at 4');
  // A broken layer and a rebuilt one: the next transition awards Bob.
  sim.world.set(bx + 4, by - 4, bz + 4, 0, true, 0);
  run(sim, 80);
  assert.equal(sim.play.stations.beacons.get(bx, by, bz).levels, 3);
  sim.world.set(bx + 4, by - 4, bz + 4, IRON_BLOCK, true, 0);
  run(sim, 80);
  assert.ok(b.achievements.has('fullBeacon'), 'Bob, at the rebuild');
});

test('the last wither skull of the T spawns the Wither and gives The Beginning? to the players within 50', () => {
  const { sim, players: [a, b, c], x0, z0, y } = sky('spawnWither');
  // Alice on a block a level up, looking down at the T's middle soul sand two ahead (-z), the row along x.
  sim.world.put(x0, y, z0, 1, 0);
  sim.teleport(a, { x: x0 + 0.5, y: y + 1, z: z0 + 0.5 });
  const tz = z0 - 2;
  sim.world.set(x0, y, tz, SOUL_SAND, true, 0);
  for (const dx of [-1, 0, 1]) sim.world.set(x0 + dx, y + 1, tz, SOUL_SAND, true, 0);
  for (const dx of [-1, 1]) { sim.world.set(x0 + dx, y + 2, tz, SKULL, true, 1); SKULLS.create(x0 + dx, y + 2, tz, 1, 0); }
  sim.teleport(b, { x: x0 + 30.5, y, z: z0 + 30.5 });
  sim.teleport(c, { x: x0 + 52.5, y, z: z0 + 0.5 });
  run(sim, 2);
  a.survival.inventory.current = 0;
  a.survival.inventory.main[0] = makeStack(ITEM_SKULL, 1, 1);
  a.yaw = 0; a.pitch = Math.atan2(-(y + 1 + 1.62 - (y + 2)), 2);
  const before = sim.mobs.ew.entities.length;
  assert.equal(sim.edit(a, true), true);
  const wither = sim.mobs.ew.entities.slice(before).find(e => e.type === 'wither');
  assert.ok(wither, 'the Wither spawned');
  assert.equal(sim.world.get(x0, y + 2, tz), 0, 'the skulls cleared');
  assert.equal(sim.world.get(x0, y + 1, tz), 0, 'the soul sand cleared');
  assert.ok(a.achievements.has('spawnWither'), 'Alice, the builder');
  assert.ok(b.achievements.has('spawnWither'), 'Bob, 30 away on both axes');
  assert.ok(!c.achievements.has('spawnWither'), 'Carol, 52 away');
});

test('a diamond Alice drops with Q gives her Diamonds to you! when Bob picks it up, not when she does', () => {
  const { sim, players: [a, b, c], x0, z0, y } = sky('diamondsToYou');
  sim.teleport(c, { x: x0 + 5.5, y, z: z0 + 5.5 });
  a.survival.inventory.current = 0;
  a.survival.inventory.main[0] = makeStack(DIAMOND, 2, 0);
  a.yaw = 0; a.pitch = 0;
  assert.equal(sim.drop('a', false), true);
  const thrown = sim.play.items.items.find(e => e.stack.id === DIAMOND);
  assert.equal(thrown?.thrower, 'Alice', 'EntityItem Thrower');
  // Saved and loaded with the world.
  const copy = new ItemEntities(); copy.load(JSON.parse(JSON.stringify(sim.play.items.serialize())), d => makeStack(d.id, d.count, d.damage));
  assert.equal(copy.items.find(e => e.stack.id === DIAMOND)?.thrower, 'Alice');
  // Alice picks her own back up: no award.
  run(sim, 20);
  sim.teleport(a, { x: thrown.x, y, z: thrown.z });
  run(sim, 40);
  assert.ok(!sim.play.items.items.includes(thrown), 'picked up');
  assert.equal(a.survival.inventory.main.reduce((n, s) => n + (s?.id === DIAMOND ? s.count : 0), 0), 2, 'both hers again');
  assert.ok(!a.achievements.has('diamondsToYou'));
  // Now Alice throws one away from herself and Bob stands where it lands.
  a.survival.inventory.current = a.survival.inventory.main.findIndex(s => s?.id === DIAMOND);
  assert.equal(sim.drop('a', false), true);
  run(sim, 20);
  const second = sim.play.items.items.find(e => e.stack.id === DIAMOND);
  sim.teleport(a, { x: x0 - 4.5, y, z: z0 + 4.5 });
  sim.teleport(b, { x: second.x, y, z: second.z });
  run(sim, 40);
  assert.equal(b.survival.inventory.main.find(s => s?.id === DIAMOND)?.count, 1, 'Bob has it');
  assert.ok(a.achievements.has('diamondsToYou'), 'Alice, the thrower');
  assert.ok(!b.achievements.has('diamondsToYou'), 'not the picker');
  // A diamond without a thrower (a window drop, a death drop) gives nothing.
  const loose = sim.play.items.dropPlayer(makeStack(DIAMOND, 1, 0), c.position, 0, 0);
  assert.equal(loose.thrower, undefined);
  run(sim, 60);
  assert.ok(!c.achievements.has('diamondsToYou'));
});

test('breeding credits the player who fed the animals (EntityAnimal.func_146082_f), not the nearest one', async () => {
  const { STAT } = await import('./stats.js');
  const { sim, players: [a, b, c], x0, z0, y } = sky('breedCow');
  const ew = sim.mobs.ew, WHEAT = 305;
  const cow = dx => { const e = ew.create('cow', x0 + dx + 0.5, y, z0 - 2.5); ew.entities.push(e); return e; };
  const [m, f] = [cow(0), cow(1)];
  sim.teleport(a, { x: x0 - 4.5, y, z: z0 + 4.5 });
  sim.teleport(b, { x: x0 + 1, y, z: z0 - 1 }); // Bob right beside the cows
  const bred = p => p.stats.get(STAT.animalsBred);
  a.survival.inventory.current = 0; a.survival.inventory.main[0] = makeStack(WHEAT, 2, 0);
  // Alice's right-clicks (the server edit, EntityAnimal.interact through the server's aim), two blocks south of each cow.
  for (const e of [m, f]) {
    sim.teleport(a, { x: e.x, y, z: e.z + 2 });
    a.yaw = 0; a.pitch = Math.atan2(-(1.62 - 0.65), 2);
    assert.equal(sim.edit(a, true), true);
    assert.equal(e.love, 600, 'in love');
  }
  sim.teleport(a, { x: x0 - 4.5, y, z: z0 + 4.5 });
  const born = () => ew.entities.filter(e => e.type === 'cow' && e.growingAge < 0).length;
  for (let i = 0; i < 400 && !born(); i++) sim.tick();
  assert.equal(born(), 1, 'a calf');
  assert.equal(bred(a), 1, "Alice's animalsBred");
  assert.ok(a.achievements.has('breedCow'), 'Alice, the feeder');
  assert.ok(!b.achievements.has('breedCow') && !bred(b), 'not Bob, the nearest');
  // Two new cows: one fed by Carol, the other put in love without a player (no feeder kept): Carol is credited, through the
  // mate's feeder when the unfed cow is the one whose AI spawns the calf. (The first pair keep Alice: the field is never cleared.)
  for (const e of [m, f]) { ew.entities.splice(ew.entities.indexOf(e), 1); }
  const [m2, f2] = [cow(3), cow(4)];
  c.survival.inventory.current = 0; c.survival.inventory.main[0] = makeStack(WHEAT, 1, 0);
  assert.equal(ew.feed(f2, WHEAT, c.survival), true);
  m2.love = 600;
  for (let i = 0; i < 400 && born() < 2; i++) sim.tick();
  assert.equal(born(), 2, 'a second calf');
  assert.equal(bred(c), 1, "Carol, a parent's feeder");
  assert.ok(c.achievements.has('breedCow'));
  assert.equal(bred(a), 1, 'Alice not again');
});
