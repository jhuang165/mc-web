// b93 horse93: three horse-seat / rider-input gaps left open by batch 92.
//  1. Rider input of a mob (public/research/horse93-reference.json, Executed: tools/probes/Horse93Probe.java, a real EntityLivingBase whose own onLivingUpdate sv.e multiplies
//     moveForward / moveStrafing by 0.98 IN PLACE, then the unchanged wi.e(FF) reads those fields raw at its next update): the port decayed them a second time (0.9604).
//  2. The seat of a rearing horse reads bM, the PREVIOUS rear amount (wi.ac), also for the player: the seat is taken after the horse's own update has copied bL into bM.
//  3. The tracker's client copy of a mob rider on a rearing horse takes the same rear shift (mob-riding.js seatPosition on the copy's counters).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EntityWorld } from "./entities.js";
import { Survival } from "./survival.js";
import { seatPosition } from "./mob-riding.js";
import { copySeat, rearSeat, newHorseAnim } from "./horse-copy.js";
import { ClientEntity } from "./entity-tracker.js";

const load = (name) => JSON.parse(readFileSync(new URL(`../public/research/${name}`, import.meta.url), "utf8"));
const ref = load("horse93-reference.json"), href = load("horse92-reference.json");
const near = (a, e, at, tol = 1e-6) => assert.ok(Math.abs(a - e) <= tol * Math.max(1, Math.abs(e)), `${at}: ${a} vs ${e}`);
const flat = () => { const solid = (x, y, z) => y < 0; return { numericSeed: 1, solid, get: (x, y, z) => (solid(x, y, z) ? 1 : 0), getMeta: () => 0, surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) }; };

test("the reference holds 5 executed AI-rider scenarios, each reading the once-decayed fields", () => {
  assert.equal(ref.aiRider.length, 5);
  for (const c of ref.aiRider) for (const t of c.ticks.slice(1)) near(t.readForward, Math.fround(c.rawForward * 0.98), `${c.name} read`, 1e-6);
});

for (const sc of ref.aiRider) {
  test(`AI rider ${sc.name}: the horse is steered by moveForward / moveStrafing x 0.98 once (executed wi / sv.e)`, () => {
    const w = new EntityWorld(flat(), [
      { id: "mob-1", type: "horse", x: 64, y: 0, z: 64, health: 53, horse: { type: 0, tame: true, saddled: true, owner: "player", speed: sc.speed, jump: sc.jumpAttr, maxHealth: 53 } },
      { id: "mob-2", type: "zombie", x: 64, y: 1.2, z: 64, health: 20, riding: "mob-1" }], () => 0.5);
    const horse = w.entities[0], rider = w.entities[1];
    Object.assign(horse, { vx: 0, vy: 0, vz: 0, onGround: true, aiMoveSpeed: 0, rotationYaw: 0 });
    // the rider's AI sets the raw values as the probe's bq() does; its walk then decays them in place
    const think = w.ai.think;
    w.ai.think = (e) => { if (e === rider) { e.moveForward = sc.rawForward; e.moveStrafing = sc.rawStrafe; return; } return think.call(w.ai, e); };
    Object.assign(rider, { rotationYaw: sc.riderYaw, rotationPitch: 0 });
    sc.ticks.forEach((t, i) => {
      w.tick({ x: 64, y: 0, z: 90 }, new Survival({}));
      near(horse.x, t.horse[0], `${sc.name} tick ${i} horse x`, 1e-5); near(horse.z, t.horse[2], `${sc.name} tick ${i} horse z`, 1e-5);
    });
  });
}

test("a rearing horse seats a mob rider by the previous rear amount on the tracker's client copy (executed rows)", () => {
  let rows = 0;
  for (const sc of href.mobRider) {
    sc.ticks.forEach((t, i) => {
      if (!(t.prevRearAmount > 0)) return;
      rows++;
      const copy = new ClientEntity("horse");
      Object.assign(copy, { x: t.horse[0], y: t.horse[1], z: t.horse[2], renderYawOffset: t.horseBody });
      copy.horse = Object.assign(newHorseAnim(), { rearAmount: t.rearAmount, prevRearAmount: t.prevRearAmount });
      const seat = seatPosition(copy, { type: sc.rider }, sc.mountOffset / 0.75);
      near(seat.x, t.rider[0], `${sc.name} ${i} x`, 1e-5); near(seat.y, t.rider[1], `${sc.name} ${i} y`, 1e-5); near(seat.z, t.rider[2], `${sc.name} ${i} z`, 1e-5);
      near(seat.renderYaw, t.riderBody, `${sc.name} ${i} body`);
    });
  }
  assert.ok(rows > 20, `rows ${rows}`);
});

test("the player's seat (client copy) reads the previous rear amount, as wi.ac does for any rider", () => {
  const copy = { x: 10, y: 0, z: 10, renderYawOffset: 90, horse: Object.assign(newHorseAnim(), { rearAmount: 0.8, prevRearAmount: 0.4 }) };
  const live = { type: "horse", growingAge: 0 };
  const seat = copySeat(copy, live), flatSeat = copySeat({ ...copy, horse: newHorseAnim() }, live), r = rearSeat(0.4, 90);
  near(seat.x, 10 + r.dx, "x"); near(seat.y, flatSeat.y + r.dy, "y"); near(seat.z, 10 + r.dz, "z");
  // a horse that starts rearing this tick (bL > 0, bM still 0) does not move the rider yet
  const first = copySeat({ ...copy, horse: Object.assign(newHorseAnim(), { rearAmount: 0.45 }) }, live);
  near(first.y, flatSeat.y, "first tick y"); near(first.x, 10, "first tick x");
});

test("the live horse seats its player rider by the previous rear amount (single player and server)", () => {
  const w = new EntityWorld(flat(), [{ id: "mob-1", type: "horse", x: 64, y: 0, z: 64, health: 53, horse: { type: 0, tame: true, saddled: true, owner: "player", speed: 0.2, jump: 0.7, maxHealth: 53 } }], () => 0.5);
  const horse = w.entities[0], player = { x: 64, y: 0, z: 64, player: true };
  w.horseSeats.mount(horse, player);
  horse.renderYawOffset = 0;
  horse.horseAnim = Object.assign(newHorseAnim(), { rearAmount: 0.8, prevRearAmount: 0 });
  w.horseSeats.updateRiderPosition(player.vehicle);
  const flatY = player.y, flatZ = player.z;
  horse.horseAnim.prevRearAmount = 0.4;
  w.horseSeats.updateRiderPosition(player.vehicle);
  near(player.y, flatY + Math.fround(0.15 * Math.fround(0.4)), "y"); near(player.z, flatZ - Math.fround(Math.fround(0.7) * Math.fround(0.4)), "z");
});
