import { test } from "node:test";
import assert from "node:assert/strict";
import { Task, TaskList, MoveHelper, LookHelper, JumpHelper, findRandomTarget, limitAngle, Rand } from "./ai.js";
import { EntityWorld, ENTITY_TYPES, setEntityRandom } from "./entities.js";
import { JavaRandom } from "./lighting.js";

const grass = { numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) };
const player = (x = 64, z = 64) => ({ x, y: 0, z });
const survival = { health: 20, creative: false, time: 6000, damage() {}, scaledDamage() {}, count: () => 0 };

class Probe extends Task {
  constructor(mutex, { run = true, keep = true, interruptible = true } = {}) {
    super();
    this.mutex = mutex;
    this.run = run;
    this.keep = keep;
    this.interruptible = interruptible;
    this.log = [];
  }
  shouldExecute() {
    this.log.push("should");
    return this.run;
  }
  continueExecuting() {
    this.log.push("continue");
    return this.keep;
  }
  isInterruptible() {
    return this.interruptible;
  }
  startExecuting() {
    this.log.push("start");
  }
  resetTask() {
    this.log.push("reset");
  }
  updateTask() {
    this.log.push("update");
  }
}

test("limitAngle turns at most `max` degrees the short way round", () => {
  assert.equal(limitAngle(0, 90, 30), 30);
  assert.equal(limitAngle(0, -90, 30), -30);
  assert.equal(limitAngle(170, -170, 30), 190, "20 degrees through 180 is below the limit");
  assert.equal(limitAngle(10, 25, 30), 25);
  assert.equal(limitAngle(-170, 170, 30), -190);
});

test("EntityAITasks looks for work every third tick and only checks running tasks otherwise", () => {
  const list = new TaskList(), a = new Probe(1);
  list.add(0, a);
  list.tick(); // tick 0: shouldExecute then start, then update
  assert.deepEqual(a.log, ["should", "start", "update"]);
  a.log = [];
  list.tick(); // tick 1: only continueExecuting
  assert.deepEqual(a.log, ["continue", "update"]);
  a.log = [];
  list.tick();
  a.log = [];
  list.tick(); // tick 3: canUse && continueExecuting keep it; no restart
  assert.deepEqual(a.log, ["continue", "update"]);
});

test("a running task that stops continuing is reset at once, and restarted only on a third tick", () => {
  const list = new TaskList(), a = new Probe(1);
  list.add(0, a);
  list.tick();
  a.keep = false;
  a.log = [];
  list.tick(); // tick 1: continue fails
  assert.deepEqual(a.log, ["continue", "reset"]);
  a.log = [];
  list.tick(); // tick 2: not running, nothing asked
  assert.deepEqual(a.log, []);
  a.keep = true;
  list.tick(); // tick 3: shouldExecute again
  assert.deepEqual(a.log, ["should", "start", "update"]);
});

test("a higher priority running task with a shared mutex bit blocks a lower one; disjoint bits run together", () => {
  const list = new TaskList(), high = new Probe(1), lowShared = new Probe(3), lowFree = new Probe(4);
  list.add(0, high);
  list.add(1, lowShared);
  list.add(2, lowFree);
  list.tick();
  assert.deepEqual(list.running.map((r) => r.action), [high, lowFree]);
  assert.ok(!lowShared.log.includes("start"));
  assert.ok(!lowShared.log.includes("should"), "canUse fails before shouldExecute is asked");
});

test("a higher priority task replaces a running interruptible one, but not a non-interruptible one", () => {
  for (const interruptible of [true, false]) {
    const list = new TaskList(), low = new Probe(1, { interruptible }), high = new Probe(1, { run: false });
    list.add(0, high);
    list.add(1, low);
    list.tick();
    assert.deepEqual(list.running.map((r) => r.action), [low]);
    high.run = true;
    list.tick();
    list.tick();
    list.tick(); // tick 3
    const running = list.running.map((r) => r.action);
    if (interruptible) {
      // The high entry is checked first: it may start only when `low` is interruptible; then low's
      // own canUse fails against the running high task and low is reset.
      assert.deepEqual(running, [high]);
      assert.ok(low.log.includes("reset"));
    } else {
      assert.deepEqual(running, [low]);
      assert.ok(!high.log.includes("start"));
    }
  }
});

test("EntityMoveHelper turns 30 degrees a tick, sets the speed and jumps only for a higher target within a block", () => {
  const e = { moveForward: 0, jumping: false };
  const mob = {
    e, x: 0, y: 0, z: 0, rotationYaw: 0, speeds: [],
    attributeSpeed: (m) => m * 0.25,
    setAIMoveSpeed(v) {
      this.speeds.push(v);
      e.moveForward = v;
    },
  };
  mob.jumpHelper = new JumpHelper(mob);
  const helper = new MoveHelper(mob);
  e.moveForward = 5;
  helper.onUpdateMoveHelper();
  assert.equal(e.moveForward, 0, "no target zeroes moveForward");
  helper.setMoveTo(0, 0, 10, 2); // straight along +z: yaw 0
  helper.onUpdateMoveHelper();
  assert.equal(mob.rotationYaw, 0);
  assert.deepEqual(mob.speeds, [0.5]);
  helper.setMoveTo(-10, 0, 0, 1); // along -x: yaw 90, limited
  helper.onUpdateMoveHelper();
  assert.equal(mob.rotationYaw, 30);
  helper.setMoveTo(0.4, 1, 0, 1); // one block up and close: jump
  helper.onUpdateMoveHelper();
  mob.jumpHelper.doJump();
  assert.equal(e.jumping, true);
  helper.setMoveTo(3, 1, 0, 1); // higher but far away: no jump
  helper.onUpdateMoveHelper();
  mob.jumpHelper.doJump();
  assert.equal(e.jumping, false);
  helper.setMoveTo(0, 0, 0, 1); // already there
  mob.speeds.length = 0;
  helper.onUpdateMoveHelper();
  assert.deepEqual(mob.speeds, []);
});

test("EntityLookHelper turns the head toward a target within the limits, else eases it to the body at 10", () => {
  const mob = { x: 0, y: 0, z: 0, eyeHeight: 1, rotationYaw: 0, rotationYawHead: 0, rotationPitch: 7, renderYawOffset: 0, navigator: { noPath: () => true } };
  const look = new LookHelper(mob);
  look.setLookPosition(10, 1, 0, 10, 40); // along +x: yaw -90
  look.onUpdateLook();
  assert.equal(mob.rotationYawHead, -10);
  assert.equal(mob.rotationPitch, 0);
  look.setLookPosition(0, 11, 10, 90, 40); // along +z and 10 up: pitch -45 limited to -40
  look.onUpdateLook();
  assert.equal(mob.rotationYawHead, 0, "yaw 0 within 90 degrees of -10");
  assert.equal(mob.rotationPitch, -40);
  mob.rotationYawHead = 45;
  look.onUpdateLook();
  assert.equal(mob.rotationYawHead, 35, "no target: 10 degrees toward the body");
  mob.navigator = { noPath: () => false };
  mob.renderYawOffset = 0;
  mob.rotationYawHead = 100;
  look.setLookPosition(-10, 1, 0, 0, 0); // yaw 90, held by deltaYaw 0
  look.onUpdateLook();
  assert.equal(mob.rotationYawHead, 75, "with a path the head stays within 75 degrees of the body");
});

test("RandomPositionGenerator takes the best of ten offsets drawn x, y, z from nextInt(2n) - n", () => {
  const seq = [0, 0, 0, 0.99, 0.99, 0.99];
  const draws = [];
  const rand = new Rand(() => {
    const v = seq[draws.length % seq.length];
    draws.push(v);
    return v;
  });
  const weights = new Map([["-5,-4,-5", 1], ["4,3,4", 2]]);
  const mob = { rand, x: 10.5, y: 5, z: 10.5, getBlockPathWeight: (x, y, z) => weights.get(`${x - 10},${y - 5},${z - 10}`) ?? 0 };
  assert.deepEqual(findRandomTarget(mob, 5, 4), { x: 14, y: 8, z: 14 });
  assert.equal(draws.length, 30);
});

const mobs = (list, random = () => 0.5) => new EntityWorld(grass, list.map((m, i) => ({ id: `m${i}`, health: 10, ...m })), random);

test("a damaged cow flees along a path (Panic), faster than it wanders", () => {
  const w = mobs([{ type: "cow", x: 64, y: 0, z: 64 }], () => 0.3), cow = w.entities[0];
  // b65 lead: Entity.rand picks the panic spot; unseeded (Math.random) it lands within a block now and then (1 full run in about ten batches)
  setEntityRandom(cow, new JavaRandom(65));
  for (let i = 0; i < 3; i++) w.tick(player(64, 64.3), survival);
  const brain = w.ai.brain(cow);
  w.damage(cow, 1, 64, 64.3);
  w.tick(player(64, 64.3), survival);
  assert.ok(cow.revenge > 0);
  for (let i = 0; i < 3; i++) w.tick(player(64, 64.3), survival);
  assert.ok(brain.tasks.running.some((r) => r.action.constructor.name === "Panic"));
  const at = { x: cow.x, z: cow.z };
  for (let i = 0; i < 20; i++) w.tick(player(64, 64.3), survival);
  assert.ok(Math.hypot(cow.x - at.x, cow.z - at.z) > 1, "the cow ran along its path");
});

test("a baby follows the adult it is near, and an adult never takes the follow task", () => {
  const w = mobs([{ type: "cow", x: 60, y: 0, z: 64, growingAge: -6000 }, { type: "cow", x: 66, y: 0, z: 64 }], () => 0.99);
  const [baby, adult] = w.entities;
  const start = Math.hypot(baby.x - adult.x, baby.z - adult.z);
  for (let i = 0; i < 90; i++) w.tick(player(64, 100), survival);
  assert.ok(Math.hypot(baby.x - adult.x, baby.z - adult.z) < start - 1, "the baby closed in");
  const names = (e) => w.ai.brain(e).tasks.running.map((r) => r.action.constructor.name);
  assert.ok(!names(adult).includes("FollowParent"));
});

test("zombie target tasks pick the nearest player within follow range and attack on collision", () => {
  const w = mobs([{ type: "zombie", x: 64, y: 0, z: 64 }], () => 0.99), z = w.entities[0];
  const brain = w.ai.brain(z);
  for (let i = 0; i < 60; i++) w.tick(player(64, 70), survival);
  assert.ok(brain.attackTarget, "the player was targeted");
  assert.ok(Math.hypot(z.x - 64, z.z - 70) < 6, "and approached");
});

test("forty mobs path-finding at once stay within the per-tick search budget", () => {
  const list = [];
  for (let i = 0; i < 40; i++) list.push({ type: ["pig", "cow", "sheep", "chicken", "zombie"][i % 5], x: 50 + (i % 8) * 3, y: 0, z: 50 + Math.floor(i / 8) * 3 });
  const w = mobs(list, () => 0.001);
  let searches = 0;
  const budget = w.ai.budget;
  const t0 = performance.now();
  for (let i = 0; i < 60; i++) {
    w.tick(player(60, 60), survival);
    assert.ok(budget.left >= 0 && budget.left <= budget.perTick);
    searches += budget.perTick - budget.left;
  }
  const ms = performance.now() - t0;
  assert.ok(searches > 0, "mobs searched for paths");
  assert.ok(searches <= 60 * budget.perTick);
  assert.ok(ms / 60 < 25, `a tick of 40 mobs took ${(ms / 60).toFixed(1)} ms`);
  assert.ok(budget.denied >= 0);
});
