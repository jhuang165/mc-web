// Batch 50: leash knots are aimed through their client copy's box and answer use / attack like EntityLeashKnot (a collidable EntityHanging, bytecode-read in su and ss), and the
// boat copy spawns EntityBoat.onUpdate's "splash" particles above 0.2625 blocks a tick (bytecode-read in xi.h; compared against the live boats.js formula on the same random stream).
import test from "node:test";
import assert from "node:assert/strict";
import { EntityWorld } from "./entities.js";
import { Survival } from "./survival.js";
import * as G from "./horse-gear.js";
import { FENCE } from "./world.js";
import { ObjectTracker, aimKnotBox } from "./object-tracker.js";
import { JavaRandom } from "./java-random.js";

const fences = new Set();
const key = (x, y, z) => `${x},${y},${z}`;
const terrain = { numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : fences.has(key(x, y, z)) ? FENCE : 0), surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) };
const world = (recs) => {
  fences.clear();
  const w = new EntityWorld(terrain, recs.map((r, i) => ({ id: `mob-${i + 1}`, type: "pig", x: 64, y: 0, z: 64, health: 10, ...r })), () => 0.5);
  Object.assign(w.ai.player, { x: 64, y: 0, z: 64 });
  for (const e of w.entities) e.onGround = true;
  return w;
};
const holding = (id, n = 2) => { const s = new Survival({ inventory: { [id]: n } }); s.inventory.current = s.inventory.find(id); return s; };
const south = { x: 0, y: 0, z: 1 };

test("a placed knot is aimed: its stand-in names the knot, the ray starts at the 0.5 cube grown by 0.1", () => {
  const w = world([{ x: 90 }]);
  fences.add(key(66, 0, 64));
  const k = w.knotCreate(66, 0, 64);
  const hit = w.pick({ x: 66.5, y: 0.75, z: 60 }, south, 6);
  assert.equal(hit.entity.knotRef, k);
  assert.ok(Math.abs(hit.distance - (64.25 - 0.1 - 60)) < 1e-6, `distance ${hit.distance}`);
  assert.equal(w.pick({ x: 66.5, y: 0.3, z: 60 }, south, 6)?.entity?.knotRef, undefined, "below the box (y 0.5 to 1, border 0.1)");
  assert.equal(w.pick({ x: 66.5, y: 0.75, z: 60 }, south, 3), null, "out of reach");
  assert.equal(w.pick({ x: 66.5, y: 0.75, z: 60 }, south, 6).entity, hit.entity, "a stable stand-in");
  assert.equal(w.knotEntity(hit.entity.id).knotRef, k);
});

test("the box comes from the host's copy when it has one; a copy not shown is not aimable", () => {
  const w = world([{ x: 90 }]);
  const k = w.knotCreate(66, 0, 64);
  w.knotBoxOf = () => [70.25, 0.5, 64.25, 70.75, 1, 64.75];
  assert.equal(w.pick({ x: 66.5, y: 0.75, z: 60 }, south, 6), null, "the live tile is not the copy's");
  assert.equal(w.pick({ x: 70.5, y: 0.75, z: 60 }, south, 6).entity.knotRef, k);
  w.knotBoxOf = () => null;
  assert.equal(w.pick({ x: 70.5, y: 0.75, z: 60 }, south, 6), null);
});

test("aimKnotBox: the tracker's copy box, the live fallback before it follows, null while followed without a copy", () => {
  const t = new ObjectTracker(10, () => 0.5), player = { x: 0, y: 0, z: 0 };
  t.view.player = player;
  const live = (k) => [k.x + 0.25, k.y + 0.5, k.z + 0.25, k.x + 0.75, k.y + 1, k.z + 0.75];
  const k = { x: 4, y: 2, z: 6, age: 0, dead: false };
  assert.deepEqual(aimKnotBox(t, k, live), live(k), "not tracked yet");
  t.serverTick({ leashKnot: [k] }, player); t.clientTick();
  assert.deepEqual(aimKnotBox(t, k, live), [4.25, 2.5, 6.25, 4.75, 3, 6.75]);
  const far = { x: 900, y: 2, z: 6, age: 0, dead: false };
  t.serverTick({ leashKnot: [k, far] }, player); t.clientTick();
  assert.equal(aimKnotBox(t, far, live), null);
});

test("right click on a knot (EntityLeashKnot.interactFirst): a lead ties the player's mobs, any other click kills it and Creative frees its mobs", () => {
  const w = world([{ x: 66, leash: { holder: "player" } }, { x: 66, leash: { holder: "player" } }]);
  fences.add(key(66, 0, 64));
  const k = w.knotCreate(66, 0, 64), stand = w.pick({ x: 66.5, y: 0.75, z: 60 }, south, 6).entity;
  assert.equal(w.leashInteract(stand, holding(G.LEAD_ITEM)), true);
  assert.ok(w.entities.every((m) => m.leash.knot), "tied to the knot");
  assert.equal(w.leashKnots().length, 1);
  assert.equal(w.leashInteract(stand, { held: null, creative: true, inventory: holding(G.LEAD_ITEM).inventory }), true);
  assert.ok(w.entities.every((m) => !m.leash), "Creative frees them");
  assert.equal(k.dead, true); assert.equal(w.leashKnots().length, 0);
  assert.equal(w.pick({ x: 66.5, y: 0.75, z: 60 }, south, 6), null, "a dead knot is not aimed");
});

test("a knot clicked with nothing to attach dies", () => {
  const w = world([{ x: 90 }]);
  w.knotCreate(66, 0, 64);
  const stand = w.pick({ x: 66.5, y: 0.75, z: 60 }, south, 6).entity;
  assert.equal(w.leashInteract(stand, { held: null, creative: false, inventory: holding(G.LEAD_ITEM).inventory }), true);
  assert.equal(w.leashKnots().length, 0);
});

test("left click on a placed or summoned knot breaks it (EntityHanging.attackEntityFrom), with no damage events", () => {
  const w = world([{ x: 90 }]);
  w.knotCreate(66, 0, 64); const s = w.knotSummon(70.5, 1, 64.5);
  const a = w.pick({ x: 66.5, y: 0.75, z: 60 }, south, 6).entity, b = w.pick({ x: 70.5, y: 1.25, z: 60 }, south, 6).entity;
  assert.equal(b.knotRef, s);
  assert.equal(w.attack(a), false); assert.equal(w.attack(b), false);
  assert.equal(w.leashKnots().length, 0);
});

// ---- the boat copy's splash ----
const boatLive = (o = {}) => ({ id: 1, x: 5.5, posY: 0.3, z: 5.5, y: 0.3, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, timeSinceHit: 0, forwardDir: 1, damage: 0, dead: false, bb: [4.75, 0, 4.75, 6.25, 0.6, 6.25], ...o });
const copyOf = (yaw = 0) => {
  const t = new ObjectTracker(10, () => 0.5), player = { x: 0, y: 0, z: 0 };
  t.view.player = player; t.ctx.world = null;
  t.serverTick({ boat: [boatLive({ yaw })] }, player); t.clientTick();
  const log = []; t.hooks.particle = (...a) => log.push(a);
  return { t, c: t.vehicleTargets === undefined ? null : [...t.entries.values()][0].client, log };
};
const f = Math.fround;

test("a boat copy at or below 0.2625 spawns nothing and draws nothing", () => {
  const { c, log } = copyOf();
  c.sim.rand = new JavaRandom(7); c.vx = 0.26249999999999996; c.vz = 0;
  c.stepVehicle();
  assert.equal(log.length, 0);
  assert.equal(c.sim.rand.nextInt(1000), new JavaRandom(7).nextInt(1000));
});

test("a fast boat copy spawns 1 + d3 * 60 splashes with the executed formula's positions and the copy's own motion", () => {
  for (const [vx, vz, yaw] of [[0.3, 0, 0], [0.2, 0.2, 90], [-0.25, 0.3, 213.5], [0, 0.5, 45]]) {
    const { c, log } = copyOf(yaw);
    c.vx = vx; c.vy = 0.01; c.vz = vz; c.yaw = yaw;
    const seed = 12345 + Math.floor(yaw), r = new JavaRandom(seed); c.sim.rand = new JavaRandom(seed);
    const x = c.x, y = c.y, z = c.z, d3 = Math.sqrt(vx * vx + vz * vz);
    c.stepVehicle(); // the copy's own interpolation then moves it; the particles come from before
    const n = Math.ceil(1 + d3 * 60);
    assert.equal(log.length, n, `count ${vx},${vz}`);
    const rad = yaw * Math.PI / 180, cs = Math.cos(rad), sn = Math.sin(rad);
    for (const p of log) {
      const d4 = f(f(r.nextFloat() * 2) - 1), d5 = (r.nextInt(2) * 2 - 1) * 0.7;
      const want = r.nextBoolean() ? [x - cs * d4 * 0.8 + sn * d5, y - 0.125, z - sn * d4 * 0.8 - cs * d5] : [x + cs + sn * d4 * 0.7, y - 0.125, z + sn - cs * d4 * 0.7];
      assert.equal(p[0], "splash");
      assert.deepEqual(p.slice(1, 4), want);
      assert.deepEqual(p.slice(4), [vx, 0.01, vz]);
    }
    assert.equal(c.sim.rand.nextInt(1000), r.nextInt(1000), "the same number of draws");
  }
});

test("the copy uses the speed of the tick it starts with: the S12 motion, then 0.99F drag while it coasts", () => {
  const { c, log } = copyOf();
  c.vt = null; c.vx = 0.27; c.vz = 0; c.vy = 0;
  c.stepVehicle(); const first = log.length;
  assert.ok(first >= 17, `first tick ${first}`);
  c.stepVehicle(); // 0.27 * 0.99 = 0.2673, still above
  assert.ok(log.length > first);
  for (let i = 0; i < 20; i++) c.stepVehicle();
  const n = log.length; c.stepVehicle(); assert.equal(log.length, n, "below 0.2625 after the drag");
});

test("a cart copy never splashes", () => {
  const t = new ObjectTracker(10, () => 0.5), player = { x: 0, y: 0, z: 0 };
  t.view.player = player; t.ctx.world = null;
  const cart = { id: 9, x: 5, posY: 64, z: 5, y: 64, px: 5, py: 64, pz: 5, vx: 0.5, vy: 0, vz: 0, yaw: 0, pitch: 0, rolling: 0, rollingDir: 1, damage: 0, type: 0, dead: false, bb: [4.5, 64, 4.5, 5.5, 64.7, 5.5] };
  t.serverTick({ minecart: [cart] }, player); t.clientTick();
  const log = []; t.hooks.particle = (...a) => log.push(a);
  const c = [...t.entries.values()][0].client; c.vx = 0.5;
  c.stepVehicle(); assert.equal(log.length, 0);
});

test("an aimed knot's C02 check uses Entity.getEyeHeight 0, not a mob brain (a knot stand-in has none)", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("./main.js", import.meta.url), "utf8");
  const line = src.split("\n").find((l) => l.includes("const aimed = aimedEntity ?"));
  assert.ok(line && /knotRef \? 0 : mobs\.ai\.brain\(aimedEntity\.entity\)\.eyeHeight/.test(line), line);
  const w = new EntityWorld({ numericSeed: 1, solid: (x, y) => y < 0, get: (x, y) => (y < 0 ? 1 : 0), surface: () => 0, spawn: () => ({ x: 0, y: 0, z: 0 }) }, []);
  const k = w.knotSummon(0.5, 1, 0.5), hit = w.pick({ x: 0.5, y: 1.6, z: 3 }, { x: 0, y: -0.1, z: -1 }, 4.5);
  assert.ok(hit?.entity?.knotRef === k);
  assert.throws(() => w.ai.brain(hit.entity)); // what serverAcceptsClick called before the batch 50 lead fix
});
