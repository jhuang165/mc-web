// Java save-folder import (save-folder-import.js) on an in-test fake file list: level.dat written with the repo's NBT writer.
import test from 'node:test';
import assert from 'node:assert/strict';
import { NBT } from './nbt.js';
import { encodeCompressedNbt } from './nbt-compression.js';
import { indexSave, importSaveFolder, entriesFromFileList, areaAround } from './save-folder-import.js';
import { levelDatBytes, playerTag } from './level-dat-fixture.js';

const file = (path, bytes, modified = 0) => ({ path, size: bytes.length, modified, read: async () => bytes });
const text = (s) => new TextEncoder().encode(s);

test('a folder without level.dat is refused with a hint', () => {
  assert.throws(() => indexSave([file('Save/region/r.0.0.mca', new Uint8Array(1))]), /no level\.dat/);
  assert.throws(() => indexSave([file('a/b/c/level.dat', new Uint8Array(1))]), /nested too deeply/);
});

test('indexSave finds the folder prefix and relative paths', () => {
  const idx = indexSave([file('My World/level.dat', new Uint8Array(1)), file('My World/region/r.0.0.mca', new Uint8Array(1))]);
  assert.equal(idx.folder, 'My World');
  assert.deepEqual([...idx.files.keys()].sort(), ['level.dat', 'region/r.0.0.mca']);
});

test('a hardcore save folder imports as a hardcore world around the player', async () => {
  const entries = [
    file('Doom/level.dat', await levelDatBytes({ hardcore: 1, player: playerTag({ Pos: { type: NBT.LIST, value: { elementType: NBT.DOUBLE, items: [100.5, 70, -40.5] } } }) })),
    file('Doom/stats/abc.json', text('{}')),
    file('Doom/DIM-1/region/r.0.0.mca', new Uint8Array(1)),
  ];
  const { record, report } = await importSaveFolder(entries);
  assert.equal(record.hardcore, true);
  assert.equal(record.name, 'Hardcore test');
  assert.equal(report.save.folder, 'Doom');
  assert.equal(report.save.area.around, 'player');
  assert.deepEqual([report.save.area.chunkX, report.save.area.chunkZ], [Math.floor(100.5 / 16) - 4, Math.floor(-40.5 / 16) - 4]);
  assert.equal(report.save.statsFile, 'abc.json');
  assert.ok(report.save.notImported.some((n) => /DIM-1/.test(n)));
});

test('without a player the area is the world spawn, and a separate playerdata file is picked', async () => {
  const bare = await importSaveFolder([file('S/level.dat', await levelDatBytes())]);
  assert.equal(bare.report.save.area.around, 'spawn');
  const dat = await encodeCompressedNbt({ name: '', tag: { type: NBT.COMPOUND, value: playerTag() } });
  const withFile = await importSaveFolder([file('S/level.dat', await levelDatBytes()), file('S/playerdata/u1.dat', dat, 1), file('S/playerdata/u2.dat', dat, 5)]);
  assert.equal(withFile.report.save.playerFile.name, 'u2.dat');
  assert.equal(withFile.report.save.playerFile.of, 2);
  assert.equal(withFile.record.flying, true);
  assert.equal(areaAround({ spawn: [0, 64, 0] }, null).around, 'spawn');
});

test('entriesFromFileList uses webkitRelativePath', async () => {
  const f = { webkitRelativePath: 'W/level.dat', name: 'level.dat', size: 3, lastModified: 7, arrayBuffer: async () => new ArrayBuffer(3) };
  const [e] = entriesFromFileList([f]);
  assert.equal(e.path, 'W/level.dat'); assert.equal(e.modified, 7);
  assert.equal((await e.read()).byteLength, 3);
});
