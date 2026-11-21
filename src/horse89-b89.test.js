// b89 horse89: the sneak (dismount) tick of a ridden horse in the native order, the first ridden tick's air speed, and the client's seat when the mount dies under it.
//   horse89-reference.json (executed, tools/verify-horse89.mjs): a real EntityPlayerMP on the unchanged wi; per tick wi.w(int) for the C0B, the real C0C handler mw.a(FFZZ), wi.h(),
//   then the real yz.ab() (EntityPlayer.updateRidden) for a sneaking linked rider, as World.updateEntityWithOptionalForce (ahb.a(sa, Z), bytecode-read) orders them.
//   Boats and carts: the same World / EntityPlayer order (bytecode-read), with dismountEntity's fallback (sv.m: posX, boundingBox.minY + height, posZ) on the moved vehicle.
//   The dead-mount seat is bytecode-read: yz.a(sa) runs dismountEntity only when !worldObj.isRemote; World.updateEntities drops a dead mount's link with no move.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EntityWorld } from "./entities.js";
import { Survival } from "./survival.js";
import { Minecarts, CART_HEIGHT } from "./minecarts.js";
import { Boats, BOAT_HEIGHT } from "./boats.js";
import { tickMinecartSimulation, tickMinecartOne, finishMinecartSimulation, tickBoatSimulation, tickBoatOne, finishBoatSimulation } from "./structure-simulation.js";
import { createPlayerRider, moveRidingPlayer, finishVehicleTick } from "./vehicle-simulation.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/horse89-reference.json", import.meta.url), "utf8"));
const flat = (cells) => (x, y, z) => y < 0 || cells.some(([x0, y0, z0, x1, y1, z1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1 && z >= z0 && z <= z1);
const stoneWorld = (cells = []) => { const solid = flat(cells); return { numericSeed: 1, solid, get: (x, y, z) => (solid(x, y, z) ? 1 : 0), getMeta: () => 0, surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) }; };
const horseWorld = (row) => {
  const w = new EntityWorld(stoneWorld(row?.cells ?? []), [{ id: "mob-1", type: "horse", x: 64, y: row?.startY ?? 0, z: 64, health: 53,
    horse: { type: 0, tame: true, saddled: true, owner: "player", speed: row?.speed ?? 0.25, jump: row?.jumpAttr ?? 0.7, maxHealth: 53 } }], () => 0.5);
  return { w, e: w.entities[0] };
};
const tick = (w) => w.tick({ x: 64, y: 0, z: 90 }, new Survival({}));
const clientState = (w, rider) => ({ rider, horses: w.horseSeats, world: w.world, position: { x: rider.x, y: rider.y, z: rider.z }, previous: {}, velocity: { x: 0, y: 0, z: 0 },
  motion: {}, yaw: 0, survival: { health: 20, held: null }, screen: "playing" });
const close = (a, b, where) => assert.ok(Math.abs(a - b) <= 1e-6, `${where}: ${a} vs ${b}`);

test("the sneak tick: the horse makes its ridden move (sneak input, a C0B jump sent that tick) before the rider gets off at the spot from its old seat", () => {
  assert.equal(ref.ticks.length, 10);
  let rows = 0;
  for (const s of ref.ticks) {
    const { w, e } = horseWorld(s);
    Object.assign(e, { vx: 0, vy: 0, vz: 0, onGround: s.startY === 0, aiMoveSpeed: 0, rotationYaw: 0 });
    const rider = createPlayerRider();
    assert.ok(w.horseSeats.mount(e, rider));
    const state = clientState(w, rider);
    const sent = [];
    const horseJump = w.horseJump;
    w.horseJump = (m, p) => { sent.push([rows, p]); return horseJump.call(w, m, p); };
    s.ticks.forEach((t, i) => {
      const where = `${s.seed} ${s.name} tick ${i}`;
      const riding = !!rider.vehicle;
      if (riding) close(rider.y, t.seatBefore[1], `${where} seat y`), close(rider.z, t.seatBefore[2], `${where} seat z`);
      moveRidingPlayer(state, { forward: s.forward, strafe: 0, jump: i >= s.held[0] && i < s.held[1], sneak: i === s.sneakTick });
      if (i === s.sneakTick) {
        assert.ok(rider.vehicle, `${where}: still riding through the client part of the sneak tick`);
        close(rider.moveForward, s.forward ? s.sneakForward : 0, `${where} C0C forward`);
      }
      tick(w);
      finishVehicleTick(state);
      for (const [k, v] of Object.entries({ x: e.x, y: e.y, z: e.z, vx: e.vx, vy: e.vy, vz: e.vz, jumpPower: e.jumpPower ?? 0, stepHeight: e.stepHeight ?? 0.5, jumpFactor: e.jumpFactor ?? 0.02 }))
        close(v, t[k], `${where} ${k}`);
      assert.equal(!!e.jumpingHorse, t.jumping, `${where} jumping`);
      assert.equal(!!e.rider, t.rider, `${where} rider`);
      assert.equal(!!rider.vehicle, t.rider, `${where} client link`);
      if (!t.rider) { // the client is where setPlayerLocation's S08 put it, then walks on its own (only the dismount tick is compared)
        if (t.updateRidden) { close(state.position.x, t.player[0], `${where} spot x`); close(state.position.y, t.player[1], `${where} spot y`); close(state.position.z, t.player[2], `${where} spot z`); }
      } else { close(state.position.y, t.player[1], `${where} seat`); close(state.position.z, t.player[2], `${where} seat z`); }
      rows++;
    });
    assert.deepEqual(sent.map((x) => x[1]), s.c0b.map((x) => x[1]), `${s.seed} ${s.name} C0B`);
  }
  assert.ok(rows > 100);
});

test("a fresh horse's first ridden tick in the air has jumpMovementFactor 0, also for a record without aiMoveSpeed (bp is not saved)", () => {
  const s = ref.ticks.find((x) => x.name === "freshAir");
  assert.equal(s.ticks[0].jumpFactor, 0);
  assert.equal(s.ticks[0].vz, 0);
  const { w, e } = horseWorld(s);
  Object.assign(e, { vx: 0, vy: 0, vz: 0, onGround: false, rotationYaw: 0 });
  delete e.aiMoveSpeed; // before: the speed attribute stood in for the missing bp, giving aQ 0.0256 and a push on tick 0
  const rider = createPlayerRider();
  w.horseSeats.mount(e, rider);
  const state = clientState(w, rider);
  for (const [i, t] of s.ticks.slice(0, 3).entries()) {
    moveRidingPlayer(state, { forward: 1, strafe: 0, jump: false, sneak: false });
    tick(w);
    finishVehicleTick(state);
    for (const k of ["y", "vy", "vz", "jumpFactor"]) close(e[k], t[k], `freshAir tick ${i} ${k}`);
  }
});

test("a horse removed or dead under the rider leaves the client at its seat (no dismountSpot): it falls from there", () => {
  for (const kill of ["removed", "corpse"]) {
    const { w, e } = horseWorld({ cells: [] });
    Object.assign(e, { onGround: true, aiMoveSpeed: 0 });
    const rider = createPlayerRider();
    w.horseSeats.mount(e, rider);
    const state = clientState(w, rider);
    moveRidingPlayer(state, { forward: 0, strafe: 0 });
    const seat = { ...state.position };
    if (kill === "removed") w.entities = [];
    else Object.assign(e, { health: 0, death: 20 });
    finishVehicleTick(state);
    assert.equal(rider.vehicle, null, kill);
    assert.deepEqual(state.position, seat, `${kill}: the seat, not the spot one block out and up`);
    assert.equal(e.rider, null);
  }
});

test("a dead cart under the rider: moveRidingPlayer and finishVehicleTick keep the seat too", () => {
  const world = { get: (x, y, z) => (y < 0 ? 1 : 0), getMeta: () => 0, solid: (x, y, z) => y < 0 };
  const make = () => {
    const minecarts = new Minecarts();
    const cart = minecarts.spawnEmpty({ x: 0.5, y: 0.5, z: 0.5 });
    const rider = createPlayerRider();
    const state = { world, minecarts, rider, position: { x: 0.5, y: 1, z: 0.5 }, previous: {}, velocity: { x: 0, y: 0, z: 0 }, motion: {}, yaw: 0,
      survival: { health: 20, held: null }, screen: "playing" };
    minecarts.mount(cart, rider);
    Object.assign(state.position, { x: rider.x, y: rider.y, z: rider.z });
    return { minecarts, cart, rider, state };
  };
  const a = make(), seat = { ...a.state.position };
  a.cart.dead = true;
  moveRidingPlayer(a.state, { forward: 0, strafe: 0 });
  assert.equal(a.rider.vehicle, null);
  assert.deepEqual(a.state.position, seat);
  assert.equal(a.cart.rider, null);
  const b = make(), seat2 = { ...b.state.position };
  b.cart.dead = true;
  finishVehicleTick(b.state);
  assert.deepEqual(b.state.position, seat2);
});

test("a cart or boat makes its move on the sneak tick too: the rider gets off after it, on the moved vehicle's top when no spot is clear (sv.m's fallback)", () => {
  const air = { get: () => 0, getMeta: () => 0, solid: () => false }; // nothing solid: dismountEntity finds no spot and uses (posX, boundingBox.minY + height, posZ)
  for (const kind of ["cart", "cart-walked", "boat", "boat-walked"]) {
    const boat = kind.startsWith("boat"), walked = kind.endsWith("walked");
    const system = boat ? new Boats() : new Minecarts();
    const v = boat ? system.spawnBoat({ x: 0.5, y: 10.5, z: 0.5 }, { seed: 1 }) : system.spawnEmpty({ x: 0.5, y: 10.5, z: 0.5 }, { seed: 1 });
    const rider = createPlayerRider();
    const state = { world: air, [boat ? "boats" : "minecarts"]: system, rider, position: { x: 0.5, y: 10, z: 0.5 }, previous: {}, velocity: { x: 0, y: 0, z: 0 }, motion: {}, yaw: 0,
      survival: { health: 20, held: null }, screen: "playing" };
    assert.ok(system.mount(v, rider), kind);
    Object.assign(state.position, { x: rider.x, y: rider.y, z: rider.z });
    Object.assign(v, { vx: 0.3, vz: 0.1 });
    const before = { x: v.x, z: v.z };
    moveRidingPlayer(state, { forward: 0, strafe: 0, sneak: true });
    assert.ok(rider.vehicle === v && rider.sneakDismount, `${kind}: still seated through the client part of the sneak tick`);
    const sim = { world: air, minecarts: boat ? null : system, boats: boat ? system : null, mobs: null, position: state.position, velocity: state.velocity, rider, width: 0.6, height: 1.8, alive: true };
    if (walked) { (boat ? tickBoatOne : tickMinecartOne)(sim, {}, v); (boat ? finishBoatSimulation : finishMinecartSimulation)(sim, {}); }
    else (boat ? tickBoatSimulation : tickMinecartSimulation)(sim, {});
    assert.equal(v.rider, null, kind);
    finishVehicleTick(state);
    assert.equal(rider.vehicle, null, kind);
    assert.ok(Math.abs(v.x - before.x) > 0.05 && Math.abs(v.z - before.z) > 0.01, `${kind}: the vehicle moved this tick`);
    close(state.position.x, v.x, `${kind} x`); close(state.position.z, v.z, `${kind} z`);
    close(state.position.y, v.bb[1] + (boat ? BOAT_HEIGHT : CART_HEIGHT), `${kind} y`);
  }
});

test("a mount the mob tick never reached: the next client tick lets the sneaking rider off at once", () => {
  const { w, e } = horseWorld({ cells: [] });
  Object.assign(e, { onGround: true, aiMoveSpeed: 0 });
  const rider = createPlayerRider();
  w.horseSeats.mount(e, rider);
  const state = clientState(w, rider);
  moveRidingPlayer(state, { forward: 0, strafe: 0, sneak: true });
  assert.ok(rider.vehicle && rider.sneakDismount);
  moveRidingPlayer(state, { forward: 0, strafe: 0, sneak: false }); // no w.tick in between
  assert.equal(rider.vehicle, null);
  assert.equal(e.rider, null);
});
