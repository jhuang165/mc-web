import test from "node:test";
import assert from "node:assert/strict";
import reference from "../public/research/villager-polish-reference.json" with { type: "json" };
import { JavaRandom } from "./java-random.js";
import { VillageCollection } from "./village.js";
import { villageTasks, villagerParticles, setVisualRandom, visualRandom } from "./village-ai.js";
import { updateVillagerAI } from "./villager.js";
import { EntityWorld } from "./entities.js";
import { mobScale } from "./slime.js";
import { PathNavigate } from "./pathfinding.js";
import { Task } from "./ai.js";

// Replays tools/probes/VillagerPolishProbe.java (unchanged 1.7.10 classes): EntityVillager status 12/13/14 particles,
// the default-reputation flag in updateAITick, EntityAIMoveIndoors' biome/hasNoSky gate and the golem's nearbyOnly
// EntityAINearestAttackableTarget path check.
const records = (c) => reference.records.filter((r) => r.case === c);
const f = Math.fround;
const key = (x, y, z) => `${x},${y},${z}`;
const K = { Task, TargetBase: class extends Task { constructor(m) { super(); this.m = m; } range() { return this.m.navigator.followRange; } startExecuting() {} } };
const V = villageTasks(K);

test("villager happy/angry/heart particles: five (3 gaussian * 0.02, 3 float position) draws from the visual Random", () => {
  const names = { 12: "heart", 13: "angryVillager", 14: "happyVillager" };
  const rows = records("particles");
  assert.equal(rows.length, 72);
  for (const r of rows) {
    const e = { type: "villager", x: r.pos[0], y: r.pos[1], z: r.pos[2], growingAge: r.child ? -24000 : 0 };
    const scale = mobScale(e), spawned = [];
    const size = { width: f(0.6 * scale), height: f(1.8 * scale) };
    assert.deepEqual([size.width, size.height], r.size.map(f), "child size");
    setVisualRandom(e, new JavaRandom(r.seed));
    const m = { e, width: size.width, height: size.height, ai: { ew: { villageBurst: (name, ent, sz, rand) => EntityWorld.prototype.villageBurst.call({ fx: { spawn: (...a) => spawned.push(a) } }, name, ent, sz, rand) } } };
    villagerParticles(m, names[r.status]);
    assert.equal(spawned.length, 5);
    // Java's Double.toString writes 8.07E-4 where JS writes 0.000807: compare the numbers
    assert.deepEqual(spawned, r.particles.map((p) => { const [n, ...v] = p.split("|"); return [n, ...v.map(Number)]; }), `status ${r.status} seed ${r.seed}`);
    assert.ok(spawned.every((p) => p[0] === names[r.status]));
    assert.equal(visualRandom(e).nextInt(1000000), r.next, "next draw");
  }
});

test("the visual Random is per entity and never Entity.rand", () => {
  const a = { type: "villager" }, b = { type: "villager" };
  assert.equal(visualRandom(a), visualRandom(a));
  assert.notEqual(visualRandom(a), visualRandom(b));
});

function world(seed, doors) {
  const cells = new Set(), roofs = [[40, 0, 49, 100]];
  const host = {
    rand: new JavaRandom(seed),
    isWoodenDoor: (x, y, z) => cells.has(key(x, y, z)),
    doorFacing: () => 0,
    canSeeSky: (x, y, z) => !roofs.some((r) => x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3]),
    hasSolidTop: (x, y) => y < 0,
    isNormalCube: (x, y) => y < 0,
    countEntities: () => 0,
    spawnGolem() {},
  };
  const c = new VillageCollection(host);
  for (let i = 0; i < doors; i++) { const x = 50 + (i % 5), z = 50 + Math.trunc(i / 5) * 3; cells.add(key(x, 0, z)); cells.add(key(x, 1, z)); }
  for (let t = 0; t < 5; t++) { if (t % 60 === 0) c.addVillagerPosition(52, 0, 52); c.tick(); }
  return { c, host };
}

test("EntityVillager.updateAITick: the cd() flag gives every known player +5 once, only when a village is found", () => {
  const rows = records("defaultRep"), names = ["A", "B", "C", "D"];
  assert.equal(rows.length, 48);
  for (const r of rows) {
    const w = world(80 + r.variant, 12), village = w.c.villages[0];
    r.start.forEach((v, i) => village.changeReputation(names[i], v));
    const x = r.far ? 300.5 : 52.5;
    const m = { e: { type: "villager", defaultReputation: r.flag, homeRadius: -1, home: null }, x, y: 0, z: x, width: 0.6, height: 1.8, rand: new JavaRandom(r.seed), randomTickDivider: 0, village: null, ai: { ew: { villages: w.c } } };
    r.steps.forEach(([reps, flagAfter, divider], round) => {
      m.randomTickDivider = 0;
      updateVillagerAI(m);
      assert.deepEqual(names.map((n) => village.playerReputation(n)), reps, `variant ${r.variant} flag ${r.flag} far ${r.far} round ${round}`);
      assert.equal(!!m.e.defaultReputation, flagAfter, "flag after");
      assert.equal(m.randomTickDivider, divider, "next check delay");
    });
    assert.equal(m.rand.nextInt(1000000), r.next, "next draw");
  }
});

test("EntityAIMoveIndoors: clear daytime stops only in biomes that can rain; hasNoSky always stops (1920 native rows)", () => {
  const rec = records("moveIndoors")[0], can = new Map(rec.biomeFacts);
  assert.equal(rec.rows.length, 1920);
  for (const [dark, day, rain, biome, seed, expected, next] of rec.rows) {
    const w = world(70, 12), world2 = { hasNoSky: dark === 1, biomeAt: () => ({ rainfall: can.get(biome) ? 0.4 : 0, snowy: false }) };
    const a = { e: { type: "villager" }, x: 51.5, y: 0, z: 52.5, rand: new JavaRandom(seed), ai: { world: world2, ew: { villages: w.c }, isDaytime: () => day === 1, isRaining: () => rain === 1 }, navigator: {} };
    assert.equal(new V.MoveIndoors(a).shouldExecute(), expected, `dark ${dark} day ${day} rain ${rain} biome ${biome} seed ${seed}`);
    assert.equal(a.rand.nextInt(1000000), next);
  }
});

const STONE = 3;
function stoneWorld(r) {
  const cells = new Set();
  for (const [x0, y0, z0, x1, y1, z1] of r.stone)
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) if (!(r.hollow && x > 67 && x < 71 && z > 62 && z < 66 && y < 3)) cells.add(key(x, y, z));
  if (r.cell) { cells.delete(key(69, 0, 64)); cells.delete(key(69, 1, 64)); }
  return { get: (x, y, z) => (y < 0 || cells.has(key(x, y, z)) ? STONE : 0) };
}

test("golem monster target: the nearbyOnly path check (end within 1.5, cached on the task for 10 + nextInt(5) ticks)", () => {
  const rows = records("golemReach");
  assert.equal(rows.length, 128);
  let blocked = 0;
  for (const r of rows) {
    if (!r.nearbyOnly) { assert.ok(r.ticks.every((t) => t[0] === true && t[1] === 0 && t[2] === 0), "without nearbyOnly nothing is cached or drawn"); continue; }
    const golemEntity = { type: "iron_golem", x: 64.5, y: 0, z: 64.5, width: f(1.4), height: f(2.9), inWater: false, inLava: false, onGround: true, maxSafePointTries: () => 3 };
    const nav = new PathNavigate(golemEntity, stoneWorld(r), { followRange: 16 });
    nav.setAvoidsWater(true);
    const [zx, zy, zz] = r.zombie;
    const zombie = { alive: true, x: zx, y: zy, z: zz, width: f(0.6), height: f(1.8), e: { type: "zombie" }, isPlayer: false };
    const end = nav.getPathToEntityLiving(zombie)?.getFinalPathPoint();
    assert.deepEqual(end ? [end.x, end.y, end.z] : null, r.end, `${r.scene} path end`);
    const m = { e: { type: "iron_golem", playerCreated: false, homeRadius: -1, home: null }, x: 64.5, y: 0, z: 64.5, rand: new JavaRandom(r.seed), navigator: nav, attackTarget: null, ai: {}, distSq: (o) => (64.5 - o.x) ** 2 + (0 - o.y) ** 2 + (64.5 - o.z) ** 2, nearby: () => [zombie] };
    const task = new V.NearestMonster(m);
    r.ticks.forEach(([expected, state, counter], t) => {
      assert.equal(task.shouldExecute(), expected, `${r.scene} seed ${r.seed} tick ${t}`);
      assert.deepEqual([task.reach, task.reachTimer], [state, counter], `${r.scene} seed ${r.seed} tick ${t} cache`);
    });
    assert.equal(m.rand.nextInt(1000000), r.next, `${r.scene} seed ${r.seed} next draw`);
    if (!r.ticks[0][0]) blocked++;
  }
  assert.ok(blocked >= 32, "some scenes are unreachable");
});
