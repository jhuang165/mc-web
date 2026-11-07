import test from 'node:test';
import assert from 'node:assert/strict';
import { Chunk } from './chunk-store.js';
import { chunkToNbt } from './chunk-nbt.js';
import { encodeRegionChunk, writeRegion, regionAddress } from './region-file.js';
import { levelDatBytes } from './level-dat-fixture.js';
import { wholeSaveRecord } from './whole-save-cli.js';
import { basesFromJson } from './whole-save-json.js';

async function region(chunks) {
  const out = [];
  for (const c of chunks) { const a = regionAddress(c.x, c.z); out.push(await encodeRegionChunk(chunkToNbt(c, {}), { x: a.x, z: a.z })); }
  return writeRegion(out);
}
const chunkAt = (cx, cz, block) => {
  const c = new Chunk(cx, cz, true);
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) c.section(0, true).setBlock(x, 1, z, block);
  c.isTerrainPopulated = true; c.isLightPopulated = true;
  return c;
};
const file = (path, bytes) => ({ path, size: bytes.length, modified: 0, read: async () => bytes });

test('whole-save CLI record embeds JSON bases per dimension and honours the size limit', async () => {
  const entries = [
    file('S/level.dat', await levelDatBytes()),
    file('S/region/r.0.0.mca', await region([chunkAt(0, 0, 7), chunkAt(1, 0, 7)])),
    file('S/DIM-1/region/r.0.0.mca', await region([chunkAt(0, 0, 87)])),
  ];
  const { record, report } = await wholeSaveRecord(entries, { name: 'CLI' });
  assert.equal(record.format, 'blockworld');
  assert.equal(record.bases[0].length, 2);
  assert.equal(record.bases[-1].length, 1);
  assert.equal(report.basesJson.omitted, 0);
  assert.equal(basesFromJson(record.bases, (d) => `w${d}`).length, 3);
  const small = await wholeSaveRecord(entries, { limit: 1 });
  assert.equal(small.report.basesJson.columns, 0);
  assert.equal(small.record.wholeSave.basesOmitted, 3);
});
