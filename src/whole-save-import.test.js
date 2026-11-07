// Whole Java save import (whole-save-import.js): a fake save built with the repo's NBT and region writers, two dimensions and
// four overworld region files, streamed into the stored-full-column store (fake IndexedDB), hydrated lazily by a streamed world,
// and exported back to Anvil region files.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fakeIndexedDB } from './fake-indexeddb.js';
const idb = fakeIndexedDB();
globalThis.indexedDB = idb;
const { World } = await import('./world.js');
const { DimensionWorld } = await import('./dimension-world.js');
const { StreamStorage } = await import('./streaming-storage.js');
const { Chunk } = await import('./chunk-store.js');
const { NBT } = await import('./nbt.js');
const { chunkToNbt, chunkFromNbt } = await import('./chunk-nbt.js');
const { encodeRegionChunk, writeRegion, readRegion, decodeRegionChunk, regionAddress, regionSlot } = await import('./region-file.js');
const { fromOriginal } = await import('./block-registry.js');
const { levelDatBytes } = await import('./level-dat-fixture.js');
const { importWholeSave, regionFiles, ColumnSink } = await import('./whole-save-import.js');
const { indexSave } = await import('./save-folder-import.js');
const { writeBaseColumns, readBaseColumns, listBaseColumns, deleteStoredWorld } = await import('./world-storage.js');
const { encodeBaseColumn, decodeBaseColumn } = await import('./whole-save-columns.js');
const { exportJavaSave } = await import('./region-export.js');
const { Survival } = await import('./survival.js');

const t = (type, value) => ({ type, value });
const compound = (fields) => new Map(Object.entries(fields));
const list = (elementType, items) => t(NBT.LIST, { elementType, items });
const ID = 'whole-save-test';
const WOOL = 35, BEDROCK = 7, CHEST = 54, NETHERRACK = 87, END_STONE = 121;

// A chunk with bedrock at y 0-4, wool (metadata from x + z) at y 70, optionally a chest with diamonds and a pig.
function chunkOf(cx, cz, { floor = BEDROCK, populated = true, chest = false, pig = false } = {}) {
  const c = new Chunk(cx, cz, true);
  for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) {
    for (let y = 0; y < 5; y++) { c.section(0, true).setBlock(lx, y, lz, floor); }
    c.section(4, true).setBlock(lx, 6, lz, WOOL); c.section(4, true).setMeta(lx, 6, lz, (lx + lz) & 15);
  }
  if (chest) c.section(4, true).setBlock(4, 7, 4, CHEST);
  c.isTerrainPopulated = populated; c.isLightPopulated = true;
  const tiles = chest ? [compound({ id: t(NBT.STRING, 'Chest'), x: t(NBT.INT, cx * 16 + 4), y: t(NBT.INT, 71), z: t(NBT.INT, cz * 16 + 4),
    Items: list(NBT.COMPOUND, [compound({ Slot: t(NBT.BYTE, 0), id: t(NBT.SHORT, 264), Count: t(NBT.BYTE, 3), Damage: t(NBT.SHORT, 0) })]) })] : [];
  const entities = pig ? [compound({ id: t(NBT.STRING, 'Pig'), Pos: list(NBT.DOUBLE, [cx * 16 + 8.5, 71, cz * 16 + 8.5]), Motion: list(NBT.DOUBLE, [0, 0, 0]) })] : [];
  return { chunk: c, tileEntities: tiles, entities };
}
async function regionBytes(chunks) {
  const entries = [];
  for (const { chunk, ...payload } of chunks) {
    const a = regionAddress(chunk.x, chunk.z);
    entries.push(await encodeRegionChunk(chunkToNbt(chunk, payload), { x: a.x, z: a.z }));
  }
  return writeRegion(entries);
}
const file = (path, bytes) => ({ path, size: bytes.length, modified: 0, read: async () => bytes });
async function fakeSave() {
  const files = [
    file('Big/level.dat', await levelDatBytes()),
    file('Big/region/r.0.0.mca', await regionBytes([chunkOf(0, 0, { chest: true, pig: true }), chunkOf(1, 0, { populated: false }), chunkOf(31, 31)])),
    file('Big/region/r.-1.0.mca', await regionBytes([chunkOf(-1, 0)])),
    file('Big/region/r.3.3.mca', await regionBytes([chunkOf(100, 100)])),
    file('Big/region/r.0.1.mcr', new Uint8Array(1)), // the pre-Anvil format is ignored
    file('Big/DIM-1/region/r.0.0.mca', await regionBytes([chunkOf(0, 0, { floor: NETHERRACK, chest: true })])),
    file('Big/DIM1/region/r.0.0.mca', await regionBytes([chunkOf(2, 3, { floor: END_STONE })])),
  ];
  return files;
}

const run = {};
async function imported() {
  if (run.done) return run;
  const progress = [], written = [];
  const entries = await fakeSave();
  const gen = new World('1710', 'javaStreamed', 15, 'default', '');
  run.origin = { chunkX: gen.originX >> 4, chunkZ: gen.originZ >> 4, x: gen.originX, z: gen.originZ };
  run.result = await importWholeSave(entries, { worldId: ID, name: 'Whole', onProgress: (p) => progress.push(p),
    writeBases: async (records) => { written.push(records.length); await writeBaseColumns(records); } });
  Object.assign(run, { progress, written, done: true });
  return run;
}

test('region files of all three dimensions are listed, anvil only', async () => {
  const { files } = indexSave(await fakeSave());
  assert.deepEqual(regionFiles(files).map((f) => [f.dimension, f.regionX, f.regionZ]), [[-1, 0, 0], [0, -1, 0], [0, 0, 0], [0, 3, 3], [1, 0, 0]]);
});

test('a base column codec round-trips sparse sections, metadata, biomes and flags', () => {
  const cells = new Uint16Array(65536);
  cells[(3 * 16 + 5) * 256 + 70] = 35 | (9 << 8); cells[(0 * 16 + 0) * 256 + 255] = 7; cells[(15 * 16 + 15) * 256 + 16] = 20 | (15 << 8);
  const rec = encodeBaseColumn('w', -4, 9, cells, { biomes: Int8Array.from({ length: 256 }, (_, i) => (i === 0 ? -1 : 4)), terrainPopulated: false });
  assert.deepEqual(rec.sections.map((s) => s.s), [1, 4, 15]);
  const out = decodeBaseColumn(rec);
  assert.equal(out.blocks[(3 * 16 + 5) * 256 + 70], 35); assert.equal(out.metadata[(3 * 16 + 5) * 256 + 70], 9);
  assert.equal(out.metadata[(15 * 16 + 15) * 256 + 16], 15); assert.equal(out.blocks[255], 7);
  assert.equal(out.terrainPopulated, false); assert.equal(out.biomes[0], 255); assert.equal(out.biomes[1], 4);
  assert.throws(() => decodeBaseColumn({ ...rec, v: 9 }), /damaged/);
  assert.throws(() => decodeBaseColumn({ ...rec, sections: [{ s: 40, blocks: rec.sections[0].blocks, meta: rec.sections[0].meta }] }), /damaged/);
  assert.ok(new ColumnSink().take(0, 0).cells.every((v) => v === 0));
});

test('every chunk of region/, DIM-1/region and DIM1/region becomes a stored full column, written in batches', async () => {
  const { result, origin, progress } = await imported();
  assert.deepEqual(result.record.wholeSave.columns, { 0: 5, '-1': 1, 1: 1 });
  assert.deepEqual(result.report.chunks, { converted: 7, overworld: 5, nether: 1, end: 1, skipped: 0 });
  assert.equal(result.record.edits.length, 0);
  assert.deepEqual((await listBaseColumns(ID)).map(([x, z]) => `${x},${z}`).sort(),
    [[0, 0], [1, 0], [31, 31], [-1, 0], [100, 100]].map(([x, z]) => `${x - origin.chunkX},${z - origin.chunkZ}`).sort());
  assert.deepEqual((await listBaseColumns(`${ID}~-1`)).map(([x, z]) => `${x},${z}`), ['0,0']);
  assert.deepEqual((await listBaseColumns(`${ID}~1`)).map(([x, z]) => `${x},${z}`), ['2,3']);
  assert.ok(progress.some((p) => p.phase === 'chunks' && p.fileCount === 5 && p.chunks > 0));
  assert.equal(result.report.save.mode, 'whole save');
});

test('imported columns are marked claimed and the runtime state of every chunk is merged', async () => {
  const { result, origin } = await imported();
  const { record } = result, lx = 0 - origin.chunkX, lz = 0 - origin.chunkZ;
  const mask = BigInt(`0x${record.populatedColumns.cells[`${lx >> 3},${lz >> 3}`]}`);
  assert.ok(mask & (1n << BigInt((lx & 7) * 8 + (lz & 7))));
  const chest = record.player.chests[`${4 - origin.x},71,${4 - origin.z}`];
  assert.equal(chest.items[0].count, 3);
  assert.equal(record.entities.filter((e) => e.type === 'pig').length, 1);
  assert.equal(record.entities[0].x, 8.5 - origin.x);
  const nether = record.dimensions[-1];
  assert.ok(nether.state.populatedColumns.cells['0,0']);
  assert.equal(nether.tiles.chests['4,71,4'].items[0].count, 3);
  assert.equal(record.dimensions[1].state.dragonSpawned, true);
});

// A streamed world whose generator is replaced by a recorder: stored columns must never reach it, missing ones must.
function recordingWorld(world) {
  world.generated = [];
  world.generateTerrainChunk = (cx, cz) => {
    world.generated.push(`${cx},${cz}`);
    const blocks = new Uint8Array(65536), metadata = new Uint8Array(65536);
    for (let col = 0; col < 256; col++) blocks[col * 256 + 20] = 1; // a generated stone layer
    return { blocks, metadata };
  };
  return world;
}

test('stored chunks load exactly as saved, missing chunks generate, and columns hydrate lazily by exact key', async () => {
  const { origin } = await imported();
  const w = recordingWorld(new World('1710', 'javaStreamed', 15, 'default', ''));
  w.generated.length = 0;
  const wool = fromOriginal(WOOL, 5), stone = fromOriginal(BEDROCK, 0);
  const storage = new StreamStorage(w, ID);
  idb.db.reads.length = 0;
  const cx = 0 - origin.chunkX, cz = 0 - origin.chunkZ;
  // The 8 x 8 window whose north-west corner is (cx - 1, cz - 1): holds imported chunks (-1,0), (0,0) and (1,0), the rest is missing.
  const px = (cx + 3) * 16, pz = (cz + 3) * 16;
  await storage.ensure(storage.columns(px, pz));
  w.streamAround(px, pz);
  const baseReads = idb.db.reads.filter(([name]) => name === 'bases');
  assert.equal(baseReads.length, 64, 'one exact-key read per column of the window, never a scan');
  assert.equal(w.baseColumns.size, 3, 'chunks -1,0, 0,0 and 1,0 of the save');
  const X = 3, Z = 5, x = cx * 16 + X, z = cz * 16 + Z;
  assert.equal(w.get(x, 70, z), fromOriginal(WOOL, (X + Z) & 15).id);
  assert.equal(w.getMeta(x, 70, z), (X + Z) & 15);
  assert.equal(w.get(x, 2, z), stone.id, 'bedrock as saved');
  assert.equal(w.get(x, 20, z), 0, 'saved air where the generator would put stone');
  assert.equal(w.get((cx + 1) * 16 + 1, 20, cz * 16 + 1), 0);
  assert.equal(w.get((cx + 4) * 16 + 1, 20, cz * 16 + 1), 1, 'a chunk missing from the save generates');
  assert.ok(!w.generated.includes(`${cx},${cz}`) && !w.generated.includes(`${cx + 1},${cz}`));
  assert.ok(w.generated.includes(`${cx + 4},${cz}`));
  // A player's edit on top of an imported column persists next to the base and survives a trim and re-hydrate.
  w.set(x, 70, z, 1); w.set(x, 100, z, 1);
  const dirty = w.takeDirtyColumns();
  assert.equal(dirty.length, 1);
  assert.equal(w.baseColumns.size, 3);
});

test('the Nether and End columns hydrate under their own world ids', async () => {
  await imported();
  const nether = recordingWorld(new DimensionWorld('1710', -1)), s1 = new StreamStorage(nether, `${ID}~-1`);
  await s1.ensure(s1.columns(8, 8));
  nether.streamAround(8, 8);
  assert.equal(nether.get(3, 2, 3), fromOriginal(NETHERRACK, 0).id);
  assert.equal(nether.get(3, 20, 3), 0);
  assert.ok(!nether.generated.includes('0,0') && nether.generated.includes('3,3'));
  const end = recordingWorld(new DimensionWorld('1710', 1)), s2 = new StreamStorage(end, `${ID}~1`);
  await s2.ensure(s2.columns(2 * 16 + 8, 3 * 16 + 8));
  end.streamAround(2 * 16 + 8, 3 * 16 + 8);
  assert.equal(end.get(2 * 16 + 5, 2, 3 * 16 + 5), fromOriginal(END_STONE, 0).id);
});

test('a damaged stored column is refused instead of loading half a column', async () => {
  const w = recordingWorld(new World('1710', 'javaStreamed', 15, 'default', ''));
  const rec = encodeBaseColumn('x', 1, 1, new Uint16Array(65536).fill(5));
  rec.sections[0].blocks = new Uint8Array(10);
  assert.throws(() => w.restoreColumns([{ world: 'x', x: 1, z: 1, cells: [], values: [], order: [], base: rec }]), /damaged/);
  assert.equal(w.baseColumns.size, 0);
});

test('exporting the imported world as a Java save round-trips the imported chunks, flags and runtime state', async () => {
  const { result, origin } = await imported();
  const player = { ...new Survival({}, 'survival').serialize(), ...result.record.player };
  const record = { ...result.record, id: ID, mode: 'survival', player, edits: [] };
  const out = await exportJavaSave(record, { readBases: readBaseColumns });
  const chunkAt = async (files, dir, cx, cz) => {
    const a = regionAddress(cx, cz), bytes = files.get(`${dir}region/r.${a.regionX}.${a.regionZ}.mca`);
    if (!bytes) return null;
    const entry = readRegion(bytes).get(regionSlot(a.x, a.z));
    return entry ? chunkFromNbt(await decodeRegionChunk(entry)) : null;
  };
  const c = await chunkAt(out.files, '', 0, 0);
  assert.ok(c, 'native chunk (0,0)');
  assert.equal(c.chunk.getBlock(3, 70, 5), WOOL); assert.equal(c.chunk.getMeta(3, 70, 5), 8);
  assert.equal(c.chunk.getBlock(3, 2, 5), BEDROCK); assert.equal(c.chunk.getBlock(3, 20, 5), 0);
  assert.equal(c.chunk.isTerrainPopulated, true);
  assert.equal(c.tileEntities.find((e) => e.get('id').value === 'Chest').get('Items').value.items[0].get('Count').value, 3);
  assert.equal(c.entities.find((e) => e.get('id').value === 'Pig').get('Pos').value.items[0], 8.5);
  const unpopulated = await chunkAt(out.files, '', 1, 0);
  assert.equal(unpopulated.chunk.isTerrainPopulated, false, 'a chunk the save never populated stays unpopulated for Java');
  for (const [cx, cz] of [[31, 31], [-1, 0], [100, 100]]) assert.equal((await chunkAt(out.files, '', cx, cz)).chunk.getBlock(0, 70, 0), WOOL, `chunk ${cx},${cz}`);
  assert.equal((await chunkAt(out.files, 'DIM-1/', 0, 0)).chunk.getBlock(1, 2, 1), NETHERRACK);
  assert.equal((await chunkAt(out.files, 'DIM1/', 2, 3)).chunk.getBlock(1, 2, 1), END_STONE);
  assert.equal(origin.chunkX !== undefined, true);
});

test('deleting the world removes its stored columns too', async () => {
  await imported();
  assert.ok((await listBaseColumns(ID)).length > 0);
  for (const id of [ID, `${ID}~-1`, `${ID}~1`]) await deleteStoredWorld(id); // hardcore.js storedWorldIds
  assert.deepEqual(await listBaseColumns(ID), []);
  assert.deepEqual(await readBaseColumns(`${ID}~1`, [[2, 3]]), [null]);
});

test('ridden boats in two chunks keep unique vehicle ids and intact riding links across the whole save', async () => {
  const boated = (cx, cz) => {
    const made = chunkOf(cx, cz), px = cx * 16 + 8.5, pz = cz * 16 + 8.5;
    const boat = compound({ id: t(NBT.STRING, 'Boat'), Pos: list(NBT.DOUBLE, [px, 71, pz]), Motion: list(NBT.DOUBLE, [0, 0, 0]), Rotation: list(NBT.FLOAT, [0, 0]) });
    made.entities = [compound({ id: t(NBT.STRING, 'Pig'), Pos: list(NBT.DOUBLE, [px, 71, pz]), Motion: list(NBT.DOUBLE, [0, 0, 0]), Riding: t(NBT.COMPOUND, boat) })];
    return made;
  };
  const files = [file('Boats/level.dat', await levelDatBytes()),
    file('Boats/region/r.0.0.mca', await regionBytes([boated(0, 0)])), file('Boats/region/r.1.0.mca', await regionBytes([boated(32, 0)]))];
  const { record } = await importWholeSave(files, { worldId: 'boats-test', name: 'Boats', writeBases: writeBaseColumns });
  const pigs = record.entities.filter((e) => e.type === 'pig'), boats = record.boats ?? [];
  assert.equal(pigs.length, 2); assert.equal(boats.length, 2);
  assert.equal(new Set(boats.map((b) => b.id)).size, 2);
  assert.equal(new Set(pigs.map((p) => p.riding)).size, 2);
  for (const pig of pigs) assert.ok(boats.some((b) => `boat-${b.id}` === pig.riding), `${pig.riding} names a boat`);
});
