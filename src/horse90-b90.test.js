// b90 horse90: the sneak dismount timing of a riding player, in single player's server copy and on the dedicated server.
//   Native (bytecode-read; horse89-reference.json executed for the horse): the C0C's sneak flag is set by the network tick; World.updateEntityWithOptionalForce (ahb.a(sa, Z)) updates the mount, and
//   right after it the rider's EntityPlayer.updateRidden (yz.ab) runs mountEntity(null) -> dismountEntity -> setPlayerLocation. So the mount still takes the rider's input on the sneak tick,
//   and the player's server copy is let go in that same tick (its packet, processed after the entities, takes the walking branch).
import test from "node:test";
import assert from "node:assert/strict";
import { EntityWorld } from "./entities.js";
import { Survival } from "./survival.js";
import { createPlayerRider, moveRidingPlayer, finishVehicleTick } from "./vehicle-simulation.js";
import { World } from "./world.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";
import { SADDLE } from "./pig-saddle.js";

const flatWorld = () => { const solid = (x, y, z) => y < 0; return { numericSeed: 1, solid, get: (x, y, z) => (solid(x, y, z) ? 1 : 0), getMeta: () => 0, surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) }; };
const tick = (w, pos = { x: 64, y: 0, z: 90 }) => w.tick(pos, new Survival({}));

test("single player: the server copy of a sneaking horse rider is let go in the sneak tick (PlayerView.sneakOff), not one tick later", () => {
  const w = new EntityWorld(flatWorld(), [{ id: "mob-1", type: "horse", x: 64, y: 0, z: 64, health: 53, horse: { type: 0, tame: true, saddled: true, owner: "player", speed: 0.25, jump: 0.7, maxHealth: 53 } }], () => 0.5);
  const e = w.entities[0];
  Object.assign(e, { onGround: true, aiMoveSpeed: 0 });
  const rider = createPlayerRider();
  assert.ok(w.horseSeats.mount(e, rider));
  const state = { rider, horses: w.horseSeats, world: w.world, position: { x: rider.x, y: rider.y, z: rider.z }, previous: {}, velocity: { x: 0, y: 0, z: 0 }, motion: {}, yaw: 0, survival: { health: 20, held: null }, screen: "playing" };
  const view = w.ai.player;
  const step = (sneak) => { moveRidingPlayer(state, { forward: 0, strafe: 0, sneak }); view.riding = !!rider.vehicle; tick(w, state.position); finishVehicleTick(state); };
  for (let i = 0; i < 4; i++) step(false);
  assert.equal(view.branch, "riding");
  step(true);
  assert.equal(rider.vehicle, null, "the rider got off in the sneak tick");
  assert.equal(view.riding, false);
  assert.equal(view.branch, "walk", "this tick's packet takes the walking branch");
  assert.ok(view.answer || view.hasMoved === false || view.accepted, "setPlayerLocation was sent");
  assert.ok(Math.abs(view.x - rider.x) < 1e-9 && Math.abs(view.z - rider.z) < 1e-9, "the copy stands at the dismount spot");
});

const pigFixture = () => {
  const world = new World("mp-horse90");
  for (let x = 20; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 40; y++) world.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: "survival", mobs: true });
  s.mobs.spawning = false; s.mobs.mobs.entities.length = 0;
  return s;
};
const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const input = (controls = {}) => ({ type: "input", controls: { ...IDLE_INPUT, ...controls }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });

test("dedicated server: a sneaking pig rider is still aboard while the pig updates and gets off right after it", () => {
  const s = pigFixture();
  const p = s.addPlayer("a", "ax", key(1)); p.position.copy({ x: 64.5, y: 10, z: 64.5 }); p.previous.copy(p.position); s.input("a", input());
  const e = s.mobs.mobs.create("pig", 66.5, 10, 64.5); e.saddled = true; s.mobs.mobs.entities.push(e);
  p.survival.inventory.main[0] = { id: SADDLE, count: 1, damage: 0 }; p.survival.inventory.current = 0;
  s.queueAnimUse("a", Number(String(e.id).replace(/^mob-/, "")), false); s.tick();
  assert.ok(p.mount?.mob === e && e.rider, "mounted");
  for (let i = 0; i < 3; i++) s.tick();
  const seen = [];
  const tickMobs = s.mobs.mobs.tick;
  s.mobs.mobs.tick = function (...a) { seen.push(!!p.mount && !!e.rider); return tickMobs.apply(this, a); };
  s.input("a", input({ sneak: true })); s.tick();
  assert.deepEqual(seen, [true], "the pig's update ran with the rider still on it");
  assert.equal(p.mount, null, "and the rider is off after it");
  assert.equal(e.rider ?? null, null);
});

test("dedicated server: a sneaking cart rider is still aboard while the cart ticks and gets off right after it", () => {
  const s = pigFixture();
  const p = s.addPlayer("a", "ax", key(1)); p.position.copy({ x: 64.5, y: 10, z: 70.5 }); p.previous.copy(p.position); s.input("a", input());
  const cart = s.vehicles.spawnVehicle("minecart", 64.5, 10, 70.5);
  s.tick(); s.vehicles.queue("a", { v: `c${cart.id}`, hit: false }); s.tick();
  assert.ok(p.mount, "mounted");
  const seen = [];
  const carts = s.vehicles.carts, tickCarts = carts.tick;
  carts.tick = function (...a) { seen.push(!!p.mount && !!cart.rider); return tickCarts.apply(this, a); };
  s.input("a", input({ sneak: true })); s.tick();
  assert.deepEqual(seen, [true]);
  assert.equal(p.mount, null);
});

test("single player: a dying pig's sneaking rider gets off after the corpse's update (the corpse path ran no sneak step)", () => {
  const w = new EntityWorld(flatWorld(), [{ id: "mob-1", type: "pig", x: 64, y: 0, z: 64, health: 10, saddled: true }], () => 0.5);
  const e = w.entities[0];
  const rider = createPlayerRider();
  assert.ok(w.pigMount(e, Object.assign(w.horseSeats, { player: rider })), "mounted");
  assert.ok(rider.vehicle);
  e.health = 0; e.death = 5;
  rider.sneakDismount = true; rider.sneakSeat = { x: rider.x, y: rider.y, z: rider.z };
  tick(w);
  assert.equal(rider.vehicle, null);
  assert.equal(e.rider ?? null, null);
  assert.ok(rider.released);
});
