// Batch 41 (ringpiston): a hopper (or dropper) beside a chest of a never-resident ring chunk finds the generated loot (ring-chests.js).
import test from "node:test";
import assert from "node:assert/strict";
import { World } from "./world.js";
import { HeadlessColumns, attachRing } from "./headless-columns.js";
import { containerAt } from "./inventory-transfer.js";
import { seedRingChest } from "./ring-chests.js";
import { restoreChests } from "./population-runtime.js";
import { populationBlockMapperReady } from "./population-world.js";

await populationBlockMapperReady;

// The first generated chest outside the resident window, scanning population cells outward from the origin.
function findChest(world) {
  for (let ring = 1; ring < 6; ring++) {
    for (let a = -ring; a <= ring; a++) for (let b = -ring; b <= ring; b++) {
      if (Math.max(Math.abs(a), Math.abs(b)) !== ring) continue;
      for (const r of world.population.cell(a, b).records.values()) {
        const c = r.chests.find((t) => !world.isLoaded(t.x, t.z) && world.population.column(t.x >> 4, t.z >> 4).blocks[(((t.x & 15) * 16) + (t.z & 15)) * 256 + t.y] === 41);
        if (c) return c;
      }
    }
  }
  return null;
}
const contents = (inv) => { const out = []; for (let i = 0; i < inv.size; i++) if (inv.get(i)) out.push(i); return out; };

test("a hopper-style read of a never-resident generated chest sees its loot once, and the later hand-over does not overwrite it", { timeout: 300000 }, () => {
  const world = new World("17", "javaStreamed");
  const c = findChest(world);
  assert.ok(c, "found a generated chest outside the window");
  const ring = new HeadlessColumns(world, { pull: 200 });
  ring.update(c.x >> 4, c.z >> 4);
  attachRing(world, ring);
  world.ringReads = true;
  assert.equal(world.isLoaded(c.x, c.z), false);
  assert.ok(ring.holds(c.x, c.z), "the chunk is a held ring column");
  const block = world.get(c.x, c.y, c.z);
  const chests = {};
  const host = { world, chests: () => chests, seedChest: (x, y, z) => seedRingChest(world, chests, x, y, z) };
  assert.deepEqual(contents(containerAt({ world, chests: () => ({}) }, c.x, c.y, c.z)), [], `without the seed an empty chest is made (block ${block})`);
  const inv = containerAt(host, c.x, c.y, c.z);
  assert.ok(inv, "the chest is a container");
  assert.deepEqual(contents(inv), c.items.map((s) => s.slot).filter((v, i, all) => all.indexOf(v) === i).sort((p, q) => p - q), "the loot slots of the 1.7.10 generation record");
  const key = `${c.x},${c.y},${c.z}`;
  chests[key].items.fill(null);
  containerAt(host, c.x, c.y, c.z);
  assert.equal(chests[key].items.filter(Boolean).length, 0, "an emptied chest is not refilled");
  assert.equal(restoreChests([c], world, { chests }), 0, "the hand-over at residency leaves the tile alone");
});

test("with a cell request hook the first lookup does not build the population cell on the calling thread (batch 42 tilesync)", { timeout: 300000 }, () => {
  const world = new World("17", "javaStreamed");
  const c = findChest(world);
  assert.ok(c);
  const ring = new HeadlessColumns(world, { pull: 200 });
  ring.update(c.x >> 4, c.z >> 4);
  attachRing(world, ring);
  world.ringReads = true;
  const pop = world.population, lcx = c.x >> 4, lcz = c.z >> 4, cellX = lcx >> 3, cellZ = lcz >> 3;
  assert.equal(pop.unclaimedRecord(lcx, lcz)?.chests?.length > 0, true, "without a hook it builds (or reads the cached cell)");
  const record = pop.cells.map.get(`${cellX},${cellZ}`);
  pop.cells.map.clear(); // the cell fell out of the cache
  const asked = [];
  pop.requestCell = (x, z) => { asked.push([x, z]); return true; };
  const t0 = performance.now();
  assert.equal(pop.unclaimedRecord(lcx, lcz), undefined);
  assert.ok(performance.now() - t0 < 50, "no build");
  assert.deepEqual(asked, [[cellX, cellZ]]);
  const chests = {};
  assert.equal(seedRingChest(world, chests, c.x, c.y, c.z), false, "the hopper waits");
  assert.equal(Object.keys(chests).length, 0, "no empty tile");
  assert.equal(pop.adopt(record), true, "the worker's cell arrives");
  assert.ok(seedRingChest(world, chests, c.x, c.y, c.z) >= 1);
  assert.ok(contents({ size: 27, get: (i) => chests[`${c.x},${c.y},${c.z}`].items[i] }).length > 0);
  pop.requestCell = () => false;
  pop.cells.map.clear();
  assert.ok(pop.unclaimedRecord(lcx, lcz) !== undefined, "a refused request builds as before");
});
