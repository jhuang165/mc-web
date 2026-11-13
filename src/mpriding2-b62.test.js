// Batch 62 (mpriding2): carts and rails, pig riding, leads on the dedicated server. Replays the server modules on DedicatedSimulation with no sockets; the client side
// runs the real client-containers.js window builder. Physics and rules are the single-player classes, whose own tests hold the executed evidence.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World, RAIL } from './world.js';
import { Survival } from './survival.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { PLACEABLE_CARTS } from './multiplayer/server-vehicles.js';
import { buildWindow, applyWindow } from './multiplayer/client-containers.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';
import { makeStack } from './inventory.js';
import { ITEM_HOPPER_CART } from './cart-variants.js';

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const input = (controls = {}) => ({ type: 'input', controls: { ...IDLE_INPUT, ...controls }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
function fixture(gameMode = 'creative', saved = {}) {
  const world = new World('mp-riding2-b62');
  for (let x = 20; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 24; y++) world.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  for (let x = 60; x <= 80; x++) world.put(x, 10, 70, RAIL, 1, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  return new DedicatedSimulation(saved, { world, gameMode, mobs: false });
}
const join = (s, id, n, x = 64.5, z = 64.5, y = 10) => { const p = s.addPlayer(id, id + 'x', key(n)); p.position.copy({ x, y, z }); p.previous.copy(p.position); s.input(id, input()); return p; };
const tick = (s, n = 1) => { for (let i = 0; i < n; i++) s.tick(); };

test('chest and hopper carts are placeable and dispensable', () => {
  const s = fixture(), sv = s.vehicles;
  assert.deepEqual([...PLACEABLE_CARTS].sort(), [0, 1, 2, 3, 5]);
  const c = sv.spawnVehicle('chest_minecart', 65.5, 10, 70.5), h = sv.spawnVehicle('hopper_minecart', 66.5, 10, 70.5);
  assert.equal(c.type, 1); assert.equal(h.type, 5);
  assert.ok(s.dispense.vehicles.dispenseCart(1, 67.5, 10, 70.5) && s.dispense.vehicles.dispenseCart(5, 68.5, 10, 70.5));
  const p = join(s, 'a', 1, 64.5, 70.5); p.survival.inventory.add(makeStack(ITEM_HOPPER_CART, 1)); p.yaw = 0; p.pitch = -1.5;
  const n = sv.carts.carts.length; s.edit(p, true);
  assert.equal(sv.carts.carts.length, n + 1);
  assert.equal(sv.carts.carts.at(-1).type, 5);
});

test('C02 on a chest cart opens a server window the client builds; contents persist and spill when broken', () => {
  const s = fixture('survival'), p = join(s, 'a', 1, 65.5, 69.5), sv = s.vehicles;
  const cart = sv.spawnVehicle('chest_minecart', 65.5, 10, 70.5);
  assert.ok(sv.act(p, { v: `c${cart.id}`, hit: false }));
  const open = p.windowOut.find(m => m.type === 'openWindow');
  assert.equal(open.kind, 'chest'); assert.equal(open.cart, `c${cart.id}`); assert.equal(open.size, 27 + 36);
  const client = new Survival({}, 'creative'), built = buildWindow(open, { survival: client, world: s.world });
  assert.ok(built && built.container.slots.length === open.size);
  // the server puts a stack in the cart, then sends the window
  cart.slots[3] = makeStack(4, 7);
  s.containers.sendAll(p);
  const items = p.windowOut.find(m => m.type === 'windowItems');
  applyWindow(items, { ...built, windowId: open.windowId, survival: client, client: { confirmTransaction() {}, windowInventory() {}, clickWindow() {} } });
  assert.equal(built.container.slots[3].stack?.id, 4);
  // walking away closes the window (EntityMinecartContainer.isUseableByPlayer)
  p.position.x = 90; tick(s);
  assert.ok(p.windowOut.some(m => m.type === 'windowClose') && !p.window);
  // broken: the contents are among the drops
  p.position.x = 65.5; sv.carts.kill(cart);
  assert.ok(sv.carts.drops.some(d => d.stack?.id === 4), 'the 7 cobble spill');
});

test('a hopper cart window and the cart sucking an item above', () => {
  const s = fixture('survival'), p = join(s, 'a', 1, 65.5, 69.5), sv = s.vehicles;
  const cart = sv.spawnVehicle('hopper_minecart', 65.5, 10, 70.5);
  assert.ok(sv.act(p, { v: `c${cart.id}`, hit: false }));
  const open = p.windowOut.find(m => m.type === 'openWindow');
  assert.equal(open.kind, 'hopper'); assert.equal(open.size, 5 + 36);
  assert.ok(buildWindow(open, { survival: new Survival({}, 'creative'), world: s.world }));
  s.containers.close(p);
  s.items.spawn(makeStack(5, 3), 65.5, 11.2, 70.5, { motion: [0, 0, 0] });
  tick(s, 12);
  assert.ok(cart.slots.some(x => x?.id === 5), 'the cart took the item');
});

test('a detector rail under a cart is powered', () => {
  const s = fixture(), sv = s.vehicles;
  s.world.put(70, 10, 70, 136, 0, false); // detector rail (browser id)
  sv.spawnVehicle('minecart', 70.5, 10, 70.5);
  tick(s, 3);
  assert.ok((s.world.getMeta(70, 10, 70) & 8) !== 0, 'detector rail powered by the cart');
});

test('a powered activator rail locks a hopper cart and an unpowered one frees it (BlockRailPowered via EntityMinecartHopper.onActivatorRailPass)', () => {
  const s = fixture('survival'), sv = s.vehicles;
  s.world.put(72, 10, 70, 137, 8 | 1, false); // activator rail, powered bit, east-west
  s.world.put(74, 10, 70, 137, 1, false);
  const locked = sv.spawnVehicle('hopper_minecart', 72.5, 10, 70.5), free = sv.spawnVehicle('hopper_minecart', 74.5, 10, 70.5);
  tick(s, 2);
  assert.equal(locked.enabled, false); assert.equal(free.enabled, true);
});
