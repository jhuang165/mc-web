// Batch 51: the boat the client player rides runs EntityBoat.onUpdate's full physics on the client (S1B calls setIsBoatEmpty(false), bytecode-read in bjb and xi.h), so its copy
// splashes from its own Entity.rand; the port mirrors the live boat's state into the copy. A cart copy keeps interpolating (xl.h's remote branch tests no rider).
import test from "node:test";
import assert from "node:assert/strict";
import { ObjectTracker } from "./object-tracker.js";
import { JavaRandom } from "./java-random.js";

const f = Math.fround;
const boatLive = (o = {}) => ({ id: 1, x: 5.5, posY: 0.3, z: 5.5, y: 0.3, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, timeSinceHit: 0, forwardDir: 1, damage: 0, dead: false, bb: [4.75, 0, 4.75, 6.25, 0.6, 6.25], ...o });
const setup = (live, riding) => {
  const t = new ObjectTracker(10, () => 0.5), player = { x: 0, y: 0, z: 0 };
  t.view.player = player; t.ctx.world = null;
  t.serverTick({ boat: [live] }, player); t.clientTick();
  const log = []; t.hooks.particle = (...a) => log.push(a); t.hooks.rides = (l) => riding.value && l === live;
  return { t, c: [...t.entries.values()][0].client, log };
};

test("a ridden boat's copy runs its own physics (batch 56): it does not take the live state, and splashes from its own motion and random", () => {
  const world = { get: () => 0, getMeta: () => 0, meta: () => 0, solid: () => false, set() { return true; } };
  const live = boatLive(), riding = { value: true }, { t, c, log } = setup(live, riding);
  live.rider = { yaw: 0, moveForward: 0, moveStrafing: 0 };
  c.world = world; c.firstUpdate = false;
  Object.assign(live, { x: 90.25, posY: 11.5, z: -30.5, vx: 0.3 });
  Object.assign(c, { x: 9.25, y: 1.5, z: -3.5, vx: 0.3, vy: 0, vz: 0.1, yaw: 213.5 });
  c.sim.rand = new JavaRandom(99);
  c.stepVehicle();
  assert.ok(Math.abs(c.x - 9.25) < 1, `the copy moved on its own motion (x ${c.x}), not to the live ${live.x}`);
  assert.ok(log.length > 0 && log.every((p) => p[0] === "splash"), "above 0.2625 blocks a tick it splashes");
});

test("a slow ridden boat does not splash; a position packet within one block changes nothing, a far one only resets the motion", () => {
  const world = { get: () => 0, getMeta: () => 0, meta: () => 0, solid: () => false, set() { return true; } };
  const live = boatLive(), riding = { value: true }, { c, log } = setup(live, riding);
  live.rider = { yaw: 0, moveForward: 0, moveStrafing: 0 };
  c.world = world; c.firstUpdate = false;
  c.setVelocity(0.1, 0, 0);
  c.vx = 0.2; const x = c.x;
  c.place(x + 0.5, c.y, c.z, 0, 0);
  assert.equal(c.vx, 0.2, "near: ignored");
  c.place(x + 3, c.y, c.z, 0, 0);
  assert.equal(c.vx, 0.1, "far: the S12 motion again");
  assert.equal(c.vt.inc, 3);
  c.stepVehicle();
  assert.equal(log.length, 0);
  assert.ok(c.x > x && c.x < x + 1, "it never interpolates to the packet: it coasts on its own physics");
});

test("an unridden boat copy still interpolates and coasts as before", () => {
  const live = boatLive(), riding = { value: false }, { c } = setup(live, riding);
  live.x = 50; c.vt = null; c.vx = 0.1; const x = c.x;
  c.stepVehicle();
  assert.ok(Math.abs(c.x - (x + 0.1)) < 1e-12);
});

test("a cart copy is never mirrored", () => {
  const t = new ObjectTracker(10, () => 0.5), player = { x: 0, y: 0, z: 0 };
  t.view.player = player; t.ctx.world = null;
  const cart = { id: 9, x: 5, posY: 64, z: 5, y: 64, px: 5, py: 64, pz: 5, vx: 0.5, vy: 0, vz: 0, yaw: 0, pitch: 0, rolling: 0, rollingDir: 1, damage: 0, type: 0, dead: false, bb: [4.5, 64, 4.5, 5.5, 64.7, 5.5] };
  t.serverTick({ minecart: [cart] }, player); t.clientTick();
  t.hooks.rides = () => true;
  const c = [...t.entries.values()][0].client; cart.x = 40;
  c.stepVehicle(); assert.equal(c.x, 5);
});
