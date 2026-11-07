import test from "node:test";
import assert from "node:assert/strict";
import reference from "../public/research/mob-doors-reference.json" with { type: "json" };
import { JavaRandom } from "./java-random.js";
import { VillageCollection, VillageDoorInfo } from "./village.js";
import { villageTasks } from "./village-ai.js";
import { PathNavigate } from "./pathfinding.js";
import { Task } from "./ai.js";
import { WOODEN_DOOR } from "./world.js";

// Replays tools/probes/MoveThroughVillageProbe.java (unchanged EntityAIMoveThroughVillage, VillageDoorInfo, Village) on a zombie:
// door choice, the visited list (coordinate equality), the navigator's door flag and the entity Random.
const f = Math.fround;
const key = (x, y, z) => `${x},${y},${z}`;
const STONE = 3;
const K = { Task, TargetBase: class extends Task { constructor(m) { super(); this.m = m; } range() { return 16; } startExecuting() {} } };
const V = villageTasks(K);

function build(seed, walled, start) {
  const doors = new Set(), stone = new Set(), roofs = [[40, 0, 49, 100]];
  const host = {
    rand: new JavaRandom(seed),
    isWoodenDoor: (x, y, z) => doors.has(key(x, y, z)),
    doorFacing: () => 0,
    canSeeSky: (x, y, z) => !roofs.some((r) => x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3]),
    hasSolidTop: (x, y) => y < 0,
    isNormalCube: (x, y) => y < 0,
    countEntities: () => 0,
    spawnGolem() {},
  };
  const c = new VillageCollection(host);
  for (let i = 0; i < 12; i++) { const x = 50 + (i % 5), z = 50 + Math.trunc(i / 5) * 3; doors.add(key(x, 0, z)); doors.add(key(x, 1, z)); }
  for (let t = 0; t < 5; t++) { if (t % 60 === 0) c.addVillagerPosition(52, 0, 52); c.tick(); }
  if (walled) {
    const sx = Math.floor(start[0]), sz = Math.floor(start[1]);
    for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) for (let y = 0; y <= 2; y++) if (x || z || y === 2) stone.add(key(sx + x, y, sz + z));
  }
  const world = { get: (x, y, z) => (y < 0 || stone.has(key(x, y, z)) ? STONE : doors.has(key(x, y, z)) ? WOODEN_DOOR : 0), getMeta: (x, y, z) => (doors.has(key(x, y, z)) && y === 1 ? 8 : 0) };
  return { c, world };
}

test("EntityAIMoveThroughVillage replays 120 native records (door choice, visited list by coordinates, flag left alone)", () => {
  const rows = reference.records.filter((r) => r.case === "throughVillage");
  assert.equal(rows.length, 120);
  let started = 0, rebuilt = 0;
  for (const r of rows) {
    const { c, world } = build(80 + (r.variant === 2 ? 1 : 0), r.variant === 2, r.start);
    const village = c.villages[0];
    assert.deepEqual(village.doors.map((d) => [d.x, d.y, d.z]), r.doors, "door order");
    const m = { type: "zombie", e: { type: "zombie", homeRadius: -1, home: null }, x: r.start[0], y: 0, z: r.start[1], width: f(0.6), height: f(1.8), onGround: true, inWater: false, inLava: false,
      rand: new JavaRandom(r.seed), maxSafePointTries: () => 3, getBlockPathWeight: () => 0,
      ai: { isDaytime: () => r.day, ew: { villages: c } } };
    m.distSq = (o) => (m.x - o.x) ** 2 + (m.y - o.y) ** 2 + (m.z - o.z) ** 2;
    m.navigator = new PathNavigate(m, world, { followRange: 40 });
    m.navigator.setBreakDoors(r.flag);
    const task = new V.MoveThroughVillage(m, 1.0, r.nocturnal);
    r.rounds.forEach(([ret, door, flagA, end, flagC, noPathC, cont, flagD, visited], round) => {
      const tag = `v${r.variant} rebuild ${r.rebuild} day ${r.day} noct ${r.nocturnal} flag ${r.flag} seed ${r.seed} round ${round}`;
      if (r.rebuild && round === 3) { village.doors = village.doors.map((d) => new VillageDoorInfo(d.x, d.y, d.z, d.insideX, d.insideZ, d.lastActivity)); rebuilt++; }
      assert.equal(task.shouldExecute(), ret, `${tag} shouldExecute`);
      assert.deepEqual(task.door ? [task.door.x, task.door.y, task.door.z] : null, door, `${tag} door`);
      assert.equal(m.navigator.canPassClosedDoors, flagA, `${tag} flag after a()`);
      const pe = task.path?.getFinalPathPoint();
      if (ret) {
        assert.deepEqual(pe ? [pe.x, pe.y, pe.z] : null, end, `${tag} path end`);
        task.startExecuting();
        started++;
        assert.equal(m.navigator.canPassClosedDoors, flagC, `${tag} flag after c()`);
        assert.equal(m.navigator.noPath(), noPathC, `${tag} noPath`);
        if (round % 3 !== 2) { m.x = door[0] + 0.5; m.y = 0; m.z = door[2] + 2.5; }
        assert.equal(task.continueExecuting(), cont, `${tag} continue`);
        task.resetTask();
      }
      assert.equal(m.navigator.canPassClosedDoors, flagD, `${tag} flag after d()`);
      assert.deepEqual(task.visited.map((d) => [d.x, d.y, d.z]), visited, `${tag} visited`);
      m.x = r.start[0]; m.y = 0; m.z = r.start[1];
      m.navigator.clearPathEntity();
    });
    assert.equal(m.rand.nextInt(1000000), r.next, "next draw");
  }
  assert.ok(started > 100 && rebuilt === 48, `${started} ${rebuilt}`);
});

test("the visited list is trimmed to 15 and matches doors by coordinates", () => {
  const { c, world } = build(80, false, [46.5, 46.5]);
  const m = { e: { type: "zombie" }, x: 46.5, y: 0, z: 46.5, width: f(0.6), rand: new JavaRandom(1), ai: { isDaytime: () => false, ew: { villages: c } }, navigator: new PathNavigate({ x: 0, y: 0, z: 0, onGround: true, width: 0.6, height: 1.8, maxSafePointTries: () => 3 }, world), distSq: () => 0, getBlockPathWeight: () => 0 };
  const t = new V.MoveThroughVillage(m, 1, true);
  for (let i = 0; i < 17; i++) t.visited.push(new VillageDoorInfo(i, 0, 0, 0, 0, 0));
  t.shouldExecute();
  assert.equal(t.visited.length, 16, "one entry drops per call");
  assert.ok(t.wasVisited({ x: 5, y: 0, z: 0 }) && !t.wasVisited({ x: 5, y: 1, z: 0 }));
});
