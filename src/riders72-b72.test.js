import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EntityWorld } from "./entities.js";
import { freeChickenNear, beginRidden, endRidden, mountEntity } from "./mob-riding.js";
import { anchoredShrunkBox } from "./mob-spawner.js";
import { passFall, takeVehicleFalls } from "./vehicle-riders.js";
import { Boats } from "./boats.js";
import { Minecarts } from "./minecarts.js";
import { createPlayerRider, syncRider } from "./vehicle-simulation.js";

// RidersProbe on the unchanged 1.7.10 classes (tools/verify-riders72.mjs -> riders72-reference.json).
const reference = JSON.parse(readFileSync(new URL("../public/research/riders72-reference.json", import.meta.url)));
const records = (c) => reference.records.filter((r) => r.case === c);
const main = readFileSync(new URL("./main.js", import.meta.url), "utf8");

test("the reference covers the three checks and the unchanged classes", () => {
  assert.equal(records("ride").length, 56);
  assert.equal(records("fall").length, 6);
  assert.equal(records("jockey").length, 12);
  for (const c of ["sa", "sv", "yz", "yq", "wg", "ahb", "apx", "sj"]) assert.match(reference.classes[c].sha256, /^[0-9a-f]{64}$/);
});

test("rider fall distance: EntityLivingBase.updateRidden zeroes it (executed on a dead mount; the live path throws in the bare probe world)", () => {
  for (const r of records("fall").filter((x) => !x.liveMount)) { assert.equal(r.before, 5, r.name); assert.equal(r.after, 0, r.name); assert.equal(r.linked, false, r.name); }
  // Zeroed after the rider's own update, not before it: beginRidden leaves the value, endRidden clears it (also with no mount left).
  const e = { vx: 1, vy: 1, vz: 1, fallDistance: 5, ridingEntity: null };
  beginRidden(e);
  assert.deepEqual([e.vx, e.vy, e.vz, e.fallDistance], [0, 0, 0, 5]);
  endRidden(e, () => 1);
  assert.equal(e.fallDistance, 0);
});

test("a zombie riding a pig keeps fallDistance 0 through the walk", () => {
  const flat = { numericSeed: 1, solid: (x, y, z) => y < 1, get: (x, y, z) => (y < 1 ? 1 : 0), getMeta: () => 0, surface: () => 1, spawn: () => ({ x: 64.5, y: 1, z: 64.5 }) };
  const w = new EntityWorld(flat, [{ id: "mob-1", type: "pig", x: 64.5, y: 1, z: 64.5, health: 10 }, { id: "mob-2", type: "zombie", x: 64.5, y: 1, z: 64.5, health: 20 }]);
  const [pig, zombie] = w.entities;
  mountEntity(zombie, pig, (m) => w.size(m)[1]);
  zombie.fallDistance = 5;
  const night = { health: 20, creative: false, time: 18000, damage() {}, scaledDamage() {}, count: () => 0 };
  const p = { x: 0.5, y: 1, z: 0.5, onGround: true, health: 20, creative: false };
  w.tick(p, night);
  assert.equal(zombie.fallDistance, 0);
});

test("chicken jockey search: chunk x, chunk z, slice, then insertion order, from the child's anchored box (executed)", () => {
  const size = (o) => (o.type === "chicken" ? [0.3, 0.7] : [0.3, 0.9]);
  let picked = 0;
  for (const r of records("jockey")) {
    const [zx, zy, zz] = r.zombie;
    const zombie = { type: "zombie", x: zx, y: zy, z: zz };
    zombie.spawnBox = anchoredShrunkBox(zombie, 0.6, 1.8, 0.3, 0.9); // the child's box setSize left
    const list = r.chickens.map(([x, y, z], i) => ({ type: "chicken", x, y, z, health: 4, riddenBy: r.ridden.includes(i) ? {} : null }));
    const hit = freeChickenNear(zombie, list, size);
    assert.equal(hit ? list.indexOf(hit) : -1, r.mounted, r.name);
    assert.equal(r.jockey, r.mounted, r.name);
    if (hit) picked++;
  }
  assert.ok(picked >= 8);
});

test("a chicken beyond the child's box is left alone even where a centred box would reach it", () => {
  const size = () => [0.3, 0.9];
  const zombie = { type: "zombie", x: 1, y: 80, z: 1 };
  zombie.spawnBox = anchoredShrunkBox(zombie, 0.6, 1.8, 0.3, 0.9);
  assert.equal(freeChickenNear(zombie, [{ type: "chicken", x: 6.25, y: 79, z: 2, health: 4 }], (o) => (o.type === "chicken" ? [0.3, 0.7] : size())), null);
});

test("vehicle falls: the landing goes to the player rider, with the fall sound hook, and to a mob passenger's turn", () => {
  const boats = new Boats(), carts = new Minecarts();
  const world = { get: () => 0, getMeta: () => 0, solid: () => false };
  const boat = boats.spawnBoat({ x: 0.5, y: 0.5, z: 0.5 }, { seed: 7 });
  const falls = [], mob = { type: "zombie" };
  boat.rider = { fall: (d) => falls.push(d) };
  Object.defineProperty(boat, "passenger", { value: mob, writable: true, configurable: true });
  Object.defineProperty(mob, "ridingEntity", { value: boat, writable: true, configurable: true });
  boat.fallDistance = 5;
  boats.updateFallState(world, boat, -1, true);
  assert.deepEqual(falls, [5]);
  assert.deepEqual(takeVehicleFalls(mob), [5]);
  assert.deepEqual(takeVehicleFalls(mob), []);
  // The cart passes any landing above 0 (Entity.updateFallState), a mob passenger that no longer rides it gets nothing.
  const cart = { rider: { fall: (d) => falls.push(d) }, passenger: mob };
  passFall(cart, 1.5);
  assert.deepEqual(falls, [5, 1.5]);
  assert.deepEqual(takeVehicleFalls(mob), []);
  assert.ok(carts);
  // The rider's fall plays the sounds through state.fallSound (EntityLivingBase.fall) when no hook is passed.
  const played = [];
  const hits = [];
  const state = { rider: createPlayerRider(), position: { x: 0, y: 5, z: 0 }, yaw: 0, world: { get: () => 1 }, survival: { health: 20, creative: false, damage: (n) => hits.push(n) }, fallSound: (s) => played.push(s.name) };
  syncRider(state);
  state.rider.fall(5);
  assert.ok(played.length >= 1 && played[0].startsWith("game.player.hurt.fall"), played.join());
  assert.deepEqual(hits, [2]);
});

test("the player's step block needs ridingEntity == null (executed ride cases; main.js gate)", () => {
  let riding = 0;
  for (const r of records("ride")) {
    if (!r.riding) continue;
    riding++;
    assert.equal(r.step, null, `${r.upper}/${r.lower}/${r.kind}`);
    assert.equal(r.p, 0, "distanceWalkedModified");
    assert.equal(r.q, r.kind === "dist" ? 0 : 5, "distanceWalkedOnStepModified");
  }
  assert.equal(riding, 28);
  // The same moves without a mount reach the step block or the walked distance.
  assert.ok(records("ride").some((r) => !r.riding && r.kind === "step" && r.step));
  assert.ok(records("ride").some((r) => !r.riding && r.kind === "dist" && r.q > 0));
  assert.match(main, /const stepRiding = !!rider\.vehicle \|\| mpRiding;/);
  assert.match(main, /if \(!sneakOnGround && !stepRiding\) stepDistance \+= distance;/);
  assert.match(main, /if \(!stepRiding && stepDistance > 1\.667/);
});
