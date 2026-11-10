// The gun server's Nether and End (server-dimensions.js): a lit Nether portal takes a Survival player to the Nether after 80 ticks
// (a Creative one at once) at an eighth of its coordinates, standing in a portal the Teleporter found or built, and the portal there
// brings it back to the first one; an End portal goes to the End's obsidian platform, with the dragon and the crystals the first
// time, and the End's exit portal goes home. A death elsewhere respawns in the Overworld, a bed elsewhere explodes, and the worlds,
// and which one each account is in, are saved with the Overworld's state.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GunSimulation } from './multiplayer/gun-simulation.js';
import { serverWorldReady, STREAMED_BIOME, STREAMED_GENERATION } from './multiplayer/server-world.js';
import { achievementList } from './multiplayer/server-stats.js';
import { BED } from './bed.js';
import { installGunRules } from '../server/pack-loader.js';

await serverWorldReady;
await installGunRules();
const STREAMED = { seed: 'ledoge0', biome: STREAMED_BIOME, generationVersion: STREAMED_GENERATION };
const seeded = (seed = 1) => () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 2 ** 32);
const STONE = 1, OBSIDIAN = 22, PORTAL = 164, END_PORTAL = 149;

// Alice on a stone floor in the sky beside a lit portal along x: the portal cells are (px..px + 1, y..y + 2, pz).
function arena({ saved = {}, creative = false } = {}) {
  const sim = new GunSimulation({ ...STREAMED, time: 6000, ...saved }, { config: { spawnMonsters: false, spawnAnimals: false, spawnProtection: 0 }, random: seeded(7) });
  sim.mobs.ew.entities.length = 0;
  const a = sim.addPlayer('a', 'Alice', 'acct-a');
  if (creative) sim.setMode(a, 'creative');
  for (const id of ['openInventory', 'mineWood', 'buildWorkBench', 'buildPickaxe', 'acquireIron', 'diamonds', 'portal', 'blazeRod']) a.achievements.unlocked.add(id);
  a.achievements.unlocked.delete('portal');
  const px = Math.floor(a.position.x) + 4, pz = Math.floor(a.position.z), y = 150;
  for (let dx = -8; dx <= 8; dx++) for (let dz = -8; dz <= 8; dz++) sim.world.put(px + dx, y - 1, pz + dz, STONE, 0);
  for (let dx = -1; dx <= 2; dx++) for (let dy = -1; dy <= 3; dy++) {
    const edge = dx === -1 || dx === 2 || dy === -1 || dy === 3;
    sim.world.put(px + dx, y + dy, pz, edge ? OBSIDIAN : PORTAL, edge ? 0 : 1);
  }
  sim.teleport(a, { x: px - 3.5, y, z: pz + 0.5 });
  step(sim, 3);
  return { sim, a, px, y, pz };
}
function step(sim, n = 1) { for (let i = 0; i < n; i++) { sim.tick(); sim.dims.tick(); } }
// The block the player's box touches at its feet: a portal cell anywhere under it (the Teleporter can put it on a cell edge).
function cell(sim, p) {
  const { x, y, z } = p.position;
  for (const cx of [Math.floor(x - 0.299), Math.floor(x + 0.299)]) for (const cz of [Math.floor(z - 0.299), Math.floor(z + 0.299)]) if (sim.world.get(cx, Math.floor(y), cz) === PORTAL) return PORTAL;
  return sim.world.get(Math.floor(x), Math.floor(y), Math.floor(z));
}
// World.getSpawnPoint scatters a respawn around the spawn (simulation's spawn()).
const nearSpawn = (sim, p) => Math.hypot(p.position.x - sim.worldSpawn().x, p.position.z - sim.worldSpawn().z) < 24;

test('80 ticks in a Nether portal take Alice to the Nether at an eighth of her position, into a portal; the way back finds the first one', async () => {
  const { sim, a, px, y, pz } = arena();
  sim.teleport(a, { x: px + 1, y, z: pz + 0.5 });
  step(sim, 40);
  assert.equal(sim.simOf('a'), sim, 'still here at 40 ticks');
  assert.equal(sim.you(a).portal, true, 'the tab sees the portal');
  step(sim, 50);
  assert.equal(sim.simOf('a'), null, 'between worlds');
  assert.deepEqual(sim.dims.departures.splice(0), [['a', -1]]);
  await sim.dims.queue;
  const nether = sim.dims.get(-1);
  assert.equal(sim.simOf('a'), nether);
  assert.equal(a.world, nether.world);
  assert.equal(cell(nether, a), PORTAL, 'standing in a portal');
  assert.ok(Math.abs(a.position.x - (px + 1) / 8) < 20 && Math.abs(a.position.z - pz / 8) < 20, `near an eighth: ${a.position.x}, ${a.position.z}`);
  assert.ok(achievementList(a).includes('portal'), 'We Need to Go Deeper');
  assert.deepEqual(sim.dims.arrivals.splice(0).map(([p, s]) => [p.id, s.dimension]), [['a', -1]]);
  assert.equal(nether.snapshot(a.view).dimension, -1);
  assert.equal(sim.savePlayer(a).dimension, undefined);
  assert.equal(nether.savePlayer(a).dimension, -1);
  // Standing still in the arrival portal never goes back (the cooldown restarts); stepping out and in again does.
  step(sim, 100);
  assert.equal(sim.simOf('a'), nether);
  const back = { ...a.position };
  nether.teleport(a, { x: back.x + 3, y: back.y, z: back.z }); // beside it (the platform the Teleporter built is wide enough)
  step(sim, 15);
  nether.teleport(a, back);
  step(sim, 90);
  await sim.dims.queue;
  assert.equal(sim.simOf('a'), sim, 'home');
  assert.equal(cell(sim, a), PORTAL, `home portal: ${JSON.stringify(a.position)} vs ${px + 1}, ${y}, ${pz}`);
  assert.ok(Math.abs(a.position.x - (px + 1)) < 2 && Math.abs(a.position.z - (pz + 0.5)) < 2, `back at the first portal: ${a.position.x}, ${a.position.z}`);
  const saved = sim.save();
  assert.ok(saved.dimensions['-1'], 'the Nether is saved with the Overworld');
  assert.equal(saved.dimensions['-1'].accounts, undefined);
});

test('a Creative player goes at once; a death in the Nether respawns at the Overworld spawn; a bed there explodes', async () => {
  const { sim, a, px, y, pz } = arena({ creative: true });
  sim.teleport(a, { x: px + 1, y, z: pz + 0.5 });
  step(sim, 2);
  await sim.dims.queue;
  const nether = sim.dims.get(-1);
  assert.equal(sim.simOf('a'), nether);
  // A bed in the Nether: BlockBed.onBlockActivated blows it up.
  const bx = Math.floor(a.position.x) + 2, by = Math.floor(a.position.y), bz = Math.floor(a.position.z);
  nether.world.put(bx, by, bz, BED, 2); nether.world.put(bx, by, bz - 1, BED, 2 | 8);
  nether.useBed(a, bx, by, bz);
  assert.equal(nether.world.get(bx, by, bz), 0);
  assert.equal(nether.world.get(bx, by, bz - 1), 0);
  assert.ok(nether.drainEvents(a).some(e => e.type === 'explosion' && e.size === 5));
  assert.equal(a.bed.sleeping, false);
  sim.setMode(a, 'survival');
  nether.setMode(a, 'survival');
  a.survival.damage(1000, 'void');
  step(sim, 1);
  assert.equal(a.dead, true);
  assert.equal(nether.respawn('a'), true);
  assert.equal(a.dead, false);
  await sim.dims.queue;
  assert.equal(sim.simOf('a'), sim);
  assert.ok(nearSpawn(sim, a), `the world spawn: ${JSON.stringify(a.position)}`);
});

test('an End portal goes to the End platform with the dragon and crystals; the exit portal goes home; the trip is saved and restored', async () => {
  const { sim, a, px, y, pz } = arena();
  const ex = px - 4, ez = pz;
  sim.world.put(ex, y, ez, END_PORTAL, 0);
  sim.teleport(a, { x: ex + 0.5, y, z: ez + 0.5 });
  step(sim, 1);
  assert.equal(sim.simOf('a'), null);
  await sim.dims.queue;
  const end = sim.dims.get(1);
  assert.equal(sim.simOf('a'), end);
  assert.ok(Math.abs(a.position.x - 100.5) < 1 && Math.abs(a.position.z - 0.5) < 1 && Math.abs(a.position.y - 49) < 1, `the platform: ${JSON.stringify(a.position)}`);
  assert.equal(end.world.get(100, 48, 0), OBSIDIAN);
  assert.ok(achievementList(a).includes('theEnd'), 'The End?');
  const all = [...end.mobs.ew.entities.map(e => e.type), ...[...end.mobs.stored.values()].flat().map(r => r.type)];
  assert.equal(all.filter(t => t === 'ender_dragon').length, 1, 'one dragon');
  assert.ok(all.filter(t => t === 'ender_crystal').length >= 5, 'the crystals');
  assert.equal(end.dragonSpawned, true);
  // Saved while in the End: the account joins there again.
  const saved = JSON.parse(JSON.stringify(sim.save()));
  assert.equal(new Map(saved.accounts).get('acct-a').dimension, 1);
  assert.equal(saved.dimensions['1'].dragonSpawned, true);
  const again = new GunSimulation(saved, { config: { spawnMonsters: false, spawnAnimals: false, spawnProtection: 0 }, random: seeded(3) });
  const home = again.dims.joinSim('acct-a');
  assert.equal(home.dimension, 1);
  assert.equal(home.dragonSpawned, true);
  // The exit portal (in the End, an End portal goes to the Overworld spawn): The End. achievement.
  const fx = Math.floor(a.position.x), fy = Math.floor(a.position.y), fz = Math.floor(a.position.z);
  end.world.put(fx, fy, fz, END_PORTAL, 0);
  step(sim, 1);
  await sim.dims.queue;
  assert.equal(sim.simOf('a'), sim);
  assert.ok(achievementList(a).includes('theEnd2'));
  assert.ok(nearSpawn(sim, a), `the world spawn: ${JSON.stringify(a.position)}`);
});

test('a player that disconnects mid-trip is saved in the world it left', async () => {
  const { sim, a, px, y, pz } = arena({ creative: true });
  sim.teleport(a, { x: px + 1, y, z: pz + 0.5 });
  step(sim, 2);
  assert.equal(sim.travelling('a'), true);
  sim.removePlayer('a');
  assert.equal(sim.travelling('a'), false);
  const saved = sim.accounts.get('acct-a');
  assert.equal(saved.dimension ?? 0, 0);
  assert.ok(Math.abs(saved.position.x - (px + 1)) < 1);
  await sim.dims.queue;
  assert.equal(sim.simOf('a'), null, 'the trip that was under way does not bring it back');
});
