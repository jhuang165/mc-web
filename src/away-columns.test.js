import { test } from "node:test";
import assert from "node:assert/strict";
import { populationBlockMapperReady } from "./population-world.js";
import { runAway, stateColumns, awayPlan, MAX_COLUMNS } from "./away-world.js";
import { compactColumn, fullColumn } from "./headless-columns.js";

// Batch 44 awaydeath2: the batch 43 smoke trip's "lost" deliveries. The portal stood in a column outside the streamed window, so main.js `chunks` did not copy it, the run did not
// tick its entities (counts.outside) and they stayed in the Overworld, where the returning player collected the item and an orb. Columns the headless ring holds are copied now.
await populationBlockMapperReady;
const STONE = 3, PORTAL = 164;
const floorColumn = (x, z) => {
  const blocks = new Uint8Array(65536), meta = new Uint8Array(65536);
  for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) for (let y = 0; y <= 10; y++) blocks[(lx * 16 + lz) * 256 + y] = STONE;
  for (let y = 11; y <= 13; y++) { blocks[(3 * 16 + 5) * 256 + y] = PORTAL; blocks[(4 * 16 + 5) * 256 + y] = PORTAL; }
  meta[(7 * 16 + 7) * 256 + 4] = 9;
  return { x, z, blocks, meta };
};
const base = { seed: "away", biome: "javaStreamed", worldType: "flat", worldSpawn: [0, 64, 0] };
const root = () => ({ ...base,
  entities: [{ id: "mob-1", type: "pig", x: 3.5, y: 11, z: 5.5, vx: 0, vy: 0, vz: 0, yaw: 0, health: 10, onGround: true }],
  drops: [{ stack: { id: 4, count: 2, damage: 0 }, x: 3.5, y: 11, z: 5.5, mx: 0, my: 0, mz: 0, age: 0, delay: 0 }],
  xpOrbs: [{ x: 3.5, y: 11.3, z: 5.5, value: 3, age: 0, vx: 0, vy: 0, vz: 0, onGround: true }] });
const trip = (copied) => { const r = root(), cols = stateColumns(r); return runAway({ ...awayPlan(r, cols, 100), chunks: cols.filter(([x, z]) => copied(x, z)).map(([x, z]) => floorColumn(x, z)), records: [] }); };

test("an entity in a column the run did not copy stays as saved and is counted outside", async () => {
  const r = await trip((x, z) => !(x === 0 && z === 0)); // its neighbours are copied, its own column is not
  assert.equal(r.entities.portalTravel.length, 0, "nothing in the uncopied column travels");
  assert.equal(r.entities.counts.outside, 3);
  assert.equal(r.entities.mobs.length, 1); assert.equal(r.entities.drops.length, 1); assert.equal(r.entities.xpOrbs.length, 1);
});

test("with the column copied, the pig, the item and the orb all reach the portal's destination", async () => {
  const r = await trip(() => true);
  assert.deepEqual(r.entities.portalTravel.map((t) => t.kind).sort(), ["item", "mob", "orb"]);
  assert.equal(r.entities.counts.outside, 0);
});

test("fullColumn expands a ring column (compact, sparse metadata) to the WorldChunk arrays it came from", () => {
  const c = floorColumn(0, 0), compact = compactColumn(c.blocks, c.meta, 256), full = fullColumn(compact, 256);
  assert.equal(compact.h, 16, "trimmed to the highest filled section");
  assert.deepEqual(full.blocks, c.blocks);
  assert.deepEqual(full.meta, c.meta);
});

test("a crowded spawn area does not push an entity's column out of the plan: work columns come before halos under the cap", () => {
  const pigs = [];
  for (let cx = -4; cx <= 3; cx++) for (let cz = -4; cz <= 3; cz++) pigs.push({ id: `mob-${pigs.length}`, type: "pig", x: cx * 16 + 8.5, y: 11, z: cz * 16 + 8.5, health: 10 });
  pigs.push({ id: "far", type: "pig", x: 120.5, y: 11, z: 8.5, health: 10 }); // chunk (7, 0): 112 blocks from the spawn
  const cols = stateColumns({ ...base, entities: pigs });
  assert.ok(cols.length <= MAX_COLUMNS);
  assert.ok(cols.some(([x, z]) => x === 7 && z === 0), "the far pig's own column is planned");
  for (const p of pigs) assert.ok(cols.some(([x, z]) => x === Math.floor(p.x / 16) && z === Math.floor(p.z / 16)), `column of ${p.id}`);
});
