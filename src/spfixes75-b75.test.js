// Batch 75 spfixes75: bonus chest torches that cannot stay drop as items, the death throw angle is taken per hit, an enchanting table's
// CustomName goes with its block (every removal path) and rides with its column in chunk-resident saves.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Survival } from "./survival.js";
import { deathThrow, attackedAtOf, hitPoseSource } from "./death-throw.js";
import { placeBonusChest } from "./bonus-world.js";
import { JavaRandom } from "./java-random.js";
import { populationBlockMapperReady } from "./population-world.js";
import { TORCH, ENCHANTING_TABLE } from "./world.js";
import { forgetTableName, pruneTableNames } from "./tile-names.js";
import { splitRuntime, joinRuntime, separateContainers, validateContainerColumns, hasRuntime } from "./chunk-runtime.js";
import { createCommandHost } from "./command-host.js";
import { createCommandRunner } from "./commands.js";
import { World } from "./world.js";
import { applyExplosion } from "./explosion-simulation.js";
import { ItemEntities } from "./item-entities.js";
import { ExperienceOrbs } from "./experience.js";
import { Projectiles } from "./projectiles.js";
import { Arrows } from "./bow.js";
await populationBlockMapperReady;

const near = (a, b, e = 2e-4) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);

test("bonus chest: a torch whose cell has no support is not placed and a torch item is owed there", () => {
  const STONE = 3, cells = new Map();
  const key = (x, y, z) => `${x},${y},${z}`;
  // Ground only on even z columns (y <= 3): the chest stands on it, the torches north and south of it hang over nothing.
  const base = (x, y, z) => (y <= 3 && ((z % 2) + 2) % 2 === 0 ? STONE : 0);
  const world = {
    get: (x, y, z) => cells.get(key(x, y, z)) ?? base(x, y, z), getMeta: (x, y, z) => 0,
    solid: (x, y, z) => (cells.get(key(x, y, z)) ?? base(x, y, z)) !== 0,
    set: (x, y, z, id) => { cells.set(key(x, y, z), id); return true; },
  };
  const record = { bonusChest: true, worldSpawn: [8, 4, 8] };
  const res = placeBonusChest(world, record, { random: new JavaRandom(7) });
  assert.equal(res.placed, true);
  assert.equal(res.drops.length, 2);
  for (const d of res.drops) {
    assert.equal(d.id, TORCH);
    assert.equal(world.get(d.x, d.y, d.z), 0, "nothing placed at the dropped torch's cell");
    assert.equal(d.z % 2 !== 0, true);
  }
});

test("death throw uses the player's position and yaw at the hit, not at death", () => {
  hitPoseSource.get = () => ({ x: 0, z: 0, yawDeg: 37 });
  try {
    const s = new Survival({}, "survival");
    s.damage(2, "mob", false, undefined, { x: 5, z: 0 }); // attacker east when hit
    assert.ok(Number.isFinite(s.attackedAt.rel));
    hitPoseSource.get = null;
    // At death the player stands elsewhere and looks elsewhere: the stored angle (0 - 37) plus the yaw at death decides.
    const t = deathThrow(s.attackedAt, { x: 100, z: -40 }, 37 + 90);
    near(t.x, -Math.cos(((0 - 37 + 37 + 90) * Math.PI) / 180) * 0.1);
    near(t.z, -Math.sin((90 * Math.PI) / 180) * 0.1);
    // Without a pose the b74 behaviour (angle taken at death) stays.
    const s2 = new Survival({}, "survival");
    s2.damage(2, "mob", false, undefined, { x: 5, z: 0 });
    assert.deepEqual(s2.attackedAt, { from: { x: 5, z: 0 } });
  } finally { hitPoseSource.get = null; }
  assert.deepEqual(attackedAtOf(false, { x: 1, z: 1 }, Math.random, { x: 0, z: 0, yawDeg: 10 }), { rel: 0 });
});

test("forgetTableName and pruneTableNames drop names of blocks that are no longer tables", () => {
  const s = { tableNames: { "1,2,3": "A", "4,5,6": "B", "7,8,9": "C" } };
  assert.equal(forgetTableName(s, "1,2,3", ENCHANTING_TABLE), false);
  assert.equal(forgetTableName(s, "1,2,3", 0), true);
  assert.equal(pruneTableNames(s, (x) => (x === 4 ? 0 : x === 7 ? null : ENCHANTING_TABLE)), 1); // 7 is unloaded: kept
  assert.deepEqual(s.tableNames, { "7,8,9": "C" });
});

test("an enchanting table (resistance 2000) survives a big blast and keeps its name; the removal hook stays for any path that does break it", () => {
  const blocks = new Map([["1,10,0", ENCHANTING_TABLE]]), k = "1,10,0", rnd = () => 0.5;
  const world = { height: 256, get: (x, y, z) => blocks.get(`${x},${y},${z}`) || 0, getMeta: () => 0, solid(x, y, z) { return this.get(x, y, z) !== 0; }, set(x, y, z, id) { if (id) blocks.set(`${x},${y},${z}`, id); else blocks.delete(`${x},${y},${z}`); return true; } };
  const survival = { health: 20, creative: false, furnaces: {}, chests: {}, tableNames: { [k]: "Named" }, scaledDamage: () => true };
  const out = applyExplosion({ world, random: new JavaRandom(1), mobs: { entities: [], damage() {}, hazard() {} }, items: new ItemEntities(rnd), xpOrbs: new ExperienceOrbs([], rnd), arrows: new Arrows(rnd), projectiles: new Projectiles(rnd), falling: { explode() {} }, primed: [], survival, position: { x: 30, y: 10, z: 30 }, velocity: { x: 0, y: 0, z: 0 }, farming: { observe() {} } }, { x: 0.5, y: 10.5, z: 0.5, size: 8 });
  assert.equal(out.changes.some(([x, y, z]) => `${x},${y},${z}` === k), false, "native resistance 2000: a size-8 blast cannot break it");
  assert.equal(world.get(1, 10, 0), ENCHANTING_TABLE);
  assert.equal(survival.tableNames[k], "Named");
});

test("chunk-resident saves keep table names per column and old metadata names migrate", () => {
  const record = { id: "w", player: { chests: {}, furnaces: {}, tableNames: { "3,64,3": "Near", "40,64,-5": "Far", "41,64,-5": "Far2" } } };
  const { metadata, columns } = splitRuntime(record);
  assert.equal(metadata.player.tableNames, undefined, "no longer in world metadata");
  const byCol = Object.fromEntries(columns.map((c) => [`${c.x},${c.z}`, c.state.tableNames]));
  assert.deepEqual(byCol["0,0"], { "3,64,3": "Near" });
  assert.deepEqual(byCol["2,-1"], { "40,64,-5": "Far", "41,64,-5": "Far2" });
  const { containers } = separateContainers(columns);
  validateContainerColumns(containers, containers.map((c) => [c.x, c.z]));
  const back = joinRuntime(metadata, columns);
  assert.deepEqual(back.player.tableNames, record.player.tableNames);
  assert.equal(hasRuntime({ player: { tableNames: { "1,1,1": "x" } } }), true);
  // Only the far column loaded: only its names come back (the near column's name stays in its own column).
  const partial = joinRuntime(metadata, columns.filter((c) => c.x === 2));
  assert.deepEqual(partial.player.tableNames, { "40,64,-5": "Far", "41,64,-5": "Far2" });
  assert.throws(() => validateContainerColumns([{ x: 0, z: 0, state: { tableNames: { "40,64,-5": "wrong column" } } }], [[0, 0]]));
});

test("/setblock over a named enchanting table drops its name; a table with a CustomName tag takes it", () => {
  const world = new World("spfixes75", "meadow", 1), survival = new Survival({}, "creative"), active = { mode: "creative", allowCommands: true };
  const host = createCommandHost({ active: () => active, world: () => world, survival: () => survival, position: () => ({ x: 30.5, y: 60, z: 30.5 }),
    changed() {}, updateBlock() {}, refreshInventory() {}, stackName: () => "x", giveDrop() {}, setTime() {}, destroyBlock(x, y, z) { world.set(x, y, z, 0); } });
  host.print = () => {};
  const run = createCommandRunner(host).run;
  run('/setblock 10 60 10 enchanting_table 0 replace {CustomName:"Study"}');
  assert.equal(survival.tableNames["10,60,10"], "Study");
  run("/setblock 10 60 10 enchanting_table 0 replace"); // same block and metadata: setBlock returns false, the tile (and name) stays
  assert.equal(survival.tableNames["10,60,10"], "Study");
  run("/setblock 10 60 10 stone 0 replace");
  run("/setblock 10 60 10 enchanting_table 0 replace");
  assert.equal(survival.tableNames["10,60,10"], undefined, "a fresh table starts unnamed");
  survival.tableNames["10,60,10"] = "Stale";
  run("/setblock 10 60 10 stone 0 replace");
  assert.equal(survival.tableNames["10,60,10"], undefined);
});
