import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { World, MOB_SPAWNER } from './world.js';
import { CHEST } from './chest.js';
import { populationBlockMapperReady } from './population-world.js';
import { StreamingPopulation, CELL } from './streaming-population.js';
import { restorePopulationColumns, LIQUIDS } from './population-runtime.js';
import { Survival } from './survival.js';
import { EntityWorld } from './entities.js';
import { importedRuntime } from './world-import.js';

await populationBlockMapperReady;

const sha = (c) => createHash('sha1').update(c.blocks).update(c.metadata).digest('hex');
const columnShas = (pop, cellX, cellZ) => {
  const out = [];
  for (let a = 0; a < CELL; a++) for (let b = 0; b < CELL; b++) out.push(sha(pop.column(cellX * CELL + a, cellZ * CELL + b)));
  return out;
};
const json = (v) => JSON.parse(JSON.stringify(v));
const totals = (cell) => {
  const t = { chests: 0, animals: 0, spawners: 0, carts: 0, ticks: 0 };
  for (const r of cell.records.values()) {
    t.chests += r.chests.length; t.animals += r.animals.length; t.spawners += r.spawners.length;
    t.carts += r.minecartChests.length; t.ticks += r.pendingTicks.length;
  }
  return t;
};

// One shared world: building a cell costs about a second.
const world = new World('17', 'javaStreamed');
const pop = world.population;

test('streamed worlds default to generation 13 and populate their first working set from one cell', () => {
  assert.equal(world.generationVersion, 13);
  assert.ok(pop instanceof StreamingPopulation);
  assert.equal(pop.cell(0, 0).failed, null);
  assert.equal(pop.cell(0, 0).populates, 81, '8 x 8 chunks plus the -x/-z margin row');
  for (let cx = 0; cx < 8; cx++) for (let cz = 0; cz < 8; cz++) {
    const live = world.chunkAt(cx, cz), column = pop.column(cx, cz);
    assert.deepEqual([...live.blocks.subarray(0, 4096)], [...column.blocks.subarray(0, 4096)]);
    assert.equal(sha({ blocks: live.blocks, metadata: live.meta }), sha(column), `column ${cx},${cz}`);
  }
  // Population changed the terrain: a terrain-only world differs in at least one column.
  const bare = new World('17', 'javaStreamed', 12);
  assert.ok(Array.from({ length: 64 }, (_, i) => i).some((i) => sha({ blocks: bare.chunkAt(i >> 3, i & 7).blocks, metadata: bare.chunkAt(i >> 3, i & 7).meta }) !== sha(pop.column(i >> 3, i & 7))));
});

test('cell records agree with the blocks: chests, spawners and the mineshaft list', () => {
  const cell = pop.cell(0, 0), t = totals(cell);
  assert.ok(t.chests > 0 && t.animals > 0 && t.spawners > 0 && t.carts > 0 && t.ticks > 0, JSON.stringify(t));
  assert.ok(cell.mineshafts.length > 0);
  for (const r of cell.records.values()) {
    for (const c of r.chests) assert.equal(world.get(c.x, c.y, c.z), CHEST, 'chest block under its record');
    for (const s of r.spawners) assert.equal(world.get(s.x, s.y, s.z), MOB_SPAWNER);
    for (const a of r.animals) assert.ok(a.x >= 0 && a.x < 128 && a.z >= 0 && a.z < 128, 'animals are cell-local');
  }
});

test('columns and records are a pure function of the seed, whatever the order or cache state', () => {
  const first = { x: columnShas(pop, 1, 0), z: columnShas(pop, 0, -1), totals: totals(pop.cell(1, 0)) };
  const other = new World('17', 'javaStreamed').population;
  // Opposite request order, and a cache that holds one cell, so each request rebuilds from scratch.
  other.cells.max = 1; other.originals.max = 8;
  assert.deepEqual(columnShas(other, 0, -1), first.z);
  assert.deepEqual(columnShas(other, 1, 0), first.x);
  assert.deepEqual(columnShas(other, 0, -1), first.z, 'evicted cell rebuilt identically');
  assert.deepEqual(columnShas(other, 1, 0), first.x);
  assert.deepEqual(totals(other.cell(1, 0)), first.totals);
  assert.deepEqual(json([...other.cell(1, 0).records]), json([...pop.cell(1, 0).records]));
  assert.ok(other.generated >= 5, 'the one-cell cache forced rebuilds');
});

test('negative cells floor like chunk coordinates and keep their own column keys', () => {
  const cell = pop.cell(-1, -1);
  assert.equal(cell.failed, null);
  assert.deepEqual([...cell.columns.keys()].slice(0, 2), ['-8,-8', '-8,-7']);
  assert.equal(pop.column(-1, -1), cell.columns.get('-1,-1'));
  assert.equal(pop.column(-8, -8), cell.columns.get('-8,-8'));
  assert.notEqual(sha(pop.column(-1, -1)), sha(pop.column(0, 0)));
});

test('each column hands its records over once, and a saved mask stops a reload handing them again', () => {
  const w = new World('17', 'javaStreamed');
  const first = w.claimFreshColumns();
  assert.equal(first.length, 64);
  assert.deepEqual(first.map((c) => [c.x, c.z]), Array.from({ length: 64 }, (_, i) => [i >> 3, i & 7]), 'x outer, z inner');
  assert.deepEqual(w.claimFreshColumns(), []);
  const saved = json(w.saveClaimedColumns());
  assert.equal(saved.version, 1);
  assert.equal(saved.cells['0,0'], 'f'.repeat(16));
  const again = new World('17', 'javaStreamed');
  again.restoreClaimedColumns(saved);
  assert.deepEqual(again.claimFreshColumns(), [], 'saved columns are not refilled');
  const fresh = new World('17', 'javaStreamed').claimFreshColumns();
  assert.deepEqual(json(fresh), json(first), 'unclaimed columns repeat the same records');
  // Moving the window claims only the columns that were never resident.
  w.streamAround(8 * 16 + 8, 8);
  const next = w.claimFreshColumns();
  assert.ok(next.length > 0 && next.every((c) => c.x >= 4 && c.x < 12));
  assert.ok(next.every((c) => !(c.x < 8 && c.z >= 0 && c.z < 8)), 'columns of the first window stay claimed');
  w.streamAround(4 * 16 + 8, 4 * 16 + 8);
  assert.equal(w.minX, 0);
  assert.deepEqual(w.claimFreshColumns(), [], 'returning to claimed columns hands nothing over');
});

test('restoreMaterialized ignores malformed entries', () => {
  const p = new World('17', 'javaStreamed').population;
  p.restoreMaterialized({ version: 1, cells: { '0,0': '1', 'x,y': 'f', '1,1': 'zz', '2,2': 'f'.repeat(17), '3,3': 5 } });
  assert.deepEqual([...p.materialized.keys()], ['0,0']);
  assert.ok(p.isMaterialized(0, 0));
  assert.ok(!p.isMaterialized(0, 1));
  p.restoreMaterialized({ version: 2, cells: { '0,0': 'f' } });
  assert.equal(p.materialized.size, 0);
  p.restoreMaterialized(null);
  assert.equal(p.materialized.size, 0);
});

test('imported records keep valid claimed-column masks and drop the rest', () => {
  const good = { version: 1, cells: { '0,0': 'ffff', '-3,2': '8000000000000000' } };
  const saved = (populatedColumns) => importedRuntime({ seed: '17', biome: 'javaStreamed', generationVersion: 13, populatedColumns });
  assert.deepEqual(saved(good).populatedColumns, good);
  assert.deepEqual(saved({ version: 1, cells: { '0,0': 'ffff', bad: 'ff', '1,1': 'nothex' } }).populatedColumns, { version: 1, cells: { '0,0': 'ffff' } });
  assert.equal(saved({ version: 9, cells: {} }).populatedColumns, undefined);
  assert.equal(saved('nope').populatedColumns, undefined);
});

test('player edits replay over populated columns after eviction', () => {
  const w = new World('17', 'javaStreamed');
  w.blockLight = () => 0;
  const x = 40, z = 40;
  let y = 255;
  while (y > 0 && w.get(x, y, z) === 0) y--;
  const before = w.get(x, y, z), above = y + 1;
  assert.ok(w.put(x, above, z, 4), 'cobblestone placed above the surface');
  w.streamAround(30 * 16, 30 * 16);
  assert.equal(w.get(x, above, z), 0, 'column evicted');
  w.streamAround(8, 8);
  assert.equal(w.get(x, above, z), 4, 'edit replayed');
  assert.equal(w.get(x, y, z), before, 'generated block under the edit regenerated unchanged');
  const col = w.chunkAt(2, 2), gen = w.population.column(2, 2);
  let diffs = 0;
  for (let i = 0; i < col.blocks.length; i++) if (col.blocks[i] !== gen.blocks[i]) diffs++;
  assert.equal(diffs, 1, 'the cached generated column was not mutated by the edit');
});

test('streamed generation 12 keeps terrain, caves and ravines only; unknown versions are refused', () => {
  const old = new World('17', 'javaStreamed', 12);
  assert.equal(old.population, undefined);
  assert.deepEqual(old.claimFreshColumns(), []);
  assert.equal(old.saveClaimedColumns(), null);
  old.restoreClaimedColumns({ version: 1, cells: { '0,0': 'f' } });
  assert.throws(() => new World('17', 'javaStreamed', 11), /Unsupported streamed/);
  assert.throws(() => new World('17', 'javaStreamed', 14), /Unsupported streamed/);
});

test('a cell that cannot be generated falls back to unpopulated terrain, loudly and repeatably', () => {
  const stone = () => ({ blocks: new Uint8Array(65536).fill(1), metadata: new Uint8Array(65536) });
  const make = () => new StreamingPopulation({
    seed: 17, originX: 0, originZ: 0, terrain: () => { throw new Error('boom'); }, biomeAt: () => null, terrainOnly: stone,
  });
  const logged = [], realError = console.error;
  console.error = (...args) => logged.push(args.join(' '));
  try {
    const a = make(), b = make();
    const cell = a.cell(3, -2);
    assert.match(cell.failed, /boom/);
    assert.equal(cell.columns.size, 64);
    assert.equal(cell.records.size, 0);
    assert.equal(a.column(24, -16).blocks[0], 1, 'the unpopulated column is served');
    assert.deepEqual(a.claim([[24, -16]]), [], 'nothing to hand over from a fallback');
    assert.ok(a.isMaterialized(24, -16));
    assert.equal(sha(a.column(25, -15)), sha(b.column(25, -15)));
    assert.equal(logged.length, 2);
    assert.match(logged[0], /cell 3,-2 fell back/);
  } finally { console.error = realError; }
});

test('an unmapped original block fails the cell instead of writing a wrong block', () => {
  const logged = [], realError = console.error;
  console.error = (...args) => logged.push(args.join(' '));
  try {
    const p = world.population;
    const guarded = new StreamingPopulation({
      seed: p.seed, originX: world.originX, originZ: world.originZ, terrain: p.terrain, biomeAt: p.biomeAt,
      terrainOnly: p.terrainOnly, mapBlock: (id) => (id === 0 ? { id: 0, meta: 0, exact: true } : { id: 1, meta: 0, exact: false }),
    });
    guarded.originals = p.originals;
    const cell = guarded.cell(0, 0);
    assert.match(cell.failed, /unmapped original block/);
    assert.equal(cell.records.size, 0);
    const bare = p.terrainOnly(2, 3);
    assert.equal(sha(guarded.column(2, 3)), sha({ blocks: Uint8Array.from(bare.blocks), metadata: Uint8Array.from(bare.metadata) }));
    assert.match(logged[0], /fell back to unpopulated terrain/);
  } finally { console.error = realError; }
});

test('population records enter live state: chests, animals, spawners, carts and liquid ticks', () => {
  const w = new World('17', 'javaStreamed'), survival = new Survival({}, 'survival'), mobs = new EntityWorld(w, []);
  const spawners = [], carts = [], ticks = [];
  const handed = restorePopulationColumns(w.claimFreshColumns(), {
    world: w, survival, mobs,
    spawners: { add: (s) => spawners.push(s) },
    minecarts: { spawnChest: (c) => carts.push(c) },
    fluids: { schedule: (x, y, z, d) => ticks.push([x, y, z, d]) },
  });
  const t = totals(w.population.cell(0, 0));
  assert.equal(handed.columns, 64);
  assert.equal(handed.chests, t.chests);
  assert.equal(handed.animals, mobs.entities.length);
  assert.ok(handed.animals > 0 && handed.animals <= t.animals);
  assert.equal(spawners.length, t.spawners);
  assert.equal(carts.length, t.carts);
  const liquidTicks = [...w.population.cell(0, 0).records.values()].flatMap((r) => r.pendingTicks).filter((p) => LIQUIDS.has(p.id)).length;
  assert.equal(ticks.length, liquidTicks);
  assert.equal(Object.keys(survival.chests).length, t.chests);
  for (const key of Object.keys(survival.chests)) {
    const [x, y, z] = key.split(',').map(Number);
    assert.equal(w.get(x, y, z), CHEST);
    assert.ok(survival.chests[key].items.some(Boolean), 'dungeon loot arrived');
  }
  // A chest that is already a tile (emptied by the player) is never refilled.
  const key = Object.keys(survival.chests)[0];
  survival.chests[key].items.fill(null);
  const again = restorePopulationColumns(new World('17', 'javaStreamed').claimFreshColumns(), {
    world: w, survival, mobs: new EntityWorld(w, []), spawners: { add() {} }, minecarts: { spawnChest() {} }, fluids: { schedule() {} },
  });
  assert.equal(again.chests, 0);
  assert.equal(survival.chests[key].items.filter(Boolean).length, 0);
});
