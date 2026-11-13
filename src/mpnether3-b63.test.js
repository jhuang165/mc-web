// Batch 63 mpnether3: the dedicated Nether's experience orbs, spawner ticking, vehicles, animal clicks and difficulty (server-nether.js, server-nether-vehicles.js, server-spawners.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World, RAIL, MOB_SPAWNER } from './world.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';
import { makeStack } from './inventory.js';

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const NETHERRACK = 150;
const input = () => ({ type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
const flat = () => { const w = new World('mp-nether3-b63'); w.spawn = () => ({ x: 64.5, y: 10, z: 64.5 }); return w; };
const frames = (s, k = 1) => { for (let i = 0; i < k; i++) s.tick(); };
// A Nether player `a` standing on a netherrack slab at y 69 (a flat floor), and an Overworld player `b` when asked.
function fixture({ mobs = false, mode = 'creative', other = false } = {}) {
  const s = new DedicatedSimulation({}, { world: flat(), gameMode: mode, mobs });
  const a = s.addPlayer('a', 'Alice', key(1));
  s.dimensions.arrive(a, -1, { at: { x: 64.5, y: 70, z: 64.5 } });
  const n = s.dimensions.nether, w = n.world;
  for (let x = 40; x <= 90; x++) for (let z = 40; z <= 90; z++) for (let y = 60; y <= 90; y++) w.put(x, y, z, y === 69 ? NETHERRACK : 0, 0, false);
  s.input('a', input());
  let b = null;
  if (other) { b = s.addPlayer('b', 'Bob', key(2)); b.position.copy({ x: 64.5, y: 10, z: 64.5 }); b.previous.copy(b.position); s.input('b', input()); }
  return { s, a, b, n, w };
}

test('Nether experience orbs: spawned into the Nether, ticked, collected by a Nether player, sent only to the Nether', { timeout: 120000 }, () => {
  const { s, a, b, n } = fixture({ other: true });
  s.dimensions.within(a, () => s.serverItems.xp.spawn(7, { x: 62.2, y: 70.2, z: 64.5 })); // a little off: the orb homes in once it is 20 ticks old (EntityXPOrb)
  assert.ok(n.xp.orbs.length >= 1, 'the orbs are the Nether\'s');
  assert.equal(s.serverItems.xp.orbs.length, 0, 'none in the Overworld set');
  const total = a.experience.total;
  let sentToNether = false;
  for (let i = 0; i < 400 && a.experience.total < total + 7; i++) {
    s.input('a', input()); s.input('b', input());
    s.tick();
    if (s.dimensions.alt[-1]?.xp?.length) sentToNether = true;
  }
  assert.ok(sentToNether, 'the Nether tick message carried the orbs');
  assert.equal(a.experience.total, total + 7, 'the Nether player collected all of the value');
  assert.equal(n.xp.orbs.length, 0);
  const base = s.tick();
  assert.equal(base.xp, undefined, 'the Overworld message never carried them');
  void b;
});

test('an Overworld orb is not collected by a Nether player, and Nether orbs are saved', { timeout: 120000 }, () => {
  const { s, a, n } = fixture({ other: true });
  s.serverItems.xp.spawn(5, { x: 64.5, y: 70.2, z: 64.5 }); // Overworld orbs at the Nether player's coordinates
  const total = a.experience.total;
  frames(s, 10);
  assert.equal(a.experience.total, total, 'a different dimension: nothing collected');
  assert.ok(s.serverItems.xp.orbs.length >= 1);
  s.dimensions.within(a, () => s.serverItems.xp.spawn(3, { x: 50.5, y: 75, z: 50.5 }));
  const saved = JSON.parse(JSON.stringify(s.save()));
  assert.ok(saved.dimensions.nether.xpOrbs.length >= 1, 'the Nether orbs are in the save');
  const again = new DedicatedSimulation(saved, { world: flat(), gameMode: 'creative', mobs: false });
  again.addPlayer('a2', 'Alice', key(1));
  assert.ok(again.dimensions.nether.xp.orbs.length >= 1, 'and come back');
  void n;
});

test('the server difficulty reaches both dimensions\' mobs (every WorldServer reads the one setting)', { timeout: 120000 }, () => {
  const { s } = fixture({ mobs: true, other: true });
  s.difficulty = 3;
  s.input('a', input()); s.input('b', input());
  frames(s, 2);
  assert.equal(s.mobs.mobs.difficulty, 3, 'Overworld mobs');
  assert.equal(s.dimensions.nether.mobs.mobs.difficulty, 3, 'Nether mobs');
  s.difficulty = 1;
  frames(s, 2);
  assert.equal(s.dimensions.nether.mobs.mobs.difficulty, 1);
  assert.equal(s.mobs.mobs.difficulty, 1);
});

test('a blaze spawner in the Nether spawns blazes near a Nether player only', { timeout: 300000 }, () => {
  const { s, a, b, n, w } = fixture({ mobs: true, other: true });
  w.put(70, 70, 64, MOB_SPAWNER, 0, false);
  n.tileEntities.spawners.add({ x: 70, y: 70, z: 64, EntityId: 'Blaze' });
  const countBlazes = () => n.mobs.mobs.entities.filter(e => e.type === 'blaze').length;
  const leaked = [];
  for (let i = 0; i < 1200 && countBlazes() < 3; i++) {
    s.input('a', input()); a.position.copy({ x: 64.5, y: 70, z: 64.5 }); a.survival.health = 20;
    s.input('b', input());
    frames(s);
    for (const pk of b.mobPackets ?? []) if (pk.type === 'spawn' && pk.mob === 'blaze') leaked.push(pk);
    b.mobPackets = null; a.mobPackets = null;
  }
  assert.ok(countBlazes() >= 1, 'the spawner produced a blaze (MobSpawnerBaseLogic.updateSpawner)');
  assert.ok(countBlazes() <= 6, 'within maxNearbyEntities');
  assert.equal(leaked.length, 0, 'the Overworld player was sent none');
  assert.ok(!s.mobs.mobs.entities.some(e => e.type === 'blaze'), 'none in the Overworld list');
});

test('a spawner does nothing with no player of its dimension in range', { timeout: 120000 }, () => {
  const { s, a, n, w } = fixture({ mobs: true });
  w.put(70, 70, 64, MOB_SPAWNER, 0, false);
  n.tileEntities.spawners.add({ x: 70, y: 70, z: 64, EntityId: 'Blaze' });
  a.position.copy({ x: 45.5, y: 70, z: 45.5 }); // 25+ blocks away
  for (let i = 0; i < 100; i++) { s.input('a', input()); a.position.copy({ x: 45.5, y: 70, z: 45.5 }); frames(s); }
  assert.equal(n.mobs.mobs.entities.filter(e => e.type === 'blaze').length, 0);
});

test('minecarts in the Nether: placed on a rail, ridden, seen only by Nether players, saved', { timeout: 120000 }, () => {
  const { s, a, b, n, w } = fixture({ other: true, mode: 'survival' });
  for (let x = 55; x <= 75; x++) w.put(x, 70, 64, RAIL, 1, false);
  a.position.copy({ x: 64.5, y: 70, z: 64.5 }); a.previous.copy(a.position);
  a.survival.inventory.main[a.survival.inventory.current] = makeStack(366, 1); // minecart
  a.yaw = 0; a.pitch = -1.5;
  s.dimensions.within(a, () => s.edit(a, true));
  assert.equal(n.vehicles.carts.carts.length, 1, 'the Nether has the cart');
  assert.equal(s.vehicles.carts.carts.length, 0, 'the Overworld has none');
  const cart = n.vehicles.carts.carts[0];
  let seen = null, leakedToOverworld = false;
  for (let i = 0; i < 3; i++) { s.input('a', input()); s.input('b', input()); s.tick(); seen ??= a.vehPackets; if (b.vehPackets) leakedToOverworld = true; b.vehPackets = null; a.vehPackets = null; }
  assert.ok(seen?.set?.some(v => v.v === `c${cart.id}`), 'the Nether player is told about the cart');
  assert.equal(leakedToOverworld, false, 'the Overworld player is not');
  assert.ok(s.queueVehicle('a', { v: `c${cart.id}`, hit: false }));
  frames(s);
  assert.ok(a.mount, 'the Nether player mounted (C02 interact)');
  assert.equal(s.presence(-1).find(x => x.id === 'a').riding, `c${cart.id}`);
  const saved = JSON.parse(JSON.stringify(s.save()));
  assert.equal(saved.dimensions.nether.vehicles.carts.carts.length, 1, 'the cart is in the Nether save');
  assert.equal(saved.vehicles.carts.carts.length, 0, 'and not in the Overworld one');
  s.removePlayer('a'); // a rider leaves
  assert.equal(a.mount, null, 'the rider was let down by the Nether instance');
  assert.ok(n.vehicles.carts.carts.length === 1);
});

test('a Nether rider is not dismounted by the Overworld vehicles and a Nether trip dismounts', { timeout: 120000 }, () => {
  const { s, a, n, w } = fixture({ other: true });
  for (let x = 55; x <= 75; x++) w.put(x, 70, 64, RAIL, 1, false);
  const cart = n.vehicles.spawnVehicle('minecart', 64.5, 70, 64.5);
  s.input('a', input()); s.input('b', input());
  frames(s);
  s.queueVehicle('a', { v: `c${cart.id}`, hit: false });
  frames(s, 3);
  assert.ok(a.mount, 'mounted');
  const overworldCart = s.vehicles.spawnVehicle('minecart', 20.5, 10, 20.5); // the same key can exist in the Overworld
  assert.ok(overworldCart);
  frames(s, 5);
  assert.ok(a.mount, 'still riding after the Overworld instance ticked');
  s.dimensions.arrive(a, 0, { at: { x: 64.5, y: 10, z: 64.5 } });
  assert.equal(a.mount, null, 'the trip dismounts');
});

test('a saddled pig clicked by a Nether player is mounted (animal clicks work in the Nether)', { timeout: 120000 }, () => {
  const { s, a, n } = fixture({ mobs: true });
  const m = n.mobs.mobs, pig = m.create('pig', 64.5, 70, 66.5);
  pig.saddled = true; m.entities.push(pig);
  s.input('a', input());
  frames(s);
  a.position.copy({ x: 64.5, y: 70, z: 64.5 }); a.previous.copy(a.position);
  assert.ok(s.queueAnimUse('a', Number(String(pig.id).replace(/^mob-/, ''))));
  frames(s);
  assert.ok(a.mount?.mob === pig, 'the pig took the rider');
});

test('a lead ties a Nether animal to a Nether player and a fence knot', { timeout: 120000 }, () => {
  const { s, a, n } = fixture({ mobs: true, mode: 'survival' });
  const m = n.mobs.mobs, cow = m.create('cow', 64.5, 70, 66.5);
  m.entities.push(cow);
  s.input('a', input()); frames(s);
  a.position.copy({ x: 64.5, y: 70, z: 64.5 }); a.previous.copy(a.position);
  a.survival.inventory.main[a.survival.inventory.current] = makeStack(2020, 1); // lead
  assert.ok(s.queueAnimUse('a', Number(String(cow.id).replace(/^mob-/, ''))));
  frames(s);
  assert.equal(cow.leash?.holderId, 'a', 'the Nether cow is led by its Nether holder');
  for (let i = 0; i < 10; i++) { a.position.copy({ x: 64.5, y: 70, z: 64.5 }); frames(s); }
  assert.ok(cow.leash, 'the lead holds (not dropped by the Overworld rule)');
});
