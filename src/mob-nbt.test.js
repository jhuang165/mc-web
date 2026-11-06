// Chunk-save NBT written by the unchanged 1.7.10 classes (public/research/mob-nbt-reference.json, tools/probes/MobNbtProbe.java)
// imported through java-mobs.js and region import, then restored by EntityWorld. Each record's getters are the native read-back.
import test from 'node:test';
import assert from 'node:assert/strict';
import reference from '../public/research/mob-nbt-reference.json' with { type: 'json' };
import { decodeNbt, NBT } from './nbt.js';
import { javaMobFromNbt, JAVA_SUMMON_MOBS, importedMobType } from './java-mobs.js';
import { EntityWorld } from './entities.js';
import { Chunk } from './chunk-store.js';
import { chunkToNbt } from './chunk-nbt.js';
import { encodeRegionChunk, writeRegion, regionAddress } from './region-file.js';
import { importJavaRegionArea } from './region-import.js';
import { importedRuntime } from './world-import.js';

const tagOf = (m) => decodeNbt(Uint8Array.from(m.nbt.match(/../g).map((b) => parseInt(b, 16)))).tag.value;
const flat = { get: () => 0, getMeta: () => 0, solid: () => false, surface: () => 0, spawn: () => ({ x: 0, y: 0, z: 0 }), numericSeed: 1 };
// The finite test world keeps mobs inside 0..128 (EntityWorld.restore), so the live check moves the record to its middle.
const live = (record) => new EntityWorld(flat, [{ ...record, x: 64.5, y: 1, z: 64.5 }], () => 0.5).entities[0];

test('the probe covers every JAVA_SUMMON_MOBS id', () => {
  assert.equal(reference.mobs.length, 22);
  assert.deepEqual([...new Set(reference.mobs.map((m) => m.id))].sort(), Object.keys(JAVA_SUMMON_MOBS).sort());
  for (const m of reference.mobs) assert.equal(importedMobType(m.id), m.kind);
});

for (const [i, m] of reference.mobs.entries()) {
  test(`native ${m.id} NBT #${i} imports with the native read-back`, () => {
    const tag = tagOf(m), r = javaMobFromNbt(tag, { shiftX: 10, shiftZ: -20 });
    assert.ok(r, 'converted');
    assert.equal(r.type, m.kind);
    assert.deepEqual([r.x, r.y, r.z], [m.x + 10, m.y, m.z - 20]);
    assert.ok(Math.abs(r.yaw + (m.yaw * Math.PI) / 180) < 1e-9, 'yaw');
    assert.equal(r.health, m.health);
    if ('age' in m) assert.equal(r.growingAge, m.age);
    if ('love' in m) assert.equal(r.love, m.love);
    if ('saddled' in m) assert.equal(r.saddled, m.saddled);
    if ('color' in m) assert.deepEqual([r.color, r.sheared], [m.color, m.sheared]);
    if ('tamed' in m) assert.deepEqual([!!r.owner, r.sitting, r.angry, r.collar], [m.tamed, m.sitting, m.angry, m.collar]);
    if ('powered' in m) assert.deepEqual([r.powered, r.ignited], [m.powered, m.ignited]);
    assert.equal(r.fire, Math.max(-1, tag.get('Fire').value));
    if (tag.get('CustomName').value) assert.equal(r.customName, tag.get('CustomName').value);
    assert.equal(!!r.persistent, !!tag.get('PersistenceRequired').value);
    // EntityWorld keeps it as the same live mob.
    const e = live(r);
    assert.equal(e.type, m.kind);
    assert.equal(e.health, m.health);
    if ('age' in m) assert.equal(e.growingAge, m.age);
    if ('saddled' in m) assert.equal(e.saddled, m.saddled);
    if ('color' in m) assert.deepEqual([e.color, e.sheared], [m.color, m.sheared]);
    if ('tamed' in m) assert.deepEqual([!!e.owner, e.sitting, e.angry, e.collar], [m.tamed, m.sitting, m.angry, m.collar]);
    if ('powered' in m) assert.deepEqual([e.powered, e.ignited], [m.powered, m.ignited]);
  });
}

test('HealF is clamped by the saved generic.maxHealth (Attributes are read first)', () => {
  // The probe's owned wolf kept the untamed wolf's maxHealth 8 in its Attributes, so HealF 18 loads as 8.
  const wolf = reference.mobs.find((m) => m.kind === 'wolf' && m.tamed);
  assert.equal(wolf.health, 8);
  assert.equal(javaMobFromNbt(tagOf(wolf)).health, 8);
  const tag = new Map(tagOf(wolf));
  tag.delete('Attributes');
  tag.set('HealF', { type: NBT.FLOAT, value: 18 });
  assert.equal(javaMobFromNbt(tag).health, 18, 'without Attributes the tamed wolf cap (20) applies');
});

test('a region with the native mobs imports them all as saved entities', async () => {
  const chunk = new Chunk(0, 0);
  // Move each native compound into chunk (0, 0): Pos is replaced, everything else is the native tag.
  const entities = reference.mobs.map((m, i) => {
    const tag = new Map(tagOf(m));
    tag.set('Pos', { type: NBT.LIST, value: { elementType: NBT.DOUBLE, items: [1.5 + (i % 4) * 3, 70, 1.5 + Math.floor(i / 4) * 2.5] } });
    return tag;
  });
  const { x, z } = regionAddress(0, 0);
  const files = [{ filename: 'r.0.0.mca', bytes: writeRegion([await encodeRegionChunk(chunkToNbt(chunk, { entities, tileEntities: [] }), { x, z })]) }];
  const { record, report } = await importJavaRegionArea(files, { area: { chunkX: 0, chunkZ: 0, width: 1, depth: 1 }, mode: 'survival' });
  assert.deepEqual(report.entities.lost, []);
  assert.equal(Object.values(report.entities.converted).reduce((a, b) => a + b, 0), 22);
  const runtime = importedRuntime(JSON.parse(JSON.stringify(record)));
  const mobs = runtime.entities ?? record.entities;
  assert.equal(mobs.length, 22);
  const ew = new EntityWorld({ ...flat, height: 256 }, mobs, () => 0.5);
  assert.deepEqual(ew.entities.map((e) => e.type), reference.mobs.map((m) => m.kind));
  assert.ok(ew.entities.find((e) => e.type === 'pig' && e.saddled));
  assert.ok(ew.entities.find((e) => e.type === 'sheep' && e.color === 14 && e.sheared));
});

test('export then import keeps the passive and hostile mobs and their saved state', async () => {
  const { World } = await import('./world.js');
  const { Survival } = await import('./survival.js');
  const { exportJavaSave } = await import('./region-export.js');
  const { readRegion, decodeRegionChunk, regionSlot } = await import('./region-file.js');
  const { chunkFromNbt } = await import('./chunk-nbt.js');
  const w = new World('17', 'javaStreamed', 12), player = new Survival({}, 'survival').serialize();
  const at = (i) => ({ x: -2 - i * 0.75, y: 102, z: -2 });
  const mobs = [
    { type: 'pig', health: 6, growingAge: -100, saddled: true },
    { type: 'cow', health: 10, growingAge: 0, love: 200 },
    { type: 'mooshroom', health: 9, growingAge: 0 },
    { type: 'sheep', health: 8, growingAge: 0, color: 11, sheared: true },
    { type: 'chicken', health: 4, growingAge: -50, chickenJockey: true },
    { type: 'wolf', health: 15, growingAge: 0, owner: 'player', sitting: true, collar: 5 },
    { type: 'wolf', health: 8, growingAge: 0, angry: true },
    { type: 'spider', health: 16 }, { type: 'cave_spider', health: 12 },
    { type: 'creeper', health: 20, powered: true },
    { type: 'witch', health: 26 }, { type: 'silverfish', health: 8 }, { type: 'snow_golem', health: 4 },
  ].map((m, i) => ({ ...m, ...at(i) }));
  const record = { id: 'mn', name: 'MN', seed: '17', biome: 'javaStreamed', generationVersion: 12, mode: 'survival', edits: [], player,
    position: { x: -0.5, y: 102, z: -0.5, yaw: 0, pitch: 0 }, entities: mobs, updated: 1700000000000 };
  const { files } = await exportJavaSave(record, { world: w });
  const cx = -1 + w.originX / 16, cz = -1 + w.originZ / 16, a = regionAddress(cx, cz);
  const chunk = chunkFromNbt(await decodeRegionChunk(readRegion(files.get(`region/r.${a.regionX}.${a.regionZ}.mca`)).get(regionSlot(a.x, a.z))));
  const back = chunk.entities.map((e) => javaMobFromNbt(e, { shiftX: -w.originX, shiftZ: -w.originZ })).filter(Boolean);
  assert.deepEqual(back.map((m) => m.type), mobs.map((m) => m.type));
  for (const [i, m] of mobs.entries()) {
    const b = back[i];
    assert.ok(Math.abs(b.x - m.x) < 1e-9 && b.z === m.z, `${m.type} position`);
    for (const k of ['health', 'growingAge', 'love', 'saddled', 'color', 'sheared', 'sitting', 'angry', 'collar', 'powered', 'chickenJockey']) if (k in m) assert.equal(b[k], m[k], `${m.type} ${k}`);
    if (m.owner) assert.equal(b.owner, 'player');
  }
});
