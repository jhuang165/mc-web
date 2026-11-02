import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { JavaRandom } from "./java-random.js";
import { randomLong } from "./mapgen.js";
import { mhSin, mhCos } from "./lighting.js";
import {
  WorldGenTrees, WorldGenBigTree, WorldGenForest, WorldGenSwamp, WorldGenTaiga1, WorldGenTaiga2, WorldGenMegaJungle,
  WorldGenMegaPineTree, WorldGenShrub, WorldGenSavannaTree, WorldGenCanopyTree, WorldGenBigMushroom,
  BIOME_TREE_PICKERS, BiomeTrees, pickTree, pickGrassMeta,
  GRASS, DIRT, FARMLAND, MYCELIUM, WATER, FLOWING_WATER, LOG, LOG2, LEAVES, LEAVES2, SAPLING, VINE, COCOA, BROWN_MUSHROOM_BLOCK, TALL_GRASS,
} from "./tree-generators.js";
const ref = JSON.parse(readFileSync(new URL("../public/research/tree-generators-reference.json", import.meta.url)));
const opaque = new Set(ref.config.opaque);
const mod = (a, b) => ((a % b) + b) % b;
const int32 = (hash, values) => { const b = Buffer.alloc(values.length * 4); values.forEach((v, i) => b.writeInt32LE(v, i * 4)); hash.update(b); };
const out = (x, y, z) => y < 0 || y >= 256 || x < -30000000 || z < -30000000 || x >= 30000000 || z >= 30000000;
// The probe's synthetic fixture (TreeGeneratorProbe.cell).
function mix(x, z) {
  let h = (Math.imul(x, 0x2F0B3A49) + Math.imul(z, 0x6C8E9CF5)) | 0;
  h ^= h >>> 15; h = Math.imul(h, 0x2C1B3C6D); h ^= h >>> 12; return h;
}
const SURFACE = [2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 60, 110, 110, 12, 1, 2], SWAMP = [2, 3, 3, 2, 12, 2, 3, 1], OBSTACLE = [17, 18, 161, 106, 6, 1, 31, 162];
const top = (x, z) => (x >= 2000 ? 250 : 62 + mod(mix(Math.floor(x / 5), Math.floor(z / 5)), 2));
function cell(x, y, z) {
  const d = mix(x, z);
  if (x >= 1000 && x < 2000) {
    const floor = ((d >>> 16) & 63) === 0 ? 62 : ((d >>> 4) & 3) === 0 ? 59 : 60;
    if (y < floor - 2) return 1; if (y < floor) return 3; if (y === floor) return SWAMP[(d >>> 8) & 7];
    if (y <= 61) return ((d >>> 12) & 7) === 0 ? 8 : 9;
    return ((d >>> 4) & 63) === 1 && y === 62 + ((d >>> 20) & 7) ? OBSTACLE[(d >>> 24) & 7] : 0;
  }
  const t = top(x, z);
  if (y < t - 3) return 1; if (y < t) return 3; if (y === t) return x >= 2000 ? 2 : SURFACE[(d >>> 20) & 15];
  return ((d >>> 4) & 63) < 2 && y === t + 1 + ((d >>> 12) & 15) ? OBSTACLE[(d >>> 16) & 7] : 0;
}
class FixtureWorld {
  constructor() { this.edits = new Map(); this.calls = createHash("sha1"); this.callCount = 0; this.writes = createHash("sha1"); this.writeCount = 0; this.ids = new Map(); }
  getBlock(x, y, z) {
    this.callCount++; int32(this.calls, [0, x, y, z]);
    return out(x, y, z) ? 0 : this.edits.get(`${x},${y},${z}`) ?? cell(x, y, z);
  }
  setBlock(x, y, z, id, meta, flags) {
    this.callCount++; int32(this.calls, [1, x, y, z, id, meta, flags]);
    if (out(x, y, z)) return false;
    this.edits.set(`${x},${y},${z}`, id); this.writeCount++; int32(this.writes, [x, y, z, id, meta, flags]);
    const key = id * 16 + meta; this.ids.set(key, (this.ids.get(key) ?? 0) + 1);
    return true;
  }
  isOpaqueCube(id) { return opaque.has(id); }
}
const CONSTRUCTORS = {
  asq: (a) => new WorldGenTrees(...a), ard: (a) => new WorldGenBigTree(...a), are: (a) => new WorldGenForest(...a), aso: () => new WorldGenSwamp(),
  asf: () => new WorldGenTaiga1(), asn: (a) => new WorldGenTaiga2(...a), arz: (a) => new WorldGenMegaJungle(...a), asa: (a) => new WorldGenMegaPineTree(...a),
  arp: (a) => new WorldGenShrub(...a), ask: (a) => new WorldGenSavannaTree(...a), asi: (a) => new WorldGenCanopyTree(...a), aru: (a) => new WorldGenBigMushroom(...a),
};
// The probe's constructor-argument description of a generator.
function describe(g) {
  if (g instanceof WorldGenBigMushroom) return ["aru", g.type >= 0 ? [g.type] : []];
  if (g instanceof WorldGenShrub) return ["arp", [g.shrubWood, g.shrubLeaves]];
  if (g instanceof WorldGenTrees) return ["asq", [g.notify, g.minHeight, g.wood, g.leaves, g.vines]];
  if (g instanceof WorldGenMegaPineTree) return ["asa", [g.notify, g.pine]];
  if (g instanceof WorldGenMegaJungle) return ["arz", [g.notify, g.baseHeight, g.extraHeight, g.wood, g.leaves]];
  if (g instanceof WorldGenForest) return ["are", [g.notify, g.tall]];
  if (g instanceof WorldGenSwamp) return ["aso", []];
  if (g instanceof WorldGenTaiga1) return ["asf", []];
  for (const [cls, C] of [["ard", WorldGenBigTree], ["asn", WorldGenTaiga2], ["ask", WorldGenSavannaTree], ["asi", WorldGenCanopyTree]]) if (g instanceof C) return [cls, [g.notify]];
  throw new Error("unknown generator");
}
// Native owner fields to BiomeTrees keys: per-biome fields by slot, then class statics.
const FIELDS = { az: "trees", aA: "bigTree", aB: "swamp", aD: "taiga2" };
const STATICS = { "aif.aC": "forest:tallBirch", "aif.aD": "forest:birch", "aif.aE": "forest:roofed", "ais.aC": "savanna:acacia",
  "aiw.aC": "taiga:taiga1", "aiw.aD": "taiga:taiga2", "aiw.aE": "taiga:megaSpruce", "aiw.aF": "taiga:megaPine" };
const ownerKey = (o) => (o === null ? undefined : STATICS[o] ?? `${o.split(".")[0]}:${FIELDS[o.split(".")[1]]}`);

test("GEN-04 tree generators: native block identities and MathHelper table", () => {
  assert.deepEqual(ref.config.blocks, [GRASS, DIRT, FARMLAND, MYCELIUM, WATER, FLOWING_WATER, LOG, LOG2, LEAVES, LEAVES2, SAPLING, VINE, COCOA, BROWN_MUSHROOM_BLOCK, TALL_GRASS]);
  assert.deepEqual(ref.config.sinCos.map(Math.fround), [mhSin(1), mhCos(1)]);
});

test("GEN-04 tree generators: native writes, call order and Random stream", () => {
  const seen = new Set();
  for (const r of ref.records) {
    const label = JSON.stringify([r.generator, r.seed, r.origins]);
    const gen = CONSTRUCTORS[r.generator[0]](r.generator[1]), w = new FixtureWorld(), random = new JavaRandom(BigInt(r.seed));
    assert.deepEqual(describe(gen), r.generator, label);
    const results = r.origins.map(([x, y, z]) => {
      const before = w.writeCount;
      if (r.scale) gen.setScale(1, 1, 1);
      const ok = gen.generate(w, random, x, y, z);
      if (ok && r.post) gen.postGenerate?.(w, random, x, y, z);
      return [ok, w.writeCount - before];
    });
    assert.deepEqual(results, r.results, label);
    assert.equal(w.writeCount, r.writeCount, label);
    assert.equal(w.writes.digest("hex"), r.writeSha1, label);
    assert.deepEqual([...w.ids].sort((a, b) => a[0] - b[0]).map(([k, n]) => [k >> 4, k & 15, n]), r.writeIds, label);
    assert.equal(w.callCount, r.callCount, label);
    assert.equal(w.calls.digest("hex"), r.callSha1, label);
    assert.equal(randomLong(random).toString(), r.nextLong, label);
    const cls = r.generator[0];
    for (const [ok] of r.results) seen.add(`${cls}:${ok}`);
    if (r.results.length > 1 && r.results.every(([ok]) => ok)) seen.add(`${cls}:chained`);
    for (const [id, meta] of r.writeIds) {
      if (id === VINE) seen.add(`${cls}:vine`);
      if (id === COCOA) seen.add("cocoa");
      if (id === DIRT && meta === 2) seen.add("podzol");
      if (id === BROWN_MUSHROOM_BLOCK || id === BROWN_MUSHROOM_BLOCK + 1) seen.add(`mushroom:${id}`);
      if (id === LOG && (meta === 4 || meta === 8)) seen.add(`branch:${meta}`);
    }
  }
  for (const cls of Object.keys(CONSTRUCTORS)) {
    assert.ok(seen.has(`${cls}:true`), `${cls} grows`);
    if (cls !== "arp") assert.ok(seen.has(`${cls}:false`), `${cls} rejects`);
  }
  for (const k of ["asq:vine", "aso:vine", "arz:vine", "cocoa", "podzol", "mushroom:99", "mushroom:100", "branch:4", "branch:8", "ard:chained", "asa:chained"])
    assert.ok(seen.has(k), k);
});

test("GEN-04 tree generators: biome tree and grass pickers with shared generator identity", () => {
  const KIND = { aid: "extremeHills", aif: "forest", aig: "birchM", aij: "ice", aik: "jungle", ail: "mesa", ain: "mutated", aih: "mutated", ait: "mutated", ais: "savanna", aiv: "swamp", aiw: "taiga" };
  assert.deepEqual([...BIOME_TREE_PICKERS.keys()], ref.config.biomes.map(([slot]) => slot));
  for (const [slot, , cls, param] of ref.config.biomes) {
    const kind = KIND[cls] ?? "plain";
    assert.deepEqual(BIOME_TREE_PICKERS.get(slot), [kind, kind === "jungle" || kind === "forest" || kind === "taiga" || kind === "mutated" || kind === "birchM" ? param : -1], `slot ${slot}`);
  }
  const trees = new BiomeTrees(), seen = new Set();
  for (const p of ref.pickers) {
    const random = new JavaRandom(BigInt(p.seed)), label = `slot ${p.slot} seed ${p.seed}`;
    const picked = p.trees.map(() => pickTree(p.slot, random, trees));
    assert.deepEqual(picked.map((g) => [g.key, describe(g)]), p.trees.map(([o, d]) => [ownerKey(o), d]), label);
    assert.deepEqual(p.grass.map(() => [TALL_GRASS, pickGrassMeta(p.slot, random)]), p.grass, label);
    assert.equal(randomLong(random).toString(), p.nextLong, label);
    for (const [o] of p.trees) seen.add(o === null ? "new" : o.includes("a") && !/^\d/.test(o) ? "static" : "field");
  }
  for (const k of ["new", "static", "field"]) assert.ok(seen.has(k), k);
  // Mutated biomes hand out their base biome's objects: one shared BigTree per base slot.
  assert.equal(pickTree(130, new JavaRandom(9n), trees).key?.split(":")[0], "2");
});
