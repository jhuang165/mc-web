import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JavaRandom } from "./lighting.js";
import { EntityWorld, setEntityRandom } from "./entities.js";
import { VillageCollection } from "./village.js";
import { Doors, doorFacing } from "./doors-panes.js";
import { zombieSpawnRolls } from "./difficulty.js";
import { WOODEN_DOOR, solidBlock } from "./world.js";

// ZombieDoorWalkProbe on the unchanged 1.7.10 classes: a zombie with the break-door task ticks (Entity.onUpdate) towards an attack target
// behind a wall whose only gap is a closed wooden door: MoveThroughVillage / AttackOnCollide pathing, PathNavigate, move helper, the
// door collision, EntityAIBreakDoor. See tools/verify-zombie-door-walk.mjs.
const reference = JSON.parse(readFileSync(new URL("../public/research/zombie-door-walk-reference.json", import.meta.url)));
const key = (x, y, z) => `${x},${y},${z}`;
const STONE = 1;

export function walkWorld(variant) {
  const cells = new Map();
  for (let z = -60; z <= 160; z++) for (let y = 0; y <= 2; y++) cells.set(key(60, y, z), [STONE, 0]);
  cells.set(key(60, 0, 50), [WOODEN_DOOR, variant === 1 ? 1 : 0]);
  cells.set(key(60, 1, 50), [WOODEN_DOOR, 8]);
  const w = {
    numericSeed: 1,
    height: 256,
    solid: (x, y, z) => y < 0 || (cells.has(key(x, y, z)) && solidBlock(...cells.get(key(x, y, z)))),
    get: (x, y, z) => (y < 0 ? STONE : cells.get(key(x, y, z))?.[0] ?? 0),
    getMeta: (x, y, z) => cells.get(key(x, y, z))?.[1] ?? 0,
    surface: () => 1,
    spawn: () => ({ x: 5.5, y: 0, z: 5.5 }),
    put: (x, y, z, b, meta = 0) => { if (b) cells.set(key(x, y, z), [b, meta]); else cells.delete(key(x, y, z)); return true; },
    set(x, y, z, b, track = true, meta = 0) {
      const old = this.get(x, y, z);
      this.put(x, y, z, b, meta);
      if (old !== b) this.onChange?.(x, y, z, old, b);
      return true;
    },
    onChange: null,
  };
  return { w, cells };
}

// The probe's village: a registered villager position and the one wooden door; the roof east of the wall hides the sky.
function village(cells, w) {
  const host = {
    rand: new JavaRandom(2),
    isWoodenDoor: (x, y, z) => cells.get(key(x, y, z))?.[0] === WOODEN_DOOR,
    doorFacing: (x, y, z) => doorFacing(w, x, y, z),
    canSeeSky: (x, y, z) => !(x >= 61 && x <= 75 && z >= 40 && z <= 60),
    hasSolidTop: (x, y) => y < 0,
    isNormalCube: (x, y) => y < 0,
    countEntities: () => 0,
    spawnGolem() {},
  };
  const c = new VillageCollection(host);
  for (let t = 0; t < 5; t++) { if (t % 60 === 0) c.addVillagerPosition(62, 0, 50); c.tick(); }
  return c;
}

// One tick row like the probe: [x, y, z, collidedH, door lower id, meta, upper id, tz running, us running, tz counter, entity Random draws,
// path index, aux events]. The probe's world has no ray tracing, so canSee is always true here as well.
function runWalk(r, ticks) {
  const { w, cells } = walkWorld(r.variant);
  const ew = new EntityWorld(w, [{ id: "mob-1", type: "zombie", x: r.start[0], y: 0, z: r.start[1], health: 20, canBreakDoors: true }]);
  ew.difficulty = r.difficulty;
  ew.worldRandom = new JavaRandom(1);
  ew.villageCollection = village(cells, w);
  ew.isDaytime = () => false;
  new Doors(w, { drop() {} }).watch();
  const z = ew.entities[0], rand = new JavaRandom(r.seed);
  let draws = [];
  { const ni = rand.nextInt.bind(rand), nf = rand.nextFloat.bind(rand); rand.nextInt = (...a) => { if (a.length) draws.push(`i${a[0]}`); return ni(...a); }; rand.nextFloat = () => { draws.push("f"); return nf(); }; }
  setEntityRandom(z, rand);
  for (const k of ["rotationYaw", "yaw", "renderYawOffset", "rotationYawHead", "prevRotationYaw"]) if (k in z) z[k] = 0;
  const player = { x: 88.5, y: 0, z: 50.5, health: 20, alive: true };
  const survival = { health: 20, creative: false, time: 18000 };
  const brain = ew.ai.brain(z);
  brain.canSee = () => true;
  // The probe targets an unticked villager (setAttackTarget): a villager-kind target for the long-memory attack task (priority 4).
  const target = { isPlayer: false, alive: true, e: { type: "villager" }, x: 88.5, y: 0, z: 50.5, width: 0.6, height: 1.8, eyeHeight: 1.62, survival: null };
  brain.ai.attackMob = () => {};
  const out = [];
  for (let t = 0; t < ticks; t++) {
    draws = [];
    ew.ai.beginTick(player, survival, 0);
    brain.attackTarget = target;
    ew.tick(player, survival, 0);
    const aux = [];
    for (const e of ew.drain()) {
      const at = e.position ? `${Math.floor(e.position.x)},${Math.floor(e.position.y)},${Math.floor(e.position.z)}` : "";
      if (e.sound === "mob.zombie.wood") aux.push(`1010|${at}`);
      if (e.sound === "mob.zombie.woodbreak") aux.push(`1012|${at}`);
      if (e.blockBreak) aux.push(`2001|${e.blockBreak.x},${e.blockBreak.y},${e.blockBreak.z}`);
    }
    const on = (cls) => brain.tasks.running.some((x) => x.action.constructor.name === cls || x.action === cls);
    out.push([z.x, z.y, z.z, !!z.collidedH, cells.get(key(60, 0, 50))?.[0] ?? -1, cells.get(key(60, 0, 50))?.[1] ?? -1, cells.get(key(60, 1, 50))?.[0] ?? -1,
      !!brain.breakDoor && on(brain.breakDoor), on("MoveThroughVillage"), (!!brain.breakDoor && on(brain.breakDoor) ? brain.breakDoor.counter : 0), [...draws], brain.navigator.getPath()?.length ?? -1, aux, brain.tasks.running.map((x) => x.priority)]);
  }
  return out;
}

const nativeRow = (row) => row.map((v, i) => ((i === 4 || i === 6) && v === 64 ? WOODEN_DOOR : v));

test("a zombie walks a door path: 18 native records, 380 ticks each (position, collision, door cell, tasks, break counter, entity Random draws, aux events)", () => {
  assert.equal(reference.records.length, 18);
  let broke = 0, knocks = 0, contact = 0;
  for (const r of reference.records) {
    const got = runWalk(r, r.ticks.length);
    for (let t = 0; t < r.ticks.length; t++) {
      const at = `difficulty ${r.difficulty} variant ${r.variant} seed ${r.seed} tick ${t}`, want = nativeRow(r.ticks[t]);
      // Contact with the target (x past 87.5; the probe's villager is never ticked or pushed, the port's stand-in is) ends the comparison.
      if (want[0] > 87.5) { contact++; break; }
      // Mobs recompute their box from the centre each move, while Entity keeps the AABB and takes the centre from it: the position
      // differs by an ulp or two once a coordinate passes a power of two (x 64 here); every decision and draw is identical.
      for (let i = 0; i < 3; i++) assert.ok(Math.abs(got[t][i] - want[i]) < 1e-9, `${at} axis ${i}`);
      assert.deepEqual(got[t].slice(3), want.slice(3), at);
    }
    if (r.ticks.some((k) => k[12].some((a) => a.startsWith("1012")))) broke++;
    knocks += r.ticks.filter((k) => k[12].some((a) => a.startsWith("1010"))).length;
  }
  assert.equal(broke, 6); // Hard only: variants 0 and 2 (the door is closed), three seeds each
  assert.ok(knocks > 100);
  assert.equal(contact, 6); // the open-door variant walks right up to the target in both difficulties
});

test("a zombie pigman rolls, saves and loads CanBreakDoors like a zombie, but its AI is off so the task never runs (native)", () => {
  const [off, on] = reference.pigman;
  assert.deepEqual([off.read, off.written, on.read, on.written], [false, false, true, true]);
  assert.deepEqual([on.pigAI, on.zombieAI], [false, true], "EntityPigZombie.isAIEnabled is false, EntityZombie's true");
  const { w } = walkWorld(0);
  const saved = new EntityWorld(w, [{ id: "mob-1", type: "pigman", x: 5.5, y: 0, z: 5.5, health: 20, canBreakDoors: true }]);
  assert.equal(saved.entities[0].canBreakDoors, true);
  assert.equal(JSON.parse(JSON.stringify(saved.serialize()))[0].canBreakDoors, true);
  assert.equal(new EntityWorld(w, [{ id: "mob-1", type: "pigman", x: 5.5, y: 0, z: 5.5, health: 20 }]).entities[0].canBreakDoors, false);
  assert.ok(!saved.ai.brain(saved.entities[0]).breakDoor, "no break-door task on a pigman");
  let doors = 0;
  for (let seed = 0; seed < 600; seed++) {
    const ew = new EntityWorld(w, []);
    ew.difficulty = 3;
    ew.worldRandom = new JavaRandom(seed * 7 + 1);
    ew.localDifficulty = () => 4;
    const pig = ew.create("pigman", 5.5, 0, 5.5);
    setEntityRandom(pig, new JavaRandom(seed));
    const peek = zombieSpawnRolls(new JavaRandom(seed), new JavaRandom(seed * 7 + 1), 3, 4, undefined, true);
    ew.onSpawnWithEgg(pig);
    assert.equal(pig.canBreakDoors, !!(peek.doors || peek.leader), `seed ${seed}`);
    if (pig.canBreakDoors) doors++;
  }
  assert.ok(doors > 50);
});
