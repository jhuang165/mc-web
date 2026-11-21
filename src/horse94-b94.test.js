// b94 horse94: three horse-rider gaps from batch 93 / the lead.
//  1. Flaky replays: the horse's Random is seeded from Math.random, so the b88 / b92 replays (which compare against probes that give the horse no AI tasks and never record an idle talk, a
//     rear, a heal or an eat) failed ~25% of runs. The replays now stub the AI and the Random; below, the wander / talk draws are shown to be native behaviour the probe never had.
//  2. A player rider's own input (public/research/horse94-reference.json playerRider, Executed: tools/probes/Horse94Probe.java, a real EntityPlayerMP taking the C0C through mw.a(FFZZ)): every
//     C05 runs mw.i -> sv.e, which decays the old input by 0.98 before the C0C overwrites it; the unchanged wi.e(FF) reads the raw fields.
//  3. Dismounts other than the sneak path (reference dismounts, Executed: the unchanged ahb.h() World.updateEntities with a zombie rider): mount setDead, rider setDead, mount killed (the corpse
//     carries the rider until deathTime 20), rider killed (a dying rider stays seated). Nobody is moved: the world loop clears the links and no dismountEntity spot search runs.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EntityWorld } from "./entities.js";
import { Survival } from "./survival.js";
import { decayRideInput, applyRide, takeRideOrQueue } from "./multiplayer/server-vehicles.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/horse94-reference.json", import.meta.url), "utf8"));
const near = (a, e, at, tol = 1e-5) => assert.ok(Math.abs(a - e) <= tol * Math.max(1, Math.abs(e)), `${at}: ${a} vs ${e}`);
const flat = () => { const solid = (x, y, z) => y < 0; return { numericSeed: 1, solid, get: (x, y, z) => (solid(x, y, z) ? 1 : 0), getMeta: () => 0, surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) }; };
const tick = (w) => w.tick({ x: 64, y: 0, z: 90 }, new Survival({}));
const f = Math.fround;

// ---- 2. the player rider's input ----
test("the reference holds 6 executed player-rider scenarios", () => {
  assert.equal(ref.playerRider.length, 6);
  assert.deepEqual(ref.playerRider.map((c) => c.name), ["steady", "strafeBack", "gap", "gapQuiet", "outOfRange", "sneakRide"]);
});

for (const sc of ref.playerRider) {
  test(`player rider ${sc.name}: C05 decay, then C0C, then the horse reads the raw fields (executed mw.i / mw.a / wi.e)`, () => {
    const w = new EntityWorld(flat(), [{ id: "mob-1", type: "horse", x: 64, y: 0, z: 64, health: 53, horse: { type: 0, tame: true, saddled: true, owner: "player", speed: sc.speed, jump: sc.jumpAttr, maxHealth: 53 } }], () => 0.5);
    const horse = w.entities[0];
    Object.assign(horse, { vx: 0, vy: 0, vz: 0, onGround: true, aiMoveSpeed: 0, rotationYaw: 0 });
    const rider = { player: true, x: 0, y: 0, z: 0, yaw: sc.riderYaw, pitch: 0, moveForward: 0, moveStrafing: 0, fallDistance: 0, vehicle: null };
    assert.ok(w.horseSeats.mount(horse, rider));
    // the dedicated server's input(): decay as the message arrives, then the C0C (a message with none, or a non-finite / out-of-range component, leaves the decayed value)
    sc.ticks.forEach((t, i) => {
      const host = { actions: [] }, p = { mount: { rider } };
      if (t.c05) takeRideOrQueue(host, p, "a", t.c0c && { s: t.c0c[0] === "NaN" ? NaN : t.c0c[0], f: t.c0c[1] === "NaN" ? NaN : t.c0c[1], j: t.c0c[2], k: t.c0c[3] });
      else if (t.c0c) { p.ride = null; applyRide(rider, { s: t.c0c[0], f: t.c0c[1] }); }
      if (p.ride) applyRide(rider, p.ride); // ServerVehicles.riderInput
      const at = `${sc.name} tick ${i}`;
      near(rider.moveForward, t.readForward, `${at} forward the horse reads`, 1e-6);
      near(rider.moveStrafing, t.readStrafe, `${at} strafe the horse reads`, 1e-6);
      tick(w);
      near(horse.x, t.horse[0], `${at} horse x`); near(horse.z, t.horse[2], `${at} horse z`);
      near(horse.rotationYaw, t.horseYaw, `${at} horse yaw`);
    });
  });
}

test("decayRideInput is the in-place 0.98F decay of sv.e (0.98F -> 0.96040004F)", () => {
  const r = { moveForward: f(0.98), moveStrafing: f(-0.98) };
  decayRideInput(r);
  assert.equal(r.moveForward, f(0.96040004)); assert.equal(r.moveStrafing, f(-0.96040004));
  decayRideInput(null); // not riding: nothing to decay
});

// ---- 3. dismounts other than the sneak path ----
const pair = () => {
  const w = new EntityWorld(flat(), [
    { id: "mob-1", type: "horse", x: 64, y: 0, z: 64, health: 53, horse: { type: 0, tame: true, saddled: true, owner: "player", speed: 0.25, jump: 0.7, maxHealth: 53 } },
    { id: "mob-2", type: "zombie", x: 64, y: 1.2, z: 64, health: 20, riding: "mob-1" }], () => 0.5);
  w.ai.think = () => {}; // the probe's entities have no AI of their own; this also keeps wander/idle rolls out of the comparison
  return { w, horse: w.entities[0], rider: w.entities[1] };
};
const ACTION = { mountSetDead: (w, h) => w.ai.despawn(h), riderSetDead: (w, h, r) => w.ai.despawn(r), mountKilled: (w, h) => w.kill(h), riderKilled: (w, h, r) => w.kill(r) };
for (const sc of ref.dismounts) {
  test(`dismount ${sc.name}: links, list and rider position follow the executed World.updateEntities`, () => {
    const { w, horse, rider } = pair();
    sc.ticks.forEach((t, i) => {
      if (i === 3) ACTION[sc.name](w, horse, rider);
      tick(w);
      const at = `${sc.name} tick ${i}`;
      // a rider killed here keeps its stubbed update natively (deathTime never advances); the port's zombie dies on its own clock, so compare until its deathTime 20
      if (sc.name === "riderKilled" && i > 21) return;
      assert.equal(!!rider.ridingEntity, t.riding, `${at} rider linked`);
      assert.equal(w.entities.length, t.loaded, `${at} entities in the list`);
      near(rider.x, t.rider[0], `${at} rider x`); near(rider.z, t.rider[2], `${at} rider z`); // not moved to a dismount spot
      if (t.riding) near(rider.y, t.rider[1], `${at} rider y`); // once free the port's rider falls on its own (the probe's rider has no update of its own)
      if (sc.name === "mountKilled") assert.equal(horse.death ?? 0, t.mountDeathTime, `${at} mount deathTime`);
    });
  });
}
