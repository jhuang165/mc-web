import test from "node:test";
import assert from "node:assert/strict";
import reference from "../public/research/village-live-reference.json" with { type: "json" };
import { JavaRandom } from "./java-random.js";
import { VillageCollection } from "./village.js";
import { villageTasks } from "./village-ai.js";
import { Task } from "./ai.js";

// Replays the village-dependent task gates (EntityAIMoveIndoors, RestrictOpenDoor, LookAtVillager, FollowGolem, Play:
// 1440 shouldExecute results and the next nextInt(1000000) of the entity's Random) and the EntityAIVillagerMate run
// (5 variants) recorded from the unchanged classes by tools/probes/VillageLiveProbe.java.
const records = (c) => reference.records.filter((r) => r.case === c);
const key = (x, y, z) => `${x},${y},${z}`;
const K = { Task, TargetBase: class extends Task {} };
const V = villageTasks(K);

function world(seed, doors) {
  const cells = new Set(), roofs = [[40, 0, 49, 100]], villagers = [];
  const host = {
    rand: new JavaRandom(seed),
    isWoodenDoor: (x, y, z) => cells.has(key(x, y, z)),
    doorFacing: () => 0,
    canSeeSky: (x, y, z) => !roofs.some((r) => x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3]),
    hasSolidTop: (x, y) => y < 0,
    isNormalCube: (x, y) => y < 0,
    countEntities: (kind, x0, y0, z0, x1, y1, z1) => kind === "villager" ? villagers.filter((v) => v.x - 0.3 < x1 && v.x + 0.3 > x0 && v.y < y1 && v.y + 1.8 > y0 && v.z - 0.3 < z1 && v.z + 0.3 > z0).length : 0,
    spawnGolem() {},
  };
  const c = new VillageCollection(host), w = { cells, villagers, host, c, day: true, rain: false, events: [], spawned: [] };
  for (let i = 0; i < doors; i++) { const x = 50 + (i % 5), z = 50 + Math.trunc(i / 5) * 3; cells.add(key(x, 0, z)); cells.add(key(x, 1, z)); }
  for (let t = 0; t < 5; t++) { if (t % 60 === 0) c.addVillagerPosition(52, 0, 52); c.tick(); }
  return w;
}

// An entity as the tasks see it: a Brain double with a box, its own Random and the village world.
function mob(w, type, x, z, seed, age = 0) {
  const [width, height] = type === "iron_golem" ? [1.4, 2.9] : [0.6, 1.8];
  const m = {
    e: { type, growingAge: age, holdRose: 0, mating: false, playing: false, homeRadius: -1, home: null },
    x, y: 0, z, width, height, rand: new JavaRandom(seed),
    ai: { ew: { villages: w.c, events: w.events, villageBurst: (name) => w.events.push(name), spawnVillagerChild: null }, isDaytime: () => w.day, isRaining: () => w.rain },
    navigator: { clearPathEntity() {}, noPath: () => true, tryMoveToXYZ() { return false; }, tryMoveToEntityLiving() { return false; }, setBreakDoors() {}, setEnterDoors() {} },
    lookHelper: { setLookPositionWithEntity() {}, setLookPosition() {} },
    getBlockPathWeight: () => 0,
    distSq: (o) => (m.x - o.x) ** 2 + (m.y - o.y) ** 2 + (m.z - o.z) ** 2,
    nearby(rx, ry, rz, test) {
      const lo = (b) => [b.x - b.width / 2, b.y, b.z - b.width / 2], hi = (b) => [b.x + b.width / 2, b.y + b.height, b.z + b.width / 2];
      const [a0, a1] = [lo(m), hi(m)];
      return w.mobs.filter((o) => o !== m && test(o) && (() => { const [b0, b1] = [lo(o), hi(o)]; return b0[0] < a1[0] + rx && b1[0] > a0[0] - rx && b0[1] < a1[1] + ry && b1[1] > a0[1] - ry && b0[2] < a1[2] + rz && b1[2] > a0[2] - rz; })());
    },
  };
  w.mobs.push(m);
  return m;
}

test("move indoors, restrict open door, look at villager, follow golem and play gates match 1440 native rows", () => {
  const rows = records("gates")[0].rows;
  assert.equal(rows.length, 1440);
  for (const [kind, day, rain, seed, expected, next] of rows) {
    const w = world(70, 12);
    w.day = day === 1; w.rain = rain === 1; w.mobs = [];
    const a = mob(w, "villager", kind === 5 ? 52.5 : 51.5, 52.5, seed, kind === 3 || kind === 4 ? -24000 : 0);
    mob(w, "villager", 54.5, 52.5, 900, kind === 4 ? -24000 : 0);
    const g = mob(w, "iron_golem", 53.5, 53.5, 1);
    if (kind === 2 || kind === 3) g.e.holdRose = 400;
    const task = [new V.MoveIndoors(a), new V.RestrictOpenDoor(a), new V.LookAtVillager(Object.assign(g, { rand: new JavaRandom(seed) })), new V.FollowGolem(a), new V.Play(a, 0.32), new V.RestrictOpenDoor(a)][kind];
    const rand = kind === 2 ? g.rand : a.rand;
    assert.equal(task.shouldExecute(), expected, `kind ${kind} day ${day} rain ${rain} seed ${seed}`);
    assert.equal(rand.nextInt(1000000), next, `rand after kind ${kind} day ${day} rain ${rain} seed ${seed}`);
  }
});

test("EntityAIVillagerMate: five native variants (gate, 300-tick run, birth, hearts, ages)", () => {
  for (const r of records("mating")) {
    const w = world(r.seed, r.doors);
    w.mobs = [];
    if (r.variant === 2) { w.c.villages[0].tickCounter = 1000; w.c.villages[0].endMatingSeason(); w.c.villages[0].tickCounter = 1001; }
    const a = mob(w, "villager", 52.5, 52.5, 300, r.variant === 1 ? -24000 : 0), b = mob(w, "villager", 53.5, 52.5, 301);
    w.villagers.push(a, b);
    if (r.variant === 4) for (let i = 0; i < 5; i++) { const o = mob(w, "villager", 52.5, 53.5, 310 + i); w.villagers.push(o); }
    for (let t = 0; t < 40; t++) { if (t % 10 === 0) w.c.addVillagerPosition(52, 0, 52); w.c.tick(); }
    assert.equal(w.c.villages[0].numVillagers, r.pop, "population variant " + r.variant);
    const task = new V.VillagerMate(a);
    let first = -1;
    for (let t = 0; t < 30000 && first < 0; t++) if (task.shouldExecute()) first = t;
    assert.equal(first, r.firstTrue, "first gate variant " + r.variant);
    if (first < 0) continue;
    b.e.mating = true;
    let child = null;
    a.ai.ew.spawnVillagerChild = (p) => (child = { profession: w.host.rand.nextInt(5), age: -24000, pos: [p.x ?? a.x, 0, p.z ?? a.z] });
    w.events.length = 0;
    task.startExecuting();
    let birth = -1;
    const hearts = [];
    for (let t = 0; t < 400; t++) {
      if (!task.continueExecuting()) break;
      const before = w.events.length;
      task.updateTask();
      if (w.events.length > before && w.events.at(-1) === "heart") hearts.push(t);
      if (child && birth < 0) birth = t;
    }
    assert.equal(birth, r.birth);
    assert.deepEqual(hearts, r.hearts);
    assert.equal(child.profession, r.child.profession);
    assert.equal(child.age, r.child.age);
    assert.deepEqual([a.e.growingAge, b.e.growingAge], r.parentAges);
  }
});
