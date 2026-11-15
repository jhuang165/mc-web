// Batch 75 entityaudit75: the object entities (XPOrb, FallingSand, PrimedTnt, EnderCrystal) in the Java export and import, compared field by field
// with the chunk-save NBT the unchanged 1.7.10 classes write (public/research/object-nbt-reference.json, tools/probes/ObjectNbtProbe.java,
// tools/verify-object-nbt.mjs). Notes: .shared-memory/notes/entityaudit75-b75-track.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import ref from '../public/research/object-nbt-reference.json' with { type: 'json' };
import { decodeNbt, NBT } from './nbt.js';
import { Chunk } from './chunk-store.js';
import { chunkFromNbt } from './chunk-nbt.js';
import { javaObjectFromNbt, fallingCellOf } from './java-objects.js';
import { importJavaRegionArea } from './region-import.js';
import { encodeRegionChunk, writeRegion } from './region-file.js';
import { chunkToNbt } from './chunk-nbt.js';
import { fromOriginal } from './block-registry.js';
import { ANVIL, SAND } from './world.js';
import { regionSlot, regionAddress, readRegion, decodeRegionChunk } from './region-file.js';

const bytes = (hex) => Uint8Array.from(hex.match(/../g).map((b) => parseInt(b, 16)));
const tagOf = (hex) => decodeNbt(bytes(hex)).tag.value;
const nativeOf = (kind, i = 0) => ref.projectiles.filter((p) => p.kind === kind)[i];

async function exportEntities(record) {
  const { World } = await import('./world.js');
  const { Survival } = await import('./survival.js');
  const { exportJavaSave } = await import('./region-export.js');
  const w = new World('17', 'javaStreamed', 12), player = new Survival({}, 'survival').serialize();
  const { files, report } = await exportJavaSave({ id: 'oa', name: 'OA', seed: '17', biome: 'javaStreamed', generationVersion: 12, mode: 'survival', edits: [], player,
    position: { x: -0.5, y: 102, z: -0.5, yaw: 0, pitch: 0 }, updated: 1700000000000, ...record }, { world: w });
  const cx = -1 + w.originX / 16, cz = -1 + w.originZ / 16, a = regionAddress(cx, cz);
  const chunk = chunkFromNbt(await decodeRegionChunk(readRegion(files.get(`region/r.${a.regionX}.${a.regionZ}.mca`)).get(regionSlot(a.x, a.z))));
  return { w, chunk, report };
}
const byId = (chunk, id) => chunk.entities.filter((e) => e.get('id').value === id);
// Keys and tag types, without the entity-specific uuid and position values.
const shape = (m) => [...m].map(([k, v]) => `${k}:${v.type}`).sort();

test('the probe saw the four object classes', () => {
  assert.equal(ref.projectiles.length, 23);
  assert.deepEqual([...new Set(ref.projectiles.map((p) => p.id))].sort(), ['EnderCrystal', 'FallingSand', 'PrimedTnt', 'XPOrb']);
  assert.ok(ref.projectiles.every((p) => p.saved && p.loaded));
});

test('export writes the same tag keys and types as the native XPOrb, PrimedTnt and EnderCrystal', async () => {
  const { chunk } = await exportEntities({
    xpOrbs: [{ x: -2.5, y: 101.75, z: -2.5, value: 7, age: 0, health: 5, fire: 0, vx: 0.25, vy: -0.5, vz: 1, onGround: false }],
    tnt: [{ x: -3.5, y: 101.5, z: -3.5, vx: 0.25, vy: -0.5, vz: 1, fuse: 80 }],
  });
  const orb = byId(chunk, 'XPOrb')[0], tnt = byId(chunk, 'PrimedTnt')[0];
  for (const [mine, kind] of [[orb, 'xporb'], [tnt, 'tnt']]) {
    const native = tagOf(nativeOf(kind).nbt);
    assert.deepEqual(shape(mine), shape(native), kind);
    assert.equal(mine.get('Fire').value, native.get('Fire').value, `${kind} Fire (an object entity starts at 0, not the -1 of a mob)`);
    assert.equal(mine.get('Air').value, native.get('Air').value, `${kind} Air`);
  }
  const nativeOrb = tagOf(nativeOf('xporb').nbt);
  assert.deepEqual(['Health', 'Age', 'Value'].map((k) => orb.get(k).value), ['Health', 'Age', 'Value'].map((k) => nativeOrb.get(k).value).map((v, i) => [5, 0, 7][i]));
  assert.equal(tnt.get('Fuse').value, 80);
});

test('export writes every EntityFallingBlock tag, with HurtEntities for an anvil and a summoned hurt block', async () => {
  const { chunk } = await exportEntities({
    falling: [
      { x: -2.5, y: 101.51, z: -2.5, block: SAND, meta: 0, ticks: 5, vx: 0, vy: -0.5, vz: 0 },
      { x: -3.5, y: 101.51, z: -3.5, block: ANVIL, meta: 2, ticks: 9, vx: 0, vy: -0.5, vz: 0 },
      { x: -4.5, y: 101.51, z: -4.5, block: SAND, meta: 0, ticks: 3, vx: 0, vy: 0, vz: 0, hurtEntities: true, fallHurtAmount: 3.5, fallHurtMax: 20 },
    ],
  });
  const [sand, anvil, hurt] = byId(chunk, 'FallingSand');
  const native = tagOf(nativeOf('falling').nbt);
  for (const e of [sand, anvil, hurt]) assert.deepEqual(shape(e), shape(native));
  assert.equal(sand.get('Fire').value, native.get('Fire').value);
  const fields = (e) => ['Tile', 'TileID', 'Data', 'Time', 'DropItem', 'HurtEntities', 'FallHurtAmount', 'FallHurtMax'].map((k) => e.get(k).value);
  // fresh native sand: Tile 12, TileID 12, Data 0, DropItem 1, HurtEntities 0, FallHurtAmount 2, FallHurtMax 40
  assert.deepEqual(fields(sand), [12, 12, 0, 5, 1, 0, 2, 40]);
  const nativeAnvil = tagOf(ref.projectiles.filter((p) => p.kind === 'falling')[3].nbt);
  assert.deepEqual([nativeAnvil.get('Tile').value, nativeAnvil.get('TileID').value, nativeAnvil.get('Data').value], [anvil.get('Tile').value, anvil.get('TileID').value, anvil.get('Data').value]);
  assert.deepEqual([anvil.get('HurtEntities').value, anvil.get('FallHurtAmount').value, anvil.get('FallHurtMax').value], [1, 2, 40]);
  assert.deepEqual([hurt.get('HurtEntities').value, hurt.get('FallHurtAmount').value, hurt.get('FallHurtMax').value], [1, 3.5, 20]);
});

test('an exported ender crystal carries only Entity.writeToNBT keys, as the native crystal does', async () => {
  const { chunk } = await exportEntities({ entities: [{ type: 'ender_crystal', x: -2.5, y: 101, z: -2.5, health: 5 }] });
  const crystal = byId(chunk, 'EnderCrystal')[0], native = tagOf(nativeOf('crystal').nbt);
  assert.deepEqual(shape(crystal), shape(native));
  assert.equal(crystal.get('Fire').value, native.get('Fire').value);
});

// ---- import: the native read of each object tag ----
const nativeFalling = ref.projectiles.filter((p) => p.kind === 'falling');
const f = Math.fround;

test('XPOrb tags read as the native orb reads them (Health masked to a byte, Value and Age shorts)', () => {
  const read = (i) => javaObjectFromNbt(tagOf(nativeOf('xporb', i).nbt), { shiftX: 10, shiftZ: -20 });
  const p = nativeOf('xporb', 1), made = javaObjectFromNbt(tagOf(p.nbt), { shiftX: 10, shiftZ: -20 });
  assert.equal(made.list, 'xpOrbs');
  assert.deepEqual([made.record.x, made.record.y, made.record.z], [p.x + 10, p.y - 0.25, p.z - 20]);
  assert.deepEqual([made.record.vx, made.record.vy, made.record.vz], [p.mx, p.my, p.mz]);
  assert.deepEqual([made.record.value, made.record.age, made.record.health], [1237, 5900, 3]);
  assert.equal(read(0).record.value, 7);
  assert.equal(read(2).lost, 'value outside 1-2477', 'a bare tag reads Value 0 (native keeps that orb; the browser holds 1-2477 only)');
  assert.equal(read(3).lost, 'value outside 1-2477', 'Value 70000 narrows to 4464');
});

test('PrimedTnt reads Fuse with getByte', () => {
  const p = nativeOf('tnt', 2), made = javaObjectFromNbt(tagOf(p.in));
  assert.equal(made.list, 'tnt');
  assert.equal(made.record.fuse, p.nbt && decodeNbt(bytes(p.nbt)).tag.value.get('Fuse').value, 'a short 300 narrows to 44');
  assert.equal(made.record.fuse, 44);
  assert.equal(javaObjectFromNbt(tagOf(nativeOf('tnt', 3).in)).record.fuse, 0, 'a missing Fuse is 0');
  const fresh = nativeOf('tnt', 0);
  assert.deepEqual([javaObjectFromNbt(tagOf(fresh.nbt)).record.y], [fresh.y - f(f(0.98) / 2)]);
});

test('FallingSand: TileID wins over Tile, air and an unregistered id become sand, Hurt fields only with HurtEntities', () => {
  const tiles = nativeFalling.map((p) => {
    const made = javaObjectFromNbt(tagOf(p.in));
    return { p, made };
  });
  // cases 7 (TileID 0), 10 (TileID 4000), 11 (no key): native TileID 12 after the read
  for (const i of [7, 10, 11]) {
    assert.equal(decodeNbt(bytes(nativeFalling[i].nbt)).tag.value.get('TileID').value, 12, `native case ${i}`);
    assert.equal(tiles[i].made.record.block, fromOriginal(12, 0).id, `port case ${i}`);
  }
  assert.equal(tiles[6].made.record.block, fromOriginal(13, 0).id, 'the legacy Tile byte');
  assert.equal(tiles[9].made.lost, 'not a falling block', 'stone (native keeps it as a falling block; open gap)');
  assert.deepEqual([tiles[4].made.record.hurtEntities, tiles[4].made.record.fallHurtAmount, tiles[4].made.record.fallHurtMax], [true, 3.5, 20]);
  assert.deepEqual([tiles[5].made.record.hurtEntities, tiles[5].made.record.fallHurtAmount, tiles[5].made.record.fallHurtMax], [true, 2, 40], 'the tag already holds the fresh 2.0 and 40');
  assert.equal(tiles[0].made.record.hurtEntities, false, 'every native save writes HurtEntities');
  assert.equal(javaObjectFromNbt(new Map([...tagOf(nativeFalling[0].in)].filter(([k]) => k !== 'HurtEntities'))).record.hurtEntities, undefined, 'without the tag only an anvil hurts');
  assert.equal(fallingCellOf(0, 0).id, fromOriginal(12, 0).id);
  const p = nativeFalling[8], r = javaObjectFromNbt(tagOf(p.in)).record;
  assert.equal(r.ticks, 255, 'Time -1 is 255 (the port never starts a block at 0)');
  assert.equal(r.y, p.y - f(0.49));
});

test('a region with XPOrb, PrimedTnt and FallingSand imports them as saved entities instead of losing them', async () => {
  const entities = [nativeOf('xporb', 1), nativeOf('tnt', 1), nativeFalling[2], nativeFalling[4]].map((m, i) => {
    const tag = new Map(tagOf(m.nbt));
    tag.set('Pos', { type: NBT.LIST, value: { elementType: NBT.DOUBLE, items: [0.5 + i * 2, 70, 0.5 + i] } });
    return tag;
  });
  const { x, z } = regionAddress(0, 0);
  const files = [{ filename: 'r.0.0.mca', bytes: writeRegion([await encodeRegionChunk(chunkToNbt(new Chunk(0, 0), { entities, tileEntities: [] }), { x, z })]) }];
  const { record, report } = await importJavaRegionArea(files, { area: { chunkX: 0, chunkZ: 0, width: 1, depth: 1 }, mode: 'survival' });
  assert.equal(record.xpOrbs.length, 1);
  assert.equal(record.tnt.length, 1);
  assert.equal(record.falling.length, 2);
  assert.equal(record.tnt[0].fuse, 10);
  assert.ok(!report.entities.lost?.some((l) => /XPOrb|PrimedTnt|FallingSand/.test(l.id ?? l)), JSON.stringify(report.entities));
  assert.equal(record.falling.find((e) => e.block === ANVIL).hurtEntities, false, 'a probe anvil built by hand wrote HurtEntities 0, so it does not hurt');
});

test('export then import keeps orbs, TNT and falling blocks', async () => {
  const sent = {
    xpOrbs: [{ x: -2.5, y: 101.75, z: -2.5, value: 7, age: 40, health: 5, fire: 0, vx: 0.25, vy: -0.5, vz: 1, onGround: false }],
    tnt: [{ x: -3.5, y: 101.5, z: -3.5, vx: 0.25, vy: -0.5, vz: 1, fuse: 33 }],
    falling: [{ x: -4.5, y: 101.51, z: -4.5, block: ANVIL, meta: 2, ticks: 9, vx: 0, vy: -0.5, vz: 0, fallDistance: 2.5, onGround: false }],
  };
  const { w, chunk } = await exportEntities(sent);
  const shift = { shiftX: -w.originX, shiftZ: -w.originZ };
  const orb = javaObjectFromNbt(byId(chunk, 'XPOrb')[0], shift).record, tnt = javaObjectFromNbt(byId(chunk, 'PrimedTnt')[0], shift).record, fall = javaObjectFromNbt(byId(chunk, 'FallingSand')[0], shift).record;
  for (const k of ['x', 'y', 'z', 'value', 'age', 'health', 'vx', 'vy', 'vz']) assert.ok(Math.abs(orb[k] - sent.xpOrbs[0][k]) < 1e-6, `orb ${k}`);
  for (const k of ['x', 'y', 'z', 'vx', 'vy', 'vz', 'fuse']) assert.ok(Math.abs(tnt[k] - sent.tnt[0][k]) < 1e-6, `tnt ${k}`);
  for (const k of ['x', 'y', 'z', 'block', 'meta', 'ticks', 'fallDistance']) assert.ok(Math.abs(fall[k] - sent.falling[0][k]) < 1e-6, `falling ${k}`);
  assert.deepEqual([fall.hurtEntities, fall.fallHurtAmount, fall.fallHurtMax], [true, 2, 40]);
});

// ---- flight per tick: tools/probes/ThrowFlightProbe.java -> throw-flight-reference.json, replayed by entity-list-replay.js ----
import { readFileSync } from 'node:fs';
import { replayEntityList, entityListDivergence } from './entity-list-replay.js';
const flight = JSON.parse(readFileSync(new URL('../public/research/throw-flight-reference.json', import.meta.url))).cases;
test('17 executed free-flight records (air, water pool, floor)', () => assert.equal(flight.length, 17));
for (const c of flight) test(`native flight ${c.name}`, () => assert.equal(entityListDivergence(c, replayEntityList(c)), null));
