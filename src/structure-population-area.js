// Standalone native ChunkProviderGenerate area replay with all four map features.
// Intentionally separate from PopulationArea/java-world: this is research and is
// never selected by a live generation version.
import { createHash } from "node:crypto";
import { mineshaftGenWorldClass } from "./mineshaft-world.js";
import { JavaRandom } from "./java-random.js";
import { BiomeDecoration } from "./biome-decorator.js";
import { populateTail } from "./population-tail.js";
import { StructurePopulation } from "./structure-population.js";
import { randomLong } from "./structure-framework.js";

const key = (x, z) => `${x},${z}`;
const hashInts = (values) => {
  const hash = createHash("sha1"), buf = Buffer.allocUnsafe(4);
  for (const n of values) { buf.writeInt32LE(n | 0); hash.update(buf); }
  return hash.digest("hex");
};
export function structureChunkSha1(chunk) {
  const values = [];
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) for (let y = 0; y < 256; y++)
    values.push(chunk.getBlock(x, y, z) | (chunk.getMeta(x, y, z) << 12));
  return hashInts(values);
}

export class StructurePopulationArea {
  constructor({ seed, chunkX, chunkZ, size = 1, terrain, manager, worldRandSeed = 0n, options = {} }) {
    if (seed === undefined || !Number.isInteger(chunkX) || !Number.isInteger(chunkZ) || !Number.isInteger(size) || size < 1)
      throw new TypeError("StructurePopulationArea needs seed, integer origin, and positive size");
    if (typeof terrain !== "function" || !manager) throw new TypeError("StructurePopulationArea needs terrain(x,z) and a biome manager");
    this.seed = BigInt(seed); this.chunkX = chunkX; this.chunkZ = chunkZ; this.size = size;
    this.terrain = terrain; this.manager = manager;
    const Base = mineshaftGenWorldClass();
    this.world = new (class extends Base {
      chunkExists() { return true; }
      // The web that a water spring washes away drops string in native World.
      dropBlockAsItem(id, x, y, z, meta, fortune) {
        if (id !== 30) return super.dropBlockAsItem(id, x, y, z, meta, fortune);
        if (this.rand.nextFloat() <= 1) this.spawnItem(x, y, z, 287, 1, 0);
      }
      spawnEntity(e) {
        if (e.type === "MinecartChest") this.carts.push(e); else this.animals.push(e);
        this.onEntity?.(e); return true;
      }
    })({ rand: new JavaRandom(worldRandSeed), terrain });
    this.world.biomeAt = (x, z) => manager.biomeAt(x, z);
    // This standalone structure fixture only needs callback behavior for these
    // structure blocks. Their native placements have no observable added/broken
    // side effects in the checked worlds; ordered writes and final chunks below
    // stay pinned to the native world probe.
    const blockAdded = this.world.blockAdded.bind(this.world);
    this.world.blockAdded = (id, x, y, z) => [46, 53, 67, 108, 109, 114, 128, 134, 135, 136].includes(id)
      ? undefined : blockAdded(id, x, y, z);
    const breakBlock = this.world.breakBlock.bind(this.world);
    this.world.breakBlock = (id, x, y, z, meta) => [53, 67, 108, 109, 114, 128, 134, 135, 136].includes(id)
      ? undefined : breakBlock(id, x, y, z, meta);
    this.world.animals = [];
    this.world.getTopSolidOrLiquid = (x, z) => this.world.getTopSolidOrLiquidBlock(x, z);
    this.world.getAverageGroundLevel = () => 64;
    this.world.notifyBlocksOfNeighborChange = (x, y, z, source) => this.world.notifyNeighbors(x, y, z, source);
    this.population = new StructurePopulation({ worldSeed: this.seed, manager, world: this.world, options });
    this.decoration = new BiomeDecoration();
    this.order = []; this.searchRows = []; this.steps = [];
  }

  run(hooks = {}) {
    const { world, chunkX, chunkZ, size, seed } = this;
    // ChunkProviderServer provides every chunk (terrain + cave/ravine + all four
    // start searches) before the first population callback in this bounded area.
    for (let x = chunkX; x < chunkX + size; x++) for (let z = chunkZ; z < chunkZ + size; z++) {
      const chunk = world.chunk(x, z), inputSha1 = structureChunkSha1(chunk);
      const starts = this.population.searchChunk(x, z);
      this.searchRows.push({ chunk: [x, z], inputSha1, starts });
    }
    const random = new JavaRandom(seed);
    for (let x = chunkX; x < chunkX + size; x++) for (let z = chunkZ; z < chunkZ + size; z++) {
      this.order.push([x, z]); hooks.beforePopulate?.(x, z, random);
      world.onCall = null; world.onWrite = null;
      const calls = createHash("sha1"), writes = createHash("sha1");
      let callCount = 0, writeCount = 0;
      world.onCall = (...args) => { callCount++; calls.update(Buffer.from(args.flatMap((v) => [v & 255, v >> 8 & 255, v >> 16 & 255, v >> 24 & 255]))); };
      world.onWrite = (x0, y0, z0, id, meta, flags) => {
        writeCount++; writes.update(Buffer.from([x0, y0, z0, id, meta, flags].flatMap((v) => [v & 255, v >> 8 & 255, v >> 16 & 255, v >> 24 & 255])));
      };
      const result = this.population.populateChunk(random, x, z);
      populateTail(world, random, this.decoration, x, z, result.biome.slot);
      const row = { chunk: [x, z], callCount, callsSha1: calls.digest("hex"), writeCount, writesSha1: writes.digest("hex"), nextLong: randomLong(random).toString(), village: result.village, events: result.events };
      this.steps.push(row); hooks.afterPopulate?.(row, result, random);
    }
    return this;
  }
}
