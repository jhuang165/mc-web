import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sneakEdge, moveInput, moveWeights, nextYSize, PlayerMotion, isCritical, criticalDamage } from "./player-movement.js";
import { EntityWorld, moveEntity, moveEntityWithHeading } from "./entities.js";
import { Survival } from "./survival.js";

const f = Math.fround;
const near = (a, b, eps = 1e-12) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);

// --- sneak edge safety: replay of tools/probes/SneakProbe.java (verify-sneak.mjs) ---
const ref = JSON.parse(await readFile(new URL("../public/research/sneak-reference.json", import.meta.url)));
// Stone below y 0 while x < 64 and z < 64: a platform whose box-edge limit is centre 64.3.
const solid = (x, y, z) => y < 0 && x < 64 && z < 64;
const platform = { numericSeed: 1, solid, get: (x, y, z) => (solid(x, y, z) ? 1 : 0), surface: () => 0, spawn: () => ({ x: 0, y: 0, z: 0 }) };
const player = (x, z, sneaking, yaw = 0) => ({ x, y: 0, z, vx: 0, vy: 0, vz: 0, onGround: true, collidedH: false, fallDistance: 0, sneaking, rotationYaw: yaw, aiMoveSpeed: 0 });

test("sneak edge safety matches the unchanged 1.7.10 Entity.moveEntity for a sneaking EntityPlayerSP", () => {
  const moves = ref.cases.filter((c) => c.case === "move"), walks = ref.cases.filter((c) => c.case === "walk");
  assert.equal(moves.length + walks.length, ref.cases.length);
  assert.ok(moves.length >= 100 && walks.length === 12);
  let shortened = 0;
  for (const c of moves) {
    const e = player(c.start[0], c.start[1], c.sneak);
    moveEntity(platform, e, 0.6, 1.8, c.move[0], -0.0784, c.move[1]);
    const label = `move ${JSON.stringify(c.start)} ${JSON.stringify(c.move)} sneak=${c.sneak}`;
    near(e.x, c.end.x, 1e-12), near(e.z, c.end.z, 1e-12);
    near(e.y, c.end.y, 1e-12);
    assert.equal(e.onGround, c.end.onGround, label);
    if (c.sneak && (c.end.x !== c.start[0] + c.move[0] || c.end.z !== c.start[1] + c.move[1])) shortened++;
  }
  assert.ok(shortened >= 20, "the cases must actually exercise the edge loop");
  for (const c of walks) {
    const e = player(c.start[0], c.start[1], c.sneak, c.yaw);
    e.aiMoveSpeed = f(0.1);
    const forward = f(f(c.forward) * f(0.98));
    c.ticks.forEach((want, i) => {
      e.px = e.x; e.pz = e.z;
      moveEntityWithHeading(platform, e, 0.6, 1.8, forward);
      const label = `walk sneak=${c.sneak} yaw=${c.yaw} start=${c.start} tick ${i}`;
      for (const k of ["x", "y", "z", "vx", "vy", "vz"]) near(e[k], want[k], 1e-12 * Math.max(1, Math.abs(want[k])));
      assert.equal(e.onGround, want.onGround, label);
    });
  }
  // Sneaking never leaves the platform; the control run walks off it.
  for (const c of walks) {
    const last = c.ticks.at(-1);
    if (c.sneak) assert.equal(last.y, 0);
    else assert.ok(last.y < -1);
  }
});

test("sneakEdge is the bytecode's three loops with the 0.05 snap", () => {
  const air = () => true, ground = () => false;
  assert.deepEqual(sneakEdge(0.3, -0.2, ground), [0.3, -0.2]);
  assert.deepEqual(sneakEdge(0.3, -0.2, air), [0, 0]);
  // Only x runs off (the box offset (dx, -1, 0) is empty for dx > 0.12): z is kept.
  const [sx, sz] = sneakEdge(0.3, 0.1, (ox) => ox > 0.12);
  near(sx, 0.1, 1e-12);
  assert.equal(sz, 0.1);
  // [-0.05, 0.05) snaps straight to zero.
  assert.deepEqual(sneakEdge(0.049, 0, air), [0, 0]);
  assert.deepEqual(sneakEdge(-0.05, 0, air), [0, 0]);
  near(sneakEdge(0.06, 0, (ox) => ox > 0.015)[0], 0.01, 1e-15);
});

test("sneak input is 0.3x as floats, and sneaking can never sprint", () => {
  const m = moveInput({ forward: 1, strafe: -1, sneak: true });
  assert.equal(m.forward, f(0.3));
  assert.equal(m.strafe, f(-0.3));
  assert.deepEqual(moveInput({ forward: 1, strafe: 0 }), { forward: 1, strafe: 0 });
  assert.equal(moveInput({ forward: 1, usingItem: true }).forward, f(0.2));
  // 0.3F * 0.98F is far below the 0.8 sprint threshold, and the diagonal is normalized.
  const w = moveWeights(m);
  assert.equal(w.forward, f(f(0.3) * f(0.98)));
  const diag = moveWeights({ forward: 1, strafe: 1 });
  near(Math.hypot(diag.forward, diag.strafe), 1, 1e-6);
  assert.deepEqual(moveWeights({ forward: 0, strafe: 0 }), { forward: 0, strafe: 0 });
});

test("sprint toggles and cancels like EntityPlayerSP.onLivingUpdate", () => {
  const p = new PlayerMotion(), ground = { onGround: true };
  p.update({ forward: 1 }, ground);
  assert.equal(p.sprinting, false);
  assert.equal(p.sprintToggleTimer, 7);
  p.update({ forward: 0 }, ground);
  p.update({ forward: 1 }, ground);
  assert.equal(p.sprinting, true, "second tap inside 7 ticks sprints");
  p.update({ forward: 1, sneak: true }, ground);
  assert.equal(p.sprinting, false, "sneaking cancels it");
  assert.equal(p.sneaking, true);
  p.update({ forward: 1 }, ground);
  p.update({ forward: 1 }, { ...ground, sprintKey: true });
  assert.equal(p.sprinting, true);
  p.update({ forward: 1 }, { ...ground, collidedH: true });
  assert.equal(p.sprinting, false, "hitting a wall stops it");
  p.update({ forward: 1 }, { ...ground, sprintKey: true, canSprint: false });
  assert.equal(p.sprinting, false, "needs food above 6");
});

test("eye drop: ySize 0.2 raised while sneaking and decayed by 0.4 each move", () => {
  assert.equal(nextYSize(0, true), f(f(0.2) * f(0.4)));
  near(nextYSize(0, true), 0.08, 1e-8);
  let y = nextYSize(0, true);
  y = nextYSize(y, true);
  assert.equal(y, f(f(0.2) * f(0.4)), "stays at 0.08 while the key is held");
  y = nextYSize(y, false);
  near(y, 0.032, 1e-8);
  const p = new PlayerMotion();
  p.update({ sneak: true }, {});
  p.endMove();
  near(p.drop(1), 0.08, 1e-8);
  near(p.drop(0.5), 0.04, 1e-8);
});

test("critical hits need a fall and multiply the damage by 1.5F; sprint knockback is the 1.7.10 vector", () => {
  assert.equal(isCritical({ fallDistance: 0.4 }), true);
  for (const bad of [{ fallDistance: 0 }, { fallDistance: 1, onGround: true }, { fallDistance: 1, onLadder: true }, { fallDistance: 1, inWater: true }, { fallDistance: 1, blind: true }, { fallDistance: 1, riding: true }])
    assert.equal(isCritical(bad), false);
  assert.equal(criticalDamage(7), 10.5);
  assert.equal(criticalDamage(1), 1.5);
  const pig = (id = "mob-1") => ({ id, type: "pig", x: 64, y: 0, z: 64, health: 100, vx: 0, vy: 0, vz: 0 });
  const survival = () => new Survival({ inventory: { 115: 1 } });
  const hit = (over) => {
    const w = new EntityWorld(platform, [pig()]), e = w.entities[0];
    e.health = 100;
    w.attack(e, 115, survival(), { x: 64, z: 60, yaw: 0, ...over.player }, over.knock, over.critical);
    return { e, damage: 100 - e.health };
  };
  const plain = hit({}), crit = hit({ critical: true });
  assert.equal(plain.damage, 8); // wooden sword
  assert.equal(crit.damage, 12);
  // Game yaw pi faces +z (Java yaw 0): the push is +0.5 along z, 0.1 up. The attacker's
  // own hit knockback is the same in all three, so the difference is the extra push.
  const hitFacing = (knock, yaw) => hit({ knock, player: { yaw } });
  const sprint = hitFacing(1, Math.PI), base = hitFacing(0, Math.PI);
  near(sprint.e.vx - base.e.vx, 0, 1e-6);
  near(sprint.e.vz - base.e.vz, 0.5, 1e-6);
  near(sprint.e.vy - base.e.vy, 0.1, 1e-12);
  // Game yaw pi/2 faces -x (Java yaw 90): enchantment 1 + sprint is i = 2, so -1.0 along x.
  const two = hitFacing(2, Math.PI / 2), base2 = hitFacing(0, Math.PI / 2);
  near(two.e.vx - base2.e.vx, -1, 1e-6);
  near(two.e.vz - base2.e.vz, 0, 1e-6);
});

// --- sprint speed, sprint jump, flight and the field of view (EntityPlayerSP/EntityLivingBase) ---
import {
  moveSpeed, groundAccel, airAccel, LIQUID_ACCEL, JUMP_MOTION, JUMP_DELAY, jumpExhaustion, sprintJumpPush,
  FLY_SPEED, flyVertical, FLY_Y_DRAG, fovMultiplier,
} from "./player-movement.js";
import { bowFov } from "./bow.js";

test("sprinting multiplies the movement attribute by 1.3 and the air factor by 1.3", () => {
  near(moveSpeed(false), 0.10000000149011612);
  near(moveSpeed(true) / moveSpeed(false), 1.30000001192092896, 1e-15);
  // Normal ground: slipperiness 0.6F * 0.91F; 0.16277136F / friction³ is exactly 1 at that friction.
  const friction = f(f(0.6) * f(0.91));
  near(groundAccel(false, friction), f(f(0.1) * f(f(0.16277136) / f(f(friction * friction) * friction))));
  near(groundAccel(true, friction) / groundAccel(false, friction), 1.3, 1e-6);
  assert.equal(airAccel(false), f(0.02));
  // (float)(0.02F + 0.02F * 0.3D): one float step below f(0.026).
  assert.equal(airAccel(true), f(f(0.02) + f(0.02) * 0.3));
  near(airAccel(true), 0.026, 1e-8);
  assert.equal(LIQUID_ACCEL, f(0.02));
  // Steady ground speed: each tick moves d = v + a * 0.98 (moveWeights) and keeps v = d * friction,
  // so d = 0.98a / (1 - friction).
  const terminal = (a) => (a * f(0.98)) / (1 - friction);
  near(terminal(groundAccel(false, friction)) * 20, 4.317, 2e-3); // blocks per second walking
  near(terminal(groundAccel(true, friction)) * 20, 5.612, 2e-3); // sprinting
});

test("held jumps wait 10 ticks; releasing the key clears the delay; liquids lift 0.04", () => {
  const p = new PlayerMotion();
  assert.equal(p.jump(true, { onGround: true }), "jump");
  assert.equal(p.jumpTicks, JUMP_DELAY);
  const fired = [];
  for (let t = 1; t <= 12; t++) fired.push(p.jump(true, { onGround: true }));
  assert.equal(fired.indexOf("jump"), 9, "the next held jump is ten ticks after the first");
  p.jump(false, { onGround: true });
  assert.equal(p.jumpTicks, 0);
  assert.equal(p.jump(true, { onGround: true }), "jump", "a fresh press jumps at once");
  assert.equal(p.jump(true, { inLiquid: true, onGround: true }), "swim", "water wins over the ground");
  assert.equal(p.jump(true, { onGround: false }), null);
  assert.equal(JUMP_MOTION, 0.41999998688697815);
  assert.equal(jumpExhaustion(true), f(0.8));
  assert.equal(jumpExhaustion(false), f(0.2));
  // Facing -z (yaw 0) the sprint jump pushes 0.2F forward.
  const push = sprintJumpPush(0);
  near(push.x, 0);
  near(push.z, -f(0.2));
});

test("Creative flight toggles on a second fresh jump press within six ticks", () => {
  const tap = (p, gap, allow = true) => {
    // Press on tick 0, release, press again on tick `gap`.
    let toggled = p.toggleFlight(true, allow);
    for (let i = 1; i < gap; i++) p.toggleFlight(false, allow);
    toggled = p.toggleFlight(true, allow) || toggled;
    p.toggleFlight(false, allow);
    return toggled;
  };
  for (let gap = 2; gap <= 6; gap++) assert.equal(tap(new PlayerMotion(), gap), true, `gap ${gap}`);
  assert.equal(tap(new PlayerMotion(), 7), false, "seven ticks is too slow");
  const held = new PlayerMotion();
  held.toggleFlight(true, true);
  for (let i = 0; i < 4; i++) assert.equal(held.toggleFlight(true, true), false, "holding the key is one press");
  const survival = new PlayerMotion();
  assert.equal(tap(survival, 2, false), false, "needs allowFlying");
});

test("flight moves 0.05F horizontally and keeps 0.6 of motionY; jump/sneak add 0.15", () => {
  assert.equal(FLY_SPEED, f(0.05));
  let vy = 0;
  for (let i = 0; i < 40; i++) vy = flyVertical(vy, { jump: true }) * FLY_Y_DRAG;
  near(vy, 0.225, 1e-9); // (v + 0.15) * 0.6 settles at 0.225 a tick
  vy = 0;
  for (let i = 0; i < 40; i++) vy = flyVertical(vy, { sneak: true }) * FLY_Y_DRAG;
  near(vy, -0.225, 1e-9);
  assert.equal(flyVertical(0.1, { jump: true, sneak: true }), 0.1);
  // Horizontal: air friction 0.91F, so the move settles at 0.98 * 0.05 / 0.09, 10.9 blocks a second.
  const air = f(0.91);
  near(((FLY_SPEED * f(0.98)) / (1 - air)) * 20, 10.89, 1e-2);
});

test("getFOVMultiplier: sprint 1.15, flight 1.1, both 1.265, times the bow term", () => {
  assert.equal(fovMultiplier(), 1);
  near(fovMultiplier({ sprinting: true }), 1.15, 1e-6);
  near(fovMultiplier({ flying: true }), 1.1, 1e-6);
  near(fovMultiplier({ flying: true, sprinting: true }), 1.265, 1e-6);
  near(fovMultiplier({ sprinting: true, bow: bowFov(20) }), 1.15 * 0.85, 1e-6);
  assert.equal(fovMultiplier({ sprinting: true }), f(fovMultiplier({ sprinting: true })), "stays a float");
});
