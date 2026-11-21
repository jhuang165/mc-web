// b88 horse88: the ridden EntityHorse tick for tick against the unchanged 1.7.10 classes.
//   horse88-reference.json (executed, tools/verify-horse88.mjs): whole server wi.h() ticks with a FakePlayer rider and wi.w(int) / cU() / mountEntity between ticks.
//   horse-reference.json `ride` rows (executed, HorseProbe): wi.e(FF) moves, replayed one tick at a time.
//   The rest is bytecode-read (blk.e 949-1102, wi.e(FF), wi.h()): the jump key counter off a horse and on the sneak tick, the jumpStrength attribute.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EntityWorld, setEntityRandom } from "./entities.js";
import { JavaRandom } from "./java-random.js";
import { Survival } from "./survival.js";
import { horseJumpCounter } from "./horse-live.js";
import { moveRidingPlayer } from "./vehicle-simulation.js";
import * as H from "./horse.js";

// A Random whose interval draws never hit (nextInt(n) is never 0 for n > 1), so idle sounds, rears, healing and eating never start.
class NoHit extends JavaRandom { constructor() { super(1); } nextInt(n) { return n > 1 ? n - 1 : 0; } }
const ref = (name) => JSON.parse(readFileSync(new URL(`../public/research/${name}`, import.meta.url), "utf8"));
const grass = { numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) };
const horseWorld = (x, y, z, { saddled = true, speed = 0.25, jump = 0.7 } = {}) => {
  const w = new EntityWorld(grass, [{ id: "mob-1", type: "horse", x, y, z, health: 53, horse: { type: 0, tame: true, saddled, owner: "player", speed, jump, maxHealth: 53 } }], () => 0.5);
  return { w, e: w.entities[0] };
};
const rider = (yaw = 0, forward = 0, strafe = 0) => ({ player: true, x: 0, y: 0, z: 0, yaw, pitch: 0, moveForward: forward, moveStrafing: strafe, fallDistance: 0, vehicle: null });
const tick = (w) => w.tick({ x: 64, y: 0, z: 90 }, new Survival({}));
// Sounds drawn from the horse's own Random (idle, the gallop's nextInt(10) breathe) are not compared: the port's stream is not the probe's.
const RANDOM_SOUNDS = /idle|breathe/;

test("whole ridden ticks match the executed wi.h() rows (jump, air release, rear, dismount in the air, unsaddled, yaw wrap)", () => {
  const r = ref("horse88-reference.json");
  assert.equal(r.ticks.length, 18);
  for (const s of r.ticks) {
    const { w, e } = horseWorld(64, 0, 64, { saddled: s.saddled, speed: s.speed, jump: s.jumpAttr });
    Object.assign(e, { vx: 0, vy: 0, vz: 0, onGround: true, aiMoveSpeed: 0, rotationYaw: 0 }); // a fresh wi: bp (aiMoveSpeed) 0, no motion
    // The probe gives the horse no AI tasks (Horse88Probe clears every uj field) and its Random is a seeded one whose draws were never recorded. Natively an unsaddled or
    // unridden horse (the unsaddled rows, and after the dismount) runs its wander task and wi.t()'s idle talk (nextInt(10) == 0 rears) off its own Random; the port's is seeded
    // from Math.random, so those draws moved the horse / started a rear in ~25% of runs. Stub the AI and the Random so no draw hits (the draws themselves are native).
    w.ai.think = () => {};
    setEntityRandom(e, new NoHit());
    const p = rider(s.riderYaw, s.forward, s.strafe);
    assert.ok(w.horseSeats.mount(e, p));
    s.ticks.forEach((t, i) => {
      for (const [at, act, arg] of s.script) if (at === i) {
        if (act === 0) w.horseJump(e, arg);
        else if (act === 1) w.horseRear(e);
        else if (act === 2) w.horseSeats.dismount(w.world, p);
        else w.horseSeats.mount(e, p);
      }
      w.events.length = 0;
      tick(w);
      const where = `${s.seed} ${s.name} tick ${i}`;
      for (const [k, v] of Object.entries({ y: e.y, vy: e.vy, vx: e.vx, vz: e.vz, yaw: e.rotationYaw, jumpPower: e.jumpPower ?? 0, rearCounter: e.rearTicks ?? 0,
        stepHeight: e.stepHeight ?? 0.5, jumpFactor: e.jumpFactor ?? 0.02, gallop: e.gallopSteps ?? 0 }))
        assert.ok(Math.abs(v - t[k]) <= 1e-6, `${where} ${k}: ${v} vs ${t[k]}`);
      for (const [k, v] of Object.entries({ onGround: !!e.onGround, held: !!e.jumpHeld, jumping: !!e.jumpingHorse, rearing: !!e.rearing, rider: !!e.rider }))
        assert.equal(v, t[k], `${where} ${k}`);
      const ours = w.events.filter((x) => x.sound && !RANDOM_SOUNDS.test(x.sound)).map((x) => x.sound);
      assert.deepEqual(ours, t.sounds.map((x) => x.split("|")[0]).filter((x) => !RANDOM_SOUNDS.test(x)), `${where} sounds`);
    });
  }
});

test("single wi.e(FF) moves from the executed ride rows: the rider's input is not decayed, strafe 0.5, backwards 0.25", () => {
  const r = ref("horse-reference.json");
  const input = { forward: [0, 0.98, 0], backward: [0, -0.98, 0], strafe: [0, 0, 0.98], diagonalYaw90: [90, 0.98, 0.98], idle: [0, 0, 0] };
  let rows = 0;
  for (const row of r.ride) {
    const sc = input[row.name];
    if (!sc) continue;
    for (let k = 0; k + 1 < row.ticks.length; k++) {
      const a = row.ticks[k].horse, b = row.ticks[k + 1].horse;
      if ([a.vx, a.vy, a.vz].some((v) => v !== 0 && Math.abs(v) < 0.005)) continue; // the probe calls e(FF) directly, so it never zeroes tiny motion as onUpdate does
      const { w, e } = horseWorld(a.x, a.y, a.z, { speed: row.speed, jump: row.jumpAttr });
      Object.assign(e, { vx: a.vx, vy: a.vy, vz: a.vz, onGround: a.onGround, aiMoveSpeed: row.speed, rotationYaw: sc[0] });
      w.horseSeats.mount(e, rider(sc[0], sc[1], sc[2]));
      tick(w);
      for (const k2 of ["x", "y", "z", "vx", "vy", "vz"]) assert.ok(Math.abs(e[k2] - b[k2]) <= 1e-6, `${row.seed} ${row.name} ${k} ${k2}: ${e[k2]} vs ${b[k2]}`);
      rows++;
    }
  }
  assert.ok(rows > 100);
});

test("the jump uses the horse.jumpStrength attribute with its modifiers, clamped to the RangedAttribute's 0..2", () => {
  for (const [mods, want] of [[[], 0.7], [[{ attribute: "horse.jumpStrength", amount: 0.5, operation: 0, uuid: "a" }], 1.2], [[{ attribute: "horse.jumpStrength", amount: 5, operation: 0, uuid: "a" }], 2]]) {
    const { w, e } = horseWorld(64, 0, 64);
    Object.assign(e, { onGround: true, modifiers: mods });
    w.horseSeats.mount(e, rider());
    w.horseJump(e, 100);
    tick(w);
    assert.ok(Math.abs(e.y - want) < 1e-6, `${JSON.stringify(mods)}: ${e.y}`); // jumpPower 1: the first tick rises by motionY
  }
});

test("EntityPlayerSP tracks the jump key off a horse, so mounting with it held continues the count (blk.e 321-328, 1100)", () => {
  const state = { rider: rider() };
  for (let i = 0; i < 3; i++) assert.equal(moveRidingPlayer(state, { jump: true }), null);
  assert.equal(state.rider.wasJump, true);
  assert.equal(state.rider.jumpPower, 0);
  // the first ridden tick with the key still held is a held tick (flag true), not a fresh press
  const sent = [];
  horseJumpCounter(state.rider, true, true, (p) => sent.push(p));
  assert.equal(state.rider.jumpCounter, 1);
  assert.equal(state.rider.jumpPower, H.heldJumpPower(1));
  horseJumpCounter(state.rider, false, true, (p) => sent.push(p));
  assert.deepEqual(sent, [Math.trunc(Math.fround(Math.fround(H.heldJumpPower(1)) * 100))]);
});

test("a ten-tick hold sends (int)(bO * 100) on the release tick and the horse jumps on its next tick", () => {
  const { w, e } = horseWorld(64, 0, 64);
  Object.assign(e, { onGround: true });
  const p = rider();
  w.horseSeats.mount(e, p);
  const sent = [];
  const send = (power) => { sent.push(power); w.horseJump(e, power); };
  horseJumpCounter(p, true, true, send); // press: a = 0
  for (let i = 0; i < 10; i++) { horseJumpCounter(p, true, true, send); tick(w); }
  assert.equal(p.jumpCounter, 10);
  assert.equal(e.jumpPower ?? 0, 0);
  horseJumpCounter(p, false, true, send);
  const power = Math.trunc(Math.fround(Math.fround(H.heldJumpPower(10)) * 100));
  assert.deepEqual(sent, [power]);
  assert.equal(p.jumpCounter, -10);
  assert.equal(e.jumpPower, H.jumpPower(true, power).power);
  tick(w);
  assert.ok(e.jumpingHorse && e.vy > 0 && (e.jumpPower ?? 0) === 0);
});

// b89 horse89: this test encoded the gap (no C0B, a same-tick dismount). Natively the C0B sent on the sneak tick still lands and the horse moves once more before
// EntityPlayer.updateRidden lets the rider go (horse89-b89.test.js replays the executed rows); the client part of the tick now keeps the rider on.
test("the sneak tick runs the counter and sends its C0B; the rider gets off in the mob tick, after the horse's move", () => {
  const { w, e } = horseWorld(64, 0, 64);
  const p = rider();
  w.horseSeats.mount(e, p);
  p.wasJump = true; p.jumpCounter = 5;
  let jumps = 0;
  const horseJump = w.horseJump;
  w.horseJump = (...a) => { jumps++; return horseJump.apply(w, a); };
  const state = { rider: p, horses: w.horseSeats, world: w.world, position: { x: 64, y: 1, z: 64 }, previous: {}, velocity: { x: 0, y: 0, z: 0 }, motion: {}, yaw: 0,
    survival: { health: 20, held: null }, screen: "playing" };
  moveRidingPlayer(state, { sneak: true, jump: false });
  assert.equal(jumps, 1);
  assert.equal(p.jumpCounter, -10); // the release ran (flag && !jump)
  assert.ok(p.vehicle && e.rider === p && p.sneakDismount);
  tick(w);
  assert.equal(p.vehicle, null);
  assert.equal(e.rider, null);
});
