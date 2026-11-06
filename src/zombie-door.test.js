import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JavaRandom } from "./lighting.js";
import { EntityWorld, setEntityRandom } from "./entities.js";
import { PathEntity, PathPoint } from "./pathfinding.js";
import { setGameRuleSource } from "./game-rules.js";
import { Doors } from "./doors-panes.js";
import { WOODEN_DOOR, IRON_DOOR } from "./world.js";
import { zombieSpawnRolls } from "./difficulty.js";

// MobRidingProbe on the unchanged 1.7.10 classes (EntityAIBreakDoor); see tools/verify-mob-riding.mjs.
const reference = JSON.parse(readFileSync(new URL("../public/research/mob-riding-reference.json", import.meta.url)));
const records = (c) => reference.records.filter((r) => r.case === c);

// A flat world with a closed wooden door at (6, 1..2, 5), the lower half's metadata 0 and the upper's 8.
function doorWorld(id = WOODEN_DOOR) {
  const cells = new Map([["6,1,5", [id, 0]], ["6,2,5", [id, 8]]]), log = [];
  const w = {
    numericSeed: 1,
    solid: (x, y, z) => y < 0,
    get: (x, y, z) => (y < 0 ? 1 : cells.get(`${x},${y},${z}`)?.[0] ?? 0),
    getMeta: (x, y, z) => cells.get(`${x},${y},${z}`)?.[1] ?? 0,
    surface: () => 1,
    spawn: () => ({ x: 5.5, y: 0, z: 5.5 }),
    put: (x, y, z, b, meta = 0) => { if (b) cells.set(`${x},${y},${z}`, [b, meta]); else cells.delete(`${x},${y},${z}`); return true; },
    set(x, y, z, b, track = true, meta = 0) {
      const old = this.get(x, y, z);
      this.put(x, y, z, b, meta);
      log.push(["set", x, y, z, b]);
      if (old !== b) this.onChange?.(x, y, z, old, b);
      return true;
    },
    onChange: null,
  };
  return { w, cells, log };
}
const setup = (d, seed, { id, collided = true, path = true } = {}) => {
  const { w, cells, log } = doorWorld(id), ew = new EntityWorld(w, [{ id: "mob-1", type: "zombie", x: 5.5, y: 0, z: 5.5, health: 20, canBreakDoors: true }]);
  ew.difficulty = d;
  ew.worldRandom = new JavaRandom(1);
  const z = ew.entities[0], rand = new JavaRandom(seed);
  setEntityRandom(z, rand);
  z.collidedH = collided;
  ew.ai.beginTick({ x: 50, y: 0, z: 50, health: 20 }, { health: 20, creative: false, time: 18000 }, 0);
  const brain = ew.ai.brain(z);
  brain.syncBreakDoors();
  if (path) brain.navigator.currentPath = new PathEntity([new PathPoint(5, 0, 5), new PathPoint(6, 0, 5), new PathPoint(7, 0, 5)]);
  return { w, cells, wlog: log, ew, z, rand, brain, task: brain.breakDoor };
};

// The probe's log: aux effects 1010 / 1012 / 2001, crack stages and the block removal, by update tick.
function replay(d, seed, opts) {
  const s = setup(d, seed, opts), log = [];
  const flush = (tick) => {
    const set = s.wlog.splice(0);
    for (const e of s.ew.drain()) {
      if (e.sound === "mob.zombie.wood") log.push([tick, "sfx", 1010, 6, 1, 5, 0]);
      if (e.sound === "mob.zombie.woodbreak") {
        if (set.length) log.push([tick, "air", 6, 1, 5]);
        log.push([tick, "sfx", 1012, 6, 1, 5, 0]);
      }
      if (e.crack) log.push([tick, "crack", e.crack.stage, e.crack.x, e.crack.y, e.crack.z]);
      if (e.blockBreak) log.push([tick, "sfx", 2001, e.blockBreak.x, e.blockBreak.y, e.blockBreak.z, e.blockBreak.block]);
    }
  };
  const start = !!s.task && s.task.shouldExecute();
  let ticks = 0, ended = false;
  if (start) {
    s.task.startExecuting();
    for (let t = 0; t < 300; t++) {
      if (!s.task.continueExecuting()) { ended = true; s.task.resetTask(); flush(t); break; }
      s.task.updateTask();
      flush(t);
      ticks++;
    }
  }
  return { ...s, start, ticks, ended, log, counter: start ? s.task.counter : 0 };
}

test("EntityAIBreakDoor replays the original: 240 ticks, crack stages, sounds, Hard removal", () => {
  const all = records("breakDoor");
  assert.equal(all.length, 32);
  let removed = 0;
  for (const r of all) {
    const out = replay(r.difficulty, r.seed, { collided: r.variant !== 1, path: r.variant !== 2 });
    const at = JSON.stringify([r.difficulty, r.seed, r.variant]);
    assert.equal(out.start, r.start, at);
    assert.equal(out.ticks, r.ticks, at);
    assert.equal(out.ended, r.ended, at);
    assert.equal(out.counter, r.counter, at);
    // Aux 2001 carries the block id: the original's 64 is this build's WOODEN_DOOR.
    assert.deepEqual(out.log, r.log.map((l) => (l[2] === 2001 ? [...l.slice(0, 6), WOODEN_DOOR] : l)), at);
    assert.equal(out.rand.nextInt(), r.randNext, `entity stream ${at}`);
    if (r.log.some((l) => l[1] === "air")) {
      removed++;
      assert.equal(r.difficulty, 3);
      assert.equal(out.w.get(6, 1, 5), 0);
    } else assert.equal(out.w.get(6, 1, 5), r.start ? WOODEN_DOOR : WOODEN_DOOR);
  }
  assert.equal(removed, 6);
});

test("mobGriefing false stops the task from starting; an iron door and an open door are left alone", () => {
  const [g] = records("griefing");
  setGameRuleSource((name) => (name === "mobGriefing" ? false : true));
  try { assert.equal(replay(3, 0).start, g.start); } finally { setGameRuleSource(null); }
  assert.equal(replay(3, 0).start, true);
  assert.equal(replay(3, 0, { id: IRON_DOOR }).start, false);
  const open = setup(3, 0);
  open.cells.set("6,1,5", [WOODEN_DOOR, 4]);
  assert.equal(open.task.shouldExecute(), false);
});

test("a door removed in the world takes its other half; found at head height, the lower half drops its item", () => {
  for (const feet of [0, 1]) {
    const out = setup(3, 0), drops = [];
    new Doors(out.w, { drop: (stacks, x, y, z) => drops.push([stacks[0].id, x, y, z]) }).watch();
    out.z.y = feet;
    out.brain.navigator.currentPath = new PathEntity([new PathPoint(5, feet, 5), new PathPoint(6, feet, 5), new PathPoint(7, feet, 5)]);
    assert.ok(out.task.shouldExecute());
    out.task.startExecuting();
    for (let t = 0; t < 240; t++) out.task.updateTask();
    assert.equal(out.w.get(6, 1, 5), 0);
    assert.equal(out.w.get(6, 2, 5), 0);
    // Feet at y 0 find the lower half (setBlockToAir drops nothing, the upper half just goes); feet at 1 find the upper
    // half, and the lower one, left with nothing above it, comes off as an item (BlockDoor.onNeighborBlockChange).
    assert.equal(drops.length, feet);
  }
});

test("the task follows e.canBreakDoors: added at priority 1 at the end of the list, removed again", () => {
  const w = doorWorld().w, ew = new EntityWorld(w, [{ id: "mob-1", type: "zombie", x: 5.5, y: 0, z: 5.5, health: 20 }, { id: "mob-2", type: "skeleton", x: 9.5, y: 0, z: 5.5, health: 20 }]);
  const z = ew.entities[0];
  ew.ai.beginTick({ x: 50, y: 0, z: 50, health: 20 }, { health: 20, creative: false, time: 18000 }, 0);
  const brain = ew.ai.brain(z);
  brain.updateAITasks();
  assert.ok(!brain.breakDoor && brain.navigator.canPassClosedDoors, "the navigator may pass closed doors from the start");
  z.canBreakDoors = true;
  brain.updateAITasks();
  assert.ok(brain.breakDoor);
  const entry = brain.tasks.entries.at(-1);
  assert.equal(entry.action, brain.breakDoor);
  assert.equal(entry.priority, 1);
  z.canBreakDoors = false;
  brain.updateAITasks();
  assert.ok(!brain.breakDoor && !brain.tasks.entries.some((e) => e.priority === 1));
  assert.ok(!ew.ai.brain(ew.entities[1]).breakDoor);
});

test("the CanBreakDoors roll and the leader zombie: doors, max health and reinforcement", () => {
  const [tag] = records("canBreakDoors");
  assert.deepEqual([tag.read, tag.written], [true, true]);
  const w = doorWorld().w, saved = new EntityWorld(w, [{ id: "mob-1", type: "zombie", x: 5.5, y: 0, z: 5.5, health: 20, canBreakDoors: true, maxHealth: 70 }]);
  assert.equal(saved.entities[0].canBreakDoors, true);
  assert.equal(saved.entities[0].maxHealth, 70);
  assert.equal(JSON.parse(JSON.stringify(saved.serialize()))[0].canBreakDoors, true);
  assert.equal(new EntityWorld(w, [{ id: "mob-1", type: "zombie", x: 5.5, y: 0, z: 5.5, health: 20, canBreakDoors: "1", maxHealth: 5 }]).entities[0].canBreakDoors, false);
  // Spawn rolls: the doors roll or a leader sets the flag, and a leader's max-health bonus is kept.
  let doors = 0, leaders = 0, plain = 0;
  for (let seed = 0; seed < 4000; seed++) {
    const ew = new EntityWorld(w, []);
    ew.difficulty = 3;
    ew.worldRandom = new JavaRandom(seed * 7 + 1);
    ew.localDifficulty = () => 4;
    const z = ew.create("zombie", 5.5, 0, 5.5);
    setEntityRandom(z, new JavaRandom(seed));
    const peek = zombieSpawnRolls(new JavaRandom(seed), new JavaRandom(seed * 7 + 1), 3, 4);
    ew.onSpawnWithEgg(z);
    assert.equal(z.canBreakDoors, !!(peek.doors || peek.leader), `seed ${seed}`);
    assert.equal(z.maxHealth, peek.leader && peek.maxHealth > 20 ? peek.maxHealth : undefined);
    assert.equal(z.health, 20);
    if (peek.leader) { leaders++; assert.ok(z.maxHealth >= 40 && z.maxHealth < 100.0001, String(z.maxHealth)); } else if (peek.doors) doors++; else plain++;
  }
  assert.ok(leaders > 20 && doors > 100 && plain > 100, `${leaders} ${doors} ${plain}`);
});

test("a zombie that has collided runs the task through the live tick", () => {
  const { ew, z, w } = setup(3, 0, { collided: false });
  z.collidedH = true;
  ew.world.solid = () => false;
  const player = { x: 5.5, y: 0, z: 5.5, health: 20 };
  const brain = ew.ai.brain(z);
  brain.navigator.currentPath = new PathEntity([new PathPoint(5, 0, 5), new PathPoint(6, 0, 5)]);
  brain.tasks.tickCount = 0;
  brain.tasks.tick();
  assert.ok(brain.tasks.running.some((e) => e.action === brain.breakDoor), "started by the task list");
  assert.equal(w.get(6, 1, 5), WOODEN_DOOR);
});
