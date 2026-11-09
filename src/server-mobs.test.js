// The gun server's mobs (server-mobs.js): a streamed world's population and natural spawning, each mob's AI aimed at its nearest
// player, gun hits on mobs, the rows each tab draws, and mobs kept with their column when it leaves the resident set.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GunSimulation } from './multiplayer/gun-simulation.js';
import { serverWorldReady, STREAMED_BIOME, STREAMED_GENERATION } from './multiplayer/server-world.js';
import { mobNumber } from './multiplayer/server-mobs.js';
import { RemoteMobs } from './multiplayer/remote-mobs.js';
import { GUNS, AKM } from './mods/guns/catalog.js';
import { loadedRounds } from './mods/guns/ammo.js';

import { makeStack } from './inventory.js';
import { ITEM_SPAWN_EGG } from './spawn-eggs.js';
import { installGunRules } from '../server/pack-loader.js';

await serverWorldReady;
await installGunRules(); // the built-in guns
const STREAMED = { seed: 'ledoge0', biome: STREAMED_BIOME, generationVersion: STREAMED_GENERATION };
const quiet = { spawnMonsters: false, spawnAnimals: false };
const run = (sim, n, each = () => {}) => { for (let i = 0; i < n; i++) { each(); sim.tick(); } };
const ids = list => list.map(mobNumber);
// A seeded random (the simulation's and the mobs' rolls), so a test sees the same fight every run.
const seeded = (seed = 1) => () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 2 ** 32);
// A stone platform in the sky around (x, z): nothing between a gun and its target, nothing to hide behind.
function platform(sim, x, z, y = 150, r = 6) {
  for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) sim.world.put(Math.floor(x) + dx, y - 1, Math.floor(z) + dz, 1, 0);
  return y;
}

test('a streamed gun world has its population, spawns mobs around players at night, and saves them with their ids', () => {
  const sim = new GunSimulation({ ...STREAMED, time: 18000 });
  assert.ok(sim.mobs, 'a streamed world has mobs');
  assert.ok(sim.mobs.ew.entities.length > 0, 'population animals of the first columns');
  assert.ok(sim.mobs.ew.entities.every(e => ['cow', 'pig', 'sheep', 'chicken', 'squid', 'villager', 'witch', 'horse', 'wolf', 'ocelot'].includes(e.type) || e.type), 'records restored');
  const p = sim.addPlayer('a', 'Alice', 'acct-a');
  run(sim, 200);
  const hostile = sim.mobs.ew.entities.filter(e => ['zombie', 'skeleton', 'spider', 'creeper', 'enderman'].includes(e.type));
  assert.ok(hostile.length > 0, 'monsters spawned at night');
  const rows = sim.you(p).mobs;
  assert.ok(rows.length > 0 && rows.length <= 80);
  const [id, type, x, , z] = rows[0];
  assert.equal(typeof id, 'number'); assert.equal(typeof type, 'string');
  assert.ok(Math.abs(x - p.position.x) <= 48 && Math.abs(z - p.position.z) <= 48);
  assert.ok(rows.every(r => r[14] && typeof r[14] === 'object'), 'the first rows carry the rig fields');
  const again = sim.you(p).mobs;
  assert.ok(again.filter(r => r[14] === 0).length > 0, 'unchanged rig fields are not sent again');
  // Save and restore: the same mobs, unique ids, new ones numbered after them.
  const saved = JSON.parse(JSON.stringify(sim.save()));
  const count = saved.mobs.stored.reduce((n, [, list]) => n + list.length, 0);
  assert.equal(count, sim.mobs.ew.entities.filter(e => e.health > 0).length + [...sim.mobs.stored.values()].reduce((n, l) => n + l.length, 0));
  const back = new GunSimulation(saved);
  const all = [...ids(back.mobs.ew.entities), ...[...back.mobs.stored.values()].flatMap(ids)];
  assert.equal(all.length, count);
  assert.equal(new Set(all).size, all.length, 'ids stay unique');
  assert.ok(back.mobs.ew.nextId > Math.max(...all));
});

test('a mob goes for its nearest player, and a mob kill gets its death message', () => {
  const sim = new GunSimulation({ ...STREAMED, time: 18000 }, { config: quiet, random: seeded(7) });
  sim.mobs.ew.entities.length = 0;
  const a = sim.addPlayer('a', 'Alice', 'acct-a'), b = sim.addPlayer('b', 'Bob', 'acct-b');
  const bx = Math.floor(a.position.x) + 30.5, bz = Math.floor(a.position.z) + 0.5, y = platform(sim, bx, bz);
  platform(sim, a.position.x, a.position.z);
  sim.teleport(a, { x: Math.floor(a.position.x) + 0.5, y, z: bz });
  sim.teleport(b, { x: bx, y, z: bz });
  run(sim, 2);
  a.survival.protection = 0; b.survival.protection = 0;
  const ew = sim.mobs.ew, zombie = ew.create('zombie', b.position.x + 2, b.position.y, b.position.z);
  ew.entities.push(zombie);
  for (let i = 0; i < 200 && b.survival.lastDamage !== 'a zombie'; i++) sim.tick();
  assert.equal(b.survival.lastDamage, 'a zombie', 'the zombie went for Bob');
  assert.equal(a.survival.health, 20, 'Alice, 30 blocks off, was left alone');
  b.survival.health = 1; // armour and regeneration would make this a long fight
  for (let i = 0; i < 200 && !b.dead; i++) sim.tick();
  assert.equal(b.dead, true, 'the zombie killed Bob');
  assert.ok(sim.chatOut.includes('Bob was slain by Zombie'), sim.chatOut.join(' / '));
});

test('a gun shot hits a mob on the server and tells the shooter', () => {
  const sim = new GunSimulation({ ...STREAMED, time: 6000 }, { config: quiet, random: seeded(3) });
  sim.mobs.ew.entities.length = 0;
  const a = sim.addPlayer('a', 'Alice', 'acct-a');
  const x0 = Math.floor(a.position.x), z0 = Math.floor(a.position.z), y0 = platform(sim, x0, z0);
  sim.teleport(a, { x: x0 + 0.5, y: y0, z: z0 + 0.5 });
  run(sim, 12); // the AKM's draw
  const ew = sim.mobs.ew, pig = ew.create('pig', x0 + 0.5, y0, z0 - 4.5);
  ew.entities.push(pig);
  sim.drainEvents(a);
  const pitch = Math.atan2(0.3 - 1.62, 5); // at the pig's body, below its head
  sim.action('a', { action: 'trigger', down: true, yaw: 0, pitch }); sim.action('a', { action: 'trigger', down: false });
  run(sim, 1);
  assert.equal(loadedRounds(GUNS[AKM], a.survival.inventory.main[0]), 29);
  assert.ok(pig.health < 10, `the pig was hit: ${pig.health}`);
  const events = sim.drainEvents(a);
  const hit = events.find(e => e.type === 'hit');
  assert.deepEqual(hit, { type: 'hit', mob: mobNumber(pig), head: hit?.head, kill: pig.health <= 0 });
  assert.equal(typeof hit.head, 'boolean');
});

test('mobs of a column that leaves are kept and come back with it; a broken spawner is forgotten', () => {
  const sim = new GunSimulation({ ...STREAMED, time: 6000 }, { config: quiet });
  const a = sim.addPlayer('a', 'Alice', 'acct-a');
  sim.teleport(a, { x: a.position.x + 600, y: 200, z: a.position.z }); // away from the spawn chunks, which stay resident
  run(sim, 2);
  const home = { x: a.position.x, y: a.position.y, z: a.position.z };
  const ew = sim.mobs.ew, cow = ew.create('cow', a.position.x + 20, 200, a.position.z);
  ew.entities.push(cow);
  const id = mobNumber(cow);
  sim.teleport(a, { x: home.x + 2000, y: 200, z: home.z });
  run(sim, 3);
  assert.ok(!ew.entities.includes(cow), 'the cow left with its column');
  assert.ok([...sim.mobs.stored.values()].some(list => list.some(r => mobNumber(r) === id)), 'and is kept with it');
  sim.teleport(a, { x: home.x, y: 200, z: home.z });
  run(sim, 3);
  assert.ok(ew.entities.some(e => mobNumber(e) === id && e.type === 'cow'), 'the cow came back');
  // A spawner stays while its block does, and is forgotten once the block is gone.
  const sx = Math.floor(home.x) + 3, sy = 120, sz = Math.floor(home.z);
  sim.world.put(sx, sy, sz, 52, 0);
  sim.mobs.spawners.add({ x: sx, y: sy, z: sz, entityId: 'Zombie' });
  run(sim, 21);
  assert.ok(sim.mobs.spawners.get(sx, sy, sz), 'the spawner is kept');
  assert.ok(JSON.parse(JSON.stringify(sim.save())).mobs.spawners.length >= 1, 'and saved');
  sim.world.put(sx, sy, sz, 0, 0);
  run(sim, 21);
  assert.equal(sim.mobs.spawners.get(sx, sy, sz), null, 'its block was broken');
});

test('a spawn egg used on a block hatches its mob on the server', () => {
  const sim = new GunSimulation({ ...STREAMED, time: 6000 }, { config: { ...quiet, spawnProtection: 0 }, random: seeded(5) });
  const a = sim.addPlayer('a', 'Alice', 'acct-a');
  const y = platform(sim, a.position.x, a.position.z);
  sim.teleport(a, { x: Math.floor(a.position.x) + 0.5, y, z: Math.floor(a.position.z) + 0.5 });
  run(sim, 2);
  sim.mobs.ew.entities.length = 0; // columns that streamed in meanwhile may have populated their animals
  a.survival.mode = 'survival'; a.survival.inventory.creative = false;
  a.survival.inventory.main[0] = makeStack(ITEM_SPAWN_EGG, 2, 90); a.survival.inventory.current = 0; // 90: Pig
  a.pitch = -Math.PI / 2; a.yaw = 0;
  assert.equal(sim.edit(a, true), true);
  assert.deepEqual(sim.mobs.ew.entities.map(e => e.type), ['pig']);
  assert.equal(a.survival.inventory.main[0].count, 1, 'the egg was spent');
});

test('a tab turns mob rows into records its mob renderer draws, with the previous tick kept for interpolation', () => {
  const list = [], remote = new RemoteMobs(list);
  remote.apply([[7, 'zombie', 1, 64, 2, 90, 80, 5, 0.5, 0.25, 0, 0, 0, 30, { burn: 0, equipment: [null, null, null, null, null] }]]);
  assert.equal(list.length, 1);
  const z = list[0];
  assert.equal(z.id, 'mob-7'); assert.equal(z.type, 'zombie');
  assert.deepEqual([z.x, z.px, z.renderYawOffset, z.prevRenderYawOffset, z.limbSwingAmount], [1, 1, 90, 90, 0.25]);
  remote.apply([[7, 'zombie', 1.5, 64, 2, 100, 80, 5, 0.75, 0.5, 9, 0, 0, 31, 0]]);
  assert.equal(list[0], z, 'the same record');
  assert.deepEqual([z.px, z.x, z.prevRenderYawOffset, z.renderYawOffset, z.prevLimbSwingAmount, z.limbSwingAmount, z.hurt], [1, 1.5, 90, 100, 0.25, 0.5, 9]);
  assert.deepEqual(z.equipment, [null, null, null, null, null], 'the rig fields stay when not resent');
  remote.apply([]);
  assert.equal(list.length, 0, 'a mob no longer sent is gone');
});
