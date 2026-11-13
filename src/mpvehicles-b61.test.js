// Batch 61 (tag b61mpv): vehicles and riding over a multiplayer connection. Replays the server module (server-vehicles.js) on DedicatedSimulation and the client copies
// (remote-vehicles.js). Physics are the single-player Minecarts / Boats classes, whose own tests hold the executed evidence.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World, RAIL, WATER } from './world.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { ServerVehicles, vehicleState, PLACEABLE_CARTS } from './multiplayer/server-vehicles.js';
import { RemoteVehicles } from './multiplayer/remote-vehicles.js';
import { ServerAchievements } from './multiplayer/server-achievements.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';
import { makeStack } from './inventory.js';

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const input = (controls = {}) => ({ type: 'input', controls: { ...IDLE_INPUT, ...controls }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
function fixture(gameMode = 'creative', saved = {}) {
  const world = new World('mp-veh-b61');
  for (let x = 20; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 24; y++) world.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  for (let x = 60; x <= 80; x++) world.put(x, 10, 70, RAIL, 1, false); // east-west rail line
  for (let x = 30; x <= 40; x++) for (let z = 30; z <= 40; z++) { world.put(x, 9, z, WATER, 0, false); world.put(x, 8, z, 1, 0, false); }
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  return new DedicatedSimulation(saved, { world, gameMode, mobs: false });
}
const join = (s, id, n, x = 64.5, z = 64.5, y = 10) => { const p = s.addPlayer(id, id + 'x', key(n)); p.position.copy({ x, y, z }); p.previous.copy(p.position); s.input(id, input()); return p; };
const tick = (s, n = 1) => { for (let i = 0; i < n; i++) s.tick(); };
const take = p => { const out = p.vehPackets; p.vehPackets = null; return out && JSON.parse(JSON.stringify(out)); };

test('spawnVehicle makes carts and boats; bad input is refused; the state message carries the fields', () => {
  const s = fixture(), sv = s.vehicles;
  assert.ok(sv instanceof ServerVehicles);
  const cart = sv.spawnVehicle('minecart', 65.5, 10, 70.5), boat = sv.spawnVehicle('boat', 35.5, 9, 35.5, { yaw: 90 });
  assert.ok(cart && boat);
  assert.equal(sv.spawnVehicle('nope', 1, 1, 1), null);
  assert.equal(sv.spawnVehicle('minecart', NaN, 1, 1), null);
  assert.ok(sv.spawnVehicle('tnt_minecart', 66.5, 10, 70.5) && sv.spawnVehicle('furnace_minecart', 67.5, 10, 70.5));
  assert.deepEqual([...PLACEABLE_CARTS].sort(), [0, 1, 2, 3, 5]);
  assert.equal(sv.find(`c${cart.id}`), cart);
  assert.equal(sv.find(`b${boat.id}`), boat);
  assert.equal(sv.find('x1'), null);
  const cs = vehicleState(cart), bs = vehicleState(boat);
  assert.equal(cs.v, `c${cart.id}`); assert.equal(bs.v, `b${boat.id}`);
  assert.ok('t' in cs && 'th' in bs);
});

test('a placed cart on a rail and a boat on water come from the held item', () => {
  const s = fixture('survival'), p = join(s, 'a', 1, 64.5, 70.5);
  p.survival.inventory.add(makeStack(366, 2));
  p.yaw = 0; p.pitch = -1.5; // look down at the rail cell under the feet
  const before = s.vehicles.carts.carts.length;
  s.edit(p, true);
  assert.equal(s.vehicles.carts.carts.length, before + 1, 'cart placed');
  assert.equal(p.survival.held?.count ?? 0, 1, 'one item used');
  const q = join(s, 'b', 2, 35.5, 34.5, 10);
  q.survival.inventory.add(makeStack(495, 1)); q.pitch = -0.6; q.yaw = 0; // look down at the water ahead
  const boats = s.vehicles.boats.carts.length;
  s.edit(q, true);
  assert.equal(s.vehicles.boats.carts.length, boats + 1, 'boat placed on the water');
});

test('mount, carried along the rail, sneak dismounts', () => {
  const s = fixture(), p = join(s, 'a', 1, 64.5, 70.5), sv = s.vehicles;
  const cart = sv.spawnVehicle('minecart', 64.5, 10, 70.5);
  tick(s, 2);
  assert.ok(sv.queue('a', { v: `c${cart.id}`, hit: false }));
  tick(s);
  assert.ok(p.mount, 'mounted');
  assert.equal(s.presence().find(x => x.id === 'a').riding, `c${cart.id}`, 'presence carries riding');
  const x0 = p.position.x;
  cart.vx = 0.3; // a push, as a powered rail would give
  tick(s, 10);
  assert.ok(Math.abs(p.position.x - cart.x) < 1e-6 || p.position.x !== x0, 'the rider follows the cart');
  p.input = { ...p.input, sneak: true }; p.lastInput = s.ticks;
  tick(s);
  assert.equal(p.mount, null, 'sneak dismounts');
});

test('a boat rider\'s input moves the boat', () => {
  const s = fixture(), p = join(s, 'a', 1, 35.5, 35.5, 9.5), sv = s.vehicles;
  const boat = sv.spawnVehicle('boat', 35.5, 9, 35.5);
  tick(s, 3);
  sv.queue('a', { v: `b${boat.id}`, hit: false }); tick(s);
  assert.ok(p.mount?.boat);
  const z0 = boat.z;
  for (let i = 0; i < 20; i++) { p.input = { ...p.input, forward: 1 }; p.lastInput = s.ticks; tick(s); }
  assert.notEqual(boat.z, z0, 'the boat moved on rider input');
  assert.ok(Math.abs(p.position.z - boat.z) < 1.5, 'the rider sits on the boat');
});

test('a hit breaks a cart into its item; riders cannot hit their own vehicle', () => {
  const s = fixture(), p = join(s, 'a', 1, 64.5, 70.5), sv = s.vehicles;
  const cart = sv.spawnVehicle('minecart', 66.5, 10, 70.5);
  tick(s, 2);
  sv.queue('a', { v: `c${cart.id}`, hit: true }); tick(s, 3);
  assert.equal(sv.find(`c${cart.id}`), null, 'creative hit breaks it');
  assert.equal(sv.queue('zz', { v: 'c1', hit: true }), false, 'unknown player');
  assert.equal(sv.queue('a', { v: '../x', hit: true }), false, 'bad key');
  assert.equal(s.itemList().length, 0, 'a creative hit drops nothing (EntityMinecart.attackEntityFrom: setDead)');
  const t = fixture('survival'), q = join(t, 'a', 1, 64.5, 70.5), c2 = t.vehicles.spawnVehicle('minecart', 66.5, 10, 70.5);
  tick(t, 2);
  for (let i = 0; i < 6 && t.vehicles.find(`c${c2.id}`); i++) { t.vehicles.act(q, { v: `c${c2.id}`, hit: true }); tick(t); } // each hit adds 10 times the damage; past 40 it breaks
  assert.equal(t.vehicles.find(`c${c2.id}`), null, 'survival hits break it');
  assert.ok(t.itemList().length >= 1, 'and it drops its item');
});

test('out of reach is refused', () => {
  const s = fixture(), p = join(s, 'a', 1, 64.5, 64.5), sv = s.vehicles;
  const cart = sv.spawnVehicle('minecart', 79.5, 10, 70.5);
  assert.equal(sv.act(p, { v: `c${cart.id}`, hit: false }), false);
  assert.equal(p.mount ?? null, null);
});

test('the vehicles message: first sight sets, unchanged sends nothing, leaving range deletes', () => {
  const s = fixture(), p = join(s, 'a', 1, 22.5, 70.5), sv = s.vehicles;
  const near = sv.spawnVehicle('minecart', 65.5, 10, 70.5), far = sv.spawnVehicle('boat', 109.5, 10, 70.5); // 43 and 87 blocks from the player
  tick(s);
  const first = take(p);
  assert.equal(first.type, 'vehicles');
  assert.deepEqual(first.set.map(x => x.v), [`c${near.id}`], 'only the vehicle in range is sent');
  tick(s, 2);
  assert.equal(take(p), null, 'no change, no message');
  p.position.copy({ x: 60.5, y: 10, z: 70.5 }); p.previous.copy(p.position); // now the boat is 49 away
  tick(s);
  assert.ok(take(p).set.some(x => x.v === `b${far.id}`), 'walking up to it sends it');
  p.position.copy({ x: 22.5, y: 10, z: 70.5 }); p.previous.copy(p.position);
  tick(s);
  assert.deepEqual(take(p).del, [`b${far.id}`], 'walking away deletes it');
});

test('client copies: apply, tick toward the target, pick, delete', () => {
  const s = fixture(), p = join(s, 'a', 1, 64.5, 64.5), sv = s.vehicles;
  const cart = sv.spawnVehicle('minecart', 65.5, 10, 70.5), boat = sv.spawnVehicle('boat', 66.5, 10, 66.5);
  tick(s);
  const remote = new RemoteVehicles(s.world);
  remote.apply(take(p));
  assert.equal(remote.carts.carts.length, 1);
  assert.equal(remote.boats.carts.length, 1);
  remote.tick();
  const rec = remote.carts.carts[0];
  assert.ok(Math.abs(rec.x - 65.5) < 0.5);
  const hit = remote.pick({ x: 65.5, y: 10.3, z: 68 }, { x: 0, y: 0, z: 1 }, 6, 6);
  assert.equal(hit?.key, `c${cart.id}`);
  assert.equal(remote.pick({ x: 65.5, y: 10.3, z: 68 }, { x: 0, y: 0, z: 1 }, 6, 6, `c${cart.id}`)?.key ?? null, null, 'the ridden vehicle is skipped');
  remote.apply({ type: 'vehicles', del: [`c${cart.id}`] });
  remote.tick();
  assert.equal(remote.carts.carts.length, 0);
  void boat;
  remote.clear();
  assert.equal(remote.boats.carts.length, 0);
});

test('vehicles are saved and restored without riders', () => {
  const s = fixture(), sv = s.vehicles;
  sv.spawnVehicle('minecart', 65.5, 10, 70.5); sv.spawnVehicle('boat', 35.5, 9, 35.5);
  const saved = JSON.parse(JSON.stringify(sv.save()));
  const t = fixture('creative', { vehicles: saved });
  assert.equal(t.vehicles.carts.carts.length, 1);
  assert.equal(t.vehicles.boats.carts.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(s.save().vehicles)), saved);
});

test('onARail: 1000 blocks by cart through the achievements sink', () => {
  const owned = new Map(), sink = { achievementsOf: id => owned.get(id) ?? (owned.set(id, new (class { constructor() { this.n = 0; } rideMinecart(x) { this.start ??= x; return x - this.start >= 1000; } stopRiding() { this.start = undefined; } })()), owned.get(id)) };
  const a = Object.assign(new ServerAchievements({ ticks: 0, players: new Map() }), { sink });
  const p = { id: 'a', position: { x: 0, y: 10, z: 0 }, previous: { x: 0, y: 10, z: 0 } };
  assert.equal(a.onMinecart(p), false, 'did not move');
  p.position.x = 1; assert.equal(a.onMinecart(p), false);
  p.position.x = 1001; p.previous.x = 1000; assert.equal(a.onMinecart(p), true);
  a.stopRiding(p); assert.equal(owned.get('a').start, undefined);
});
