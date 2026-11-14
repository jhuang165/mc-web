// Batch 73 nbtexport73: flower pot and fieldless tile entities through the Java region export and import, TileTicks, daylight sensor power.
import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from './world.js';
import { Survival } from './survival.js';
import { exportJavaSave } from './region-export.js';
import { importJavaRegionArea } from './region-import.js';
import { readRegion, decodeRegionChunk } from './region-file.js';
import { chunkFromNbt } from './chunk-nbt.js';
import { decodeCompressedNbt } from './nbt-compression.js';
import { potNbtOf, potFromNbt } from './stone-utility.js';

const ids = (c) => c.tileEntities.map((t) => `${t.get('id').value}`).sort();
async function roundTrip(edits, extra = {}) {
  const w = new World('17', 'javaStreamed', 12);
  w.restore(edits);
  const record = { id: 'x', name: 'X', seed: '17', biome: 'javaStreamed', generationVersion: 12, mode: 'survival', edits: [...w.edits], player: new Survival({}, 'survival').serialize(), position: { x: 3.5, y: 110, z: 5.5, yaw: 0, pitch: 0 }, ...extra };
  const { files } = await exportJavaSave(record, { world: w });
  const regions = [...files].filter(([k]) => /^region\/.*\.mca$/.test(k)).map(([k, bytes]) => ({ filename: k.slice(7), bytes }));
  const chunks = [];
  for (const { bytes } of regions) for (const entry of readRegion(bytes).values()) chunks.push(chunkFromNbt(await decodeRegionChunk(entry)));
  const data = (await decodeCompressedNbt(files.get('level.dat'))).tag.value.get('Data').value;
  return { files, regions, chunks, w, data };
}
const areaOf = (w, cx, cz) => ({ chunkX: cx + w.originX / 16, chunkZ: cz + w.originZ / 16, width: 1, depth: 1 });
const tilesOf = (chunks, id) => chunks.flatMap((c) => c.tileEntities).filter((t) => t.get('id').value === id);

test('flower pot NBT helpers keep native Item and Data', () => {
  assert.deepEqual(potNbtOf({ id: 44, damage: 3 }), { Item: 38, Data: 3 });
  assert.deepEqual(potFromNbt({ Item: 38, Data: 3 }), { id: 44, damage: 3 });
  assert.equal(potFromNbt({ Item: 0, Data: 0 }), null);
});

test('a pot, an ender chest, an enchanting table and a daylight sensor export their tile entities and the pot imports back', async () => {
  const edits = [['0,100,0', 106], ['2,100,0', 163], ['4,100,0', 86], ['6,100,0', 129 | (7 << 8)], ['8,100,0', 106]];
  const out = await roundTrip(edits, { pots: [{ x: 0, y: 100, z: 0, id: 44, damage: 3 }] });
  const pot = tilesOf(out.chunks, 'FlowerPot');
  assert.equal(pot.length, 2);
  const filled = pot.find((t) => t.get('x').value === out.w.originX), empty = pot.find((t) => t !== filled);
  assert.deepEqual([filled.get('Item').value, filled.get('Data').value], [38, 3]);
  assert.deepEqual([empty.get('Item').value, empty.get('Data').value], [0, 0]);
  assert.equal(tilesOf(out.chunks, 'EnderChest').length, 1);
  assert.equal(tilesOf(out.chunks, 'EnchantTable').length, 1);
  assert.equal(tilesOf(out.chunks, 'DLDetector').length, 1);
  // the daylight sensor power is the block metadata, not tile data
  const chunk = out.chunks.find((c) => tilesOf([c], 'DLDetector').length);
  assert.equal(chunk.chunk.getBlock(6, 100, 0), 151);
  assert.equal(chunk.chunk.getMeta(6, 100, 0), 7);
  const back = await importJavaRegionArea(out.regions, { area: areaOf(out.w, 0, 0) });
  assert.equal(back.record.pots.length, 1);
  const [p] = back.record.pots;
  assert.deepEqual([p.x & 15, p.y, p.z & 15, p.id, p.damage], [0, 100, 0, 44, 3]);
  assert.equal(back.report.tileEntities.converted.FlowerPot, 2);
  assert.equal(back.report.tileEntities.converted.DLDetector, 1);
  assert.equal(back.report.tileEntities.converted.EnchantTable, 1);
  assert.equal(back.report.tileEntities.converted.EnderChest, 1);
  assert.deepEqual(back.report.tileEntities.lost, []);
});

test('fluid ticks export as TileTicks with native fields and import back as delays', async () => {
  const out = await roundTrip([['-1,99,-1', 10]], { fluidTicks: { version: 1, time: 80, entries: [{ x: -1, y: 99, z: -1, block: 10, delay: 3 }] } });
  const ticks = out.chunks.flatMap((c) => c.tileTicks ?? []);
  assert.ok(ticks.length >= 1);
  assert.deepEqual([...ticks[0].keys()].sort(), ['i', 'p', 't', 'x', 'y', 'z']);
  assert.equal(ticks[0].get('t').value, 3);
  const back = await importJavaRegionArea(out.regions, { area: areaOf(out.w, -1, -1) });
  assert.ok(back.record.fluidTicks?.entries?.some((e) => e.delay === 3));
});
