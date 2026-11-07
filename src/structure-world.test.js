// Live villages, strongholds and temples: generation version 14 (finite) and 15 (streamed). Older versions stay
// mineshaft-only. The structure placement itself is replayed natively in structure-population-area.test.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { World } from './world.js';
import { streamedSource } from './java-world.js';
import { PopulationArea, populationBlockMapperReady, populationBlockMapper } from './population-world.js';
import { restorePopulation, restorePopulationColumns } from './population-runtime.js';
import { ChunkProviderGenerate, BiomeTerrainState } from './terrain-generator.js';
import { MapGenCaves, MapGenRavine } from './mapgen.js';
import { DISPENSER, MOB_SPAWNER } from './world.js';
import { FLOWER_POT } from './stone-utility.js';
import { itemFromOriginal } from './region-import.js';
import * as VILLAGE from './village-generator.js';
import * as STRONGHOLD from './stronghold-generator.js';
import * as SCATTERED from './scattered-feature-generator.js';

await populationBlockMapperReady;
const digest = (w) => {
  const h = createHash('sha1');
  for (const k of [...w.chunks.keys()].sort()) { const c = w.chunks.get(k); h.update(c.blocks); h.update(c.meta); }
  return h.digest('hex');
};
const finite = (seed, version = 14) => new World(seed, 'java', version);
const fakeSurvival = () => ({ chests: {}, dispensers: {}, furnaces: {} });
const fakeMobs = () => ({ entities: [], create: (type, x, y, z) => ({ type, x, y, z }) });

test('every structure loot item maps to an internal item', () => {
  const bad = [];
  for (const m of [VILLAGE, STRONGHOLD, SCATTERED]) for (const [k, rows] of Object.entries(m))
    if (/LOOT/.test(k)) for (const [[id, , damage]] of rows) if (!itemFromOriginal(id, damage)) bad.push(`${k} ${id}:${damage}`);
  assert.deepEqual(bad, []);
});

test('finite v14: a village seed lists its village, villagers and chests, with every block mapped', () => {
  const w = finite('110'), g = w.generatedStructures;
  assert.equal(w.generationVersion, 14);
  assert.equal(g.villages.length, 1);
  assert.ok(Array.isArray(g.strongholds) && Array.isArray(g.temples) && Array.isArray(g.mineshafts));
  const villagers = g.animals.filter((a) => a.type === 'Villager');
  assert.ok(villagers.length >= 3);
  for (const v of villagers) assert.ok(Number.isInteger(v.profession) && v.profession >= 0 && v.profession <= 4);
  assert.ok(g.chests.length >= 1);
  const [x0, y0, z0, x1, y1, z1] = g.villages[0].boundingBox;
  let solid = 0;
  for (let x = Math.max(0, x0); x <= Math.min(127, x1); x++) for (let z = Math.max(0, z0); z <= Math.min(127, z1); z++) for (let y = y0; y <= y1; y++) if (w.get(x, y, z)) solid++;
  assert.ok(solid > 1000);
  // Village lake suppression and structure writes change the area against v11.
  assert.notEqual(digest(w), digest(finite('110', 11)));
});

test('finite v14: jungle temple dispensers hand off nine slots and are restored once', () => {
  const w = finite('267'), g = w.generatedStructures;
  assert.equal(g.temples.length, 1);
  assert.equal(g.temples[0].kind, 'jungle');
  assert.equal(g.dispensers.length, 2);
  for (const d of g.dispensers) { assert.equal(w.get(d.x, d.y, d.z), DISPENSER); assert.ok(d.items.every((s) => s.slot >= 0 && s.slot < 9)); assert.ok(d.items.length > 0); }
  const survival = fakeSurvival(), mobs = fakeMobs();
  const first = restorePopulation({}, w, survival, mobs);
  assert.equal(first.dispensers, 2);
  for (const d of g.dispensers) {
    const tile = survival.dispensers[`${d.x},${d.y},${d.z}`];
    assert.equal(tile.items.length, 9);
    assert.equal(tile.items.filter(Boolean).length, d.items.length);
  }
  // A looted dispenser is never refilled.
  const key = `${g.dispensers[0].x},${g.dispensers[0].y},${g.dispensers[0].z}`;
  survival.dispensers[key].items.fill(null);
  restorePopulationColumns([{ records: { chests: [], animals: [], spawners: [], minecartChests: [], pendingTicks: [], dispensers: g.dispensers, pots: [] } }],
    { world: w, survival, mobs, spawners: { add() {} }, minecarts: { spawnChest() {} }, fluids: { schedule() {} } });
  assert.ok(survival.dispensers[key].items.every((s) => s === null));
});

test('finite v14: further jungle temples generate (redstone hooks skipped, nothing powered)', () => {
  for (const seed of ['267', '854']) {
    const g = finite(seed).generatedStructures;
    assert.equal(g.temples[0].kind, 'jungle', seed);
    assert.equal(g.dispensers.length, 2, seed);
  }
});

test('finite v14: a desert temple lists its chests; reloads regenerate identically', () => {
  const a = finite('395'), b = finite('395');
  assert.equal(a.generatedStructures.temples[0].kind, 'desert');
  assert.ok(a.generatedStructures.chests.length >= 4);
  assert.equal(digest(a), digest(b));
  assert.deepEqual(JSON.parse(JSON.stringify(a.generatedStructures)), JSON.parse(JSON.stringify(b.generatedStructures)));
});

test('finite v11 and streamed v13 stay mineshaft-only', () => {
  const g = finite('110', 11).generatedStructures;
  for (const k of ['villages', 'strongholds', 'temples', 'dispensers', 'pots']) assert.equal(g[k], undefined, k);
  assert.ok(!g.animals.some((a) => a.type === 'Villager'));
  const src = streamedSource({ seed: 31n, generationVersion: 13, originX: 0, originZ: 0 });
  const cell = src.population.cell(1, 0);
  assert.equal(cell.villages, undefined);
  assert.equal(cell.failed, null);
});

test('World accepts streamed 12, 13 and 15 only', () => {
  assert.throws(() => new World('x', 'javaStreamed', 14));
  assert.throws(() => new World('x', 'javaStreamed', 11));
});

function streamedCell(seed, version, cx, cz) {
  const src = streamedSource({ seed, generationVersion: version, originX: 0, originZ: 0 });
  return { src, cell: src.population.cell(cx, cz) };
}
const allRecords = (cell, name) => [...cell.records.values()].flatMap((r) => r[name] ?? []);

test('streamed v15: village, desert and jungle temple cells', () => {
  const village = streamedCell(31n, 15, 1, 0).cell;
  assert.equal(village.failed, null);
  assert.ok(village.villages.length >= 1);
  assert.ok(allRecords(village, 'animals').some((a) => a.type === 'Villager'));
  const desert = streamedCell(9n, 15, -4, -3).cell;
  assert.equal(desert.failed, null);
  assert.ok(desert.temples.some((t) => t.kind === 'desert'));
  assert.ok(allRecords(desert, 'chests').length >= 1);
  const jungle = streamedCell(25n, 15, -3, 4).cell;
  assert.equal(jungle.failed, null);
  assert.ok(jungle.temples.some((t) => t.kind === 'jungle'));
  const disp = allRecords(jungle, 'dispensers');
  assert.ok(disp.length >= 1);
  for (const d of disp) assert.ok(d.items.every((s) => s.slot < 9));
});

test('streamed v15: swamp hut witch and flower pot, stronghold silverfish spawner', () => {
  const hut = streamedCell(3n, 15, 2, -3);
  assert.equal(hut.cell.failed, null);
  assert.ok(hut.cell.temples.some((t) => t.kind === 'swamp_hut'));
  assert.ok(allRecords(hut.cell, 'animals').some((a) => a.type === 'Witch'));
  const pots = allRecords(hut.cell, 'pots');
  assert.equal(pots.length, 1);
  assert.deepEqual([pots[0].id, pots[0].damage], [76, 0]); // metadata 7: red mushroom
  const col = hut.cell.columns.get(`${Math.floor(pots[0].x / 16)},${Math.floor(pots[0].z / 16)}`);
  assert.equal(col.blocks[((pots[0].x & 15) * 16 + (pots[0].z & 15)) * 256 + pots[0].y], FLOWER_POT);
  const sh = streamedCell(1n, 15, -1, -6);
  assert.equal(sh.cell.failed, null);
  assert.ok(sh.cell.strongholds.length >= 1);
  const spawners = allRecords(sh.cell, 'spawners');
  assert.ok(spawners.some((s) => s.entityId === 'Silverfish'));
  for (const s of spawners) {
    const col2 = sh.cell.columns.get(`${Math.floor(s.x / 16)},${Math.floor(s.z / 16)}`);
    assert.equal(col2.blocks[((s.x & 15) * 16 + (s.z & 15)) * 256 + s.y], MOB_SPAWNER);
  }
});

test('streamed v15: reloads regenerate identically and claimed columns are never handed over twice', () => {
  const a = streamedSource({ seed: 31n, generationVersion: 15, originX: 0, originZ: 0 }).population;
  const b = streamedSource({ seed: 31n, generationVersion: 15, originX: 0, originZ: 0 }).population;
  const ca = a.cell(1, 0), cb = b.cell(1, 0);
  for (const [k, col] of ca.columns) assert.deepEqual(col.blocks, cb.columns.get(k).blocks, k);
  assert.deepEqual(JSON.stringify([...ca.records]), JSON.stringify([...cb.records]));
  const cols = [...ca.columns.keys()].map((k) => k.split(',').map(Number));
  const first = a.claim(cols);
  assert.ok(first.length > 0);
  assert.deepEqual(a.claim(cols), []);
  // The saved claim mask survives a reload: nothing is refilled.
  const restored = b.restoreMaterialized(JSON.parse(JSON.stringify(a.saveMaterialized())));
  assert.deepEqual(restored.claim(cols), []);
});

test('worker side builds a v15 cell with structures once per source', async () => {
  const { createStreamWorker } = await import('./streaming-generator.js');
  const run = await createStreamWorker({ seed: '31', generationVersion: 15, originX: 0, originZ: 0 });
  const { message } = run({ type: 'cell', x: 1, z: 0 });
  assert.ok(message.cell.villages.length >= 1);
  assert.equal(message.cell.failed, null);
});

// Native fixtures from structure-population-world-reference.json: the live block mapper must take every original state
// the four structure kinds write over those native areas, and every structure start area must map on real seeds.
const reference = JSON.parse(readFileSync(new URL('../public/research/structure-population-world-reference.json', import.meta.url)));
function areaFor(seed, type, chunkX, chunkZ, size = 1) {
  const state = new BiomeTerrainState(), gen = new ChunkProviderGenerate(seed, type, state), manager = gen.manager;
  const top = (x, z) => state.topBlock(manager.biomeAt(x, z));
  const caves = new MapGenCaves(seed, manager, top), ravines = new MapGenRavine(seed, manager, top), cache = new Map();
  const terrain = (x, z) => {
    const k = `${x},${z}`; let chunk = cache.get(k);
    if (!chunk) { const c = gen.provideChunk(x, z); caves.generate(x, z, c.blocks); ravines.generate(x, z, c.blocks); chunk = { blocks: c.blocks.slice(), metadata: c.metadata.slice() }; cache.set(k, chunk); }
    return chunk;
  };
  return new PopulationArea({ seed, chunkX, chunkZ, size, terrain, biomeAt: (x, z) => manager.biomeAt(x, z), structures: true, manager }).run();
}
function unmapped(pass, size) {
  const w = pass.world, map = populationBlockMapper(), bad = new Set();
  for (let a = 0; a < size; a++) for (let b = 0; b < size; b++) {
    const c = w.chunk(pass.chunkX + a, pass.chunkZ + b);
    for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) for (let y = 0; y < 256; y++) {
      const id = c.getBlock(x, y, z), meta = c.getMeta(x, y, z);
      if (!map(id, meta)?.exact) bad.add(`${id}:${meta}`);
    }
  }
  return [...bad];
}
test('every block the native structure fixtures write maps exactly', () => {
  for (const rec of reference.records) {
    const pass = areaFor(BigInt(rec.seed), rec.type, rec.chunk[0], rec.chunk[1]);
    assert.deepEqual(unmapped(pass, 1), [], `${rec.seed} ${rec.chunk}`);
  }
});
test('every block of stronghold and swamp hut areas maps exactly', () => {
  const sh = areaFor(1n, 'default', -10, -50, 8);
  assert.deepEqual(unmapped(sh, 8), []);
  assert.ok(sh.structures.generators.stronghold.structureMap.size >= 1);
  assert.ok(sh.world.liveSpawners().some((t) => t.name === 'Silverfish'));
  const hut = areaFor(2n, 'default', 48, -25, 8);
  assert.deepEqual(unmapped(hut, 8), []);
  assert.ok(hut.world.animals.some((e) => e.type === 'Witch'));
});
