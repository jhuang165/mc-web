// Riding on the gun server (server-riding.js): saddled pigs steered with a carrot on a stick, horses and their jump charge,
// boats placed on water and rowed, empty minecarts placed on rails, sneak to get off, and the rows and presence each tab
// draws a rider and its vehicle from.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GunSimulation } from './multiplayer/gun-simulation.js';
import { serverWorldReady, STREAMED_BIOME, STREAMED_GENERATION } from './multiplayer/server-world.js';
import { RemoteThrown } from './multiplayer/remote-thrown.js';
import { makeStack } from './inventory.js';
import { CARROT_ON_A_STICK } from './pig-saddle.js';
import { BOAT_ITEM } from './boats.js';
import { EMPTY_CART_ITEM } from './vehicle-simulation.js';
import { WATER, RAIL } from './world.js';
import { installGunRules } from '../server/pack-loader.js';

await serverWorldReady;
await installGunRules();
const STREAMED = { seed: 'ledoge0', biome: STREAMED_BIOME, generationVersion: STREAMED_GENERATION };
const quiet = { spawnMonsters: false, spawnAnimals: false, spawnProtection: 0 };
const seeded = (seed = 1) => () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 2 ** 32);
const IDLE = { forward: 0, strafe: 0, jump: false, sneak: false, sprint: false };
// `n` ticks with player a's input held (a v3 input message each tick, as a tab sends).
function hold(sim, a, n, controls = {}) {
  for (let i = 0; i < n; i++) { sim.input(a.id, { controls: { ...IDLE, ...controls }, yaw: a.yaw, pitch: a.pitch, slot: a.survival.inventory.current }); sim.tick(); }
}
// A two-layer stone floor in the sky around (x, z), with an optional water pool of radius `pool` in its top layer.
function arena(sim, a, { pool = 0 } = {}) {
  const y = 150, x0 = Math.floor(a.position.x), z0 = Math.floor(a.position.z);
  for (let dx = -8; dx <= 8; dx++) for (let dz = -14; dz <= 8; dz++) {
    sim.world.put(x0 + dx, y - 2, z0 + dz, 1, 0);
    const wet = pool && Math.abs(dx) <= pool && dz <= -2 && dz >= -2 - 2 * pool;
    sim.world.put(x0 + dx, y - 1, z0 + dz, wet ? WATER : 1, 0);
  }
  sim.teleport(a, { x: x0 + 0.5, y, z: z0 + 0.5 });
  a.yaw = 0; a.pitch = 0; // looking toward -z
  hold(sim, a, 2);
  sim.mobs.ew.entities.length = 0; // the columns' own animals
  a.survival.mode = 'survival'; a.survival.inventory.creative = false;
  return { x0, y, z0 };
}
function setup(seed) {
  const sim = new GunSimulation({ ...STREAMED, time: 6000 }, { config: quiet, random: seeded(seed) });
  const a = sim.addPlayer('a', 'Alice', 'acct-a');
  return { sim, a, ...arena(sim, a) };
}
const give = (a, id, count = 1, damage = 0) => { a.survival.inventory.main[0] = id ? makeStack(id, count, damage) : null; a.survival.inventory.current = 0; };
const flat = (p, q) => Math.hypot(p.x - q.x, p.z - q.z);

test('a saddled pig seats the player, a carrot on a stick steers it, and sneak gets off', () => {
  const { sim, a, x0, y, z0 } = setup(3);
  const pig = sim.mobs.ew.create('pig', x0 + 0.5, y, z0 - 1.5); pig.saddled = true; sim.mobs.ew.entities.push(pig);
  pig.aiMoveSpeed = Math.fround(0.25); // as pig-saddle.test.js: a ridden pig keeps the speed it last wandered at (a new one has 0)
  give(a, CARROT_ON_A_STICK, 1);
  a.pitch = -0.6;
  assert.equal(sim.edit(a, true), true);
  assert.equal(a.rider.vehicle?.entity, pig, 'on the pig');
  hold(sim, a, 1);
  assert.ok(flat(a.position, pig) < 0.01 && a.position.y > pig.y, 'the seat follows the pig');
  const you = sim.you(a);
  assert.equal(you.riding.kind, 'pig'); assert.equal(you.riding.id, Number(pig.id.replace('mob-', '')));
  assert.equal(you.riding.health, pig.health); assert.ok(you.riding.max >= pig.health);
  assert.equal(sim.presence().find(e => e.id === 'a').riding, 'mob');
  const start = { x: pig.x, z: pig.z };
  a.pitch = 0;
  hold(sim, a, 60, { forward: 1 });
  assert.ok(flat(pig, start) > 1, `the held carrot on a stick steers the pig (${flat(pig, start).toFixed(2)})`);
  assert.ok(flat(a.position, pig) < 0.01, 'still seated');
  hold(sim, a, 1, { sneak: true });
  assert.equal(a.rider.vehicle, null, 'sneak gets off');
  assert.equal(pig.rider, null);
  assert.equal(sim.you(a).riding, null);
  assert.equal(sim.presence().find(e => e.id === 'a').riding, undefined);
});

test('a tame horse carries its rider, charges the jump bar while jump is held and jumps on release', () => {
  const { sim, a, x0, y, z0 } = setup(4);
  const horse = sim.mobs.ew.create('horse', x0 + 0.5, y, z0 - 2);
  horse.growingAge = 0; // an adult (create makes a foal, which cannot be ridden)
  Object.assign(horse.horse, { type: 0, tame: true, saddled: true, owner: 'Alice' });
  sim.mobs.ew.entities.push(horse);
  give(a, 0);
  a.pitch = -0.4;
  assert.equal(sim.edit(a, true), true);
  assert.equal(a.rider.vehicle?.entity, horse);
  const start = { x: horse.x, z: horse.z };
  a.pitch = 0;
  hold(sim, a, 12, { forward: 1 });
  assert.ok(flat(horse, start) > 1, `the horse walks on (${flat(horse, start).toFixed(2)})`);
  hold(sim, a, 8, { jump: true });
  const charged = sim.you(a).riding.jump;
  assert.ok(charged > 0.3 && charged <= 1, `the jump bar charges (${charged})`);
  assert.ok(horse.onGround && horse.y >= y - 0.01, `still on the floor (${horse.y})`);
  const ground = horse.y;
  hold(sim, a, 3);
  assert.ok(horse.y > ground, 'released, the horse jumps');
  assert.equal(sim.you(a).riding.jump, 0);
  // A player riding is off when it leaves; the horse is free for someone else.
  sim.removePlayer('a');
  assert.equal(horse.rider, null);
});

test('a boat placed on water is boarded, rowed and left; the tab draws it from its rows', () => {
  const sim = new GunSimulation({ ...STREAMED, time: 6000 }, { config: quiet, random: seeded(5) });
  const a = sim.addPlayer('a', 'Alice', 'acct-a');
  arena(sim, a, { pool: 4 });
  give(a, BOAT_ITEM, 1);
  a.pitch = -0.7;
  assert.equal(sim.edit(a, true), true, 'the boat is placed');
  const boat = sim.mobs.boats.carts[0];
  assert.ok(boat && !a.survival.inventory.main[0], 'one boat, the item spent');
  hold(sim, a, 10);
  const rows = sim.you(a).boats;
  assert.equal(rows.length, 1); assert.equal(rows[0][0], boat.id);
  a.pitch = -0.7;
  assert.equal(sim.edit(a, true), true, 'the use button boards it');
  assert.equal(a.rider.vehicle, boat);
  assert.equal(sim.you(a).riding.kind, 'boat');
  const start = { x: boat.x, z: boat.z };
  a.pitch = 0;
  hold(sim, a, 45, { forward: 1 }); // a boat picks up speed slowly (EntityBoat's speedMultiplier)
  assert.equal(a.rider.vehicle, boat, 'still aboard');
  assert.ok(flat(boat, start) > 0.5, `rowed forward (${flat(boat, start).toFixed(2)})`);
  assert.ok(flat(a.position, boat) < 0.5, 'the seat is in the boat');
  hold(sim, a, 1, { sneak: true });
  assert.equal(a.rider.vehicle, null); assert.equal(boat.rider, null);
  // The tab's records: the box, last tick's position for the lerp, the yaw turned the short way round.
  const tab = new RemoteThrown();
  tab.applyBoats([[7, 1, 2, 3, 179, 0, 0, 1]]);
  tab.applyBoats([[7, 2, 2, 3, -179, 5, 3, -1]]);
  const [r] = tab.boats;
  assert.equal(r.px, 1); assert.equal(r.x, 2); assert.equal(r.yaw, -179); assert.equal(r.prevYaw, -181);
  assert.equal(r.timeSinceHit, 5); assert.equal(r.forwardDir, -1); assert.equal(r.bb.length, 6);
  tab.applyBoats([]);
  assert.equal(tab.boats.length, 0);
  // Saved and loaded: the boat is kept, its player is not seated again.
  const back = new GunSimulation(JSON.parse(JSON.stringify(sim.save())));
  assert.equal(back.mobs.boats.carts.length, 1);
});

test('an empty minecart placed on a rail is boarded, and a teleport or a death gets the rider off', () => {
  const { sim, a, x0, y, z0 } = setup(6);
  for (let dz = -6; dz <= -1; dz++) sim.world.put(x0, y, z0 + dz, RAIL, 0);
  give(a, EMPTY_CART_ITEM, 1);
  a.pitch = -0.7;
  assert.equal(sim.edit(a, true), true, 'placed on the rail');
  const cart = sim.mobs.minecarts.carts.find(c => c.type === 0);
  assert.ok(cart && !a.survival.inventory.main[0]);
  hold(sim, a, 2);
  a.pitch = -0.7;
  assert.equal(sim.edit(a, true), true, 'boarded');
  assert.equal(a.rider.vehicle, cart);
  hold(sim, a, 1);
  assert.ok(flat(a.position, cart) < 0.01, 'seated in the cart');
  assert.equal(sim.presence().find(e => e.id === 'a').riding, 'cart');
  sim.teleport(a, { x: x0 + 3.5, y, z: z0 + 3.5 });
  assert.equal(a.rider.vehicle, null); assert.equal(cart.rider, null);
  assert.equal(a.position.x, x0 + 3.5, 'the teleport wins over the dismount spot');
  // Back in, then killed: the rider is off the cart.
  sim.teleport(a, { x: x0 + 0.5, y, z: z0 + 0.5 });
  hold(sim, a, 2);
  a.pitch = -0.7;
  assert.equal(sim.edit(a, true), true);
  assert.equal(a.rider.vehicle, cart);
  a.survival.damage(1000, 'void');
  hold(sim, a, 1);
  assert.equal(a.dead, true); assert.equal(a.rider.vehicle, null); assert.equal(cart.rider, null);
});
