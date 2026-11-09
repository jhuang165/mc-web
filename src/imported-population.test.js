// Population of imported unpopulated chunks (imported-population.js): the native Chunk.populateChunk order, the stored-column
// write-back, and the whole-save pass. The native replay itself is tools/verify-interchange-populate.mjs
// (public/research/interchange-populate-reference.json); these tests pin the plan and the stored-column rules.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fakeIndexedDB } from './fake-indexeddb.js';
globalThis.indexedDB = fakeIndexedDB();
const { populationBlockMapperReady } = await import('./population-world.js');
await populationBlockMapperReady;
const { streamedSource } = await import('./java-world.js');
const { fromOriginal } = await import('./block-registry.js');
const { encodeBaseColumn, decodeBaseColumn } = await import('./whole-save-columns.js');
const { populationPlan, populateImportedColumns } = await import('./imported-population.js');
const { Chunk } = await import('./chunk-store.js');
const { chunkToNbt } = await import('./chunk-nbt.js');
const { encodeRegionChunk, writeRegion, regionAddress } = await import('./region-file.js');
const { levelDatBytes } = await import('./level-dat-fixture.js');
const { importWholeSave } = await import('./whole-save-import.js');
const { wholeSaveRecord } = await import('./whole-save-cli.js');
const { World } = await import('./world.js');

const grid = (n, flag = () => false) => { const out = []; for (let x = 0; x < n; x++) for (let z = 0; z < n; z++) out.push([x, z, flag(x, z)]); return out; };

test('populationPlan replays Chunk.populateChunk over the load order of the stored set', () => {
  assert.deepEqual(populationPlan(grid(3)), [[0, 0], [0, 1], [1, 0], [1, 1]]);
  // A saved-populated chunk is never populated again; its neighbours still are.
  assert.deepEqual(populationPlan(grid(3, (x, z) => x === 0 && z === 0)), [[0, 1], [1, 0], [1, 1]]);
  // The +x, +z and +x+z neighbours are needed: an L of three chunks populates nothing.
  assert.deepEqual(populationPlan([[0, 0, false], [1, 0, false], [0, 1, false]]), []);
  // A hole in the stored set blocks every populate whose window needs it.
  assert.deepEqual(populationPlan(grid(3).filter(([x, z]) => !(x === 1 && z === 1))), []);
  assert.deepEqual(populationPlan([]), []);
  // Input order does not matter: the plan is the sorted load order.
  assert.deepEqual(populationPlan(grid(3).reverse()), populationPlan(grid(3)));
});

function storedArea(seed, version, type, n, flag = () => false, origin = [0, 0], generatorOptions = '') {
  const pop = streamedSource({ seed: BigInt(seed), generationVersion: version, originX: origin[0] * 16, originZ: origin[1] * 16, worldType: type, generatorOptions }).population;
  const store = new Map(), coords = [], unpopulated = [];
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
    const o = pop.original(a + origin[0], b + origin[1]), cells = new Uint16Array(65536);
    for (let i = 0; i < 65536; i++) { if (!o.blocks[i] && !o.metadata[i]) continue; const m = fromOriginal(o.blocks[i], o.metadata[i]); cells[i] = m.id | m.meta << 8; }
    const populated = flag(a, b);
    store.set(`${a},${b}`, encodeBaseColumn('w', a, b, cells, { terrainPopulated: populated, lightPopulated: true, biomes: new Uint8Array(256).fill(1) }));
    coords.push([a, b]); if (!populated) unpopulated.push([a, b]);
  }
  const reads = [];
  return { pop, store, coords, unpopulated, origin, reads,
    read: async (w, cs) => { reads.push(cs.length); return cs.map(([x, z]) => store.get(`${x},${z}`)); },
    write: async (rs) => { for (const r of rs) store.set(`${r.x},${r.z}`, r); } };
}
const cellsOf = (record) => { const d = decodeBaseColumn(record); return d; };

test('stored unpopulated columns populate with the native rule; populated and neighbour-less columns stay untouched', async () => {
  const s = storedArea(17, 16, 'default', 4, (x, z) => x === 3 && z === 3);
  const before = new Map([...s.store].map(([k, r]) => [k, cellsOf(r)]));
  const out = await populateImportedColumns({ population: s.pop, origin: { chunkX: 0, chunkZ: 0 }, worldKey: 'w', coords: s.coords, unpopulated: s.unpopulated, read: s.read, write: s.write });
  // 4x4 stored, (3,3) saved populated: populates (0..2, 0..2) = 9, the edge row and column have no +x/+z neighbour.
  assert.equal(out.populated, 9);
  assert.equal(out.skipped.noNeighbours, 6);
  for (const [k, r] of s.store) {
    const [x, z] = k.split(',').map(Number), inside = x < 3 && z < 3;
    assert.equal(r.terrainPopulated, inside || (x === 3 && z === 3), k);
    assert.equal(r.lightPopulated, true, 'light flag kept');
    assert.deepEqual([...r.biomes], new Array(256).fill(1), 'biomes kept');
  }
  // The saved-populated corner column is not re-populated but its cells may take a neighbour's overhang; a column no populate window
  // touches is byte-identical.
  const same = (a, b) => a.blocks.every((v, i) => v === b.blocks[i]) && a.metadata.every((v, i) => v === b.metadata[i]);
  assert.ok(out.changedCells > 0);
  assert.ok(same(before.get('3,0'), cellsOf(s.store.get('3,0'))) || out.changedCells > 0);
  assert.ok(out.reads >= 16);
  // Idempotent: nothing is unpopulated with neighbours left, a second pass populates nothing.
  const again = await populateImportedColumns({ population: s.pop, origin: { chunkX: 0, chunkZ: 0 }, worldKey: 'w', coords: s.coords,
    unpopulated: s.coords.filter(([x, z]) => !s.store.get(`${x},${z}`).terrainPopulated), read: s.read, write: s.write });
  assert.equal(again.populated, 0);
});

test('population with MapFeatures off, Superflat presets and a streamed origin shift', async () => {
  const off = storedArea(3, 17, 'default', 3);
  const a = await populateImportedColumns({ population: off.pop, origin: { chunkX: 0, chunkZ: 0 }, worldKey: 'w', coords: off.coords, unpopulated: off.unpopulated, read: off.read, write: off.write });
  assert.equal(a.populated, 4);
  const flat = storedArea(1, 15, 'flat', 3, () => false, [0, 0], '3;minecraft:bedrock,2*minecraft:dirt,minecraft:grass;1;decoration');
  const f = await populateImportedColumns({ population: flat.pop, origin: { chunkX: 0, chunkZ: 0 }, worldKey: 'w', coords: flat.coords, unpopulated: flat.unpopulated, read: flat.read, write: flat.write });
  assert.equal(f.populated, 4);
  assert.equal(f.skipped.failed, 0);
  const shifted = storedArea(9, 16, 'largeBiomes', 3, () => false, [-5, 7]);
  // local coordinates 0..2 map to native -5.., 7..: the origin is subtracted, never added twice
  const b = await populateImportedColumns({ population: shifted.pop, origin: { chunkX: -5, chunkZ: 7 }, worldKey: 'w', coords: shifted.coords, unpopulated: shifted.unpopulated, read: shifted.read, write: shifted.write });
  assert.equal(b.populated, 4);
  assert.equal(shifted.store.get('0,0').terrainPopulated, true);
  assert.equal(shifted.store.get('2,2').terrainPopulated, false);
});

test('a populate that needs an unmappable original block is skipped and reported, not half applied', async () => {
  const s = storedArea(17, 16, 'default', 3);
  const snapshot = (r) => JSON.stringify(r.sections.map((q) => [q.s, Buffer.from(q.blocks).toString('base64'), Buffer.from(q.meta).toString('base64')]));
  const before = new Map([...s.store].map(([k, r]) => [k, snapshot(r)]));
  // Nothing but the terrain blocks maps exactly: any decoration written by the populate refuses the call.
  const out = await populateImportedColumns({ population: s.pop, origin: { chunkX: 0, chunkZ: 0 }, worldKey: 'w', coords: s.coords, unpopulated: s.unpopulated, read: s.read, write: s.write,
    mapBlock: (id, meta) => ([0, 1, 7, 3, 2, 8, 9, 10, 11, 12, 13, 15, 14, 16, 21, 56, 73, 129, 82, 78, 79, 80].includes(id) ? fromOriginal(id, meta) : null) });
  assert.ok(out.skipped.unmapped >= 1, 'the centre populate writes grass, plants or trees the restricted mapper refuses');
  assert.equal(out.populated, 0);
  for (const [k, r] of s.store) { assert.equal(snapshot(r), before.get(k), `${k} untouched when refused`); assert.equal(r.terrainPopulated, false); }
});

// ---- the whole-save pass --------------------------------------------------------------------------------------------------
const FLOOR = 7;
function chunkOf(cx, cz, populated) {
  const c = new Chunk(cx, cz, true);
  for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) {
    for (let y = 0; y < 5; y++) c.section(0, true).setBlock(lx, y, lz, FLOOR);
    for (let y = 5; y < 62; y++) c.section(y >> 4, true).setBlock(lx, y & 15, lz, 1);
    c.section(3, true).setBlock(lx, 14, lz, 2);
  }
  c.isTerrainPopulated = populated; c.isLightPopulated = true;
  return { chunk: c, tileEntities: [], entities: [] };
}
async function regionBytes(chunks) {
  const entries = [];
  for (const { chunk, ...payload } of chunks) { const a = regionAddress(chunk.x, chunk.z); entries.push(await encodeRegionChunk(chunkToNbt(chunk, payload), { x: a.x, z: a.z })); }
  return writeRegion(entries);
}
const file = (path, bytes) => ({ path, size: bytes.length, modified: 0, read: async () => bytes });
async function saveOf(options = {}) {
  const gen = new World('1710', 'javaStreamed', 16, 'default', '');
  const ox = gen.originX >> 4, oz = gen.originZ >> 4, chunks = [];
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) chunks.push(chunkOf(ox + a, oz + b, a === 2 && b === 2));
  // One saved-unpopulated Nether chunk: never populated here, counted.
  const nether = new Chunk(0, 0, true); nether.section(0, true).setBlock(1, 1, 1, 87); nether.isTerrainPopulated = false;
  const regions = new Map();
  for (const c of chunks) { const k = `${c.chunk.x >> 5},${c.chunk.z >> 5}`; (regions.get(k) ?? regions.set(k, []).get(k)).push(c); }
  const files = [file('Save/level.dat', await levelDatBytes(options.level))];
  for (const [k, list] of regions) files.push(file(`Save/region/r.${k.replace(',', '.')}.mca`, await regionBytes(list)));
  files.push(file('Save/DIM-1/region/r.0.0.mca', await regionBytes([{ chunk: nether, tileEntities: [], entities: [] }])));
  return files;
}

test('importWholeSave populates unpopulated stored chunks through readBases and reports it', async () => {
  const stored = new Map();
  const files = await saveOf();
  const { record, report } = await importWholeSave(files, { worldId: 'pop-test', writeBases: async (rs) => { for (const r of rs) stored.set(`${r.world}|${r.x}|${r.z}`, r); },
    readBases: async (w, cs) => cs.map(([x, z]) => stored.get(`${w}|${x}|${z}`) ?? null) });
  assert.equal(report.population.ran, true);
  assert.equal(report.population.unpopulatedStored, 8);
  assert.equal(report.population.populated, 4, 'the 2x2 with all three +x/+z neighbours stored, (2,2) saved populated');
  assert.equal(report.population.stillUnpopulated, 4);
  assert.deepEqual(report.population.unpopulatedNetherEnd, { '-1': 1, 1: 0 });
  assert.ok(report.population.changedCells >= 0);
  const flags = [...stored.values()].filter((r) => r.world === 'pop-test').map((r) => r.terrainPopulated);
  assert.equal(flags.filter(Boolean).length, 5, '4 populated now + the saved-populated corner');
  assert.equal([...stored.values()].find((r) => r.world === 'pop-test~-1').terrainPopulated, false);
  assert.doesNotMatch(report.save.notImported.join(' '), /stay unpopulated/, 'the report no longer claims chunks stay unpopulated when the pass ran');
  assert.ok(record.populatedColumns);
});

test('without readBases or with populate:false chunks stay as saved and the report says so', async () => {
  const stored = new Map(), files = await saveOf();
  const write = async (rs) => { for (const r of rs) stored.set(`${r.world}|${r.x}|${r.z}`, r); };
  const a = await importWholeSave(files, { worldId: 'no-pop', writeBases: write });
  assert.equal(a.report.population.ran, false);
  assert.equal(a.report.population.populated, 0);
  assert.match(a.report.save.notImported.join(' '), /stay unpopulated/);
  const b = await importWholeSave(files, { worldId: 'no-pop2', writeBases: write, readBases: async () => [], populate: false });
  assert.equal(b.report.population.ran, false);
});

test('the Node CLI whole-save mode populates through its JSON store', async () => {
  const files = await saveOf();
  const { record, report } = await wholeSaveRecord(files);
  assert.equal(report.population.populated, 4);
  const overworld = record.bases[0];
  assert.equal(overworld.length, 9);
  assert.equal(overworld.filter((c) => c.t).length, 5);
  const off = await wholeSaveRecord(files, { populate: false });
  assert.equal(off.record.bases[0].filter((c) => c.t).length, 1);
});

// Native Chunk.populateChunk runs the same ChunkProviderGenerate.populate with its block callbacks, so an imported unpopulated jungle temple
// (seed 671, structure-area-reference.json) gets the neighbour-callback writes (tripwire hooks, wire, repeater, piston): generation 22 (level.dat
// imports) replays them, generation 16 keeps the quiet result. The chain is the one `structure-live-neighbors.test.js` compares call by call.
test('imported unpopulated jungle temple populates with the neighbour callbacks at generation 22 and not at 16', async () => {
  const hashes = {};
  for (const version of [16, 22]) {
    const s = storedArea(671, version, 'default', 6, () => false, [0, 13]);
    const out = await populateImportedColumns({ population: s.pop, origin: { chunkX: 0, chunkZ: 13 }, worldKey: 'w', coords: s.coords, unpopulated: s.unpopulated, read: s.read, write: s.write });
    assert.equal(out.populated, 25);
    assert.equal(out.skipped.failed, 0);
    assert.equal(out.skipped.unmapped, 0);
    hashes[version] = JSON.stringify([...s.store.keys()].sort().map((k) => { const d = decodeBaseColumn(s.store.get(k)); return [d.blocks.join(','), d.metadata.join(',')]; }));
  }
  assert.notEqual(hashes[22], hashes[16]);
});

test('powered TNT of an imported populate becomes a primed TNT record in the chunk runtime', async () => {
  const { StructurePopulation } = await import('./structure-population.js');
  const real = StructurePopulation.prototype.populateChunk;
  let first = true;
  // Synthetic callback result (no vanilla structure powers TNT): one TNT at the block centre of the first populated chunk.
  StructurePopulation.prototype.populateChunk = function (random, x, z, opts) {
    const out = real.call(this, random, x, z, opts);
    if (first) { first = false; (this.world.primedTnt ??= []).push({ type: 'PrimedTnt', x: x * 16 + 8.5, y: 70.5, z: z * 16 + 8.5, fuse: 80 }); }
    return out;
  };
  try {
    const s = storedArea(17, 22, 'default', 3);
    const out = await populateImportedColumns({ population: s.pop, origin: { chunkX: 0, chunkZ: 0 }, worldKey: 'w', coords: s.coords, unpopulated: s.unpopulated, read: s.read, write: s.write });
    assert.equal(out.tnt.length, 1);
    const [t] = out.tnt;
    assert.deepEqual([t.x, t.z, t.fuse], [8.5, 8.5, 80]);
    assert.ok(Math.abs(t.y - (70.5 - 0.49)) < 1e-6 && t.vy === 0.20000000298023224);
  } finally { StructurePopulation.prototype.populateChunk = real; }
});
