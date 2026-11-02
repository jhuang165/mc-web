import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { JavaRandom } from "./java-random.js";
import { ChunkProviderGenerate, BiomeTerrainState } from "./terrain-generator.js";
import { MapGenCaves, MapGenRavine } from "./mapgen.js";
import { randomLong } from "./mapgen.js";
import { WorldGenLakes } from "./lake-generator.js";
const ref = JSON.parse(readFileSync(new URL("../public/research/lake-reference.json", import.meta.url)));
const materials = new Map(ref.materials.map(([id, solid, liquid]) => [id, {solid, liquid}]));
const mod = (a,b) => ((a % b) + b) % b;
class Fixture {
  constructor(r) {
    this.name = r.fixture; this.ground = Math.min(r.pos[1],64);
    this.chunks = new Map(); this.edits = new Map(); this.writes = []; this.calls = createHash("sha1"); this.callCount = 0;
  }
  call(...args) {
    this.callCount++; const bytes = Buffer.alloc(args.length * 4);
    args.forEach((v,i) => bytes.writeInt32LE(v,i*4)); this.calls.update(bytes);
  }
  getBlock(x,y,z) {
    this.call(0,x,y,z);
    if (y < 0 || y >= 256 || x < -30000000 || z < -30000000 || x >= 30000000 || z >= 30000000) return 0;
    const key = `${x},${y},${z}`; if (this.edits.has(key)) return this.edits.get(key);
    if (this.name === "natural") return this.chunks.get(`${x>>4},${z>>4}`)[((x&15)*16+(z&15))*256+y];
    switch (this.name) {
      case "air": return 0;
      case "water": return 9;
      case "flowingWater": return 8;
      case "lava": return 11;
      case "flowingLava": return 10;
      case "hollow": return mod(x+z,5) === 0 ? 0 : 1;
      case "plants": return mod(x+z,5) === 0 ? 31 : 1;
      case "lowerWater": return y < this.ground ? 9 : 1;
      case "lowerLava": return y < this.ground ? 11 : 1;
      case "solid": return 1;
      default: return y > this.ground ? 0 : y >= this.ground - 3 ? 3 : 1;
    }
  }
  setBlock(x,y,z,id,meta,flags) {
    this.call(1,x,y,z,id,meta,flags);
    if (y < 0 || y >= 256 || x < -30000000 || z < -30000000 || x >= 30000000 || z >= 30000000) return false;
    this.edits.set(`${x},${y},${z}`,id); this.writes.push([x,y,z,id,meta,flags]); return true;
  }
  isSolid(id) { return materials.get(id).solid; }
  isLiquid(id) { return materials.get(id).liquid; }
  getSkyLight(x,y,z) { this.call(2,x,y,z); return this.name === "dark" ? 0 : 15; }
  biomeTop(x,z) { this.call(3,x,z); return this.name === "mycelium" ? 110 : 2; }
  canFreeze(x,y,z) { this.call(4,x,y,z); return this.name === "cold" && mod(x+z,3) === 0; }
}
function replay(r) {
  const w = new Fixture(r), random = new JavaRandom(r.seed);
  if (r.fixture === "natural") {
    const terrain = new ChunkProviderGenerate(BigInt(r.worldSeed), "default", new BiomeTerrainState());
    const topAt = (x,z) => terrain.biomeState.topBlock(terrain.manager.biomeAt(x,z));
    const caves = new MapGenCaves(BigInt(r.worldSeed),terrain.manager,topAt), ravines = new MapGenRavine(BigInt(r.worldSeed),terrain.manager,topAt);
    for (const [x,z,sha1] of r.inputs) {
      const {blocks} = terrain.provideChunk(x,z); caves.generate(x,z,blocks); ravines.generate(x,z,blocks);
      const bytes = Buffer.alloc(blocks.length*2); blocks.forEach((v,i)=>bytes.writeUInt16LE(v,i*2));
      assert.equal(createHash("sha1").update(bytes).digest("hex"),sha1,`natural input ${r.worldSeed} ${x},${z}`);
      w.chunks.set(`${x},${z}`,blocks);
    }
  }
  const label = JSON.stringify([r.fixture,r.seed,r.liquid,r.pos]);
  assert.equal(new WorldGenLakes(r.liquid).generate(w,random,...r.pos),r.result,label);
  assert.deepEqual(w.writes,r.writes,label);
  assert.equal(w.callCount,r.callCount,label);
  assert.equal(w.calls.digest("hex"),r.callSha1,label);
  assert.equal(randomLong(random).toString(),r.nextLong,label);
}
test("GEN-04 lakes: native water/lava cavities, rim RNG, grass/mycelium, dark and freeze service calls", () => {
  const fixtures = new Set(["solid","surface","dark","mycelium","cold"]);
  for (const r of ref.records.filter(r => fixtures.has(r.fixture))) replay(r);
  assert.ok(ref.records.some(r => r.fixture === "mycelium" && r.writes.some(w => w[3] === 110)));
  assert.ok(ref.records.some(r => r.fixture === "surface" && r.writes.some(w => w[3] === 2)));
  assert.ok(ref.records.some(r => r.fixture === "cold" && r.writes.some(w => w[3] === 79)));
});
test("GEN-04 lakes: liquid material vetoes, exact same-fluid identity, non-solid lower boundaries and air descent", () => {
  const fixtures = new Set(["solid","surface","dark","mycelium","cold"]);
  for (const r of ref.records.filter(r => !fixtures.has(r.fixture) && r.fixture !== "natural")) replay(r);
  for (const name of ["water","flowingWater","lava","flowingLava","hollow","plants"])
    assert.ok(ref.records.some(r => r.fixture === name && !r.result && r.writes.length === 0));
  assert.ok(ref.records.some(r => r.fixture === "lowerWater" && r.liquid === 9 && r.result));
  for (const [fixture,liquid] of [["lowerWater",8],["lowerWater",11],["lowerLava",10],["lowerLava",9]])
    assert.ok(ref.records.some(r => r.fixture === fixture && r.liquid === liquid && !r.result));
});

test("GEN-04 lakes: exact replay across native terrain/surface/cave/ravine chunk boundaries", () => {
  const records = ref.records.filter(r => r.fixture === "natural");
  assert.equal(records.length,12);
  for (const r of records) replay(r);
  assert.ok(records.some(r => r.result && r.writes.length > 0));
  assert.ok(records.some(r => !r.result));
});
