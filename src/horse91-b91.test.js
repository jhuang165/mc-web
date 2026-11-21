// b91 horse91: the sneak (dismount) tick of a player on a boat or a cart, replayed against public/research/vehicle91-reference.json
// (Executed: tools/probes/Vehicle91Probe.java, a real EntityPlayerMP with the unchanged xi / xs and yz.ab, tools/verify-vehicle91.mjs).
// Native: the sneak tick still runs the mount's onUpdate with the rider's input (the 0.3 sneak slowdown), then yz.ab lets the rider off at the dismount spot searched from the
// rider's seat of the PREVIOUS tick (the moved mount's updateRiderPosition has not run yet); the next tick the mount carries no rider.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { solidBlock, WATER, RAIL } from "./world.js";
import { Minecarts } from "./minecarts.js";
import { Boats } from "./boats.js";
import { tickMinecartSimulation, tickBoatSimulation } from "./structure-simulation.js";
import { createPlayerRider, moveRidingPlayer, finishVehicleTick } from "./vehicle-simulation.js";
import { ServerVehicles } from "./multiplayer/server-vehicles.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/vehicle91-reference.json", import.meta.url), "utf8"));
const internal = { 1: 3, 9: WATER, 66: RAIL };
const num = (v) => (v === "-0" ? -0 : v);
function probeWorld(cells) {
  const map = new Map(cells.map(([x, y, z, id, meta = 0]) => [`${x},${y},${z}`, [internal[id], meta]]));
  const cell = (x, y, z) => map.get(`${x},${y},${z}`) ?? [y < 0 ? 3 : 0, 0];
  return { get: (x, y, z) => cell(x, y, z)[0], getMeta: (x, y, z) => cell(x, y, z)[1], solid: (x, y, z) => solidBlock(...cell(x, y, z)), set: (x, y, z, id) => { map.set(`${x},${y},${z}`, [id, 0]); return true; } };
}
const near = (a, e, at, tol = 1e-6) => assert.ok(Math.abs(a - num(e)) <= tol * Math.max(1, Math.abs(num(e))), `${at}: ${a} vs ${e}`);

for (const c of ref.cases) {
  test(`${c.kind} ${c.name}: sneak tick ${c.sneakTick} (single-player order)`, () => {
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
    c.ticks.forEach((r, i) => {
      const at = `${c.name} tick ${i}`;
      if (r.riding) moveRidingPlayer(state, { forward: c.forward, strafe: 0, sneak: i === c.sneakTick });
      else moveRidingPlayer(state, { forward: 0, strafe: 0, sneak: false });
      // The released rider's own collideWithNearbyEntities needs its onUpdate, which the probe does not run (and which a player listed before the mount skips this tick,
      // World.updateEntities: a linked rider is `continue`d). The port always pushes after the vehicles (a fixed player-after-vehicle order), so the sneak tick drops that push here.
      const push = system.pushEntity; if (i === c.sneakTick) system.pushEntity = () => [0, 0];
      (boat ? tickBoatSimulation : tickMinecartSimulation)(sim, {});
      system.pushEntity = push;
      finishVehicleTick(state);
      if (c.sneakTick < 0 || i <= c.sneakTick) { // after the release the probe has no player update (no pushes on the vehicle), so only the link is compared
      near(v.x, r.x, `${at} x`); near(v.posY ?? v.y, boat ? r.y : r.y, `${at} y`); near(v.z, r.z, `${at} z`);
      near(v.vx, r.vx, `${at} vx`); near(v.vy, r.vy, `${at} vy`); near(v.vz, r.vz, `${at} vz`);
      }
      assert.equal(!!v.rider, r.rider, `${at} rider linked`);
      assert.equal(!!rider.vehicle, r.rider, `${at} rider vehicle`);
      if (r.spots.length) { near(state.position.x, r.player[0], `${at} player x`); near(state.position.y, r.player[1], `${at} player y`); near(state.position.z, r.player[2], `${at} player z`); }
    });
  });
}

// Dedicated server: the same records through DedicatedSimulation. The mount tick is the reference's tick 0 (the player is aboard before the vehicles update), so only the
// scenarios that give no forward key are replayed (a key at tick 0 would arrive one tick late: the C0C of the mounting tick reaches a rider only after C02 mounted it).
import { World } from "./world.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";
const OFF = { x: 64, y: 10, z: 64 };
const serverWorld = (cells) => {
  const world = new World("mp-horse91");
  const map = new Map(cells.map(([x, y, z, id, meta = 0]) => [`${x + OFF.x},${y + OFF.y},${z + OFF.z}`, [internal[id], meta]]));
  for (let x = 20; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 2; y <= 40; y++) {
    const hit = map.get(`${x},${y},${z}`);
    if (hit) world.put(x, y, z, hit[0], hit[1], false); else world.put(x, y, z, y <= 8 ? 3 : 0, 0, false);
  }
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  return world;
};
const uuid = `00000000-0000-0000-0000-${"1".padStart(12, "0")}`;
for (const c of ref.cases.filter((r) => r.forward === 0 && r.sneakTick >= 0)) {
  test(`${c.kind} ${c.name}: sneak tick ${c.sneakTick} (dedicated server)`, () => {
    const boat = c.kind === "boat", [x, y, z, vx, vy, vz] = c.spawn;
    const s = new DedicatedSimulation({}, { world: serverWorld(c.cells), gameMode: "survival", mobs: true });
    s.mobs.spawning = false; s.mobs.mobs.entities.length = 0;
    const p = s.addPlayer("a", "ax", uuid);
    p.position.copy({ x: x + OFF.x, y: y + OFF.y, z: z + OFF.z }); p.previous.copy(p.position);
    const input = (sneak) => ({ type: "input", controls: { ...IDLE_INPUT }, yaw: (180 - c.riderYaw) * Math.PI / 180, pitch: 0, current: 0, hotbar: Array(9).fill(null), ride: { s: 0, f: 0, j: false, k: sneak } });
    s.input("a", { ...input(false), ride: undefined });
    const v = s.vehicles.spawnVehicle(boat ? "boat" : "minecart", x + OFF.x, y + OFF.y, z + OFF.z, { yaw: c.mountYaw });
    Object.assign(v, { vx, vy, vz });
    s.vehicles.queue("a", { v: `${boat ? "b" : "c"}${v.id}`, hit: false });
    const system = boat ? s.vehicles.boats : s.vehicles.carts;
    const push = system.pushEntity;
    c.ticks.forEach((r, i) => {
      const at = `${c.name} tick ${i}`;
      if (i > 0) s.input("a", input(i === c.sneakTick));
      if (i === c.sneakTick) system.pushEntity = () => [0, 0];
      s.tick();
      system.pushEntity = push;
      if (i === 0) assert.ok(p.mount, "mounted by tick 0");
      if (i <= c.sneakTick) { near(v.x, r.x + OFF.x, `${at} x`); near(v.z, r.z + OFF.z, `${at} z`); near(v.vx, r.vx, `${at} vx`); near(v.vz, r.vz, `${at} vz`); }
      assert.equal(!!p.mount, r.rider, `${at} rider linked`);
      if (r.spots.length) { near(p.position.x, r.player[0] + OFF.x, `${at} player x`); near(p.position.y, r.player[1] + OFF.y, `${at} player y`); near(p.position.z, r.player[2] + OFF.z, `${at} player z`); }
    });
  });
}

// ---- a mob on a saddled horse (command / NBT only; bytecode-read: wi.e(FF) and wi.bh() test `instanceof sv` and cu(), not EntityPlayer) ----
import { EntityWorld } from "./entities.js";
import { Survival } from "./survival.js";
const flatWorld = () => { const solid = (x, y, z) => y < 0; return { numericSeed: 1, solid, get: (x, y, z) => (solid(x, y, z) ? 1 : 0), getMeta: () => 0, surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) }; };
const pair = (saddled) => {
  const w = new EntityWorld(flatWorld(), [
    { id: "mob-1", type: "horse", x: 64, y: 0, z: 64, health: 53, horse: { type: 0, tame: true, saddled, owner: "player", speed: 0.25, jump: 0.7, maxHealth: 53 } },
    { id: "mob-2", type: "zombie", x: 64, y: 1.2, z: 64, health: 20, riding: "mob-1" }], () => 0.5);
  return { w, horse: w.entities[0], zombie: w.entities[1] };
};
const run = (w, n) => { for (let i = 0; i < n; i++) w.tick({ x: 64, y: 0, z: 90 }, new Survival({})); };

test("a zombie rider steers a saddled horse with its own input (the horse's AI is blocked)", () => {
  const { w, horse, zombie } = pair(true);
  assert.equal(zombie.ridingEntity, horse);
  run(w, 3);
  const ai = horse.aiSkipped ?? 0;
  assert.ok(ai >= 3, "wi.bh() is true for a saddled horse with any rider: no AI ticks");
  const x0 = horse.x, z0 = horse.z;
  Object.assign(zombie, { rotationYaw: 90, moveForward: 1 / 0.98, moveStrafing: 0 });
  zombie.holdInput = true;
  const think = w.ai.think; w.ai.think = (e) => { if (e === zombie) return; return think.call(w.ai, e); };
  run(w, 1);
  assert.ok(Math.abs(horse.rotationYaw - 90) < 1e-4, `the horse takes the rider's yaw (${horse.rotationYaw})`);
});

test("an unsaddled horse keeps its own AI under a mob rider", () => {
  const { w, horse } = pair(false);
  run(w, 5);
  assert.ok((horse.aiSkipped ?? 0) === 0);
});
