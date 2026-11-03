import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JavaRandom } from "./java-random.js";
import { StructurePopulation, STRUCTURE_POPULATE_ORDER, STRUCTURE_SEARCH_ORDER } from "./structure-population.js";
import { WorldChunkManager } from "./biome-layers.js";
import { randomLong } from "./structure-framework.js";

const native = JSON.parse(readFileSync(new URL("../public/research/structure-population-reference.json", import.meta.url)));

const names = ["mineshaft", "village", "stronghold", "scatteredFeature"];
const stageReference = JSON.parse(readFileSync(new URL("../public/research/population-stage-reference.json", import.meta.url)));
function fixture({ village = true } = {}) {
  const calls = [], results = { mineshaft: false, village, stronghold: true, scatteredFeature: false };
  const generators = Object.fromEntries(names.map((name) => [name, {
    distance: 32,
    structureMap: { size: 0 },
    canSpawnStructureAtCoords() { return false; },
    generate(x, z) { calls.push(["search", name, x, z]); },
    generateStructuresInChunk(world, random, x, z) { calls.push(["populate", name, world, random, x, z]); return results[name]; },
  }]));
  const world = { rand: new JavaRandom(1n), biome: () => ({ slot: 2 }) };
  const manager = { areBiomesViable: () => false, biomeAt: () => ({ slot: 2 }) };
  const population = new StructurePopulation({ worldSeed: 123n, manager, world, generators });
  return { population, calls, world, results };
}

test("ChunkProviderGenerate structure search order is terrain stage order", () => {
  const { population, calls } = fixture();
  population.searchChunk(-2, 7);
  assert.deepEqual(calls.map((c) => c.slice(0, 2)), STRUCTURE_SEARCH_ORDER.map((n) => ["search", n]));
  assert.ok(calls.every((c) => c[2] === -2 && c[3] === 7));
});

test("populate structures share one provider Random in native order and return village presence", () => {
  const { population, calls, world } = fixture();
  const random = new JavaRandom(77n), result = population.populateStructures(random, -3, 5);
  assert.deepEqual(calls.map((c) => c.slice(0, 2)), STRUCTURE_POPULATE_ORDER.map((n) => ["populate", n]));
  assert.ok(calls.every((c) => c[2] === world && c[3] === random && c[4] === -3 && c[5] === 5));
  assert.deepEqual(result, { mineshaft: false, village: true, stronghold: true, scatteredFeature: false });
});

test("village and scattered search preserve native World.setRandomSeed draw side effects", () => {
  const world = { rand: new JavaRandom(0n), biome: () => ({ slot: 2 }) };
  const manager = { areBiomesViable: () => false, biomeAt: () => ({ slot: 2 }) };
  const originalCalls = [];
  const p = new StructurePopulation({ worldSeed: 123n, manager, world,
    generators: Object.fromEntries(names.map((name) => [name, {
      distance: 32, structureMap: { size: 0 },
      canSpawnStructureAtCoords(x, z) { originalCalls.push([name, x, z]); return false; },
      generate() {}, generateStructuresInChunk() { return false; },
    }])) });
  const seed = (x, z, salt) => BigInt.asIntN(64, BigInt(x) * 341873128712n + BigInt(z) * 132897987541n + 123n + BigInt(salt));
  const x = -2, z = 7, cellX = Math.floor(x / 32), cellZ = Math.floor(z / 32);
  const expected = new JavaRandom(seed(cellX, cellZ, 14357617)); expected.nextInt(24); expected.nextInt(24);
  assert.equal(p.generators.scatteredFeature.canSpawnStructureAtCoords(x, z), false);
  assert.deepEqual(world.rand.save(), expected.save());
  assert.deepEqual(originalCalls, [["scatteredFeature", x, z]]);
  const expectedVillage = new JavaRandom(seed(cellX, cellZ, 10387312)); expectedVillage.nextInt(24); expectedVillage.nextInt(24);
  p.generators.village.canSpawnStructureAtCoords(x, z);
  assert.deepEqual(world.rand.save(), expectedVillage.save());
  assert.deepEqual(originalCalls.at(-1), ["village", x, z]);
});

test("native ChunkProviderGenerate searches all four structure maps in order and leaves native World.rand state", () => {
  for (const row of native.records) {
    const seed = BigInt(row.seed), [x, z] = row.chunk;
    const world = { rand: new JavaRandom(0n) };
    const generator = new StructurePopulation({ worldSeed: seed, manager: new WorldChunkManager(seed, "default"), world });
    assert.deepEqual(generator.searchChunk(x, z), Object.fromEntries(names.map((name) => [name, row.structures[name].size])));
    assert.deepEqual(Object.keys(generator.generators), names);
    assert.deepEqual(STRUCTURE_SEARCH_ORDER, row.searchOrder);
    for (const name of names) {
      const expected = row.structures[name].keys.map((key) => JSON.parse(key));
      assert.deepEqual(generator.generators[name].structureMap.keys(), expected, `${name} native map order for seed ${row.seed}`);
    }
    assert.equal(randomLong(world.rand).toString(), row.worldNextLong, `World.rand after seed ${row.seed} search`);
  }
});

test("populateChunk matches native pre-decoration draws and village presence suppresses both lakes", () => {
  const row = stageReference.records.find((r) => r.kind === "stage" && r.worldSeed === "0" && r.chunk[0] === 0 && r.chunk[1] === -1 && r.mode === "none");
  assert.ok(row, "native no-structure stage fixture");
  const world = {
    biome: () => ({ slot: 1 }), getBlock: (_x, y) => y <= 63 ? 1 : 0,
    isSolid: (id) => id === 1, isLiquid: () => false, isAirBlock: (_x, y) => y > 63,
    setBlock() {}, setBlockToAir() {}, getTileEntity: () => null,
    getSkyLight: () => 15, biomeTop: () => 2, canFreeze: () => false,
  };
  const manager = { areBiomesViable: () => false, biomeAt: () => ({ slot: 1 }) };
  const injected = (village) => Object.fromEntries(names.map((name) => [name, {
    distance: 32, structureMap: { size: 0 }, canSpawnStructureAtCoords: () => false,
    generate() {}, generateStructuresInChunk() { return name === "village" && village; },
  }]));
  const trace = [], noVillage = new StructurePopulation({ worldSeed: 0n, manager, world, generators: injected(false) })
    .populateChunk(new JavaRandom(0n), row.chunk[0], row.chunk[1], { trace });
  // Our flat adapter allows the water lake to succeed and consume its generator
  // RNG, so compare the unchanged native provider draws through both lake inputs.
  assert.deepEqual(trace.slice(0, 9), row.draws.slice(0, 9));
  const lakeKinds = noVillage.events.map(([kind]) => kind).filter((kind) => kind === "water" || kind === "lava");
  assert.deepEqual(lakeKinds, ["water", "lava"], "no village permits both native lake paths in this fixture");
  const withVillage = new StructurePopulation({ worldSeed: 0n, manager, world, generators: injected(true) })
    .populateChunk(new JavaRandom(0n), row.chunk[0], row.chunk[1]);
  assert.equal(withVillage.village, true);
  assert.ok(withVillage.events.every(([kind]) => kind === "dungeon"), "village presence suppresses water and lava lakes");
});
