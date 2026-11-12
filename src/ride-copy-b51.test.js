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

test("a ridden boat's copy splashes from the live boat's motion with the copy's own random, and follows the live state", () => {
  const live = boatLive(), riding = { value: true }, { c, log } = setup(live, riding);
  Object.assign(live, { x: 9.25, posY: 1.5, z: -3.5, vx: 0.3, vy: 0.01, vz: 0.1, yaw: 213.5, pitch: 0 });
  c.stepVehicle(); // the copy has the live state from before: no splash yet, then it takes the new one
  assert.equal(log.length, 0);
  assert.deepEqual([c.x, c.y, c.z, c.vx, c.vy, c.vz, c.yaw], [9.25, 1.5, -3.5, 0.3, 0.01, 0.1, 213.5]);
  const seed = 99; c.sim.rand = new JavaRandom(seed); const r = new JavaRandom(seed);
  const d3 = Math.sqrt(0.3 * 0.3 + 0.1 * 0.1);
  c.stepVehicle();
  assert.equal(log.length, Math.ceil(1 + d3 * 60));
  const rad = 213.5 * Math.PI / 180, cs = Math.cos(rad), sn = Math.sin(rad);
  for (const p of log) {
    const d4 = f(f(r.nextFloat() * 2) - 1), d5 = (r.nextInt(2) * 2 - 1) * 0.7;
    const want = r.nextBoolean() ? [9.25 - cs * d4 * 0.8 + sn * d5, 1.5 - 0.125, -3.5 - sn * d4 * 0.8 - cs * d5] : [9.25 + cs + sn * d4 * 0.7, 1.5 - 0.125, -3.5 + sn - cs * d4 * 0.7];
    assert.deepEqual(p.slice(0, 4), ["splash", ...want]);
    assert.deepEqual(p.slice(4), [0.3, 0.01, 0.1]);
  }
  assert.equal(c.sim.rand.nextInt(1000), r.nextInt(1000));
});

test("a slow ridden boat does not splash, and the copy does not coast on its own", () => {
  const live = boatLive({ vx: 0.2 }), riding = { value: true }, { c, log } = setup(live, riding);
  c.stepVehicle(); c.stepVehicle();
  assert.equal(log.length, 0);
  assert.equal(c.x, 5.5, "no coast: the position is the live one");
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
