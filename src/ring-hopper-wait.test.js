// Batch 43 (tileedits): a hopper (and a hopper cart) above or below an evicted column whose saved containers are still loading waits.
// Natively that chunk would be loaded, so the hopper would suck from the chest above; the port used to read null and fall back to picking
// up item entities for that tick. The ring world below must end the same as the all-resident world.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ContainerResidency } from './container-residency.js';
import { Survival } from './survival.js';
import { World } from './world.js';
import { seedRingChest } from './ring-chests.js';
import { updateHopper, HOPPER } from './hopper.js';
import { hopperSuck } from './cart-hopper.js';
import { newHopperTile, containerPending } from './inventory-transfer.js';
import { makeStack } from './inventory.js';

const CHEST = 41, FURNACE = 14;
const reader = (disk) => async (id, columns) => columns.map(([x, z]) => structuredClone(disk.get(`${x},${z}`) ?? { world: id, x, z, state: {} }));
const savedChest = () => ({ facing: 5, items: [{ id: 322, count: 7, damage: 0 }] });

// A hopper at (640, 70, 641) (column 40,40) with a chest above it (saved, evicted) and a dropped item inside the pickup box.
function build(resident) {
  const w = new World('17', 'javaStreamed', 12), s = new Survival(), disk = new Map();
  disk.set('40,40', { world: 'w', x: 40, z: 40, state: { chests: { '640,71,641': savedChest() } } });
  const manager = new ContainerResidency(w, 'w', s, { read: reader(disk) });
  if (resident) s.chests['640,71,641'] = savedChest();
  const blocks = { '640,70,641': HOPPER, '640,71,641': CHEST }, hoppers = { '640,70,641': newHopperTile() };
  const fake = { get: (x, y, z) => blocks[`${x},${y},${z}`] ?? 0, getMeta: () => 0, chunks: w.chunks, population: null };
  const entities = [{ x: 640.5, y: 71.2, z: 641.5, stack: makeStack(3, 5), dead: false }];
  const host = { world: fake, chests: () => s.chests, furnaces: () => s.furnaces, dispensers: () => s.dispensers, hoppers: () => hoppers, brewing: () => s.brewing,
    maxStack: (st) => (st.id === 322 ? 1 : 64), items: () => entities, changed() {}, burnTime: () => 0,
    seedChest: resident ? undefined : (x, y, z) => seedRingChest(fake, s.chests, x, y, z, manager), containerReady: resident ? undefined : (x, z) => manager.reach(x, z) };
  return { manager, s, host, tile: hoppers['640,70,641'], entities, blocks };
}
const items = (tile) => tile.items.map((i) => (i ? `${i.id}x${i.count}` : '-')).join(',');

test('a hopper above a still-loading evicted chest skips pickup and transfer, then ends like the all-resident world', async () => {
  const ring = build(false), full = build(true);
  assert.equal(containerPending(ring.host, 640, 71, 641), true);
  assert.equal(updateHopper(ring.host, ring.tile, 640, 70, 641, 0), false, 'waiting: no transfer');
  assert.equal(ring.entities[0].dead, false, 'the dropped item was not picked up while the chest loads');
  assert.equal(ring.tile.cooldown ?? 0, 0, 'no cooldown started, it retries next tick');
  assert.equal(ring.tile.items.some(Boolean), false);
  await ring.manager.ensure([[40, 40]]);
  assert.equal(containerPending(ring.host, 640, 71, 641), false);
  assert.equal(updateHopper(ring.host, ring.tile, 640, 70, 641, 0), true);
  assert.equal(updateHopper(full.host, full.tile, 640, 70, 641, 0), true);
  assert.equal(items(ring.tile), items(full.tile), 'same hopper contents as the resident world');
  assert.equal(ring.entities[0].dead, full.entities[0].dead);
  assert.equal(ring.s.chests['640,71,641'].items[0]?.count ?? 0, full.s.chests['640,71,641'].items[0]?.count ?? 0);
});

test('a furnace above the hopper and a hopper cart wait the same way', async () => {
  const ring = build(false);
  ring.blocks['640,71,641'] = FURNACE;
  assert.equal(containerPending(ring.host, 640, 71, 641), true, 'a not-yet-reached column holds the saved furnace');
  assert.equal(updateHopper(ring.host, ring.tile, 640, 70, 641, 0), false);
  assert.equal(ring.entities[0].dead, false);
  const cart = { x: 640.5, posY: 70, z: 641.5, slots: Array(5).fill(null), bb: [640.1, 70, 641.1, 640.9, 70.7, 641.9] };
  assert.equal(hopperSuck(cart, { transfer: ring.host }), false);
  assert.equal(ring.entities[0].dead, false, 'the cart did not pick the item up while the column loads');
  assert.equal(cart.slots.some(Boolean), false);
  await ring.manager.ensure([[40, 40]]);
  assert.equal(containerPending(ring.host, 640, 71, 641), false);
});
