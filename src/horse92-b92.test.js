// b92 horse92: three riding gaps left open by batch 91, each replayed against an executed record.
//  1. A released rider's push of its vehicle (public/research/vehicle92-reference.json, Executed: tools/probes/Vehicle92Probe.java, a real EntityPlayerMP with the unchanged xi / xs,
//     yz.ab, mw.h and mw.i). Natively the push is the network tick's C03 (mw.i -> onLivingUpdate -> collideWithNearbyEntities) AFTER the world tick, whatever the player's place in the
//     entity list (the record is identical with the player first and last; a linked rider is skipped by the world loop and mw.h has no super call). The port always pushes after the
//     vehicles, which is that order: the sneak tick's push is replayed here instead of being dropped (src/horse91-b91.test.js drops it because its record had no player update).
//  2. The mounting tick's C0C: C02 then C0C reaches the boat that tick; C0C then C02 is dropped (mw.a(FFZZ) does nothing while ridingEntity is null).
//  3. A mob rider on a saddled horse (public/research/horse92-reference.json, Executed: tools/probes/Horse92Probe.java, the unchanged wi / yq / yl): wi.e(FF) sets prevRotationYaw, so
//     sa.ab never turns the rider (it does not write the rider's yaw or pitch at all); wi.ac shifts the rider by 0.7 * bM / 0.15 * bM and copies the body yaw while bM > 0; yl.ab copies an
//     EntityCreature mount's body yaw into a skeleton.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { solidBlock, WATER, RAIL, World } from "./world.js";
import { Minecarts } from "./minecarts.js";
import { Boats } from "./boats.js";
import { tickMinecartSimulation, tickBoatSimulation } from "./structure-simulation.js";
import { createPlayerRider, moveRidingPlayer, finishVehicleTick } from "./vehicle-simulation.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";
import { EntityWorld } from "./entities.js";
import { Survival } from "./survival.js";

const load = (name) => JSON.parse(readFileSync(new URL(`../public/research/${name}`, import.meta.url), "utf8"));
const vref = load("vehicle92-reference.json"), href = load("horse92-reference.json");
const internal = { 1: 3, 9: WATER, 66: RAIL };
const num = (v) => (v === "-0" ? -0 : v);
const near = (a, e, at, tol = 1e-6) => assert.ok(Math.abs(a - num(e)) <= tol * Math.max(1, Math.abs(num(e))), `${at}: ${a} vs ${e}`);
function probeWorld(cells) {
  const map = new Map(cells.map(([x, y, z, id, meta = 0]) => [`${x},${y},${z}`, [internal[id], meta]]));
  const cell = (x, y, z) => map.get(`${x},${y},${z}`) ?? [y < 0 ? 3 : 0, 0];
  return { get: (x, y, z) => cell(x, y, z)[0], getMeta: (x, y, z) => cell(x, y, z)[1], solid: (x, y, z) => solidBlock(...cell(x, y, z)), set: (x, y, z, id) => { map.set(`${x},${y},${z}`, [id, 0]); return true; } };
}

// ---- 1. the list order of the released rider's push ----
test("Executed record: the player's place in the entity list changes nothing (the push is the network tick's)", () => {
  const key = (c) => `${c.kind} ${c.name} ${c.inputOrder}`;
  for (const a of vref.cases.filter((c) => c.playerFirst && c.inputOrder === 0)) {
    const b = vref.cases.find((c) => !c.playerFirst && c.inputOrder === 0 && key(c) === key(a));
    assert.ok(b, key(a));
    assert.deepEqual(a.ticks, b.ticks, `${key(a)}: the same rows with the player before and after the vehicle`);
  }
});

for (const c of vref.cases.filter((r) => r.playerFirst && r.inputOrder === 0 && r.sneakTick >= 0)) {
  test(`${c.kind} ${c.name}: the released rider pushes the vehicle after the vehicles update (single-player order)`, () => {
    const boat = c.kind === "boat", world = probeWorld(c.cells);
    const system = boat ? new Boats() : new Minecarts();
    const [x, y, z, vx, vy, vz] = c.spawn;
    const v = boat ? system.spawnBoat({ x, y, z, yaw: c.mountYaw, vx, vy, vz }, { seed: 7 }) : Object.assign(system.spawnEmpty({ x, y, z }, { seed: 1 }), { vx, vy, vz, yaw: c.mountYaw });
    const rider = createPlayerRider();
    const state = { world, [boat ? "boats" : "minecarts"]: system, rider, position: { x, y, z }, previous: {}, velocity: { x: 0, y: 0, z: 0 }, motion: {},
      yaw: (180 - c.riderYaw) * Math.PI / 180, survival: { health: 20, held: null }, screen: "playing" };
    assert.ok(system.mount(v, rider));
    Object.assign(state.position, { x: rider.x, y: rider.y, z: rider.z });
    const sim = { world, minecarts: boat ? null : system, boats: boat ? system : null, mobs: null, position: state.position, velocity: state.velocity, rider, width: 0.6, height: 1.8, alive: true };
    c.ticks.slice(0, c.sneakTick + 1).forEach((r, i) => {
      const at = `${c.name} tick ${i}`;
      moveRidingPlayer(state, { forward: c.forward, strafe: 0, sneak: i === c.sneakTick });
      (boat ? tickBoatSimulation : tickMinecartSimulation)(sim, {});
      finishVehicleTick(state);
      near(v.x, r.x, `${at} x`); near(v.z, r.z, `${at} z`); near(v.vx, r.vx, `${at} vx`); near(v.vz, r.vz, `${at} vz`);
    });
  });
}

const OFF = { x: 64, y: 10, z: 64 };
const serverWorld = (cells) => {
  const world = new World("mp-horse92");
  const map = new Map(cells.map(([x, y, z, id, meta = 0]) => [`${x + OFF.x},${y + OFF.y},${z + OFF.z}`, [internal[id], meta]]));
  for (let x = 20; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 2; y <= 40; y++) {
    const hit = map.get(`${x},${y},${z}`);
    if (hit) world.put(x, y, z, hit[0], hit[1], false); else world.put(x, y, z, y <= 8 ? 3 : 0, 0, false);
  }
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  return world;
};
const uuid = `00000000-0000-0000-0000-${"1".padStart(12, "0")}`;
const message = (c, ride) => ({ type: "input", controls: { ...IDLE_INPUT }, yaw: (180 - c.riderYaw) * Math.PI / 180, pitch: 0, current: 0, hotbar: Array(9).fill(null), ...(ride ? { ride } : {}) });
function dedicated(c) {
  const boat = c.kind === "boat", [x, y, z, vx, vy, vz] = c.spawn;
  const s = new DedicatedSimulation({}, { world: serverWorld(c.cells), gameMode: "survival", mobs: true });
  s.mobs.spawning = false; s.mobs.mobs.entities.length = 0;
  const p = s.addPlayer("a", "ax", uuid);
  p.position.copy({ x: x + OFF.x, y: y + OFF.y, z: z + OFF.z }); p.previous.copy(p.position);
  s.input("a", message(c));
  const v = s.vehicles.spawnVehicle(boat ? "boat" : "minecart", x + OFF.x, y + OFF.y, z + OFF.z, { yaw: c.mountYaw });
  Object.assign(v, { vx, vy, vz });
  return { s, p, v, key: `${boat ? "b" : "c"}${v.id}` };
}
for (const c of vref.cases.filter((r) => r.playerFirst && r.inputOrder === 0 && r.sneakTick >= 0)) {
  test(`${c.kind} ${c.name}: the released rider pushes the vehicle after the vehicles update (dedicated server)`, () => {
    const { s, p, v, key } = dedicated(c);
    s.vehicles.queue("a", { v: key, hit: false });
    c.ticks.slice(0, c.sneakTick + 1).forEach((r, i) => {
      const at = `${c.name} tick ${i}`;
      s.input("a", message(c, { s: 0, f: i === c.sneakTick ? (c.kind === "boat" ? c.sneakForward * c.forward : 0) : 0.98 * c.forward, j: false, k: i === c.sneakTick }));
      s.tick();
      if (i === 0) assert.ok(p.mount, "mounted by tick 0");
      near(v.x, r.x + OFF.x, `${at} x`); near(v.z, r.z + OFF.z, `${at} z`); near(v.vx, r.vx, `${at} vx`); near(v.vz, r.vz, `${at} vz`);
    });
  });
}

// ---- 2. the mounting tick's C0C ----
for (const c of vref.cases.filter((r) => r.inputOrder > 0)) {
  test(`${c.kind} ${c.name}: ${c.inputOrder === 1 ? "C02 then C0C steers the boat or cart in the mounting tick" : "C0C then C02 is dropped, the mounting tick has no key"} (dedicated server)`, () => {
    const { s, p, v, key } = dedicated(c);
    const ride = { s: 0, f: 0.98 * c.forward, j: false, k: false };
    if (c.inputOrder === 1) { s.vehicles.queue("a", { v: key, hit: false }); s.input("a", message(c, ride)); }
    else { s.input("a", message(c, ride)); s.vehicles.queue("a", { v: key, hit: false }); }
    c.ticks.forEach((r, i) => {
      const at = `${c.name} tick ${i}`;
      if (i > 0) s.input("a", message(c, ride));
      s.tick();
      if (i === 0) assert.ok(p.mount, "mounted by tick 0");
      near(v.x, r.x + OFF.x, `${at} x`); near(v.z, r.z + OFF.z, `${at} z`); near(v.vx, r.vx, `${at} vx`); near(v.vz, r.vz, `${at} vz`);
    });
  });
}

// ---- 3. a mob rider on a saddled horse ----
const flat = () => { const solid = (x, y, z) => y < 0; return { numericSeed: 1, solid, get: (x, y, z) => (solid(x, y, z) ? 1 : 0), getMeta: () => 0, surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) }; };
for (const sc of href.mobRider) {
  test(`mob rider ${sc.name}: seat, yaw and body yaw follow the executed wi / yq / yl`, () => {
    const w = new EntityWorld(flat(), [
      { id: "mob-1", type: "horse", x: 64, y: 0, z: 64, health: 53, horse: { type: 0, tame: true, saddled: sc.saddled, owner: "player", speed: sc.speed, jump: sc.jumpAttr, maxHealth: 53 } },
      { id: "mob-2", type: sc.rider, x: 64, y: 1.2, z: 64, health: 20, riding: "mob-1" }], () => 0.5);
    const horse = w.entities[0], rider = w.entities[1];
    Object.assign(horse, { vx: 0, vy: 0, vz: 0, onGround: true, aiMoveSpeed: 0, rotationYaw: 0 });
    // The probe stubs the rider's own AI / living update (h()), so only the rider's input is replayed; an unsaddled horse's own AI is off too (random wandering has no record).
    const think = w.ai.think; w.ai.think = (e) => { if (e === rider || !sc.saddled) return; return think.call(w.ai, e); };
    Object.assign(rider, { rotationYaw: sc.riderYaw, rotationPitch: sc.riderPitch, renderYawOffset: sc.riderYaw + 30 });
    const skeleton = sc.rider === "skeleton";
    sc.ticks.forEach((t, i) => {
      if (i === sc.rearTick) w.horseRear(horse);
      Object.assign(rider, { moveForward: sc.forward, moveStrafing: sc.strafe });
      w.tick({ x: 64, y: 0, z: 90 }, new Survival({}));
      const at = `${sc.name} tick ${i}`;
      assert.equal(!!rider.ridingEntity, t.linked, `${at} linked`);
      near(horse.x, t.horse[0], `${at} horse x`, 1e-5); near(horse.z, t.horse[2], `${at} horse z`, 1e-5);
      near(horse.rotationYaw, t.horseYaw, `${at} horse yaw`);
      near(rider.x, t.rider[0], `${at} rider x`, 1e-5); near(rider.y, t.rider[1], `${at} rider y`, 1e-5); near(rider.z, t.rider[2], `${at} rider z`, 1e-5);
      near(rider.rotationYaw, t.riderYaw, `${at} rider yaw`); near(rider.rotationPitch, t.riderPitch, `${at} rider pitch`);
      // the rider's own body turn is its stubbed h(); the record is comparable where the mount writes it: bM > 0 (wi.ac) or a skeleton (yl.ab)
      if (skeleton || t.prevRearAmount > 0) near(rider.renderYawOffset, t.riderBody, `${at} rider body yaw`);
    });
  });
}
