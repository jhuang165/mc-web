// The fishing rod (server-fishing.js) and maps (server-maps.js) on the gun server: a cast bobber that every tab sees in the
// presence, a bite reeled in as a server item with its orbs and the rod's wear, the hook lost with the rod put away; an empty map
// that becomes a filled one, its terrain and markers drawn on the server and sent to the carrier as changed columns, and saved.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GunSimulation } from './multiplayer/gun-simulation.js';
import { serverWorldReady, STREAMED_BIOME, STREAMED_GENERATION } from './multiplayer/server-world.js';
import { makeStack } from './inventory.js';
import { FISHING_ROD } from './fishing-content.js';
import { ITEM_EMPTY_MAP, ITEM_FILLED_MAP, MAP_SIZE, mapStore } from './maps.js';
import { WATER } from './world.js';
import { installGunRules } from '../server/pack-loader.js';

await serverWorldReady;
await installGunRules();
const STREAMED = { seed: 'ledoge0', biome: STREAMED_BIOME, generationVersion: STREAMED_GENERATION };
const quiet = { spawnMonsters: false, spawnAnimals: false, spawnProtection: 0 };
const seeded = (seed = 1) => () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 2 ** 32);
const IDLE = { forward: 0, strafe: 0, jump: false, sneak: false, sprint: false };
function hold(sim, a, n, controls = {}) {
  for (let i = 0; i < n; i++) { sim.input(a.id, { controls: { ...IDLE, ...controls }, yaw: a.yaw, pitch: a.pitch, slot: a.survival.inventory.current }); sim.tick(); }
}
// A stone floor in the sky with a deep pool ahead (toward -z) of player a.
function setup(seed) {
  const sim = new GunSimulation({ ...STREAMED, time: 6000 }, { config: quiet, random: seeded(seed) });
  const a = sim.addPlayer('a', 'Alice', 'acct-a');
  const y = 150, x0 = Math.floor(a.position.x), z0 = Math.floor(a.position.z);
  for (let dx = -8; dx <= 8; dx++) for (let dz = -14; dz <= 4; dz++) for (let k = 1; k <= 3; k++) {
    const wet = Math.abs(dx) <= 5 && dz <= -3 && dz >= -13;
    sim.world.put(x0 + dx, y - k, z0 + dz, wet && k < 3 ? WATER : 1, 0);
  }
  sim.teleport(a, { x: x0 + 0.5, y, z: z0 + 0.5 });
  a.yaw = 0; a.pitch = 0;
  hold(sim, a, 2);
  sim.mobs.ew.entities.length = 0;
  a.survival.mode = 'survival'; a.survival.inventory.creative = false;
  return { sim, a, y };
}
const give = (a, id, count = 1, damage = 0) => { a.survival.inventory.main[0] = makeStack(id, count, damage); a.survival.inventory.current = 0; };

test('a cast bobber is in every presence, a bite reeled in drops the catch with its orbs, and the rod wears', () => {
  const { sim, a, y } = setup(11);
  const b = sim.addPlayer('b', 'Bob', 'acct-b');
  sim.teleport(b, { ...a.position }); hold(sim, a, 1);
  give(a, FISHING_ROD);
  a.pitch = -0.3; // a little down, toward the pool
  assert.equal(sim.edit(a, true), true, 'the rod is used');
  assert.ok(a.fishing.active, 'cast');
  hold(sim, a, 1);
  const seen = sim.presence().find(e => e.id === 'a').hook;
  assert.ok(Array.isArray(seen) && seen.length === 3 && seen.every(Number.isFinite), 'the bobber is in the presence other tabs read');
  assert.equal(sim.presence().find(e => e.id === 'b').hook, undefined);
  hold(sim, a, 60);
  const hook = a.fishing.hook;
  assert.ok(hook && !hook.dead && hook.z < a.position.z - 2, `the bobber flew out over the pool (${hook?.z - a.position.z})`);
  assert.ok(hook.y < y && hook.y > y - 3, `it floats in the water (${hook.y})`);
  // A bite (EntityFishHook.ticksCatchable), then the rod reels it in: one server item, orbs, one use of the rod.
  hook.ticksCatchable = 20;
  const before = sim.play.items.items.length, orbs = sim.mobs.orbs.orbs.length;
  assert.equal(sim.edit(a, true), true);
  assert.equal(a.fishing.active, false, 'reeled in');
  assert.equal(sim.play.items.items.length, before + 1, 'the catch is a server item');
  assert.ok(sim.mobs.orbs.orbs.length > orbs, 'with experience orbs');
  assert.equal(a.survival.inventory.main[0].damage, 1, 'the rod took one use');
  hold(sim, a, 1);
  assert.equal(sim.presence().find(e => e.id === 'a').hook, undefined, 'no bobber after the reel');
  // Cast again and switch to an empty hand: EntityFishHook.onUpdate drops a hook whose angler no longer holds the rod.
  assert.equal(sim.edit(a, true), true);
  hold(sim, a, 2);
  a.survival.inventory.main[1] = null;
  sim.input(a.id, { controls: IDLE, yaw: a.yaw, pitch: a.pitch, slot: 1 }); sim.tick();
  assert.equal(a.fishing.active, false, 'the hook is gone with the rod put away');
  // A death drops it too.
  sim.input(a.id, { controls: IDLE, yaw: a.yaw, pitch: a.pitch, slot: 0 }); sim.tick();
  assert.equal(sim.edit(a, true), true);
  a.survival.damage(1000, 'void');
  hold(sim, a, 1);
  assert.equal(a.fishing.active, false);
});

test('an empty map becomes a filled map drawn on the server; its carrier gets the changed columns and markers', () => {
  const { sim, a } = setup(12);
  give(a, ITEM_EMPTY_MAP, 2);
  assert.equal(sim.edit(a, true), true, 'the empty map is used');
  const inv = a.survival.inventory, filled = inv.main.find(s => s?.id === ITEM_FILLED_MAP);
  assert.ok(filled, 'a filled map in the inventory');
  assert.equal(inv.main[0]?.id, ITEM_EMPTY_MAP); assert.equal(inv.main[0].count, 1, 'one empty map spent');
  const data = mapStore.get(filled.damage);
  assert.ok(data && data.scale === 0, 'a scale 0 map');
  assert.equal(data.xCenter, Math.floor(a.position.x / 128 + 0.5) * 128);
  // Selected, the map draws the terrain around the player over 16 ticks (one column in 16 each tick) and marks the player.
  inv.current = inv.main.indexOf(filled);
  hold(sim, a, 20);
  const px = Math.trunc(Math.floor(a.position.x - data.xCenter)) + 64, pz = Math.trunc(Math.floor(a.position.z - data.zCenter)) + 64;
  assert.notEqual(data.colors[px + pz * MAP_SIZE], 0, 'the stone floor under the player is drawn');
  assert.ok(data.decorations.has('Alice'), 'the player marker');
  // What the tab got: the whole map once (its columns), then only what changed.
  const fresh = sim.addPlayer('c', 'Cleo', 'acct-c');
  fresh.survival.inventory.main[0] = makeStack(ITEM_FILLED_MAP, 1, data.id);
  const rows = sim.you(fresh).maps;
  assert.equal(rows.length, 1);
  const [row] = rows, colors = new Int8Array(MAP_SIZE * MAP_SIZE);
  assert.deepEqual([row.id, row.scale, row.x, row.z, row.dim], [data.id, 0, data.xCenter, data.zCenter, 0]);
  for (const [x, lo, text] of row.cols) Buffer.from(text, 'base64').forEach((v, i) => { colors[x + (lo + i) * MAP_SIZE] = (v << 24) >> 24; });
  assert.deepEqual(colors, data.colors, 'the columns rebuild the map');
  assert.deepEqual(row.deco, [...data.decorations.values()]);
  assert.equal(sim.you(fresh).maps, undefined, 'nothing new, nothing sent');
  // A map someone stops carrying loses that player's marker.
  inv.main[inv.current] = null;
  hold(sim, a, 1);
  assert.equal(data.decorations.has('Alice'), false);
  // Saved with the world and loaded back.
  const saved = JSON.parse(JSON.stringify(sim.save()));
  mapStore.load(null);
  const back = new GunSimulation(saved, { config: quiet });
  const again = mapStore.get(data.id);
  assert.ok(again && again.xCenter === data.xCenter, 'the map is kept');
  assert.equal(again.colors[px + pz * MAP_SIZE], data.colors[px + pz * MAP_SIZE]);
  assert.ok(back.maps);
});
