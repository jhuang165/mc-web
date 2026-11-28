// Batch 102 mobrec102:
// 1. The b101 golem spawn-gating records (public/research/village-gate-b101-reference.json) replayed through the REAL EntityWorld on a REAL World (real chunks, real blocks for the doors,
//    floor, slabs, walls and the roof the probe's canSeeSky stood in for, the real heightmap canSeeSky, real entity sizes, spawnIronGolem joining ew.entities), not the b101 fake world.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EntityWorld } from "./entities.js";
import { JavaRandom } from "./java-random.js";
import { World, WOODEN_DOOR } from "./world.js";

const gate = JSON.parse(readFileSync(new URL("../public/research/village-gate-b101-reference.json", import.meta.url)));
const Y0 = 20; // probe y 0 is real y Y0; the probe's floor (every y < 0) is stone from y 0 to Y0 - 1
const STONE = 1;

export function realReplay(r) {
  const w = new World("gate102-" + r.name, "meadow");
  for (let x = 28; x <= 84; x++) for (let z = 0; z <= 100 && z < w.size; z++) {
    for (let y = 0; y < Y0; y++) w.set(x, y, z, STONE, false);
    for (let y = Y0; y < w.height; y++) w.set(x, y, z, 0, false);
  }
  for (let x = 40; x <= 49; x++) for (let z = 0; z <= 100 && z < w.size; z++) w.set(x, Y0 + 8, z, STONE, false); // the probe's roof x 40..49: real blocks, real sky test
  const ew = new EntityWorld(w, [], () => 0.5);
  // The probe's World.i(x, y, z) (canBlockSeeTheSky) is a roof rectangle (x 40..49) and ignores blocks: a `fill` record (stone over the doors) does not shade them natively.
  // The real heightmap sky would (a stone layer at y 1 roofs every door), so those records keep the probe's rule; the others use the real heightmap (the roof above is real stone).
  if (r.script.some((o) => o.split(" ")[1] === "fill")) ew.ai.deps.canSeeSky = (x) => !(x >= 40 && x <= 49);
  const rand = new JavaRandom(r.seed), nextInt = rand.nextInt.bind(rand), zero = [], draws = [];
  let tick = 0;
  rand.nextInt = (b) => { const v = nextInt(b); if (b === 7000 && v === 0) zero.push(tick); if (b === 16 || b === 6) draws.push([tick, b, v]); return v; };
  ew.worldRandom = rand;
  const c = ew.villages, spawns = [], snaps = [], golems = () => ew.entities.filter((e) => e.type === "iron_golem");
  const add = (type, x, y, z) => { const e = ew.create(type, x, y + Y0, z); e.growingAge = 0; ew.entities.push(e); return e; };
  for (tick = 0; tick <= r.ticks; tick++) {
    for (const op of r.script) {
      const p = op.split(" ");
      if (Number(p[0]) !== tick) continue;
      const n = p.slice(2).map(Number);
      if (p[1] === "door") { w.set(n[0], n[1] + Y0, n[2], WOODEN_DOOR, false, n[3]); w.set(n[0], n[1] + Y0 + 1, n[2], WOODEN_DOOR, false, 8); }
      else if (p[1] === "rmdoor") { w.set(n[0], n[1] + Y0, n[2], 0, false); w.set(n[0], n[1] + Y0 + 1, n[2], 0, false); }
      else if (p[1] === "vill") add("villager", n[0], n[1], n[2]);
      else if (p[1] === "golem") add("iron_golem", n[0], n[1], n[2]);
      else if (p[1] === "fill") for (let x = n[0]; x <= n[3]; x++) for (let y = n[1]; y <= n[4]; y++) for (let z = n[2]; z <= n[5]; z++) w.set(x, y + Y0, z, STONE, false);
    }
    const before = golems().length;
    if (tick % 60 === 0) c.addVillagerPosition(52, Y0, 52);
    c.tick();
    for (const g of golems().slice(before)) spawns.push([tick, g.x, g.y - Y0, g.z, c.villages[0].numGolems]);
    if (tick % 500 === 0) snaps.push([tick, c.villages.map((v) => [v.center[0], v.center[1] - Y0, v.center[2], v.radius, v.doors.length, v.numVillagers, v.numGolems])]);
  }
  return { ew, w, spawns, zero, draws, snaps, golems: golems() };
}

test("mobrec102 golem gate on the real EntityWorld: 20 records", () => assert.equal(gate.records.length, 20));
for (const r of gate.records) {
  test(`mobrec102 real-world golem gate: ${r.name} (Executed record, real World and EntityWorld)`, () => {
    const got = realReplay(r);
    assert.deepEqual(got.spawns, r.spawns, "spawns");
    assert.deepEqual(got.zero, r.zeroRolls, "nextInt(7000) == 0 ticks");
    assert.deepEqual(got.draws, r.draws, "spawn box search draws");
    assert.deepEqual(got.snaps, r.snaps, "village digests");
    // the golem really joined the entity list: a real iron golem with its health, standing in a loaded chunk of the real world, and the spawn is not player-created
    for (const g of got.golems.slice(r.script.filter((o) => o.includes(" golem ")).length)) {
      assert.equal(g.health, 100); assert.equal(g.playerCreated, false); assert.ok(got.w.isLoaded(g.x, g.z));
    }
  });
}

// ---- 2. the player's hurt-window countdown at the player's place in the entity walk ----
import { Survival } from "./survival.js";
function arena() {
  const cells = new Map();
  const world = { numericSeed: 1, get: (x, y, z) => cells.get(`${x},${y},${z}`) ?? (y < 0 ? 1 : 0), getMeta: () => 0, set: (x, y, z, b) => cells.set(`${x},${y},${z}`, b),
    solid: (x, y, z) => (cells.get(`${x},${y},${z}`) ?? (y < 0 ? 1 : 0)) !== 0, surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) };
  const ew = new EntityWorld(world, null, () => 0.5);
  return ew;
}
const player = { x: 50, y: 0, z: 50, health: 20, alive: true, isPlayer: true };
test("mobrec102 counters: without deferCounters Survival.tick counts the window down itself (every older caller)", () => {
  const s = new Survival({}, "survival"); s.protection = 20; s.hurtTicks = 20;
  s.tick();
  assert.equal(s.protection, 19); assert.equal(s.hurtTicks, 19);
});
test("mobrec102 counters: with deferCounters the countdown waits for the player's turn in EntityWorld.tick (native: EntityPlayerMP.onUpdate in the walk, after the previous network phase's effects)", () => {
  const s = new Survival({}, "survival"); s.deferCounters = true;
  const ew = arena();
  s.protection = 20; s.hurtTicks = 20;
  s.tick();
  assert.equal(s.protection, 20); assert.equal(s.hurtTicks, 20); assert.equal(s.countersOwed, true);
  ew.tick(player, s);
  assert.equal(s.protection, 19); assert.equal(s.hurtTicks, 19); assert.equal(s.countersOwed, false);
  s.tick(); ew.tick(player, s);
  assert.equal(s.protection, 18);
});
test("mobrec102 counters: a hit taken in the survival tick (poison, the network phase) is counted down once by the walk of the same tick, so a later mob hit sees 19, not 20", () => {
  const s = new Survival({}, "survival"); s.deferCounters = true;
  const ew = arena();
  s.tick();
  s.damage(1, "magic");
  const fresh = s.hurtTicks;
  ew.tick(player, s);
  assert.equal(s.hurtTicks, fresh - 1);
});
test("mobrec102 counters: a tick whose walk did not run settles the owed countdown at the next survival tick", () => {
  const s = new Survival({}, "survival"); s.deferCounters = true; s.protection = 20;
  s.tick(); s.tick();
  assert.equal(s.protection, 19);
  s.tick();
  assert.equal(s.protection, 18);
});
