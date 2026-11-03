import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { World } from './world.js';
import { exportJavaSave } from './region-export.js';
import { importJavaRegionArea } from './region-import.js';
import { structureDataFiles, parseStructureDataFiles, hasStructureData } from './structure-data.js';
import { decodeCompressedNbt, encodeCompressedNbt } from './nbt-compression.js';
import { compoundTag } from './structure-nbt.js';
import { NBT, decodeNbt } from './nbt.js';

const reference = JSON.parse(await readFile(new URL('../public/research/structure-data-reference.json', import.meta.url), 'utf8'));
const NAMES = ['Mineshaft', 'Village', 'Stronghold', 'Temple'];
const chunksOf = ([x0, x1, z0, z1]) => { const c = []; for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) c.push([x, z]); return c; };
const raw = (bytes) => gunzipSync(Buffer.from(bytes));
const b64 = (bytes) => Buffer.from(bytes).toString('base64');

test('reference covers the structure kinds and every start id', () => {
  assert.equal(reference.records.length, 4);
  assert.ok(reference.summary.starts.Village >= 1 && reference.summary.starts.Stronghold >= 1 && reference.summary.starts.Temple >= 1 && reference.summary.starts.Mineshaft >= 1);
});

for (const rec of reference.records) {
  test(`native data/*.dat bytes replay for seed ${rec.seed} ${rec.range}`, async () => {
    for (const version of [14, 15]) {
      const { files } = await structureDataFiles({ record: { biome: version === 15 ? 'javaStreamed' : 'java' }, seed: rec.seed, chunks: chunksOf(rec.range), generationVersion: version });
      assert.deepEqual([...files.keys()].sort(), NAMES.map((n) => `data/${n}.dat`).sort());
      for (const name of NAMES) assert.equal(raw(files.get(`data/${name}.dat`)).toString('base64'), rec.files[name].rawBase64, `${name} v${version}`);
    }
  });
}

test('versions 8-13 write nothing and chunk order does not change the bytes', async () => {
  const rec = reference.records[0], chunks = chunksOf(rec.range);
  for (const v of [9, 11, 12, 13]) assert.equal(hasStructureData(v), false);
  assert.equal((await structureDataFiles({ record: { biome: 'java' }, seed: rec.seed, chunks, generationVersion: 13 })).files.size, 0);
  const shuffled = [...chunks].reverse(), a = await structureDataFiles({ record: { biome: 'java' }, seed: rec.seed, chunks: shuffled, generationVersion: 14 });
  assert.equal(raw(a.files.get('data/Village.dat')).toString('base64'), rec.files.Village.rawBase64);
});

// A Java save as imported: the native gzip files, an unknown Fortress start and a corrupt file.
async function importedWithFortress(rec) {
  const doc = decodeNbt(Buffer.from(rec.files.Mineshaft.rawBase64, 'base64'));
  const features = doc.tag.value.get('data').value.get('Features').value;
  const fortress = compoundTag([['id', { type: NBT.STRING, value: 'Fortress' }], ['ChunkX', { type: NBT.INT, value: 9999 }], ['ChunkZ', { type: NBT.INT, value: 9999 }], ['Children', { type: NBT.LIST, value: { elementType: NBT.COMPOUND, items: [] } }]]);
  const entries = [...features, ['[9999,9999]', fortress]];
  return encodeCompressedNbt({ name: '', tag: compoundTag([['data', compoundTag([['Features', compoundTag(entries)]])]]) });
}

test('import keeps data/*.dat, counts unknown ids and survives corrupt files', async () => {
  const rec = reference.records[0];
  const village = (await structureDataFiles({ record: { biome: 'java' }, seed: rec.seed, chunks: chunksOf(rec.range), generationVersion: 14 })).files.get('data/Village.dat');
  const nether = await importedWithFortress(rec);
  const { record, report } = await importJavaRegionArea([], {
    area: { chunkX: -1, chunkZ: -1, width: 1, depth: 1 }, missing: 'air',
    structureData: [{ filename: 'data/Village.dat', bytes: village }, { filename: 'data/Mineshaft.dat', bytes: nether }, { filename: 'data/Temple.dat', bytes: new Uint8Array([1, 2, 3]) }],
  });
  assert.equal(report.structures.files.length, 2);
  assert.equal(report.structures.invalid.length, 1);
  assert.deepEqual(report.structures.unknownIds, { Fortress: 1 });
  assert.equal(typeof report.structures.kept, 'boolean');
  if (report.structures.kept) assert.deepEqual(Object.keys(record.structureData).sort(), ['Mineshaft', 'Village']);
  else assert.equal(record.structureData, undefined);
});

test('round trip: imported data re-exports unchanged for old versions and merges with native precedence for v14', async () => {
  const rec = reference.records[0], chunks = chunksOf(rec.range);
  const nether = await importedWithFortress(rec), villageBytes = (await structureDataFiles({ record: { biome: 'java' }, seed: rec.seed, chunks, generationVersion: 14 })).files.get('data/Village.dat');
  const { structureData, report } = await parseStructureDataFiles([{ filename: 'data/Mineshaft.dat', bytes: nether }, { filename: 'data/Village.dat', bytes: villageBytes }]);
  assert.deepEqual(report.unknownIds, { Fortress: 1 });
  // v13: exactly what was imported, nothing regenerated.
  const old = await structureDataFiles({ record: { biome: 'java', structureData }, seed: rec.seed, chunks, generationVersion: 13 });
  assert.deepEqual([...old.files.keys()].sort(), ['data/Mineshaft.dat', 'data/Village.dat']);
  assert.equal(b64(raw(old.files.get('data/Mineshaft.dat'))), b64(raw(nether)));
  // v14: regenerated starts are merged in; the imported Fortress survives and imported starts are not replaced.
  const merged = await structureDataFiles({ record: { biome: 'java', structureData }, seed: rec.seed, chunks, generationVersion: 14 });
  assert.equal(merged.files.size, 4);
  assert.equal(raw(merged.files.get('data/Village.dat')).toString('base64'), rec.files.Village.rawBase64);
  const mine = await decodeCompressedNbt(merged.files.get('data/Mineshaft.dat')), keys = [...mine.tag.value.get('data').value.get('Features').value.keys()];
  assert.ok(keys.includes('[9999,9999]'));
  assert.equal(merged.report.imported, report.starts);
  // and a second round trip is a fixed point
  const again = await parseStructureDataFiles([...merged.files].map(([filename, bytes]) => ({ filename, bytes })));
  const second = await structureDataFiles({ record: { biome: 'java', structureData: again.structureData }, seed: rec.seed, chunks, generationVersion: 14 });
  for (const [name, bytes] of merged.files) assert.equal(b64(raw(second.files.get(name))), b64(raw(bytes)), name);
});

test('exportJavaSave writes data/*.dat for v15 and none for v12', async () => {
  const w = new World('17', 'javaStreamed', 12);
  const base = { id: 'e', name: 'E', seed: '17', biome: 'javaStreamed', mode: 'creative', edits: [], position: { x: 0, y: 100, z: 0, yaw: 0, pitch: 0 }, updated: 1700000000000 };
  const old = await exportJavaSave({ ...base, generationVersion: 12 }, { world: w });
  assert.equal([...old.files.keys()].filter((k) => k.startsWith('data/')).length, 0);
  const fresh = await exportJavaSave({ ...base, generationVersion: 15 }, { world: w });
  assert.equal(fresh.files.has('data/Village.dat'), true);
  assert.equal(fresh.report.structureData.files.length, 4);
  const doc = await decodeCompressedNbt(fresh.files.get('data/Mineshaft.dat'));
  assert.equal(doc.name, '');
  assert.ok(doc.tag.value.get('data').value.get('Features'));
});
