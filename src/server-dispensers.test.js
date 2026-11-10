// Dispensers and droppers on the gun server: dispense.js over the server's redstone (simulation.js installDispensers). A powered
// dispenser shoots an arrow, throws a snowball, launches a fire charge, places water and a minecart onto a rail, and clicks; a
// dropper pushes into the chest in front of it or drops the item into the world; using a dispenser opens its window.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GunSimulation } from './multiplayer/gun-simulation.js';
import { serverWorldReady, STREAMED_BIOME, STREAMED_GENERATION } from './multiplayer/server-world.js';
import { makeStack } from './inventory.js';
import { newChest } from './chest.js';
import { WATER } from './world.js';
import { installGunRules } from '../server/pack-loader.js';

await serverWorldReady;
await installGunRules();
const STREAMED = { seed: 'ledoge0', biome: STREAMED_BIOME, generationVersion: STREAMED_GENERATION };
const seeded = (seed = 1) => () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 2 ** 32);
const STONE = 1, CHEST = 41, DISPENSER = 115, DROPPER = 132, REDSTONE_BLOCK = 123, RAIL = 61, COBBLE = 12;
const ARROW = 320, SNOWBALL = 312, WATER_BUCKET = 341, BUCKET = 340, MINECART = 366, FIRE_CHARGE = 1952;
const EAST = 5; // dispense.js FACING[5] = +x

// Alice on a stone floor in the sky; a dispenser (or dropper) at (x0, y, z0) facing east, its tile, and a lever-free trigger: a
// redstone block put beside it.
function arena() {
  const sim = new GunSimulation({ ...STREAMED, time: 6000 }, { config: { spawnMonsters: false, spawnAnimals: false, spawnProtection: 0 }, random: seeded(7) });
  sim.mobs.ew.entities.length = 0;
  const a = sim.addPlayer('a', 'Alice', 'acct-a');
  const ax = Math.floor(a.position.x), az = Math.floor(a.position.z), y = 150;
  for (let dx = -6; dx <= 6; dx++) for (let dz = -6; dz <= 6; dz++) sim.world.put(ax + dx, y - 1, az + dz, STONE, 0);
  sim.teleport(a, { x: ax + 0.5, y, z: az + 0.5 });
  for (let i = 0; i < 3; i++) sim.tick();
  const x0 = ax - 3, z0 = az + 3, key = (x, y, z) => `${x},${y},${z}`;
  const build = (id, stack) => {
    sim.world.set(x0, y, z0, id, true, 0);
    sim.world.put(x0, y, z0, id, EAST); // BlockDispenser.onBlockAdded faces it away from opaque neighbours (south here); turn it east
    const tile = sim.tiles.dispensers[key(x0, y, z0)] ??= { items: Array(9).fill(null) };
    tile.items[4] = stack;
    return tile;
  };
  const sounds = [];
  const sound = sim.mobs.sound.bind(sim.mobs);
  sim.mobs.sound = e => { sounds.push(e); sound(e); };
  const fire = (ticks = 8) => { sim.world.set(x0, y, z0 - 1, REDSTONE_BLOCK, true, 0); for (let i = 0; i < ticks; i++) sim.tick(); };
  return { sim, a, x0, y, z0, key, build, fire, sounds };
}

test('a powered dispenser shoots an arrow east and clicks the bow sound', () => {
  const { sim, x0, y, z0, build, fire, sounds } = arena();
  const tile = build(DISPENSER, makeStack(ARROW, 3, 0));
  const before = sim.mobs.arrows.list.length;
  fire(6);
  const shot = sim.mobs.arrows.list.slice(before);
  assert.equal(shot.length, 1, 'one arrow');
  assert.ok(shot[0].x > x0 + 1 && Math.abs(shot[0].z - (z0 + 0.5)) < 0.5, `flies east: ${shot[0].x}`);
  assert.equal(tile.items[4].count, 2);
  assert.ok(sounds.some(s => s.sound === 'random.bow' && s.pitch === 1.2), 'aux 1002');
  // Staying powered does not fire again (the triggered bit).
  for (let i = 0; i < 10; i++) sim.tick();
  assert.equal(tile.items[4].count, 2);
  assert.equal(sim.world.get(x0, y, z0), DISPENSER);
});

test('a dispenser throws a snowball and launches a fire charge', () => {
  let { sim, build, fire } = arena();
  build(DISPENSER, makeStack(SNOWBALL, 1, 0));
  fire(6);
  assert.equal(sim.mobs.projectiles.balls.filter(b => b.kind === 'snowball').length, 1);
  ({ sim, build, fire } = arena());
  build(DISPENSER, makeStack(FIRE_CHARGE, 1, 0));
  fire(6);
  assert.equal(sim.mobs.ew._fireballs?.balls.length, 1, 'a small fireball');
});

test('a dispenser empties a water bucket in front of it and the water flows', () => {
  const { sim, x0, y, z0, build, fire } = arena();
  const tile = build(DISPENSER, makeStack(WATER_BUCKET, 1, 0));
  fire(20);
  assert.equal(sim.world.get(x0 + 1, y, z0), WATER);
  assert.equal(tile.items[4].id, BUCKET, 'the empty bucket goes back');
  assert.ok([[x0 + 2, y, z0], [x0 + 1, y, z0 + 1], [x0 + 1, y, z0 - 1]].some(c => sim.world.get(...c) === WATER), 'it spread');
});

test('a dispenser puts a minecart onto the rail in front of it', () => {
  const { sim, x0, y, z0, build, fire } = arena();
  sim.world.set(x0 + 1, y, z0, RAIL, true, 1); // east-west
  build(DISPENSER, makeStack(MINECART, 1, 0));
  const before = sim.mobs.minecarts.carts.length;
  fire(6);
  const carts = sim.mobs.minecarts.carts.slice(before);
  assert.equal(carts.length, 1);
  assert.ok(Math.abs(carts[0].x - (x0 + 1.5)) < 0.6, `on the rail: ${carts[0].x}`);
});

test('a dropper pushes one item into the chest in front, and drops one into the world with nothing there', () => {
  const { sim, a, x0, y, z0, key, build, fire } = arena();
  sim.world.set(x0 + 1, y, z0, CHEST, true, 0);
  const chest = sim.tiles.chests[key(x0 + 1, y, z0)] ??= newChest();
  const tile = build(DROPPER, makeStack(COBBLE, 5, 0));
  fire(6);
  assert.equal(chest.items.reduce((n, s) => n + (s?.count ?? 0), 0), 1, 'one cobble in the chest');
  assert.equal(tile.items[4].count, 4);
  // Unpower, take the chest away, power again: the cobble comes out as an item.
  sim.world.set(x0, y, z0 - 1, 0, true, 0);
  for (let i = 0; i < 3; i++) sim.tick();
  sim.world.set(x0 + 1, y, z0, 0, true, 0); delete sim.tiles.chests[key(x0 + 1, y, z0)];
  const items = sim.play.items.items.length;
  fire(6);
  assert.equal(sim.play.items.items.length, items + 1);
  assert.equal(tile.items[4].count, 3);
  a.position.x = x0 + 2.5; a.position.z = z0 + 0.5;
  assert.ok(sim.play.itemsNear(a).some(e => e[4] === COBBLE), 'the tabs see it');
});

test('using a dispenser opens its window over the tile', () => {
  const { sim, a, x0, y, z0, build } = arena();
  build(DISPENSER, makeStack(ARROW, 7, 0));
  a.survival.inventory.main[a.survival.inventory.current] = null;
  const dx = x0 + 0.5 - a.position.x, dz = z0 + 0.5 - a.position.z, dy = y + 0.5 - (a.position.y + 1.62);
  a.yaw = Math.atan2(-dx, -dz); a.pitch = Math.atan2(dy, Math.hypot(dx, dz));
  assert.equal(sim.edit(a, true), true);
  assert.equal(a.window?.kind, 'dispenser');
  const slots = sim.play.windowState(a).slots;
  assert.equal(slots.find(([i]) => i === 4)?.[1]?.count, 7);
});

// A player's placement writes the block untracked for its collision test first (block-placement-simulation.js), so the redstone
// hears of it from server-play.js placedRedstone: a redstone block a player puts on a dispenser fires it.
test('a redstone block a player places on top of a dispenser fires it', () => {
  const { sim, a, x0, y, z0, build } = arena();
  const tile = build(DISPENSER, makeStack(ARROW, 2, 0));
  const inv = a.survival.inventory, P = a.position;
  inv.main[inv.current] = makeStack(1123, 1, 0); // Block of Redstone
  const dx = x0 + 0.5 - P.x, dz = z0 + 0.5 - P.z, dy = y + 1 - (P.y + 1.62);
  a.yaw = Math.atan2(-dx, -dz); a.pitch = Math.atan2(dy, Math.hypot(dx, dz));
  a.input = { ...a.input, sneak: true }; // a click on a dispenser opens it otherwise
  assert.equal(sim.edit(a, true), true);
  assert.equal(sim.world.get(x0, y + 1, z0), REDSTONE_BLOCK);
  for (let i = 0; i < 6; i++) sim.tick();
  assert.equal(tile.items[4].count, 1, 'it fired');
  assert.equal(sim.world.getMeta(x0, y, z0) & 8, 8, 'triggered');
});
