// Batch 80: NetherGenWorld's BlockFire.canNeighborBurn and World.doesBlockHaveSolidTopSurface, replayed against
// the executed 1.7.10 fire table and the 160 BlockFire placement fixtures in fire-reference.json
// (tools/probes/FireProbe.java over the unchanged alb / ahb classes; ids are native 1.7.10 block ids).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NetherGenWorld, FIRE_ENCOURAGEMENT } from "./nether-generator.js";
import { JavaRandom } from "./lighting.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/fire-reference.json", import.meta.url)));
const empty = { generateChunk: (x, z) => ({ blocks: new Uint16Array(32768), x, z }) };

// A NetherGenWorld holding a fixture's cells (native 128-high layout, all in chunk 0, 0) and an empty halo.
function fixtureWorld(cells, seed) {
  const blocks = new Uint16Array(32768);
  for (let i = 0; i < cells.length; i += 5) {
    const [x, y, z, id, meta] = cells.slice(i, i + 5);
    assert.equal(meta, 0);
    blocks[(x * 16 + z) * 128 + y] = id;
  }
  const w = new NetherGenWorld({ rand: new JavaRandom(BigInt(seed)), halo: empty });
  w.addNetherChunk({ blocks, x: 0, z: 0 });
  return w;
}

test("FIRE_ENCOURAGEMENT is the executed chanceToEncourageFire column for every 1.7.10 block id", () => {
  assert.equal(ref.table.length, 171);
  for (const [id, enc] of ref.table) assert.equal(FIRE_ENCOURAGEMENT[id] ?? 0, enc, `block ${id}`);
  assert.equal(Object.keys(FIRE_ENCOURAGEMENT).length, ref.table.filter((e) => e[1] > 0).length);
});

test("hasSolidTopSurface matches doesBlockHaveSolidTopSurface (meta 0) for every 1.7.10 block id", () => {
  const w = fixtureWorld([], 0);
  for (const e of ref.table) {
    const [id] = e;
    if (id === 0 || id === 51) continue;
    const blocks = new Uint16Array(32768);
    blocks[(4 * 16 + 4) * 128 + 3] = id;
    w.addNetherChunk({ blocks, x: 0, z: 0 });
    assert.equal(w.hasSolidTopSurface(4, 3, 4) ? 1 : 0, e[9], `block ${id}`);
  }
});

test("canNeighborBurn reads x+1, x-1, y-1, y+1, z-1, z+1 and stops at the first flammable neighbour", () => {
  const w = fixtureWorld([4, 4, 3, 17, 0, 4, 4, 5, 5, 0], 0); // a log at z - 1, planks at z + 1
  const reads = [];
  w.onCall = (kind, x, y, z) => { if (kind === 0) reads.push([x, y, z]); };
  assert.equal(w.canNeighborBurn(4, 4, 4), true);
  assert.deepEqual(reads, [[5, 4, 4], [3, 4, 4], [4, 3, 4], [4, 5, 4], [4, 4, 3]]);
  reads.length = 0;
  const bare = fixtureWorld([4, 3, 4, 20, 0], 0);
  bare.onCall = w.onCall;
  assert.equal(bare.canNeighborBurn(4, 4, 4), false);
  assert.equal(reads.length, 6);
});

test("BlockFire placement fixtures: canPlaceBlockAt and onBlockAdded (removal or the 30 + nextInt(10) tick)", () => {
  assert.equal(ref.place.length, 160);
  let removed = 0, unsupported = 0;
  for (const c of ref.place) {
    const w = fixtureWorld(c.cells, c.seed);
    const solid = w.hasSolidTopSurface(4, 3, 4);
    if (!solid) unsupported++;
    assert.equal(solid || w.canNeighborBurn(4, 4, 4) ? 1 : 0, c.can, `seed ${c.seed} canPlaceBlockAt`);
    const ops = [];
    // The probe's World subclass writes its map without neighbour notifications, so only the fire cell's own
    // operations are compared (GenWorld's setBlockToAir also notifies the fixture's water, which schedules).
    w.onCall = (kind, x, y, z, id, a) => {
      if (x !== 4 || y !== 4 || z !== 4) return;
      if (kind === 5) ops.push(`t,${x},${y},${z},${a}`);
      if (kind === 1 && id === 0) ops.push(`a,${x},${y},${z}`);
    };
    w.blockAdded(51, 4, 4, 4);
    assert.deepEqual(ops, c.added, `seed ${c.seed} onBlockAdded`);
    assert.equal(w.rand.nextInt(1000000), c.next, `seed ${c.seed} world Random after`);
    if (ops[0]?.startsWith("a")) removed++;
  }
  // The fixtures exercise both branches of the neighbour test, not only the solid floor.
  assert.ok(unsupported > 20 && removed > 10, `${unsupported} unsupported, ${removed} removed`);
});
