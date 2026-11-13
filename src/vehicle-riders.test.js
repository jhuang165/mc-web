import test from "node:test";
import assert from "node:assert/strict";
import { JavaRandom } from "./lighting.js";
import { EntityWorld } from "./entities.js";
import { Boats } from "./boats.js";
import { Minecarts } from "./minecarts.js";
import { seatPosition, releaseStaleRiders } from "./mob-riding.js";
import { vehicleSeat, vehicleSize, isVehicle } from "./vehicle-seat.js";
import { cartPicksUp, mountMobOnVehicle, linkVehicleRiders } from "./vehicle-riders.js";
import { shadowQuads, SHADOWS } from "./shadows.js";

const f = Math.fround;
const flat = { numericSeed: 1, solid: (x, y, z) => y < 1, get: (x, y, z) => (y < 1 ? 1 : 0), getMeta: () => 0, surface: () => 1, spawn: () => ({ x: 64.5, y: 1, z: 64.5 }) };
const world = (list = []) => new EntityWorld(flat, list.map((m, i) => ({ id: `mob-${i + 1}`, health: 20, ...m })));
const night = { health: 20, creative: false, time: 18000, damage() {}, scaledDamage() {}, count: () => 0 };
const heightOf = (w) => (m) => w.size(m)[1];
const spawn = (w, type, x, y, z) => { const e = w.create(type, x, y, z); w.entities.push(e); w.nextId++; return e; };

test("a boat's seat is 0.4 ahead along its yaw at posY - 0.3, a cart's under its centre; skeletons sit 0.5 lower", () => {
  const boats = new Boats(), boat = boats.spawnBoat({ x: 10, y: 5, z: 20, yaw: 90 });
  const s = vehicleSeat(boat, 0);
  assert.ok(Math.abs(s.x - 10) < 1e-12 && Math.abs(s.z - 20.4) < 1e-12);
  assert.equal(s.y, boat.posY - f(0.3));
  assert.equal(vehicleSeat(boat, -0.5).y, boat.posY - f(0.3) - 0.5);
  const cart = new Minecarts().spawnEmpty({ x: 3, y: 4, z: 5 });
  assert.deepEqual(vehicleSeat(cart, 0), { x: 3, y: cart.posY - f(0.3), z: 5 });
  assert.deepEqual(vehicleSize(boat), [f(1.5), f(0.6)]);
  assert.deepEqual(vehicleSize(cart), [f(0.98), f(0.7)]);
  assert.ok(isVehicle(boat) && isVehicle(cart) && !isVehicle({ type: "pig" }));
  const w = world(), zombie = spawn(w, "zombie", 0, 0, 0), skeleton = spawn(w, "skeleton", 0, 0, 0);
  assert.equal(seatPosition(boat, zombie, 0).y, vehicleSeat(boat, 0).y);
  assert.equal(seatPosition(boat, skeleton, 0).y, vehicleSeat(boat, -0.5).y);
});

test("EntityMinecart.applyEntityCollision picks up a free mob only for a fast empty cart", () => {
  const w = world(), carts = new Minecarts(), cart = carts.spawnEmpty({ x: 10.5, y: 1, z: 10.5 });
  const pig = (dx = 0.5) => spawn(w, "pig", 10.5 + dx, 1, 10.5);
  cart.vx = 0.05;
  assert.equal(cartPicksUp(cart, pig()), false, "too slow: 0.0025 <= 0.01");
  cart.vx = 0.2;
  const golem = spawn(w, "iron_golem", 11, 1, 10.5);
  assert.equal(cartPicksUp(cart, golem), false, "iron golems are never taken");
  assert.equal(cartPicksUp(cart, { player: true, x: 11, z: 10.5 }), false, "players are never taken");
  const chest = carts.spawnCart(1, { x: 20.5, y: 1, z: 10.5 });
  chest.vx = 0.2;
  assert.equal(cartPicksUp(chest, pig()), false, "only type 0");
  const mob = pig();
  carts.collide(cart, mob);
  assert.equal(mob.ridingEntity, cart);
  assert.equal(cart.passenger, mob);
  assert.equal(cartPicksUp(cart, pig()), false, "occupied");
  assert.equal(mountMobOnVehicle(cart, pig(), heightOf(w)), false);
  assert.equal(carts.mount(cart, { vehicle: null }), false, "a player cannot take an occupied cart");
  const ridingAlready = pig(), other = carts.spawnEmpty({ x: 40.5, y: 1, z: 10.5 });
  other.vx = 0.2;
  assert.ok(mountMobOnVehicle(cart, ridingAlready) === false);
  assert.equal(cartPicksUp(other, mob), false, "already riding something");
});

test("a mob rides a boat and a cart with the vehicle, and a dead vehicle frees it", () => {
  const w = world();
  w.worldRandom = new JavaRandom(7);
  const boats = new Boats(), boat = boats.spawnBoat({ x: 64.5, y: 1, z: 64.5, yaw: 0 }), zombie = spawn(w, "zombie", 64.5, 1, 64.5);
  assert.ok(mountMobOnVehicle(boat, zombie, heightOf(w)));
  // b57so: EntityBoat.interactFirst refuses only another player as rider (bytecode-read): a click on a boat with a mob in it takes the boat over, and the stale pair is cleared within a pass (mob and taker free)
  const other = boats.spawnBoat({ x: 70.5, y: 1, z: 64.5, yaw: 0 }), zombie2 = spawn(w, "zombie", 70.5, 1, 64.5);
  assert.ok(mountMobOnVehicle(other, zombie2, heightOf(w)));
  const taker = { vehicle: null };
  assert.equal(boats.mount(other, taker), true, "b58so: the click seats the taker; the stale pair is cleared at the mob's turn (savedorder6-b58.test.js)");
  assert.equal(zombie2.ridingEntity, other);
  releaseStaleRiders([zombie2], new Set(), () => true);
  assert.equal(zombie2.ridingEntity ?? null, null);
  assert.equal(taker.vehicle, null);
  const p = { x: 64.5, y: 1, z: 70, health: 20 };
  for (let i = 0; i < 10; i++) {
    boat.x += 0.1; boat.px = boat.x - 0.1;
    boats.setPosition(boat, boat.x, boat.posY, boat.z);
    w.tick(p, night); w.drain();
    assert.equal(zombie.ridingEntity, boat);
    const seat = vehicleSeat(boat, 0);
    assert.deepEqual([zombie.x, zombie.y, zombie.z], [seat.x, seat.y, seat.z], `tick ${i}`);
  }
  boat.dead = true;
  w.tick(p, night); w.drain();
  assert.equal(zombie.ridingEntity, null);
});

test("passengers survive a save: the mob keeps the vehicle's id and both lists relink", () => {
  const w = world(), boats = new Boats(), carts = new Minecarts();
  boats.spawnBoat({ x: 1, y: 1, z: 1 });
  const boat = boats.spawnBoat({ x: 64.5, y: 1, z: 64.5 }), cart = carts.spawnEmpty({ x: 70.5, y: 1, z: 64.5 });
  const a = spawn(w, "zombie", 64.5, 1, 64.5), b = spawn(w, "skeleton", 70.5, 1, 64.5), loose = spawn(w, "pig", 0, 1, 0);
  assert.ok(mountMobOnVehicle(boat, a, heightOf(w)) && mountMobOnVehicle(cart, b, heightOf(w)));
  const mobSave = JSON.parse(JSON.stringify(w.serialize())), boatSave = JSON.parse(JSON.stringify(boats.toJSON())), cartSave = JSON.parse(JSON.stringify(carts.toJSON()));
  assert.deepEqual(mobSave.map((m) => m.riding), [`boat-${boat.id}`, `cart-${cart.id}`, undefined]);
  boats.carts[0].dead = true; // the first boat is gone before the save: ids must still match
  const boats2 = Boats.fromJSON(JSON.parse(JSON.stringify(boats.toJSON())).length === 1 ? boatSave.slice(1) : boatSave), carts2 = Minecarts.fromJSON(cartSave);
  const w2 = new EntityWorld(flat, mobSave);
  linkVehicleRiders(w2.entities, boats2.carts, carts2.carts, heightOf(w2));
  const [a2, b2, l2] = w2.entities;
  assert.equal(a2.ridingEntity, boats2.carts.find((v) => v.id === boat.id));
  assert.equal(b2.ridingEntity, carts2.carts[0]);
  assert.equal(l2.ridingEntity ?? null, null);
  assert.equal(a2.riding, undefined);
  assert.equal(boats2.carts.find((v) => v.id === boat.id).passenger, a2);
  assert.deepEqual(w2.serialize().map((m) => m.riding), mobSave.map((m) => m.riding));
  // A mob whose vehicle is gone is simply free.
  const w3 = new EntityWorld(flat, mobSave);
  linkVehicleRiders(w3.entities, [], [], heightOf(w3));
  assert.ok(w3.entities.every((e) => !e.ridingEntity && e.riding === undefined));
});

test("a boat casts RenderBoat's 0.5 shadow from its posY", () => {
  assert.deepEqual(SHADOWS.boat, { size: f(0.5), opaque: 1 });
  const floor = { get: (x, y, z) => (y < 1 ? 1 : 0), light: () => 15 };
  const q = shadowQuads({ ...SHADOWS.boat, x: 0.5, y: 1.3, z: 0.5, height: 0 }, { x: 0.5, y: 2, z: 0.5 }, floor);
  assert.ok(q.length > 0);
  assert.ok(q.some((s) => s.y === 1 + 0.015625));
});
