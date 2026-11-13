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
import { CARROT_ON_A_STICK, SADDLE } from './pig-saddle.js';

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
  assert.deepEqual([...PLACEABLE_CARTS].sort(), [0, 1, 2, 3, 5, 6]);
  const c = sv.spawnVehicle('chest_minecart', 65.5, 10, 70.5), h = sv.spawnVehicle('hopper_minecart', 66.5, 10, 70.5);
  assert.equal(c.type, 1); assert.equal(h.type, 5);
  assert.ok(s.dispense.vehicles.dispenseCart(1, 67.5, 10, 70.5) && s.dispense.vehicles.dispenseCart(5, 68.5, 10, 70.5));
  const p = join(s, 'a', 1, 64.5, 70.5); p.survival.inventory.main[p.survival.inventory.current] = makeStack(ITEM_HOPPER_CART, 1); p.yaw = 0; p.pitch = -1.5; // b62 lead: Creative keeps its starter hotbar now that the input mirror is retired (mpsmall2), so seed the held slot
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

// ---- pig riding ----
function pigFixture(gameMode = 'survival') {
  const world = new World('mp-riding2-pig-b62');
  for (let x = 20; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 40; y++) world.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode, mobs: true });
  s.mobs.spawning = false; s.mobs.mobs.entities.length = 0;
  return s;
}
const pig = (s, x = 66.5, z = 64.5, y = 10) => { const m = s.mobs.mobs.create('pig', x, y, z); m.saddled = true; s.mobs.mobs.entities.push(m); return m; };
const give = (p, id, count = 1, damage = 0) => { p.survival.inventory.main[0] = makeStack(id, count, damage); p.survival.inventory.current = 0; };
const wireId = m => Number(String(m.id).replace(/^mob-/, ''));

test('C02 on a saddled pig seats the player, even holding a saddle; sneaking lets go', () => {
  const s = pigFixture(), p = join(s, 'a', 1), e = pig(s);
  give(p, SADDLE, 1);
  s.queueAnimUse('a', wireId(e), false); s.tick();
  assert.ok(p.mount?.mob === e && e.rider, 'mounted');
  assert.equal(p.survival.inventory.main[0].count, 1, 'the saddle was not used up');
  tick(s, 3);
  assert.ok(Math.hypot(p.position.x - e.x, p.position.z - e.z) < 0.5, 'the player sits on the pig');
  assert.ok(s.presence().find(x => x.id === 'a').riding, 'others see it riding');
  s.input('a', input({ sneak: true })); tick(s, 2);
  assert.equal(p.mount, null); assert.equal(e.rider ?? null, null);
});

test('an unsaddled pig is saddled, not mounted', () => {
  const s = pigFixture(), p = join(s, 'a', 1), e = pig(s); e.saddled = false;
  give(p, SADDLE, 1);
  s.queueAnimUse('a', wireId(e), false); s.tick();
  assert.equal(e.saddled, true); assert.ok(!p.mount);
});

test('a rider with a carrot on a stick steers the pig and the stick boost wears it by 7; a worn-out stick turns into a fishing rod', () => {
  const s = pigFixture(), p = join(s, 'a', 1), e = pig(s);
  give(p, CARROT_ON_A_STICK, 1, 0);
  s.queueAnimUse('a', wireId(e), false); s.tick();
  assert.ok(p.mount);
  e.aiMoveSpeed = 0.25; // a pig that has walked before (the move helper sets it); a never-moved one has 0 here as in single player
  const x0 = e.x, z0 = e.z;
  s.input('a', input({ forward: true })); tick(s, 150);
  assert.ok(Math.hypot(e.x - x0, e.z - z0) > 1.5, 'the pig walked where the rider pushed');
  const before = p.survival.inventory.main[0].damage ?? 0; // the steering task may have worn it by 1 on the way (p = 0.006 a tick)
  s.edit(p, true);
  assert.equal(p.survival.inventory.main[0].damage, before + 7, 'boost costs 7');
  p.survival.inventory.main[0].damage = 20; s.edit(p, true); assert.equal(p.survival.inventory.main[0].damage, 20, 'under 7 durability left: no boost'); // ItemCarrotOnAStick needs 7 left
  p.survival.inventory.main[0].damage = 25; s.mobs.mobs.wearStick(p.survival, 1); // the steering task's wear (EntityAIControlledByPlayer)
  assert.equal(p.survival.inventory.main[0].id, 700, 'the broken stick is a fishing rod');
});

test('a pig carrying a player that lands from more than 5 blocks awards flyPig', () => {
  const s = pigFixture(), p = join(s, 'a', 1, 66.5, 64.5, 10), e = pig(s, 66.5, 64.5, 10);
  s.queueAnimUse('a', wireId(e), false); s.tick();
  assert.ok(p.mount);
  e.y = 20; e.fallDistance = 0; s.events = [];
  tick(s, 40);
  assert.ok((s.events ?? []).some(ev => ev.type === 'award' && ev.achievement === 'flyPig' && ev.id === 'a'), 'flyPig');
});

// ---- mob riders ----
test('a fast empty cart picks up a mob and carries it; a chest cart does not', () => {
  const s = pigFixture('creative'), p = join(s, 'a', 1, 30.5, 30.5);
  for (let x = 60; x <= 80; x++) s.world.put(x, 10, 70, RAIL, 1, false);
  const e = pig(s, 68.5, 70.5); e.saddled = false;
  const cart = s.vehicles.spawnVehicle('minecart', 66.5, 10, 70.5), chest = s.vehicles.spawnVehicle('chest_minecart', 76.5, 10, 70.5);
  cart.vx = 0.22; // slow enough to enter the 0.2 push margin before the pig's box stops it (the order is the single-player one: carts move, then the pushes)
  tick(s, 12);
  assert.ok(e.ridingEntity === cart, 'the pig sits in the cart');
  const x0 = cart.x; tick(s, 5);
  assert.ok(Math.abs(e.x - cart.x) < 1.5, 'it travels with the cart');
  assert.ok(cart.x !== x0 || cart.vx !== 0);
  const f2 = pig(s, 78.5, 70.5); chest.vx = 0.22; tick(s, 12);
  assert.ok(!f2.ridingEntity, 'a chest cart never picks a mob up');
});

test('a spider jockey: the skeleton rides the spider on the server and both are sent', () => {
  const s = pigFixture('creative'); join(s, 'a', 1);
  const mobs = s.mobs.mobs, sp = mobs.create('spider', 66.5, 10, 64.5);
  mobs.entities.push(sp);
  mobs.spawnSpiderJockey(sp);
  const sk = mobs.entities.find(e => e.type === 'skeleton');
  assert.ok(sk && sk.ridingEntity === sp, 'skeleton rides the spider');
  tick(s, 20);
  assert.ok(Math.abs(sk.x - sp.x) < 0.5 && Math.abs(sk.z - sp.z) < 0.5 && sk.y > sp.y && sk.ridingEntity === sp, 'it sits on the spider');
});

// ---- leads ----
const LEAD = 2020;
const mobPackets = p => { const out = p.mobPackets ?? []; p.mobPackets = null; return JSON.parse(JSON.stringify(out)); };
test('C02 with a lead ties a cow to the clicking player; it follows that player, not the nearest one; the lead packet names the holder', () => {
  const s = pigFixture(), a = join(s, 'a', 1, 64.5, 64.5), b = join(s, 'b', 2, 67.5, 64.5);
  const cow = s.mobs.mobs.create('cow', 66.5, 10, 64.5); s.mobs.mobs.entities.push(cow);
  s.tick(); mobPackets(a); mobPackets(b);
  give(a, LEAD, 2);
  s.queueAnimUse('a', wireId(cow), false); s.tick();
  assert.equal(cow.leash?.holder, 'player'); assert.equal(cow.leash.holderId, 'a');
  assert.equal(a.survival.inventory.main[0].count, 1, 'one lead used');
  const att = mobPackets(b).find(m => m.type === 'attach' && m.mode === 1);
  assert.ok(att && att.i === wireId(cow) && att.holder.kind === 'player' && att.holder.id === 'a', 'S1B(1) reaches every watcher');
  // b stands closer to the cow; the lead still pulls toward a once the cow is more than 6 blocks from a
  a.position.x = 56.5; a.position.z = 64.5; b.position.x = 66.5; b.position.z = 66.5;
  tick(s, 40);
  assert.ok(cow.leash && cow.x < 66, 'the cow is drawn toward its holder');
  // the holder's click frees it and the lead drops
  a.position.x = 62.5; give(a, 0, 0); a.survival.inventory.main[0] = null;
  s.queueAnimUse('a', wireId(cow), false); s.tick();
  assert.ok(!cow.leash, 'freed');
  const off = mobPackets(b).find(m => m.type === 'attach' && m.mode === 1);
  assert.ok(off && off.holder === null, 'the lead is off on the wire');
});

test('another player cannot take or free a lead; the holder leaving drops the lead', () => {
  const s = pigFixture(), a = join(s, 'a', 1, 64.5, 64.5), b = join(s, 'b', 2, 67.5, 64.5);
  const cow = s.mobs.mobs.create('cow', 66.5, 10, 64.5); s.mobs.mobs.entities.push(cow);
  give(a, LEAD, 1); s.queueAnimUse('a', wireId(cow), false); s.tick();
  assert.ok(cow.leash);
  s.queueAnimUse('b', wireId(cow), false); s.tick();
  assert.equal(cow.leash?.holderId, 'a', 'b cannot free it');
  s.removePlayer?.('a'); tick(s, 3);
  assert.ok(!cow.leash, 'the lead dropped when the holder left');
});

test('a lead on a fence: the holder\'s mob joins a knot; the knot holds without the player; breaking the knot frees the mob', () => {
  const s = pigFixture(), a = join(s, 'a', 1, 64.5, 64.5);
  const cow = s.mobs.mobs.create('cow', 66.5, 10, 64.5); s.mobs.mobs.entities.push(cow);
  s.world.put(65, 10, 66, 60, 0, false); // fence
  give(a, LEAD, 1); s.queueAnimUse('a', wireId(cow), false); s.tick();
  assert.equal(cow.leash.holderId, 'a');
  assert.ok(s.leads.fence(a, [65, 10, 66]), 'the fence click is taken');
  assert.deepEqual(cow.leash.knot, { x: 65, y: 10, z: 66 });
  assert.equal(s.mobs.mobs.knotList.length, 1);
  a.position.x = 90.5; tick(s, 5);
  assert.ok(cow.leash?.knot, 'the knot still holds');
  s.mobs.mobs.knotKill(s.mobs.mobs.knotList[0]); tick(s, 3);
  assert.ok(!cow.leash, 'knot gone, lead off');
});

test('client: S1B(1) packets become renderer views (own lead, another player\'s lead, a knot)', async () => {
  const { leadViews } = await import('./multiplayer/remote-leads.js');
  const mk = w => ({ health: 5, x: 1, y: 2, z: 3, leadWire: w });
  const own = mk({ kind: 'player', id: 'me' }), other = mk({ kind: 'player', id: 'you' }), knot = mk({ kind: 'knot', x: 4, y: 5, z: 6 }), none = mk(null);
  const out = leadViews([own, other, knot, none], 'me', id => (id === 'you' ? { x: 9, y: 10, z: 11 } : null));
  assert.equal(out.mobs.filter(m => m.leash).length, 3);
  assert.deepEqual(out.mobs.find(m => m.x === 1 && m.leash.holder === 'player').leash, { holder: 'player' });
  const o = out.mobs.find(m => m.leash?.holderUuid); assert.ok(out.mobs.some(h => h.uuid === o.leash.holderUuid && h.x === 9));
  assert.deepEqual(out.knots, [{ x: 4, y: 5, z: 6 }]);
  assert.equal(out.mobs.find(m => m.leash?.knot).x, 1, 'the view reads the copy live');
  assert.equal(leadViews([own], 'me', () => null).mobs[0], out.mobs.find(m => m.leash?.holder === 'player'), 'stable object per copy');
});
