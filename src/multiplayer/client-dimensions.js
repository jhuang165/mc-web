// Batch 61 mpnether: the Nether on the dedicated multiplayer server (client side and the world class both sides share).
//
// The dedicated protocol sends a finite world (8 x 8 columns, 0..127) as `columns`. A Nether replica is the same kind of world, but a column holds Nether
// terrain and the world answers like the Nether (no sky, 128 high, Hell biome). FiniteDimensionWorld builds no terrain of its own: the server fills it from
// the single-player Nether generator (DimensionWorld.generateTerrainChunk, same layout `(lx * 16 + lz) * 256 + y`) and the client decodes the columns it is sent.
// Wire messages (all prefixed `dim`): `dimRespawn` (S07 Respawn plus the new world) and the `dim` field of a welcome world snapshot.
import { World, BLOCKS } from '../world.js';
import { decodeColumn } from './protocol.js';

export const NETHER = -1, END = 1;
// Batch 63 mpend: the End. The finite world is 128 x 128 (the light volume is hard-wired to that grid), but the native End spawn platform (100, 49, 0) lies 100 blocks from the origin, so the
// replica holds the window x -25..102, z -96..31 of the End: End coordinates (X, Z) are stored at (X + 25, Z + 96). The platform, the island's +x part and the origin (the exit portal) are inside.
export const END_OFFSET = Object.freeze({ x: 25, z: 96 });
// Batch 65 mpendwindow: a 256 x 256 End ('full'), native x -128..127, z -128..127 stored at (X + 128, Z + 128). World.size / LightVolume.size make the grid width a property of the world, so the
// whole main island (end stone from about x -120 to 136, z -160 to 120 depending on the seed), the spike pillars with their crystals and the platform at (100, 49, 0) are inside it. An End saved
// by 0.93.0 is the 128 x 128 window above ('legacy') and keeps loading as it is; a snapshot without `window` is a legacy End too.
export const END_WINDOWS = Object.freeze({ legacy: Object.freeze({ size: 128, x: END_OFFSET.x, z: END_OFFSET.z }), full: Object.freeze({ size: 256, x: 128, z: 128 }) });
export const endWindow = name => END_WINDOWS[name] ?? END_WINDOWS.legacy;
export const END_BIOME = Object.freeze({ id: 9, name: 'Sky', rainfall: 0, snowy: false, temperature: 0.5, topBlock: 152 });
export const NETHER_BIOME = Object.freeze({ id: 8, name: 'Hell', rainfall: 0, snowy: false, temperature: 2, topBlock: 150 });

export class FiniteDimensionWorld extends World {
  static pending = 0;
  static pendingWindow = 'legacy';
  // World's constructor asks for the grid width before it builds the columns (b65 mpendwindow).
  static windowSize() { return FiniteDimensionWorld.pending === END ? endWindow(FiniteDimensionWorld.pendingWindow).size : 128; }
  constructor(seed, dimension = NETHER, window = 'legacy') {
    FiniteDimensionWorld.pending = dimension; // World's constructor calls generate() before this class's fields exist
    FiniteDimensionWorld.pendingWindow = window;
    super(seed, 'java', 9);
  }
  // Called by World's constructor: the empty columns exist already; only the dimension's own rules are set (as DimensionWorld.generate does).
  generate() {
    this.dimension = FiniteDimensionWorld.pending;
    const end = this.dimension === END; // b63: the End has no sky and no hell flag (BiomeGenEnd 'Sky', temperature 0.5)
    this.isEnd = end; this.isHell = !end; this.hasNoSky = true; // aqo.f / aqo.g: the Nether (hell) or the End (no sky only)
    // b64 mpend2: the End replica is a shifted window, but the world's origin names where it lies in the End (native = local + origin), so the code that reads native coordinates (the eye of
    // ender's stronghold search, structure and chunk lookups) and F3 (displayX / displayZ) see the End's own coordinates. Positions on the wire stay window-local (the replica predicts in them).
    this.endWindow = end ? (endWindow(FiniteDimensionWorld.pendingWindow) === END_WINDOWS.full ? 'full' : 'legacy') : null; // b65: which End window this replica holds
    const at = end ? endWindow(this.endWindow) : null;
    this.originX = end ? -at.x : 0; this.originZ = end ? -at.z : 0;
    this.displayX = this.originX; this.displayZ = this.originZ;
    this.biomeAt = () => (end ? END_BIOME : NETHER_BIOME);
    this.temperatureAt = () => (end ? 0.5 : 2);
    this.seaLevel = end ? 0 : 32;
  }
  // World.getActualHeight: 128 in the Nether; the build limit stays 256.
  get actualHeight() { return 128; }
  // A dry spot to stand on (DimensionWorld.spawn): the first safe netherrack floor near the middle of this finite world.
  spawn() {
    if (this.dimension === END) return { x: 100.5 - this.originX, y: 49.01, z: 0.5 - this.originZ }; // WorldProviderEnd entrance (100, 50, 0): the platform (dimension-world.js spawn)
    for (let r = 0; r < 64; r++) for (let x = 64 - r; x <= 64 + r; x++) for (const z of [64 - r, 64 + r]) {
      if (x < 0 || x >= 128 || z < 0 || z >= 128) continue;
      for (let y = 40; y < 120; y++) if (this.get(x, y, z) === 0 && this.get(x, y + 1, z) === 0 && this.solid(x, y - 1, z) && this.get(x, y - 1, z) !== 11) return { x: x + 0.5, y: y + 0.01, z: z + 0.5 };
    }
    return { x: 64.5, y: 64, z: 64.5 };
  }
}

// The client's copy of a dimension world from a snapshot (`welcome.world` or `dimRespawn.world`): the Overworld snapshot has no `dimension`.
export function restoreDimensionReplica(snapshot) {
  const world = new FiniteDimensionWorld(snapshot.seed, snapshot.dimension, snapshot.window); // b65: `window` is the End's layout (absent: the 0.93.0 window)
  if (snapshot.columns.length !== world.chunks.size) throw new Error('Unsupported multiplayer world');
  const seen = new Set();
  for (const packet of snapshot.columns) {
    const key = `${packet.x},${packet.z}`, column = world.chunks.get(key);
    if (!column || seen.has(key)) throw new Error('Invalid multiplayer column');
    decodeColumn(packet, column, BLOCKS.length); seen.add(key);
  }
  return world;
}
