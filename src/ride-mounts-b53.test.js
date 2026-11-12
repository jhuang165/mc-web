// Batch 53: a boat copy runs Entity.handleWaterMovement (sa.N, bytecode-read; xi.h begins with super.h()): entering water draws the sound pitch, then 1 + width * 20 bubbles
// and as many splashes from the copy's own Entity.rand; the sound is logged (a client plays none). A ridden pig's copy is packet-driven (the seat is main.js seatOnCartCopy).
import test from "node:test";
import assert from "node:assert/strict";
import { ObjectTracker } from "./object-tracker.js";
import { JavaRandom } from "./java-random.js";
import { WATER } from "./world.js";

const f = Math.fround;
const boatLive = (o = {}) => ({ id: 1, x: 5.5, posY: 0.3, z: 5.5, y: 0.3, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, timeSinceHit: 0, forwardDir: 1, damage: 0, dead: false, bb: [4.75, 0, 4.75, 6.25, 0.6, 6.25], ...o });
const wet = { get: (x, y, z) => (y === 0 ? WATER : 0), meta: () => 0, getMeta: () => 0 };
const setup = (live, world) => {
  const t = new ObjectTracker(10, () => 0.5), player = { x: 0, y: 0, z: 0 };
  t.view.player = player; t.ctx.world = world;
  t.serverTick({ boat: [live] }, player); t.clientTick();
  const log = []; t.hooks.particle = (...a) => log.push(a); t.hooks.sound = (...a) => log.push(["sound", ...a]);
  const c = [...t.entries.values()][0].client; c.world = world;
  return { t, c, log };
};

test("a boat copy entering water plays the splash sound and spawns bubbles and splashes from its own random", () => {
  const live = boatLive(), { c, log } = setup(live, wet);
  c.firstUpdate = false; c.inWater = false; c.vx = 0.3; c.vy = -0.05; c.vz = 0.1;
  const seed = 7; c.sim.rand = new JavaRandom(seed); const r = new JavaRandom(seed);
  c.waterMovement();
  const { vx, vy, vz } = c; // the flow push is added before the sound and the particles read the motion
  const vol = Math.min(1, f(f(Math.sqrt(vx * vx * 0.20000000298023224 + vy * vy + vz * vz * 0.20000000298023224)) * f(0.2)));
  const pitch = f(1 + f(f(r.nextFloat() - r.nextFloat()) * f(0.4)));
  assert.deepEqual(log[0].slice(0, 2), ["sound", "game.neutral.swim.splash"]);
  assert.equal(log[0][5], vol); assert.equal(log[0][6], pitch);
  const n = f(1 + f(f(1.5) * 20)), w = f(1.5), y = f(Math.floor(c.y - 0.3) + 1);
  assert.equal(log.length, 1 + 2 * n);
  for (let i = 0; i < n; i++) {
    const a = f(f(f(r.nextFloat() * 2) - 1) * w), b = f(f(f(r.nextFloat() * 2) - 1) * w);
    assert.deepEqual(log[1 + i], ["bubble", c.x + a, y, c.z + b, vx, vy - f(r.nextFloat() * f(0.2)), vz]);
  }
  for (let i = 0; i < n; i++) {
    const a = f(f(f(r.nextFloat() * 2) - 1) * w), b = f(f(f(r.nextFloat() * 2) - 1) * w);
    assert.deepEqual(log[1 + n + i], ["splash", c.x + a, y, c.z + b, vx, vy, vz]);
  }
  assert.equal(c.inWater, true);
  const before = log.length;
  c.waterMovement();
  assert.equal(log.length, before, "already in water: no splash");
});

test("the first update never splashes, and a dry box clears the flag", () => {
  const live = boatLive(), { c, log } = setup(live, wet);
  c.firstUpdate = true; c.inWater = false;
  c.waterMovement();
  assert.equal(log.length, 0);
  assert.equal(c.inWater, true);
  c.world = { get: () => 0 };
  c.waterMovement();
  assert.equal(c.inWater, false);
});
