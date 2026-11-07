import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JavaRandom } from "./lighting.js";
import { EntityWorld, setEntityRandom } from "./entities.js";
import { VillageCollection } from "./village.js";
import { Doors, doorFacing } from "./doors-panes.js";
import { WOODEN_DOOR } from "./world.js";
import { solidBlock } from "./world.js";

// ZombieDoorAttackProbe on the unchanged 1.7.10 classes (tools/verify-zombie-door-attack.mjs): the door wall of the batch 19 walk, but the
// attack target is a real villager ticked every tick inside a stone room behind the door. The zombie's AttackOnCollide + BreakDoor +
// MoveThroughVillage run until its melee lands on the villager (the villager's revenge target reaching the village's aggressor list is
// the village-aggressors replay's subject).
const reference = JSON.parse(readFileSync(new URL("../public/research/zombie-door-attack-reference.json", import.meta.url)));
const key = (x, y, z) => `${x},${y},${z}`;
const STONE = 1;

function walkWorld(variant) {
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

function room(cells) {
  for (let y = 0; y <= 3; y++) {
    for (let x = 60; x <= 71; x++) { cells.set(key(x, y, 44), [STONE, 0]); cells.set(key(x, y, 56), [STONE, 0]); }
    for (let z = 44; z <= 56; z++) cells.set(key(71, y, z), [STONE, 0]);
  }
  cells.set(key(60, 3, 50), [STONE, 0]);
}

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

function logged(seed) {
  const rand = new JavaRandom(seed), log = [];
  const ni = rand.nextInt.bind(rand), nf = rand.nextFloat.bind(rand);
  rand.nextInt = (...a) => { if (a.length) log.push(`i${a[0]}`); return ni(...a); };
  rand.nextFloat = () => { log.push("f"); return nf(); };
  return { rand, log };
}

export function runAttack(r) {
  const { w, cells } = walkWorld(r.variant);
  room(cells);
  const ew = new EntityWorld(w, [
    { id: "mob-1", type: "zombie", x: 54.5, y: 0, z: 50.5, health: 20, canBreakDoors: true },
    { id: "mob-2", type: "villager", x: 66.5, y: 0, z: 50.5, health: 20, profession: 0 },
  ]);
  ew.difficulty = r.difficulty;
  ew.worldRandom = new JavaRandom(1);
  ew.villageCollection = village(cells, w);
  ew.isDaytime = () => false;
  ew.ai.deps.canSeeSky = (x, y, z) => !(x >= 61 && x <= 75 && z >= 40 && z <= 60);
  new Doors(w, { drop() {} }).watch();
  const [z, v] = ew.entities, zl = logged(r.seed), vl = logged(r.seed + 100);
  setEntityRandom(z, zl.rand);
  setEntityRandom(v, vl.rand);
  for (const e of [z, v]) { for (const k of ["rotationYaw", "yaw", "renderYawOffset", "rotationYawHead", "prevRotationYaw"]) if (k in e) e[k] = 0; e.onGround = true; }
  v.growingAge = 0;
  const player = { x: 130, y: 0, z: 50, health: 20, alive: true }; // the probe has no player: a creative one 32..128 blocks away (idle ages, nothing despawns, no task sees it)
  const survival = { health: 20, creative: true, time: 18000 };
  const zb = ew.ai.brain(z), vb = ew.ai.brain(v);
  zb.canSee = () => true;
  vb.canSee = () => true; // the probe world has no ray tracing
  zb.attackTarget = vb;
  const out = [];
  for (let t = 0; t < r.ticks.length; t++) {
    zl.log.length = 0; vl.log.length = 0;
    ew.ai.beginTick(player, survival, 0);
    ew.tick(player, survival, 0);
    const aux = [];
    for (const e of ew.drain()) {
      const at = e.position ? `${Math.floor(e.position.x)},${Math.floor(e.position.y)},${Math.floor(e.position.z)}` : "";
      if (e.sound === "mob.zombie.wood") aux.push(`1010|${at}`);
      if (e.sound === "mob.zombie.woodbreak") aux.push(`1012|${at}`);
      if (e.blockBreak) aux.push(`2001|${e.blockBreak.x},${e.blockBreak.y},${e.blockBreak.z}`);
    }
    const on = (cls) => zb.tasks.running.some((x) => x.action.constructor.name === cls);
    const tz = !!zb.breakDoor && on(zb.breakDoor.constructor.name);
    const agg = vb.village ? vb.village.aggressors.length : -1;
    out.push([z.x, z.y, z.z, !!z.collidedH, v.x, v.y, v.z, v.health, cells.get(key(60, 0, 50))?.[0] ?? -1, cells.get(key(60, 0, 50))?.[1] ?? -1, cells.get(key(60, 1, 50))?.[0] ?? -1,
      tz, on("MoveThroughVillage"), on("AttackOnCollide"), tz ? zb.breakDoor.counter : 0, [...zl.log], [...vl.log], aux, agg]);
  }
  return out;
}

const want0 = (r, t) => r.ticks[t - 1];
const nativeRow = (row) => row.map((v, i) => ((i === 8 || i === 10) && v === 64 ? WOODEN_DOOR : v));

test("a zombie attacks a villager through a door: native records until the melee lands (positions, tasks, door, both Randoms, aux events)", () => {
  assert.equal(reference.records.length, 10);
  // Normal difficulty cannot break a closed door: that walk (300 ticks) never lands; the other nine do, the villager ends on 17 health.
  assert.deepEqual(reference.records.filter((r) => r.hitTick < 0).map((r) => [r.difficulty, r.variant]), [[2, 0]]);
  assert.ok(reference.records.filter((r) => r.hitTick > 0).every((r) => r.ticks.at(-1)[7] === 17));
  for (const r of reference.records) {
    const got = runAttack(r);
    for (let t = 0; t < r.ticks.length; t++) {
      const at = `difficulty ${r.difficulty} variant ${r.variant} seed ${r.seed} tick ${t}`, want = nativeRow(r.ticks[t]);
      for (const i of [0, 1, 2, 4, 5, 6]) assert.ok(Math.abs(got[t][i] - want[i]) < 1e-6, `${at} column ${i}: ${got[t][i]} vs ${want[i]}`);
      assert.deepEqual(got[t].slice(3, 4), want.slice(3, 4), at);
      if (JSON.stringify(got[t].slice(7)) !== JSON.stringify(want.slice(7))) assert.fail(`${at}\n got ${JSON.stringify(got[t])}\nwant ${JSON.stringify(want)}\nprev ${JSON.stringify(want0(r, t))}`);
    }
  }
});
