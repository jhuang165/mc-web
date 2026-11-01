import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initializeAllBiomeGenerators, WorldChunkManager, BIOMES_TO_SPAWN_IN, EdgeLayer } from "./biome-layers.js";
import { BIOME_LIST, B, getBiome } from "./java-biomes.js";
import { mul, add, H, L, toBig, stringHash } from "./java-long.js";
import { JavaRandom } from "./lighting.js";

const reference = JSON.parse(readFileSync(new URL("../public/research/biome-layers-reference.json", import.meta.url)));
const records = (kind) => reference.records.filter((r) => r.kind === kind);

test("long multiply and add wrap like Java longs", () => {
  let s = 0x9e3779b97f4a7c15n;
  const next = () => (s = BigInt.asUintN(64, s * 6364136223846793005n + 1442695040888963407n));
  const split = (v) => [Number(BigInt.asIntN(32, v >> 32n)), Number(BigInt.asIntN(32, v))];
  for (let i = 0; i < 2000; i++) {
    const a = next(), b = i % 7 === 0 ? 0xffffffffffffffffn : next();
    mul(...split(a), ...split(b));
    assert.equal(BigInt.asUintN(64, toBig(H, L)), BigInt.asUintN(64, a * b));
    add(...split(a), ...split(b));
    assert.equal(BigInt.asUintN(64, toBig(H, L)), BigInt.asUintN(64, a + b));
  }
  // default_1_1 was recorded for the "Overworld".hashCode() seed first.
  assert.equal(stringHash("Overworld"), Number(records("ints").find((r) => r.type === "default_1_1").seed));
});

test("the biome registry matches BiomeGenBase, including slot 161's id-160 biome", () => {
  const { biomes, fields } = records("biomes")[0];
  assert.equal(BIOME_LIST.filter(Boolean).length, biomes.length);
  for (const r of biomes) {
    const b = BIOME_LIST[r.index];
    const cls = reference.classes[r.class].name.replace(/^BiomeGen/, "");
    assert.deepEqual(
      [b.id, b.name, b.cls, b.temperature, b.rainfall, b.rootHeight, b.heightVariation, b.category, b.snowy, b.rainfallInt, b.topBlock, b.topMeta, b.fillerBlock],
      [r.id, r.name, cls, ...[r.temperature, r.rainfall, r.rootHeight, r.heightVariation].map(Math.fround), r.category, r.snowy, r.rainfallInt, ...r.top, r.filler[0]],
      `slot ${r.index}`);
    assert.equal(r.enableSnow, r.snowy);
    assert.equal(r.mesa, cls === "Mesa");
  }
  assert.equal(getBiome(161).id, 160);
  assert.equal(getBiome(-1), BIOME_LIST[0]);
  assert.equal(getBiome(200), null);
  const letters = "o p q r s t u v w x y z A B C D E F G H I J K L M N O P Q R S T U V W X Y Z aa ab".split(" ");
  assert.deepEqual(Object.values(B), letters.map((f) => fields[f]));
});

test("every layer of the stack has the client's seeds, wiring and cells", () => {
  for (const g of records("graph")) {
    const [mix, voronoi, again] = initializeAllBiomeGenerators(BigInt(g.seed), g.type);
    assert.equal(again, mix);
    const nodes = [], ids = new Map();
    const inputs = (l) => [l.parent, l.river].filter(Boolean);
    const visit = (l) => {
      if (ids.has(l)) return;
      ids.set(l, nodes.length);
      nodes.push(l);
      for (const p of inputs(l)) visit(p);
    };
    visit(mix);
    visit(voronoi);
    assert.deepEqual([ids.get(mix), ids.get(voronoi), ids.get(mix)], g.roots);
    assert.equal(nodes.length, g.nodes.length, g.type);
    nodes.forEach((n, i) => {
      const want = g.nodes[i];
      assert.equal(n.base.toString(), want.base, `${g.type} node ${i} base`);
      assert.equal(n.worldSeed.toString(), want.world, `${g.type} node ${i} world seed`);
      assert.deepEqual(inputs(n).map((p) => ids.get(p)), want.inputs, `${g.type} node ${i} inputs`);
      if (n instanceof EdgeLayer) assert.equal(n.mode, want.mode);
      assert.deepEqual(Array.from(n.getInts(-6, -6, 12, 12)), want.ints, `${g.type} node ${i} (${want.class})`);
    });
  }
});

test("river mix and voronoi cells match for every seed and world type", () => {
  const rs = records("ints");
  assert.equal(rs.length, 24);
  for (const r of rs) {
    const [mix, voronoi] = initializeAllBiomeGenerators(BigInt(r.seed), r.type);
    for (const [x, z, w, h, ints] of r.mix) assert.deepEqual(Array.from(mix.getInts(x, z, w, h)), ints, `${r.seed} ${r.type} mix ${x},${z}`);
    for (const [x, z, w, h, ints] of r.voronoi) assert.deepEqual(Array.from(voronoi.getInts(x, z, w, h)), ints, `${r.seed} ${r.type} voronoi ${x},${z}`);
  }
});

test("WorldChunkManager lookups, rainfall, viability and spawn search match", () => {
  const ids = (biomes) => biomes.map((b) => b.id);
  for (const r of records("manager")) {
    const m = new WorldChunkManager(BigInt(r.seed), r.type);
    assert.deepEqual(r.spawnBiomes, BIOMES_TO_SPAWN_IN);
    const [gx, gz, gw, gh, gen] = r.generation;
    assert.deepEqual(ids(m.biomesForGeneration(gx, gz, gw, gh)), gen);
    for (const [x, z, w, h, cache, want] of r.blocks) assert.deepEqual(ids(m.biomeArea(x, z, w, h, cache === 1)), want);
    for (const [x, z, id] of r.at) assert.equal(m.biomeAt(x, z).id, id, `${x},${z}`);
    const [rx, rz, rw, rh, rain] = r.rainfall;
    assert.deepEqual(m.rainfall(rx, rz, rw, rh), rain.map(Math.fround));
    for (const [x, z, radius, ok] of r.viable) assert.equal(m.areBiomesViable(x, z, radius, BIOMES_TO_SPAWN_IN), ok, `${x},${z},${radius}`);
    r.find.forEach(([x, z, radius, pos, nextLong], i) => {
      const random = new JavaRandom(BigInt(r.seed) + BigInt(i));
      assert.deepEqual(m.findBiomePosition(x, z, radius, BIOMES_TO_SPAWN_IN, random), pos);
      const after = BigInt.asIntN(64, (BigInt(random.next(32)) << 32n) + BigInt(random.next(32)));
      assert.equal(after, BigInt(nextLong));
    });
  }
});
