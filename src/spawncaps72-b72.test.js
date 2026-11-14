// Batch 72 spawncaps72: no entity count caps on eggs, chicks, babies, silverfish and natural spawn hooks (only SPAWN_RUNAWAY_GUARD), dragon/crystal block the
// spawn box, stems use the caller's random, spawner counts include subclasses. Deterministic: no Math.random.
import { test } from "node:test";
import assert from "node:assert/strict";
import { EntityWorld, SPAWN_RUNAWAY_GUARD } from "./entities.js";
import { JavaRandom } from "./java-random.js";
import { countsAs } from "./mob-spawner.js";
import { Farming } from "./farming.js";

const flat = { numericSeed: 123, getMeta: () => 0, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), surface: () => 0, spawn: () => ({ x: 64, y: 0, z: 64 }) };

test("the shared guard is far above the old 40 and 256", () => {
  assert.ok(SPAWN_RUNAWAY_GUARD >= 5000);
});

test("createMob (egg, summon, natural) passes 40 and 256 mobs", () => {
  const m = new EntityWorld(flat, [], () => 0.5);
  const hooks = m.spawnerHooks({});
  for (let i = 0; i < 300; i++) { const e = hooks.createMob("cow", 10 + i, 0, 10, 0); assert.ok(e, `cow ${i}`); m.entities.push(e); }
  assert.equal(m.entities.length, 300);
  assert.equal(m.spawnerHooks({ limit: 3 }).createMob("cow", 0, 0, 0, 0), null); // an explicit limit (server wire cap) still applies
});

test("chicks, silverfish and babies are not capped at 40", () => {
  const m = new EntityWorld(flat, [], () => 0.5);
  for (let i = 0; i < 60; i++) m.entities.push(m.create("pig", i, 0, 0));
  assert.ok(m.hatch(1, 0, 1, 0));
  assert.ok(m.spawnSilverfishAt(2, 0, 2));
});

test("the dragon and an End crystal block the spawn box (a cow or any living mob does too)", () => {
  for (const type of ["ender_dragon", "ender_crystal", "cow"]) {
    const m = new EntityWorld(flat, [], () => 0.5);
    const hooks = m.spawnerHooks({});
    const probe = () => hooks.canSpawnHere(m.create("villager", 50, 0, 50)); // villager: space checks only
    assert.equal(probe(), true, "empty ground");
    m.entities.push(m.create(type, 50, 0, 50));
    assert.equal(probe(), false, type);
  }
});

test("spawner counts include subclasses", () => {
  assert.ok(countsAs("zombie", "pigman"));
  assert.ok(!countsAs("pigman", "zombie"));
  assert.ok(countsAs("cow", "mooshroom"));
  assert.ok(!countsAs("mooshroom", "cow"));
  assert.ok(countsAs("skeleton", "wither_skeleton"));
  assert.ok(countsAs("spider", "cave_spider"));
  assert.ok(!countsAs("zombie", "cow"));
});

test("stem growth draws from the caller's random", () => {
  const w = { edits: new Map(), cells: new Map([["5,1,5", [160, 0]]]), get(x, y, z) { return y === 0 ? 60 : (this.cells.get(`${x},${y},${z}`)?.[0] ?? 0); }, getMeta(x, y, z) { return this.cells.get(`${x},${y},${z}`)?.[1] ?? 0; }, set() {}, setMeta() {} };
  const f = new Farming(w);
  f.stemRandom = { nextInt() { throw new Error("own random used"); } };
  let draws = 0;
  const rng = { nextInt(n) { draws++; return 1; } };
  f.lightLevel = () => 15;
  f.randomTick(5, 1, 5, 160, rng);
  assert.ok(draws >= 1);
});
