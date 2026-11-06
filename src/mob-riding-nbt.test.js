// Riders in the Java chunk NBT: Entity.writeToNBT nests the mount as "Riding" inside its rider, Entity.writeToNBTOptional skips a mob that has a
// rider, and AnvilChunkLoader.loadEntities rebuilds each pair with mountEntity (verified against the unchanged bytecode, see mob-riding.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeRegionChunk, readRegion, regionAddress, regionSlot } from './region-file.js';
import { chunkFromNbt } from './chunk-nbt.js';
import { importJavaRegionArea } from './region-import.js';
import { World } from './world.js';
import { Survival } from './survival.js';
import { exportJavaSave } from './region-export.js';
import { EntityWorld } from './entities.js';

const byTypeEarly = (recs, t) => recs.find((m) => m.type === t);
const flat = { get: () => 0, getMeta: () => 0, solid: () => false, surface: () => 0, spawn: () => ({ x: 0, y: 0, z: 0 }), numericSeed: 1, height: 256 };

test('a spider jockey and a chicken jockey export as rider-with-Riding and import as linked pairs', async () => {
  const w = new World('17', 'javaStreamed', 12), player = new Survival({}, 'survival').serialize();
  const mobs = [
    { id: 'mob-1', type: 'spider', x: -2, y: 102, z: -2, health: 16 },
    { id: 'mob-2', type: 'skeleton', x: -2, y: 102.175, z: -2, health: 20, riding: 'mob-1' },
    { id: 'mob-3', type: 'chicken', x: -5, y: 102, z: -2, health: 4, chickenJockey: true },
    { id: 'mob-4', type: 'zombie', x: -5, y: 102.3, z: -2, health: 20, growingAge: -24000, riding: 'mob-3' },
    { id: 'mob-5', type: 'cow', x: -8, y: 102, z: -2, health: 10 },
    { id: 'mob-6', type: 'pig', x: -10, y: 102, z: -2, health: 10, saddled: true },
  ];
  const record = { id: 'rd', name: 'RD', seed: '17', biome: 'javaStreamed', generationVersion: 12, mode: 'survival', edits: [], player, position: { x: -0.5, y: 102, z: -0.5, yaw: 0, pitch: 0 }, entities: structuredClone(mobs), updated: 1700000000000 };
  const { files } = await exportJavaSave(record, { world: w });
  const cx = -1 + w.originX / 16, cz = -1 + w.originZ / 16, a = regionAddress(cx, cz), name = `region/r.${a.regionX}.${a.regionZ}.mca`;
  const chunk = chunkFromNbt(await decodeRegionChunk(readRegion(files.get(name)).get(regionSlot(a.x, a.z))));
  // Only the riders and the loose cow are chunk entities; each mount is nested.
  assert.deepEqual(chunk.entities.map((e) => e.get('id').value).sort(), ['Cow', 'Pig', 'Skeleton', 'Zombie']);
  const skeleton = chunk.entities.find((e) => e.get('id').value === 'Skeleton'), zombie = chunk.entities.find((e) => e.get('id').value === 'Zombie');
  assert.equal(skeleton.get('Riding').value.get('id').value, 'Spider');
  assert.equal(zombie.get('Riding').value.get('id').value, 'Chicken');
  assert.equal(zombie.get('Riding').value.get('IsChickenJockey').value, 1);
  assert.equal(zombie.get('IsBaby').value, 1);
  assert.equal(skeleton.get('Riding').value.has('Riding'), false);

  const regions = [...files].filter(([n]) => n.startsWith('region/')).map(([n, bytes]) => ({ filename: n.split('/').pop(), bytes }));
  const imported = await importJavaRegionArea(regions, { area: { chunkX: cx, chunkZ: cz, width: 1, depth: 1 }, mode: 'survival' });
  assert.deepEqual(imported.report.entities.lost, []);
  const recs = imported.record.entities;
  assert.equal(recs.length, 6);
  assert.equal(byTypeEarly(recs, 'pig').saddled, true, 'a saddled pig imports through the farm-animal reader');
  const byType = (t) => recs.find((m) => m.type === t);
  assert.equal(byType('skeleton').riding, byType('spider').id);
  assert.equal(byType('zombie').riding, byType('chicken').id);
  assert.equal(byType('cow').riding, undefined);
  assert.equal(new Set(recs.map((m) => m.id).filter(Boolean)).size, 4);

  const ew = new EntityWorld(flat, recs.map((m) => ({ ...m, x: 64.5, y: 1, z: 64.5 })), () => 0.5);
  const live = (t) => ew.entities.find((e) => e.type === t);
  assert.equal(live('skeleton').ridingEntity, live('spider'));
  assert.equal(live('spider').riddenBy, live('skeleton'));
  assert.equal(live('zombie').ridingEntity, live('chicken'));
  assert.equal(live('chicken').chickenJockey, true);
  assert.equal(live('cow').ridingEntity, undefined);
});

test('a browser save restores the pair after serialize and a reload', () => {
  const ew = new EntityWorld(flat, [
    { id: 'mob-1', type: 'spider', x: 64.5, y: 1, z: 64.5, health: 16 },
    { id: 'mob-2', type: 'skeleton', x: 64.5, y: 1.2, z: 64.5, health: 20, riding: 'mob-1' },
  ], () => 0.5);
  const saved = JSON.parse(JSON.stringify(ew.serialize()));
  assert.equal(saved.find((m) => m.type === 'skeleton').riding, 'mob-1');
  const again = new EntityWorld(flat, saved, () => 0.5);
  const sk = again.entities.find((e) => e.type === 'skeleton');
  assert.equal(sk.ridingEntity.type, 'spider');
  assert.equal(sk.ridingEntity.riddenBy, sk);
});
