// Batch 65 mpspawners2: spawner effects and riding chains on the dedicated server, spawner minecarts, and the client's copy of the spawner (server-spawners.js, client-spawners.js, client-dispense.js).
// Native facts (bytecode-read, see .shared-memory/notes/mpspawners2-b65-track.md): agq.b(1) sets the client's delay to minSpawnDelay (no value on the wire), playAuxSFX 2004 and block events go to players
// within 64 blocks of the same dimension, a spawner minecart sends no EntityId (the client copy is a Pig).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World, MOB_SPAWNER } from './world.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';
import { chainSupported, sendSpawnerFx } from './multiplayer/server-spawners.js';
import { RemoteDispense } from './multiplayer/client-dispense.js';
import { applySpawnerDelay } from './multiplayer/client-spawners.js';
import { RemoteVehicles } from './multiplayer/remote-vehicles.js';
import { vehicleState } from './multiplayer/server-vehicles.js';
import { MobSpawners, receiveClientEvent } from './mob-spawner.js';
import { tickSpawnersClient } from './structure-simulation.js';
import { summonCart } from './cart-summon.js';
import { NBT } from './nbt.js';
import { JavaRandom } from './java-random.js';

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const NETHERRACK = 150;
const input = () => ({ type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
const flat = () => { const w = new World('mp-spawners2-b65'); w.spawn = () => ({ x: 64.5, y: 10, z: 64.5 }); return w; };
// A Nether player on a netherrack floor at y 69 (no sky light, so every monster kind may spawn).
function fixture() {
  const s = new DedicatedSimulation({}, { world: flat(), gameMode: 'creative', mobs: true });
  const a = s.addPlayer('a', 'Alice', key(1));
  s.dimensions.arrive(a, -1, { at: { x: 64.5, y: 70, z: 64.5 } });
  const n = s.dimensions.nether, w = n.world;
  for (let x = 40; x <= 90; x++) for (let z = 40; z <= 90; z++) for (let y = 60; y <= 90; y++) w.put(x, y, z, y === 69 ? NETHERRACK : 0, 0, false);
  s.input('a', input());
  return { s, a, n, w };
}
// NBT compounds in the JSON form spawner-data.js saves (a SpawnData entry's `props`).
const str = v => ({ t: NBT.STRING, v });
const comp = (...pairs) => ({ t: NBT.COMPOUND, v: pairs });
const FAST = { Delay: 0, MinSpawnDelay: 1, MaxSpawnDelay: 2, SpawnCount: 1, MaxNearbyEntities: 6, RequiredPlayerRange: 16 };
const spawnData = (id, riding) => ({ weight: 1, props: comp(['id', str(id)], ...(riding ? [['Riding', riding]] : [])) });
const addSpawner = (n, w, extra) => { w.put(70, 70, 64, MOB_SPAWNER, 0, false); return n.tileEntities.spawners.add({ x: 70, y: 70, z: 64, ...FAST, ...extra }); };
const run = (f, step, max = 600) => { for (let i = 0; i < max; i++) { step(); if (f.done()) return true; } return false; };
const fx = a => (a.dispOut ?? []).filter(m => m.type === 'dispFx').flatMap(m => m.events);

test('a Nether spawner sends the block event and the 2004 burst as dispFx events to the player in range', { timeout: 300000 }, () => {
  const { s, a, n, w } = fixture();
  addSpawner(n, w, { EntityId: 'Blaze' });
  const seen = [];
  const ok = run({ done: () => seen.some(e => e.k === 'spawnerBurst') && seen.some(e => e.k === 'spawnerPuff') }, () => {
    s.input('a', input()); a.position.copy({ x: 64.5, y: 70, z: 64.5 }); a.survival.health = 20;
    s.tick(); seen.push(...fx(a)); a.dispOut = null; a.mobPackets = null;
  });
  assert.ok(ok, 'a spawn happened');
  const burst = seen.find(e => e.k === 'spawnerBurst');
  assert.deepEqual([burst.x, burst.y, burst.z], [70, 70, 64], 'playAuxSFX 2004 at the spawner block');
  const delay = seen.find(e => e.k === 'spawnerDelay');
  assert.ok(delay && delay.v === undefined && [delay.x, delay.y, delay.z].join() === '70,70,64', 'addBlockEvent(1, 0) at the block, no minecart key');
  const puff = seen.find(e => e.k === 'spawnerPuff');
  assert.ok(puff.w > 0 && puff.h > 0, 'entity status 20 carries the mob size');
});

test('sendSpawnerFx: 64 blocks strictly, a minecart status by its tracking range, nothing without events', () => {
  const near = { id: 1, position: { x: 63.9, y: 0, z: 0 } }, far = { id: 2, position: { x: 64, y: 0, z: 0 } }, up = { id: 3, position: { x: 0, y: 64, z: 0 } };
  sendSpawnerFx([near, far, up], [{ k: 'spawnerBurst', x: 0, y: 0, z: 0 }]);
  assert.equal(near.dispOut.length, 1);
  assert.equal(far.dispOut, undefined, 'exactly 64 is outside (d^2 < 64^2)');
  assert.equal(up.dispOut, undefined, 'the vertical distance counts');
  const p = { id: 4, position: { x: 70, y: 200, z: 0 } }, q = { id: 5, position: { x: 81, y: 0, z: 0 } };
  sendSpawnerFx([p, q], [{ k: 'spawnerDelay', x: 0, y: 64, z: 0, v: 'c3' }]);
  assert.equal(p.dispOut.length, 1, 'the cart tracker range is horizontal (80)');
  assert.equal(q.dispOut, undefined);
  const r = { id: 6, position: { x: 0, y: 0, z: 0 } };
  sendSpawnerFx([r], []);
  assert.equal(r.dispOut, undefined);
});

test('chainSupported: a Riding mount outside the server kinds refuses the whole spawn', () => {
  const jockey = { props: comp(['id', str('Skeleton')], ['Riding', comp(['id', str('Spider')])]) };
  const mk = j => MobSpawners.fromJSON([{ x: 0, y: 0, z: 0, EntityId: 'Skeleton', SpawnData: j }]).get(0, 0, 0).spawnData;
  assert.equal(chainSupported(mk(jockey)), true, 'spider jockey');
  assert.equal(chainSupported(mk(spawnData('Skeleton', comp(['id', str('Giant')])))), false, 'a giant mount has no client copy'); // b66: villagers are server kinds now
  assert.equal(chainSupported(mk(spawnData('Zombie', comp(['id', str('Boat')])))), true, 'a boat is a vehicle, made in ServerVehicles');
  assert.equal(chainSupported(mk(spawnData('Zombie', comp(['id', str('Spider')], ['Riding', comp(['id', str('Pig')])])))), true, 'a deeper chain');
  assert.equal(chainSupported(null), true);
});

test('a spider jockey from SpawnData Riding is spawned and linked on the server, and survives a save', { timeout: 300000 }, () => {
  const { s, a, n, w } = fixture();
  addSpawner(n, w, { EntityId: 'Skeleton', SpawnData: spawnData('Skeleton', comp(['id', str('Spider')])) });
  const ents = () => n.mobs.mobs.entities;
  const ok = run({ done: () => ents().some(e => e.type === 'skeleton' && e.ridingEntity?.type === 'spider') }, () => {
    s.input('a', input()); a.position.copy({ x: 64.5, y: 70, z: 64.5 }); a.survival.health = 20; s.tick(); a.dispOut = null; a.mobPackets = null;
  });
  assert.ok(ok, 'a skeleton rides a spider');
  const saved = n.mobs.save();
  assert.ok(saved.some(r => r.type === 'skeleton' && /^mob-\d+$/.test(r.riding ?? '')), 'the rider saves its mount id');
  assert.ok(saved.some(r => r.type === 'spider'), 'the mount saves');
  const spawnerSave = n.tileEntities.spawners.toJSON()[0];
  assert.ok(spawnerSave.SpawnData, 'the spawner keeps its SpawnData with the Riding compound');
  const again = MobSpawners.fromJSON(JSON.parse(JSON.stringify([spawnerSave]))).get(70, 70, 64);
  assert.equal(chainSupported(again.spawnData), true);
  assert.equal(again.spawnData.props.get('Riding').type, NBT.COMPOUND, 'the chain survives the JSON round trip');
});

test('an unsupported Riding mount spawns nothing (the rolls are spent)', { timeout: 300000 }, () => {
  const { s, a, n, w } = fixture();
  addSpawner(n, w, { EntityId: 'Skeleton', SpawnData: spawnData('Skeleton', comp(['id', str('Giant')])) }); // b66: villagers are server kinds now
  for (let i = 0; i < 80; i++) { s.input('a', input()); a.position.copy({ x: 64.5, y: 70, z: 64.5 }); s.tick(); a.dispOut = null; a.mobPackets = null; }
  assert.equal(n.mobs.mobs.entities.filter(e => e.type === 'skeleton' || e.type === 'giant').length, 0);
});

test('a SpawnData Riding boat is made in the dimension\'s vehicles', { timeout: 300000 }, () => {
  const { s, a, n, w } = fixture();
  addSpawner(n, w, { EntityId: 'Zombie', SpawnData: spawnData('Zombie', comp(['id', str('Boat')])) });
  const ok = run({ done: () => n.vehicles.boats.carts.some(b => !b.dead) }, () => {
    s.input('a', input()); a.position.copy({ x: 64.5, y: 70, z: 64.5 }); a.survival.health = 20; s.tick(); a.dispOut = null; a.mobPackets = null;
  });
  assert.ok(ok, 'a boat exists');
  assert.ok(n.mobs.mobs.entities.some(e => e.type === 'zombie' && e.ridingEntity), 'the zombie sits in it');
  assert.equal(s.vehicles.boats.carts.length, 0, 'not in the Overworld list');
});

test('a spawner minecart on the server spawns, sends its status by cart key, and its state is type 4', { timeout: 300000 }, () => {
  const { s, a, n } = fixture();
  const tag = new Map([['EntityId', { type: NBT.STRING, value: 'Blaze' }], ['Delay', { type: NBT.SHORT, value: 0 }], ['MinSpawnDelay', { type: NBT.SHORT, value: 1 }], ['MaxSpawnDelay', { type: NBT.SHORT, value: 2 }], ['SpawnCount', { type: NBT.SHORT, value: 1 }]]);
  const { cart } = summonCart(n.vehicles.carts, 4, 66.5, 70, 64.5, tag);
  assert.equal(vehicleState(cart).t, 4);
  const seen = [];
  const ok = run({ done: () => seen.some(e => e.k === 'spawnerBurst') }, () => {
    s.input('a', input()); a.position.copy({ x: 64.5, y: 70, z: 64.5 }); a.survival.health = 20; s.tick(); seen.push(...fx(a)); a.dispOut = null; a.mobPackets = null;
  });
  assert.ok(ok, 'the cart\'s logic spawned a mob');
  assert.ok(n.mobs.mobs.entities.some(e => e.type === 'blaze'));
  const delay = seen.find(e => e.k === 'spawnerDelay');
  assert.equal(delay.v, 'c' + cart.id, 'S19 status 1 names the cart');
  const burst = seen.find(e => e.k === 'spawnerBurst');
  assert.deepEqual([burst.x, burst.y, burst.z], [Math.floor(cart.x), Math.floor(cart.posY), Math.floor(cart.z)], 'the cart\'s block');
});

test('client: dispFx events reach the hooks; the delay event sets minSpawnDelay on a block or a cart copy', () => {
  const calls = [];
  const rd = new RemoteDispense({ spawnerBurst: (...a) => calls.push(['burst', ...a]), spawnerDelay: (...a) => calls.push(['delay', ...a]), spawnerPuff: (...a) => calls.push(['puff', ...a]) });
  rd.apply({ type: 'dispFx', events: [{ k: 'spawnerBurst', x: 1, y: 2, z: 3 }, { k: 'spawnerDelay', x: 1, y: 2, z: 3 }, { k: 'spawnerDelay', x: 4, y: 5, z: 6, v: 'c9' }, { k: 'spawnerPuff', x: 1, y: 2, z: 3, w: 0.6, h: 1.8 }, { k: 'spawnerBurst', x: NaN, y: 0, z: 0 }] });
  assert.deepEqual(calls, [['burst', 1, 2, 3], ['delay', 1, 2, 3, null], ['delay', 4, 5, 6, 'c9'], ['puff', 1, 2, 3, 0.6, 1.8]]);

  const spawners = new MobSpawners();
  const sp = spawners.add({ x: 1, y: 2, z: 3, EntityId: 'Blaze', MinSpawnDelay: 120, MaxSpawnDelay: 300, Delay: 500 });
  assert.equal(sp.client.delay, 500);
  assert.equal(applySpawnerDelay({ spawners }, 1, 2, 3), true);
  assert.equal(sp.client.delay, 120, 'agq.b(1): delay = minSpawnDelay');
  assert.equal(applySpawnerDelay({ spawners }, 9, 9, 9), false);

  const rv = new RemoteVehicles(null);
  rv.carts.spawnCart = rv.carts.spawnCart.bind(rv.carts);
  const copy = rv.carts.spawnCart(4, { x: 4.5, y: 5, z: 6.5, items: [] });
  rv.copies.set('c9', { v: copy, target: {} });
  assert.equal(copy.spawner.entityId, 'Pig', 'the client copy of a spawner cart is a Pig (no EntityId on the wire)');
  copy.spawner.client.delay = 700;
  assert.equal(applySpawnerDelay({ spawners, copies: rv.copies }, 4, 5, 6, 'c9'), true);
  assert.equal(copy.spawner.client.delay, copy.spawner.minSpawnDelay);
  assert.equal(applySpawnerDelay({ spawners, copies: rv.copies }, 4, 5, 6, 'c10'), false);
});

test('client: the multiplayer tick draws smoke and flame for a described spawner and a remote cart copy within 16 blocks', () => {
  const spawners = new MobSpawners();
  spawners.add({ x: 10, y: 70, z: 10, EntityId: 'Zombie' });
  const rv = new RemoteVehicles(null);
  const cart = rv.carts.spawnCart(4, { x: 12.5, y: 70, z: 10.5, items: [] });
  const parts = [];
  const eye = { x: 10.5, y: 71.62, z: 10.5 };
  tickSpawnersClient({ spawners, minecarts: rv.carts, random: new JavaRandom(1), eye }, { particle: (n, x, y, z) => parts.push([n, x, y, z]) });
  assert.equal(parts.length, 4, 'smoke and flame for each of the two');
  assert.deepEqual(parts.map(p => p[0]), ['smoke', 'flame', 'smoke', 'flame']);
  const sp = spawners.get(10, 70, 10);
  assert.ok(sp.client.rotation > 0, 'the display mob spins');
  assert.ok(cart.spawner.client.rotation > 0, 'and so does the cart\'s');
  parts.length = 0;
  tickSpawnersClient({ spawners, minecarts: rv.carts, random: new JavaRandom(1), eye: { x: 100, y: 71, z: 100 } }, { particle: () => parts.push(1) });
  assert.equal(parts.length, 0, 'nothing outside 16 blocks');
  assert.equal(receiveClientEvent(sp, 2), false);
});
