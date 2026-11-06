// SpawnerAnimals.findChunksForSpawning (aho.a(mt, ZZZ)) and canCreatureTypeSpawnAtLocation (aho.a(sx, ahb, III)) for
// Java 1.7.10, in the original World.rand draw order. The caller (entities.js naturalSpawn) supplies the world through
// `ctx`; this module owns only the control flow, the eligible-chunk order and the arithmetic. Checked against seeded native
// replays in public/research/spawn-lists-reference.json (spawner-animals.test.js). natural-spawning.md lists what differs.
import { CREATURE_TYPES } from "./spawn-lists.js";
import { weightedPick } from "./population-tail.js";

const f = Math.fround;

// ChunkCoordIntPair.hashCode (agu.hashCode).
export function chunkPairHash(x, z) {
  const i = (Math.imul(1664525, x) + 1013904223) | 0;
  const j = (Math.imul(1664525, z ^ -559038737) + 1013904223) | 0;
  return i ^ j;
}

// The HashMap<ChunkCoordIntPair, Boolean> eligibleChunksForSpawning (aho.a, one per WorldServer) as filled for one player in
// native chunk (pcx, pcz): dx outer, dz inner over -8..8, the outer ring marked true (no spawning there, but it counts for the
// cap; a ring chunk of another player stays false). java.util.HashMap iterates by bucket (hash ^ hash >>> 16, masked by the
// table size) and in insertion order inside a bucket. clear() keeps the table, so with one player it is 512 from the first fill on.
// Returns [dx, dz, edge] in iteration order.
export function eligibleChunkOrder(pcx, pcz, capacity = 512) {
  const rows = [];
  for (let dx = -8; dx <= 8; dx++) for (let dz = -8; dz <= 8; dz++) {
    const h = chunkPairHash(pcx + dx, pcz + dz), bucket = (h ^ (h >>> 16)) & (capacity - 1);
    rows.push([bucket, rows.length, dx, dz, dx === -8 || dx === 8 || dz === -8 || dz === 8]);
  }
  rows.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return rows.map(([, , dx, dz, edge]) => [dx, dz, edge]);
}

// canCreatureTypeSpawnAtLocation. `w` gives block(x, y, z) (this build's ids), normalCube(id), liquid(id), solidTop(x, y, z)
// (World.doesBlockHaveSolidTopSurface) and bedrock (the id).
export function canCreatureTypeSpawnAtLocation(type, w, x, y, z) {
  if (type.material === "water") return w.liquid(w.block(x, y, z)) && w.liquid(w.block(x, y - 1, z)) && !w.normalCube(w.block(x, y + 1, z));
  if (!w.solidTop(x, y - 1, z)) return false;
  const feet = w.block(x, y, z);
  return w.block(x, y - 1, z) !== w.bedrock && !w.normalCube(feet) && !w.liquid(feet) && !w.normalCube(w.block(x, y + 1, z));
}

// findChunksForSpawning(world, spawnHostileMobs, spawnPeacefulMobs, spawnAnimals); returns the native total. ctx:
//   rand                       World.rand (JavaRandom)
//   order                      [[cx, cz, edge]] in HashMap order (chunk coordinates of this world)
//   capChunks                  eligibleChunksForSpawning.size() (the port counts the usable chunks, see natural-spawning.md)
//   count(type)                World.countEntities(type's creature class), without persistent mobs
//   chunkTop(cx, cz, i)        Chunk.getTopFilledSegment (i is the index in order), or null for a chunk the browser does not
//                              simulate (skipped, no draws)
//   block, normalCube, liquid, solidTop, bedrock, isMaterial(type, id)   as for canCreatureTypeSpawnAtLocation
//   playerWithin(x, y, z)      World.getClosestPlayer(x, y, z, 24) != null
//   spawn                      the world spawn point {x, y, z} (ChunkCoordinates), or null
//   possibleCreatures(type, x, y, z)   WorldServer.spawnRandomCreature's list (null or empty: no entry)
//   create(name, x, y, z, yaw) a new mob after setLocationAndAngles(x, y, z, yaw, 0), or null
//   canSpawnHere(e)            EntityLiving.getCanSpawnHere
//   add(e)                     World.spawnEntityInWorld
//   onSpawn(e, data, name)     EntityLiving.onSpawnWithEgg(data), returning the next data
//   maxInChunk(name)           getMaxSpawnedInChunk
export function findChunksForSpawning(ctx, hostile, peaceful, animals) {
  if (!hostile && !peaceful) return 0;
  const { rand } = ctx;
  let total = 0;
  for (const type of CREATURE_TYPES) {
    if ((type.peaceful && !peaceful) || (!type.peaceful && !hostile) || (type.animal && !animals)) continue;
    if (ctx.count(type.name) > Math.trunc((type.max * ctx.capChunks) / 256)) continue;
    const order = ctx.order;
    chunks: for (let i = 0; i < order.length; i++) {
      const [cx, cz, edge] = order[i];
      if (edge) continue;
      const top = ctx.chunkTop(cx, cz, i);
      if (top === null) continue;
      // func_151350_a (getRandomSpawningPointInChunk).
      const x = cx * 16 + rand.nextInt(16), z = cz * 16 + rand.nextInt(16), y = rand.nextInt(top + 16 - 1);
      const id = ctx.block(x, y, z);
      if (ctx.normalCube(id) || !ctx.isMaterial(type, id)) continue;
      let spawned = 0;
      for (let group = 0; group < 3; group++) {
        let x1 = x, y1 = y, z1 = z, entry = null, data = null;
        for (let attempt = 0; attempt < 4; attempt++) {
          x1 += rand.nextInt(6) - rand.nextInt(6);
          y1 += rand.nextInt(1) - rand.nextInt(1);
          z1 += rand.nextInt(6) - rand.nextInt(6);
          if (!canCreatureTypeSpawnAtLocation(type, ctx, x1, y1, z1)) continue;
          const fx = f(x1 + 0.5), fy = y1, fz = f(z1 + 0.5);
          if (ctx.playerWithin(fx, fy, fz)) continue;
          if (ctx.spawn) {
            const dx = f(fx - ctx.spawn.x), dy = f(fy - ctx.spawn.y), dz = f(fz - ctx.spawn.z);
            if (f(f(f(dx * dx) + f(dy * dy)) + f(dz * dz)) < 576) continue;
          }
          if (entry === null) {
            const list = ctx.possibleCreatures(type, x1, y1, z1);
            entry = list && list.length ? weightedPick(rand, list) : null;
            if (entry === null) break;
          }
          const e = ctx.create(entry[0], fx, fy, fz, f(rand.nextFloat() * 360));
          if (e && ctx.canSpawnHere(e)) {
            spawned++;
            ctx.add(e);
            data = ctx.onSpawn(e, data, entry[0]);
            if (spawned >= ctx.maxInChunk(entry[0])) continue chunks;
          }
          total += spawned;
        }
      }
    }
  }
  return total;
}
