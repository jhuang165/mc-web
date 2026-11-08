// Whole-save import of an unpopulated Nether and End (batch 28 interchange5): the stored columns populate through ChunkProviderHell /
// ChunkProviderEnd, runtime records survive, and an imported furnace keeps the block id (61 unlit / 62 lit) it was saved with.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fakeIndexedDB } from './fake-indexeddb.js';
globalThis.indexedDB = fakeIndexedDB();
const { populationBlockMapperReady } = await import('./population-world.js');
await populationBlockMapperReady;
const { NBT } = await import('./nbt.js');
const { Chunk } = await import('./chunk-store.js');
const { chunkToNbt } = await import('./chunk-nbt.js');
const { encodeRegionChunk, writeRegion, regionAddress } = await import('./region-file.js');
const { levelDatBytes } = await import('./level-dat-fixture.js');
const { importWholeSave } = await import('./whole-save-import.js');
const { Survival } = await import('./survival.js');
const { exportJavaSave } = await import('./region-export.js');

const t = (type, value) => ({ type, value });
const furnaceTile = (x, y, z, burn) => new Map(Object.entries({ id: t(NBT.STRING, 'Furnace'), x: t(NBT.INT, x), y: t(NBT.INT, y), z: t(NBT.INT, z), BurnTime: t(NBT.SHORT, burn), CookTime: t(NBT.SHORT, 0), Items: t(NBT.LIST, { elementType: NBT.COMPOUND, items: [] }) }));
function dimChunk(cx, cz, floor, top, populated, furnace) {
  const c = new Chunk(cx, cz, false), tiles = [];
  for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) for (let y = 0; y < top; y++) c.section(y >> 4, true).setBlock(lx, y & 15, lz, y < 2 ? 7 : floor);
  if (furnace) { const [id, burn] = furnace; c.section(6, true).setBlock(3, 4, 5, id); c.section(6, true).setMeta(3, 4, 5, 3); tiles.push(furnaceTile(cx * 16 + 3, 100, cz * 16 + 5, burn)); }
  c.isTerrainPopulated = populated; c.isLightPopulated = false;
  return { chunk: c, tileEntities: tiles, entities: [] };
}
const file = (path, bytes) => ({ path, size: bytes.length, modified: 0, read: async () => bytes });
async function region(chunks) {
  const entries = [];
  for (const { chunk, ...payload } of chunks) { const a = regionAddress(chunk.x, chunk.z); entries.push(await encodeRegionChunk(chunkToNbt(chunk, payload), { x: a.x, z: a.z })); }
  return writeRegion(entries);
}
async function saveOf() {
  const nether = [], end = [];
  for (let x = 0; x < 3; x++) for (let z = 0; z < 3; z++) {
    // the 2x2 at (0,0) is unpopulated with an unlit furnace that has fuel left and a lit one with none; the rest is populated
    const first = x < 2 && z < 2;
    nether.push(dimChunk(x, z, 87, 70, !first, x === 0 && z === 0 ? [61, 120] : x === 1 && z === 0 ? [62, 0] : null));
    end.push(dimChunk(x, z, 121, 60, !first, null));
  }
  return [file('Save/level.dat', await levelDatBytes()), file('Save/DIM-1/region/r.0.0.mca', await region(nether)), file('Save/DIM1/region/r.0.0.mca', await region(end))];
}
let memo = null;
const importSave = () => (memo ??= importSaveOnce());
async function importSaveOnce() {
  const stored = new Map();
  const out = await importWholeSave(await saveOf(), { worldId: 'dim-pop', writeBases: async (rs) => { for (const r of rs) stored.set(`${r.world}|${r.x}|${r.z}`, r); },
    readBases: async (w, cs) => cs.map(([x, z]) => stored.get(`${w}|${x}|${z}`) ?? null) });
  return { ...out, stored };
}

test('an unpopulated Nether and End populate on import and report it per dimension', async () => {
  const { report, stored } = await importSave();
  assert.deepEqual(report.population.unpopulatedNetherEnd, { '-1': 4, 1: 4 });
  const n = report.population.dimensions['-1'], e = report.population.dimensions['1'];
  // (0,0) needs (1,0), (0,1), (1,1): stored; (1,0) needs (2,0)..: stored and populated-flagged chunks are never populated again.
  assert.equal(n.populated, 4); assert.equal(e.populated, 4);
  assert.equal(n.stillUnpopulated, 0);
  assert.ok(n.changedCells > 0, 'the Nether populate wrote cells');
  assert.ok(n.fluidTicks > 0, 'hell lava pockets scheduled liquid ticks');
  assert.ok(e.entities >= 1, 'the End populate at chunk (0,0) spawns the dragon (and any crystals of spikes inside the window)');
  for (const [k, r] of stored) if (/~-1\||~1\|/.test(k)) assert.equal(r.terrainPopulated, true, k);
  assert.equal(report.save.notImported.join(' ').includes('stay unpopulated'), false);
});

test('Nether populate runtime records and the furnace lit state reach the dimension blobs', async () => {
  const { record } = await importSave();
  const nether = record.dimensions[-1];
  assert.ok(nether.state.fluidTicks.entries.length > 0);
  assert.ok(record.dimensions[1].state.entities.some((m) => m.type === 'ender_dragon'));
  const furnaces = nether.tiles.furnaces;
  assert.equal(furnaces['3,100,5'].lit, false, 'an unlit furnace (61) with BurnTime 120 stays unlit');
  assert.equal(furnaces['3,100,5'].burn, 120);
  assert.equal(furnaces['19,100,5'].lit, true, 'a lit furnace (62) with no fuel stays lit until its first update');
});

test('a furnace keeps its saved lit state until the burning flag flips, then follows burn', () => {
  const s = new Survival({ furnaces: { '1,2,3': { items: [null, null, null], burn: 2, burnTotal: 2, cook: 0, lit: false }, '4,5,6': { items: [null, null, null], burn: 0, burnTotal: 0, cook: 0, lit: true }, '7,8,9': { items: [null, null, null], burn: 0, burnTotal: 0, cook: 0 } } });
  assert.equal(s.furnaces['1,2,3'].lit, false);
  assert.equal(s.furnaces['4,5,6'].lit, true);
  assert.equal('lit' in s.furnaces['7,8,9'], false);
  s.tickFurnaces();
  assert.equal(s.furnaces['1,2,3'].burn, 1); assert.equal(s.furnaces['1,2,3'].lit, false, 'still burning: the block did not flip');
  assert.equal(s.furnaces['4,5,6'].lit, true, 'nothing changed for the fuel-less lit furnace in one update');
  s.tickFurnaces();
  assert.equal(s.furnaces['1,2,3'].burn, 0); assert.equal('lit' in s.furnaces['1,2,3'], false, 'the burning flag flipped: lit follows burn from here');
  assert.equal(JSON.parse(JSON.stringify(s.serialize().furnaces['4,5,6'])).lit, true, 'the lit state is saved');
});

test('the Java export writes the furnace block id from the lit state, not from BurnTime', async () => {
  const { readRegion, decodeRegionChunk } = await import('./region-file.js');
  const { chunkFromNbt } = await import('./chunk-nbt.js');
  const { record, stored } = await importSave();
  const out = await exportJavaSave({ ...record, id: 'dim-pop' }, { readBases: async (w, cs) => cs.map(([x, z]) => stored.get(`${w}|${x}|${z}`) ?? null), maxChunks: 4096 });
  const files = out.files ?? out;
  const bytes = files.get ? files.get('DIM-1/region/r.0.0.mca') : files['DIM-1/region/r.0.0.mca'];
  assert.ok(bytes, 'the Nether region was exported');
  const entries = readRegion(bytes), at = async (cx, cz) => chunkFromNbt(await decodeRegionChunk(entries.get(cz * 32 + cx))).chunk;
  assert.equal((await at(0, 0)).getBlock(3, 100, 5), 61, 'unlit furnace with BurnTime 120 stays 61');
  assert.equal((await at(1, 0)).getBlock(3, 100, 5), 62, 'lit furnace with no fuel stays 62');
});
