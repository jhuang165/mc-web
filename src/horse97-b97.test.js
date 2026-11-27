// b97 horse97: a player rider killed in a boat or minecart (public/research/kill97-reference.json from tools/probes/Kill97Probe.java, real mw.a(ro) onDeath, xi boat, xs cart)
// stays linked through the 20 death ticks and is unlinked the tick after, where it sat; the single-player order (death-ride.js) matches the same record.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { WATER } from "./world.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";
import { makeSide } from "../tools/sweep-use75.mjs";

const ref = JSON.parse(readFileSync(new URL("../public/research/kill97-reference.json", import.meta.url), "utf8"));
const kc = (mount, variant) => ref.cases.find((c) => c.mount === mount && c.variant === variant);
const ticks = (c) => c.rows.filter((r) => r.t != null);

for (const mount of ["boat", "cart"]) {
  test(`${mount} reference: linked through deathTime 20, unlinked the tick after, the player does not move at the release`, () => {
    const rows = ticks(kc(mount, 0)), i = rows.findIndex((r) => r.deathTime === 20);
    assert.ok(rows[i].riding && rows[i].ridden && rows[i].playerDead, "still linked when deathTime reaches 20");
    assert.ok(!rows[i + 1].riding && !rows[i + 1].ridden, "unlinked the next tick");
    assert.deepEqual(rows[i + 1].player, rows[i].player, "no teleport");
    assert.ok(rows.slice(0, i + 1).every((r) => r.riding), "linked through the whole animation");
  });
  test(`${mount} reference: a killed mount unlinks the rider at once`, () => {
    const rows = ticks(kc(mount, 2));
    assert.ok(rows.filter((r) => r.t >= 3).every((r) => !r.riding && !r.ridden));
  });
}

const OFF = { x: 0, y: 0, z: 0 };
const rideSide = (boat, pool = false) => {
  const side = makeSide(), { s, p } = side;
  if (pool) for (let x = 40; x <= 90; x++) for (let z = 40; z <= 90; z++) for (let y = 9; y <= 10; y++) s.world.put(x, y, z, WATER, 0, false);
  const v = s.vehicles.spawnVehicle(boat ? "boat" : "minecart", p.position.x, p.position.y, p.position.z, { yaw: 0 });
  s.vehicles.queue("a", { v: `${boat ? "b" : "c"}${v.id}`, hit: false });
  s.tick();
  assert.ok(p.mount, "mounted");
  p.survival.protection = 0; // the join's spawn protection
  return { side, s, p, v, system: boat ? s.vehicles.boats : s.vehicles.carts };
};
for (const boat of [true, false]) {
  const name = boat ? "boat" : "minecart";
  test(`dedicated server: a killed ${name} rider stays seated through the 20 death ticks, is unlinked the tick after, and does not move`, () => {
    const { s, p, v } = rideSide(boat);
    s.damagePlayer(p, 50, { name: "/kill" });
    const seat = [], linked = [];
    for (let i = 0; i < 40; i++) {
      s.tick();
      const dt = p.deathTime ?? 0;
      if (dt <= 20) assert.ok(p.mount && v.rider, `linked at deathTime ${dt} (tick ${i})`);
      seat.push([p.position.x, p.position.y, p.position.z]); linked.push(!!p.mount);
    }
    assert.equal(p.mount, null, "released after the animation");
    assert.equal(v.rider ?? null, null, "the vehicle side is free");
    const at = linked.indexOf(false);
    assert.deepEqual(seat[at], seat[at - 1], "no teleport at the release (the position of the last linked tick is kept)");
  });
  test(`dedicated server: the respawn unlinks a dead ${name} rider and frees the vehicle`, () => {
    const { s, p, v } = rideSide(boat);
    s.damagePlayer(p, 50, { name: "/kill" });
    for (let i = 0; i < 5; i++) s.tick();
    assert.ok(p.mount, "still seated mid animation");
    s.serverSurvival.settle(p); s.serverSurvival.respawn(p);
    assert.equal(p.mount, null);
    assert.equal(v.rider ?? null, null);
  });
}
test("dedicated server: a boat still takes the dying rider's last input on the kill tick and none after it (Kill97Probe variant 3)", () => {
  const { s, p, v } = rideSide(true, true);
  const input = (f) => ({ type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null), ride: { s: 0, f, j: false, k: false } });
  const vz = [];
  for (let i = 0; i < 3; i++) { s.input("a", input(1)); s.tick(); vz.push(v.vz); }
  s.input("a", input(1));
  s.damagePlayer(p, 50, { name: "/kill" });
  s.tick(); vz.push(v.vz);
  s.tick(); vz.push(v.vz);
  s.tick(); vz.push(v.vz);
  const dv = (i) => Math.abs(vz[i]) - Math.abs(vz[i - 1]) * 0.99; // a drag-only tick has dv <= 0
  assert.ok(dv(3) > 1e-4, `the kill tick still accelerates: ${vz}`);
  assert.ok(dv(4) < 1e-9 && dv(5) < 1e-9, `no acceleration after the kill tick: ${vz}`);
});

// ---- single player: death-ride.js (the importable half of main.js die() / the dead-screen tick / respawnPlayer) ----
import { Boats } from "./boats.js";
import { Minecarts } from "./minecarts.js";
import { createPlayerRider, syncRider } from "./vehicle-simulation.js";
import { startDeathRide, tickDeathRide, releaseDeathRide } from "./death-ride.js";

const spState = (kind) => {
  const world = { get: () => 0, getMeta: () => 0, solid: () => false, inside: false };
  const boats = new Boats(), minecarts = new Minecarts();
  const state = { rider: createPlayerRider(), position: { x: 5.5, y: 11, z: 5.5 }, previous: {}, velocity: { x: 0.3, y: -0.2, z: 0.1 }, motion: { sneaking: false }, yaw: 0, world, boats, minecarts,
    survival: { health: 0, creative: false }, grounded: true, fallDistance: 0, landedFall: 0 };
  syncRider(state);
  const v = kind === "boat" ? boats.spawnBoat({ x: 5.5, y: 10.2, z: 5.5, yaw: 0 }, { seed: 7 }) : minecarts.spawnCart(0, { x: 5.5, y: 10.2, z: 5.5 });
  return { state, v, system: kind === "boat" ? boats : minecarts };
};
for (const kind of ["boat", "cart"]) test(`single player (${kind}): the dying rider stays linked until the tick after deathTime 20, then is released where it sat`, () => {
  const { state, v, system } = spState(kind);
  assert.ok(system.mount(v, state.rider));
  const seat = { x: state.position.x, y: state.position.y, z: state.position.z };
  assert.equal(startDeathRide(state), true);
  assert.equal(state.rider.dead, true, "marked dead so a save keeps no Riding link");
  // the dead-screen loop: tickDeathRide before the tick's ++deathTime
  let deathTime = 0, releasedAt = -1;
  for (let tick = 0; tick < 40; tick++) {
    if (tickDeathRide(state, deathTime)) { releasedAt = tick; break; }
    assert.ok(state.rider.vehicle, `linked at deathTime ${deathTime}`);
    deathTime++;
  }
  assert.equal(deathTime, 20, "released at the start of the tick after the one that reached 20");
  assert.equal(releasedAt, 20);
  assert.equal(state.rider.vehicle, null);
  assert.equal(v.rider, null, "the vehicle is free");
  assert.deepEqual({ x: state.position.x, y: state.position.y, z: state.position.z }, seat, "no spot search, no teleport");
  assert.equal(tickDeathRide(state, 25), false, "nothing more to release");
});
test("single player: the respawn releases a rider still seated, and a rider on nothing is untouched", () => {
  const { state, v, system } = spState("boat");
  assert.equal(releaseDeathRide(state), false);
  assert.equal(startDeathRide(state), false);
  system.mount(v, state.rider);
  assert.equal(releaseDeathRide(state), true);
  assert.equal(state.rider.vehicle, null);
});
test("main.js (code-read contract): die() no longer detaches at once; the dead tick and the respawn use death-ride.js and a seated body is not thrown", () => {
  const main = readFileSync(new URL("./main.js", import.meta.url), "utf8");
  const die = main.slice(main.indexOf("function die()"), main.indexOf("// GuiGameOver (modal-dialogs.js)"));
  assert.ok(die.includes("startDeathRide(vehicleState())"));
  assert.ok(!die.includes("detachPlayerVehicle"), "no immediate detach in die()");
  assert.ok(main.includes("tickDeathRide(v, deathTime)") && main.includes("releaseDeathRide(v)"));
  assert.ok(main.includes("movementTick(IDLE_INPUT); // b101 spcopy101")); // b101: the dead tick is the full movementTick (idle input); a seated body goes through moveRidingPlayer, which keeps it at its seat
});

// ---- the water dismount's spot (mw.a((sa) null), Executed: Kill97Probe -Ddismount97, dismount97-reference.json) ----
import { dismountSpot } from "./minecarts.js";
const dm = JSON.parse(readFileSync(new URL("../public/research/dismount97-reference.json", import.meta.url), "utf8"));
const HEIGHT = { horse: 1.6, pig: 0.9, boat: 0.6, cart: 0.7 };
const spotWorld = (ceiling) => {
  const solid = (x, y, z) => y <= 63 || (ceiling && y === 66 && x >= 3 && x <= 8 && z >= 3 && z <= 8);
  const get = (x, y, z) => (solid(x, y, z) ? 1 : 0);
  const clear = (b) => { for (let x = Math.floor(b[0]); x < Math.ceil(b[3]); x++) for (let y = Math.floor(b[1]); y < Math.ceil(b[4]); y++) for (let z = Math.floor(b[2]); z < Math.ceil(b[5]); z++) if (solid(x, y, z)) return false; return true; };
  return { world: { get, getMeta: () => 0, solid: (x, y, z) => solid(x, y, z) }, clear };
};
for (const c of dm.cases.filter((r) => r.ground === "open" || r.ground === "ceiling")) {
  test(`dismount spot, ${c.mount} on ${c.ground} ground: the port's dismountSpot matches the executed mountEntity(null)`, () => {
    const { world, clear } = spotWorld(c.ground === "ceiling");
    const rider = { x: c.before[0], y: c.before[1], z: c.before[2], width: 0.6, height: 1.8 };
    const spot = dismountSpot(world, rider, { x: c.mountPos[0], minY: c.mountPos[1], height: HEIGHT[c.mount], z: c.mountPos[2] }, clear);
    for (const [i, k] of ["x", "y", "z"].entries()) assert.ok(Math.abs(spot[k] - c.after[i]) < 1e-5, `${k}: ${spot[k]} vs ${c.after[i]}`);
  });
}
test("dismount reference: the native sequence is S08, S1B(mode 0, player, -1), S08 (two setPlayerLocation calls); the server carries it as state, not packets (open)", () => {
  for (const c of dm.cases) {
    assert.equal(c.spots.length, 2, `${c.mount}/${c.ground}`);
    assert.deepEqual(c.spots[0], c.spots[1]);
    assert.deepEqual(c.packets.map((p) => [p.a, p.c]), [[0, -1]]);
    assert.equal(c.riding, false); assert.equal(c.ridden, false);
  }
});
