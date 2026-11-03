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
import { POWER_SOURCES } from "./mineshaft-world.js";

const SIDE_DX = [0, 0, 0, 0, -1, 1], SIDE_DY = [-1, 1, 0, 0, 0, 0], SIDE_DZ = [0, 0, -1, 1, 0, 0];
// Jungle temple redstone (sticky piston, wire, lever, repeater, tripwire hook and wire). With relaxRedstone
// their onBlockAdded / onNeighborBlockChange / breakBlock hooks are skipped: block writes stay exact only while
// nothing is powered, and the world-call stream is not claimed (see public/research/structure-area.md).
const REDSTONE_PUZZLE = new Set([29, 55, 69, 93, 131, 132]);
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
  constructor({ seed, chunkX, chunkZ, size = 1, terrain, manager, worldRandSeed = 0n, options = {}, traceWorldRand = false, relaxRedstone = false }) {
    if (seed === undefined || !Number.isInteger(chunkX) || !Number.isInteger(chunkZ) || !Number.isInteger(size) || size < 1)
      throw new TypeError("StructurePopulationArea needs seed, integer origin, and positive size");
    if (typeof terrain !== "function" || !manager) throw new TypeError("StructurePopulationArea needs terrain(x,z) and a biome manager");
    this.seed = BigInt(seed); this.chunkX = chunkX; this.chunkZ = chunkZ; this.size = size;
    this.terrain = terrain; this.manager = manager; this.traceWorldRand = traceWorldRand; this.relaxRedstone = relaxRedstone;
    const Base = mineshaftGenWorldClass(), area = this;
    this.world = new (class extends Base {
      chunkExists() { return true; }
      // The web that a water spring washes away drops string in native World.
      dropBlockAsItem(id, x, y, z, meta, fortune) {
        if (id !== 30) return super.dropBlockAsItem(id, x, y, z, meta, fortune);
        if (this.rand.nextFloat() <= 1) this.spawnItem(x, y, z, 287, 1, 0);
      }
      // BlockDoor (64 wooden, 71 iron) onNeighborBlockChange as ItemDoor.func_150924_a triggers it: the
      // neighbour is the door itself, so only the support checks and the power reads run.
      neighborChanged(id, x, y, z, source) {
        if (area.relaxRedstone && REDSTONE_PUZZLE.has(id)) return undefined;
        if (id !== 64 && id !== 71) return super.neighborChanged(id, x, y, z, source);
        const meta = this.getBlockMetadata(x, y, z);
        if ((meta & 8) === 0) {
          let broke = false;
          if (this.getBlock(x, y + 1, z) !== id) { this.setBlockToAir(x, y, z); broke = true; }
          if (!this.solidTopAt(x, y - 1, z)) {
            this.setBlockToAir(x, y, z); broke = true;
            if (this.getBlock(x, y + 1, z) === id) this.setBlockToAir(x, y + 1, z);
          }
          if (broke) throw new Error(`structure door fell at ${x},${y},${z}: its drop is unported`);
          const powered = this.indirectlyPowered(x, y, z) || this.indirectlyPowered(x, y + 1, z);
          if (source !== id && (powered || POWER_SOURCES.includes(source))) throw new Error("structure door power change is unported");
        } else {
          if (this.getBlock(x, y - 1, z) !== id) this.setBlockToAir(x, y, z);
          if (source !== id) this.neighborChanged(id, x, y - 1, z, source);
        }
      }
      // World.isBlockIndirectlyGettingPowered (v), getIndirectPowerLevelTo (g), getBlockPowerInput (u) and
      // getStrongestIndirectPower side reads (e), with the power functions of the unpressed stone plate
      // (the only provider these structures leave next to a power query). Others stay unported.
      indirectlyPowered(x, y, z) {
        for (let side = 0; side < 6; side++) {
          if (this.indirectPowerLevelTo(x + SIDE_DX[side], y + SIDE_DY[side], z + SIDE_DZ[side], side) > 0) return true;
        }
        return false;
      }
      indirectPowerLevelTo(x, y, z, side) {
        if (this.isNormalCube(this.getBlock(x, y, z))) {
          let power = 0;
          for (let s = 0; s < 6; s++) {
            const ax = x + SIDE_DX[s], ay = y + SIDE_DY[s], az = z + SIDE_DZ[s], id = this.getBlock(ax, ay, az);
            power = Math.max(power, this.providedPower(id, ax, ay, az, s, true));
            if (power >= 15) return power;
          }
          return power;
        }
        return this.providedPower(this.getBlock(x, y, z), x, y, z, side, false);
      }
      providedPower(id, x, y, z, side, strong) {
        if (id === 70) return (!strong || side === 1) && this.getBlockMetadata(x, y, z) > 0 ? 15 : 0;
        if (POWER_SOURCES.includes(id)) throw new Error(`structure redstone power from block ${id} is unported`);
        return 0;
      }
      // BlockFurnace.func_149930_e / BlockDispenser.func_149938_m: face away from an opaque side.
      containerFacing(x, y, z) {
        const op = (id) => this.isOpaqueCube(id);
        const north = this.getBlock(x, y, z - 1), south = this.getBlock(x, y, z + 1), west = this.getBlock(x - 1, y, z), east = this.getBlock(x + 1, y, z);
        let meta = 3;
        if (op(north) && !op(south)) meta = 3;
        if (op(south) && !op(north)) meta = 2;
        if (op(west) && !op(east)) meta = 5;
        if (op(east) && !op(west)) meta = 4;
        this.setBlockMetadata(x, y, z, meta, 2);
      }
      blockAdded(id, x, y, z) {
        // BlockContainer.onBlockAdded is only its super call; BlockFlowerPot adds nothing.
        if (id === 140 || (area.relaxRedstone && REDSTONE_PUZZLE.has(id))) return undefined;
        // BlockTNT.onBlockAdded: a powered TNT block would prime itself; none is reachable in these structures.
        if (id === 46) { if (this.indirectlyPowered(x, y, z)) throw new Error("structure TNT power is unported"); return undefined; }
        if (id === 23 || id === 61 || id === 62) return this.containerFacing(x, y, z);
        return super.blockAdded(id, x, y, z);
      }
      // BlockButton.breakBlock only acts on a powered (metadata bit 8) button.
      breakBlock(id, x, y, z, meta) {
        if ((id === 77 && (meta & 8) === 0) || (area.relaxRedstone && REDSTONE_PUZZLE.has(id))) return undefined;
        return super.breakBlock(id, x, y, z, meta);
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
    this.world.blockAdded = (id, x, y, z) => [53, 67, 108, 109, 114, 128, 134, 135, 136].includes(id)
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
      const row = { chunk: [x, z], callCount, callsSha1: calls.digest("hex"), writeCount, writesSha1: writes.digest("hex"), nextLong: randomLong(random).toString(), ...(this.traceWorldRand ? { worldNextLong: randomLong(world.rand).toString() } : {}), village: result.village, events: result.events };
      this.steps.push(row); hooks.afterPopulate?.(row, result, random);
    }
    return this;
  }
}
