// Batch 61 mpnether: the Nether on the dedicated multiplayer server (client side and the world class both sides share).
//
// The dedicated protocol sends a finite world (8 x 8 columns, 0..127) as `columns`. A Nether replica is the same kind of world, but a column holds Nether
// terrain and the world answers like the Nether (no sky, 128 high, Hell biome). FiniteDimensionWorld builds no terrain of its own: the server fills it from
// the single-player Nether generator (DimensionWorld.generateTerrainChunk, same layout `(lx * 16 + lz) * 256 + y`) and the client decodes the columns it is sent.
// Wire messages (all prefixed `dim`): `dimRespawn` (S07 Respawn plus the new world) and the `dim` field of a welcome world snapshot.
import { World, BLOCKS } from '../world.js';
import { decodeColumn } from './protocol.js';

export const NETHER = -1;
export const NETHER_BIOME = Object.freeze({ id: 8, name: 'Hell', rainfall: 0, snowy: false, temperature: 2, topBlock: 150 });

export class FiniteDimensionWorld extends World {
  static pending = 0;
  constructor(seed, dimension = NETHER) {
    FiniteDimensionWorld.pending = dimension; // World's constructor calls generate() before this class's fields exist
    super(seed, 'java', 9);
  }
  // Called by World's constructor: the empty columns exist already; only the dimension's own rules are set (as DimensionWorld.generate does).
  generate() {
    this.dimension = FiniteDimensionWorld.pending;
    this.isEnd = false; this.isHell = true; this.hasNoSky = true; // aqo.f / aqo.g: the Nether
    this.originX = this.originZ = 0;
    this.biomeAt = () => NETHER_BIOME;
    this.temperatureAt = () => 2;
    this.seaLevel = 32;
  }
  // World.getActualHeight: 128 in the Nether; the build limit stays 256.
  get actualHeight() { return 128; }
  // A dry spot to stand on (DimensionWorld.spawn): the first safe netherrack floor near the middle of this finite world.
  spawn() {
    for (let r = 0; r < 64; r++) for (let x = 64 - r; x <= 64 + r; x++) for (const z of [64 - r, 64 + r]) {
      if (x < 0 || x > 127 || z < 0 || z > 127) continue;
      for (let y = 40; y < 120; y++) if (this.get(x, y, z) === 0 && this.get(x, y + 1, z) === 0 && this.solid(x, y - 1, z) && this.get(x, y - 1, z) !== 11) return { x: x + 0.5, y: y + 0.01, z: z + 0.5 };
    }
    return { x: 64.5, y: 64, z: 64.5 };
  }
}

// The client's copy of a dimension world from a snapshot (`welcome.world` or `dimRespawn.world`): the Overworld snapshot has no `dimension`.
export function restoreDimensionReplica(snapshot) {
  const world = new FiniteDimensionWorld(snapshot.seed, snapshot.dimension);
  if (snapshot.columns.length !== world.chunks.size) throw new Error('Unsupported multiplayer world');
  const seen = new Set();
  for (const packet of snapshot.columns) {
    const key = `${packet.x},${packet.z}`, column = world.chunks.get(key);
    if (!column || seen.has(key)) throw new Error('Invalid multiplayer column');
    decodeColumn(packet, column, BLOCKS.length); seen.add(key);
  }
  return world;
}
