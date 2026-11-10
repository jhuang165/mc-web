// Hoppers on the gun server: the hopper item places one (block-placement-simulation.js hopperItemBlock); the Hoppers host over the
// shared tile maps (simulation.js, hopper.js TileEntityHopper.updateEntity) runs chest -> hopper -> chest every 8 ticks, feeds a furnace and
// sucks up a dropped item (gone from the tabs' item list); a powered hopper is locked (BlockHopper.func_149919_e via the server's redstone),
// comparators read the hopper, and an open hopper window follows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GunSimulation } from './multiplayer/gun-simulation.js';
import { serverWorldReady, STREAMED_BIOME, STREAMED_GENERATION } from './multiplayer/server-world.js';
import { makeStack } from './inventory.js';
import { newChest } from './chest.js';
import { newHopperTile, HopperContainer } from './hopper.js';
import { installGunRules } from '../server/pack-loader.js';

await serverWorldReady;
await installGunRules();
const STREAMED = { seed: 'ledoge0', biome: STREAMED_BIOME, generationVersion: STREAMED_GENERATION };
const seeded = (seed = 1) => () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 2 ** 32);
const STONE = 1, FURNACE = 14, CHEST = 41, HOPPER = 133, REDSTONE_BLOCK = 123, COBBLE = 12, IRON_ORE = 16;

// Alice on a stone floor in the sky; (x0, y, z0) is a free cell two blocks east of her.
function arena() {
  const sim = new GunSimulation({ ...STREAMED, time: 6000 }, { config: { spawnMonsters: false, spawnAnimals: false, spawnProtection: 0 }, random: seeded(7) });
  sim.mobs.ew.entities.length = 0;
  const a = sim.addPlayer('a', 'Alice', 'acct-a');
  const ax = Math.floor(a.position.x), az = Math.floor(a.position.z), y = 150;
  for (let dx = -6; dx <= 6; dx++) for (let dz = -6; dz <= 6; dz++) sim.world.put(ax + dx, y - 1, az + dz, STONE, 0);
  sim.teleport(a, { x: ax + 0.5, y, z: az + 0.5 });
  for (let i = 0; i < 3; i++) sim.tick();
  const key = (x, y, z) => `${x},${y},${z}`;
  const place = (x, y, z, id, meta = 0) => {
    sim.world.set(x, y, z, id, true, meta);
    if (id === CHEST) sim.tiles.chests[key(x, y, z)] ??= newChest();
    if (id === HOPPER) sim.tiles.hoppers[key(x, y, z)] ??= newHopperTile();
  };
  return { sim, a, x0: ax + 2, y, z0: az, key, place };
}
const count = items => items.reduce((n, s) => n + (s?.count ?? 0), 0);

test('a player places a hopper from the hopper item (ItemReed): facing down, with its tile', () => {
  const { sim, a, key } = arena();
  a.survival.mode = 'survival'; a.survival.inventory.creative = false;
  const inv = a.survival.inventory;
  inv.main[0] = makeStack(1133, 2, 0); inv.current = 0; a.pitch = -1.2; a.yaw = 0;
  assert.equal(sim.edit(a, true), true);
  const cells = [];
  for (let dx = -3; dx <= 3; dx++) for (let dz = -4; dz <= 4; dz++) {
    const c = [Math.floor(a.position.x) + dx, Math.floor(a.position.y), Math.floor(a.position.z) + dz];
    if (sim.world.get(...c) === HOPPER) cells.push(c);
  }
  assert.equal(cells.length, 1, 'one hopper on the floor');
  assert.equal(sim.world.getMeta(...cells[0]), 0, 'placed on the top face: facing down');
  assert.ok(sim.tiles.hoppers[key(...cells[0])], 'its tile');
  assert.equal(inv.main[0].count, 1);
});

test('items run from a chest through a hopper into the chest below, one every 8 ticks', () => {
  const { sim, x0, y, z0, key, place } = arena();
  place(x0, y, z0, CHEST); // the floor chest (replaces the stone)
  place(x0, y + 1, z0, HOPPER, 0); // facing down
  place(x0, y + 2, z0, CHEST);
  const top = sim.tiles.chests[key(x0, y + 2, z0)], bottom = sim.tiles.chests[key(x0, y, z0)];
  top.items[0] = makeStack(COBBLE, 10, 0);
  for (let i = 0; i < 41; i++) sim.tick();
  const moved = count(bottom.items), held = count(sim.tiles.hoppers[key(x0, y + 1, z0)].items);
  assert.ok(moved >= 4 && moved <= 6, `about one per 8 ticks: ${moved}`);
  assert.equal(moved + held + count(top.items), 10, 'none lost');
  for (let i = 0; i < 120; i++) sim.tick();
  assert.equal(count(bottom.items), 10);
});

test('a hopper above a furnace fills its smelting slot', () => {
  const { sim, x0, y, z0, key, place } = arena();
  place(x0, y, z0, FURNACE);
  place(x0, y + 1, z0, HOPPER, 0);
  sim.tiles.hoppers[key(x0, y + 1, z0)].items[0] = makeStack(IRON_ORE, 3, 0);
  for (let i = 0; i < 20; i++) sim.tick();
  assert.equal(sim.tiles.furnace(key(x0, y, z0)).items[0]?.id, IRON_ORE);
});

test('a hopper sucks up a dropped item above it, and the tabs stop listing it', () => {
  const { sim, a, x0, y, z0, key, place } = arena();
  place(x0, y, z0, HOPPER, 0);
  sim.play.items.spill([makeStack(COBBLE, 5, 0)], x0 + 0.5, y + 1.2, z0 + 0.5);
  for (let i = 0; i < 40; i++) sim.tick();
  assert.equal(count(sim.tiles.hoppers[key(x0, y, z0)].items), 5);
  assert.equal(sim.play.itemsNear(a).some(e => e[4] === COBBLE), false);
});

test('a powered hopper is locked; comparators read its slots; an open hopper window shows what it took', () => {
  const { sim, a, x0, y, z0, key, place } = arena();
  place(x0, y, z0, CHEST);
  place(x0, y + 1, z0, HOPPER, 0);
  const hopper = sim.tiles.hoppers[key(x0, y + 1, z0)];
  hopper.items[0] = makeStack(COBBLE, 4, 0);
  place(x0 + 1, y + 1, z0, REDSTONE_BLOCK);
  for (let i = 0; i < 3; i++) sim.tick();
  assert.equal(sim.world.getMeta(x0, y + 1, z0) & 8, 8, 'the enabled bit is cleared');
  for (let i = 0; i < 30; i++) sim.tick();
  assert.equal(count(hopper.items), 4, 'nothing moved while powered');
  assert.deepEqual(sim.redstone.hooks.containerSlots(x0, y + 1, z0, 154)[0], { count: 4, max: 64 });
  sim.world.set(x0 + 1, y + 1, z0, 0, true, 0);
  for (let i = 0; i < 3; i++) sim.tick();
  assert.equal(sim.world.getMeta(x0, y + 1, z0) & 8, 0, 'unpowered again');
  // Alice opens the hopper; the server's window follows the hopper's own moves.
  sim.play.open(a, 'hopper', new HopperContainer(a.survival.inventory, hopper, () => {}), { key: key(x0, y + 1, z0), at: [x0, y + 1, z0] });
  for (let i = 0; i < 40; i++) sim.tick();
  assert.equal(count(hopper.items), 0, 'all moved down');
  assert.equal(count(sim.tiles.chests[key(x0, y, z0)].items), 4);
  assert.equal(sim.play.windowState(a).slots.slice(0, 5).every(([, s]) => !s), true, 'the window shows the empty hopper');
});

// EntityMinecartHopper on the gun server: the cart host's hopper transfer (server-mobs.js cartHost) pulls from a chest above the
// cart and picks up a dropped item over it; using the cart opens its five slots as a hopper window (displayGUIHopperMinecart).
test('a hopper minecart pulls from the chest above it, picks up a dropped item, and opens as a hopper window', () => {
  const { sim, a, x0, y, z0, key, place } = arena();
  const cart = sim.mobs.minecarts.spawnCart(5, { x: x0 + 0.5, y: y + 0.35, z: z0 + 0.5, items: [] });
  place(x0, y + 1, z0, CHEST);
  sim.tiles.chests[key(x0, y + 1, z0)].items[0] = makeStack(COBBLE, 3, 0);
  for (let i = 0; i < 20; i++) sim.tick();
  assert.equal(count(cart.slots), 3, 'the chest above emptied into the cart');
  assert.equal(count(sim.tiles.chests[key(x0, y + 1, z0)].items), 0);
  sim.world.set(x0, y + 1, z0, 0, true, 0); delete sim.tiles.chests[key(x0, y + 1, z0)];
  sim.play.items.spill([makeStack(IRON_ORE, 2, 0)], x0 + 0.5, y + 1.1, z0 + 0.5);
  for (let i = 0; i < 30; i++) sim.tick();
  assert.equal(count(cart.slots), 5, 'the dropped ore went in too');
  assert.equal(sim.play.itemsNear(a).some(e => e[4] === IRON_ORE), false);
  const dx = cart.x - a.position.x, dz = cart.z - a.position.z, dy = cart.posY + 0.35 - (a.position.y + 1.62);
  a.yaw = Math.atan2(-dx, -dz); a.pitch = Math.atan2(dy, Math.hypot(dx, dz));
  assert.equal(sim.edit(a, true), true);
  assert.equal(a.window?.kind, 'hopper');
  assert.equal(sim.play.openState(a).title, 'Minecart');
  const slots = sim.play.windowState(a).slots;
  assert.equal(slots.filter(([i]) => i < 5).reduce((n, [, s]) => n + (s?.count ?? 0), 0), 5, 'the window shows the cart');
});

// TileEntityHopper.func_145893_b over the server's carts (simulation.js Hoppers host `carts`): a hopper above a chest minecart
// fills it, a hopper under it empties it.
test('hoppers fill a chest minecart from above and empty it from below', () => {
  const { sim, x0, y, z0, key, place } = arena();
  place(x0, y, z0, HOPPER, 0);
  place(x0, y + 2, z0, HOPPER, 0);
  const cart = sim.mobs.minecarts.spawnChest({ x: x0 + 0.5, y: y + 1.35, z: z0 + 0.5, items: [{ slot: 4, id: 15, damage: 0, count: 2 }] }); // two iron ore (original id)
  sim.tiles.hoppers[key(x0, y + 2, z0)].items[0] = makeStack(COBBLE, 3, 0);
  for (let i = 0; i < 5; i++) sim.tick();
  assert.ok(cart.bb[1] >= y + 1 && cart.bb[1] < y + 1.2, `the cart rests on the lower hopper: ${cart.bb[1]}`);
  for (let i = 0; i < 100; i++) sim.tick();
  const bottom = sim.tiles.hoppers[key(x0, y, z0)].items;
  assert.equal(count(sim.tiles.hoppers[key(x0, y + 2, z0)].items), 0, 'the top hopper emptied into the cart');
  assert.equal(count(cart.slots), 0, 'the lower hopper emptied the cart');
  assert.deepEqual(bottom.filter(Boolean).map(s => [s.id, s.count]).sort((a, b) => a[0] - b[0]), [[COBBLE, 3], [IRON_ORE, 2]]);
});
