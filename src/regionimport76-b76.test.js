// Batch 76 regionimport76: Java region import keeps what the native readers keep (XPOrb Value 0 and above 2477, Health 0; FallingSand of a block that does
// not fall, Data above 15, Time 0, DropItem) and builds an EnderCrystal without the mob readers. Evidence: public/research/object-nbt-reference.json
// (Executed, tools/probes/ObjectNbtProbe.java rows) and the bytecode of wz/xj. Notes: .shared-memory/notes/regionimport76-b76-track.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import ref from '../public/research/object-nbt-reference.json' with { type: 'json' };
import { decodeNbt, NBT } from './nbt.js';
import { Chunk } from './chunk-store.js';
import { chunkToNbt } from './chunk-nbt.js';
import { javaObjectFromNbt, javaCrystalFromNbt } from './java-objects.js';
import { importJavaRegionArea } from './region-import.js';
import { encodeRegionChunk, writeRegion, regionAddress } from './region-file.js';
import { fromOriginal } from './block-registry.js';
import { FallingBlocks } from './falling.js';
import { World } from './world.js';
import { Experience } from './experience.js';
import { ExperienceOrbs } from './experience.js';

const bytes = (hex) => Uint8Array.from(hex.match(/../g).map((b) => parseInt(b, 16)));
const tagOf = (hex) => decodeNbt(bytes(hex)).tag.value;
const rows = (kind) => ref.projectiles.filter((p) => p.kind === kind);
const falling = rows('falling'), crystals = rows('crystal');

test('the executed native rows for a zero, a clipped and a Health 0 orb load and save back as they came', () => {
  const zero = rows('xporb')[2], big = rows('xporb')[3];
  assert.equal(tagOf(zero.nbt).get('Value').value, 0);
  assert.equal(tagOf(zero.nbt).get('Health').value, 0);
  assert.equal(tagOf(big.nbt).get('Value').value, 4464);
  assert.equal(tagOf(big.nbt).get('Health').value, 44);
});

test('import keeps an orb of Value 0, Value above 2477 and Health 0 with the native numbers', () => {
  const zero = javaObjectFromNbt(tagOf(rows('xporb')[2].nbt)).record;
  assert.deepEqual([zero.value, zero.health], [0, 0]);
  const tag = new Map(tagOf(rows('xporb')[0].nbt));
  tag.set('Value', { type: NBT.SHORT, value: 5000 });
  tag.set('Age', { type: NBT.SHORT, value: -30 });
  const big = javaObjectFromNbt(tag).record;
  assert.deepEqual([big.value, big.age], [5000, -30]);
  tag.set('Age', { type: NBT.SHORT, value: 6000 });
  assert.equal(javaObjectFromNbt(tag).lost, 'expired', 'xpOrbAge 6000 ends on the first tick');
});

test('the orb list keeps those orbs on load, and a Health 0 orb dies when hit', () => {
  const orbs = new ExperienceOrbs([
    { x: 0.5, y: 70, z: 0.5, value: 0, age: 0, health: 0 },
    { x: 1.5, y: 70, z: 0.5, value: 4464, age: -30, health: 44 },
  ]);
  assert.equal(orbs.orbs.length, 2);
  assert.equal(orbs.orbs[1].age, -30);
  const o = orbs.orbs[0];
  orbs.hurt(o, null, 1);
  assert.ok(o.dead);
});

test('FallingSand of a block that does not fall is kept, Data keeps its byte, Time 0 stays 0', () => {
  const stone = javaObjectFromNbt(tagOf(falling[9].in)).record;
  assert.deepEqual([stone.block, stone.meta], [fromOriginal(1, 0).id, 0]);
  const data31 = javaObjectFromNbt(tagOf(falling[12].in)).record; // native: Data 31 saves as 31
  assert.equal(tagOf(falling[12].nbt).get('Data').value, 31);
  assert.equal(data31.meta, 31);
  const stone15 = new Map(tagOf(falling[9].in)); stone15.set('Data', { type: NBT.BYTE, value: 15 });
  const s15 = javaObjectFromNbt(stone15).record;
  assert.deepEqual([s15.meta, s15.data], [0, 15], 'port stone cannot hold Data 15, so the byte rides along');
  assert.equal(javaObjectFromNbt(tagOf(falling[0].in)).record.ticks, 0);
  assert.equal(javaObjectFromNbt(tagOf(falling[8].in)).record.ticks, 255);
  const tag = new Map(tagOf(falling[0].in));
  assert.equal(javaObjectFromNbt(tag).record.dropItem, true, 'the tag is written by every native save');
  tag.delete('DropItem');
  assert.equal(javaObjectFromNbt(tag).record.dropItem, undefined, 'no DropItem tag leaves the default');
  tag.set('DropItem', { type: NBT.BYTE, value: 0 });
  assert.equal(javaObjectFromNbt(tag).record.dropItem, false);
});

// A flat world: stone below y 60, air above (the real World, so moveEntity and the block set work).
const flatWorld = () => { const w = new World('17', 'flat', 12); for (let x = -3; x < 4; x++) for (let z = -3; z < 4; z++) for (let y = 1; y < 70; y++) w.set(x, y, z, y < 60 ? 1 : 0, false, 0); return w; };
const landing = (record) => ({ ...record, x: 0.5, y: 61, z: 0.5, vx: 0, vy: 0, vz: 0, ticks: 5, onGround: false, fallDistance: 0 });

test('a falling stone with Data 31 lands as stone with metadata 15 (nibble), nothing drops and the byte survives save and load', () => {
  const rec = javaObjectFromNbt(tagOf(falling[9].in)).record;
  const world = flatWorld(), drops = [];
  const fb = new FallingBlocks(world, { drop: (stack) => drops.push(stack) }, [landing({ ...rec, meta: 31 })]);
  assert.equal(fb.entities.length, 1, 'restoreEntity no longer drops a non-falling block');
  assert.equal(fb.entities[0].meta, 31);
  assert.equal(fb.serialize()[0].meta, 31);
  for (let i = 0; i < 40 && fb.entities.length; i++) fb.tick();
  assert.equal(fb.entities.length, 0);
  assert.equal(drops.length, 0);
  assert.equal(world.get(0, 60, 0), rec.block, 'the stone landed on the floor');
  assert.equal(world.getMeta(0, 60, 0), 15);
});

test('DropItem false leaves no item when the block times out; the default drops one', () => {
  const rec = javaObjectFromNbt(tagOf(falling[0].in)).record;
  const run = (extra) => {
    const world = flatWorld(), drops = [];
    // Time 255 plus the 600-tick timeout: EntityFallingBlock gives up and drops its item unless DropItem is false.
    const fb = new FallingBlocks(world, { drop: (stack) => drops.push(stack) }, [{ ...landing({ ...rec, ...extra }), ticks: 601, y: 65 }]);
    for (let i = 0; i < 3 && fb.entities.length; i++) fb.tick();
    return drops.length;
  };
  assert.equal(run({}), 1);
  assert.equal(run({ dropItem: false }), 0);
});

test('the crystal reader follows Entity.readFromNBT only: Foo, Health and Attributes are ignored', () => {
  const tag = new Map(tagOf(crystals[1].in));
  tag.set('Pos', { type: NBT.LIST, value: { elementType: NBT.DOUBLE, items: [3.5, 70, 4.5] } });
  tag.set('Health', { type: NBT.SHORT, value: 1 });
  tag.set('HealF', { type: NBT.FLOAT, value: 1 });
  tag.set('CustomName', { type: NBT.STRING, value: 'x' });
  const c = javaCrystalFromNbt(tag, { shiftX: 10, shiftZ: -20 });
  assert.equal(c.type, 'ender_crystal');
  assert.deepEqual([c.x, c.y, c.z, c.health, c.fire], [13.5, 70, -15.5, 5, 0]);
  assert.equal(c.customName, undefined);
  assert.equal(javaCrystalFromNbt(tag.set('Fire', { type: NBT.SHORT, value: 40 })).fire, 40);
  assert.equal(javaCrystalFromNbt(tag.set('Invulnerable', { type: NBT.BYTE, value: 1 })).invulnerable, true);
  assert.equal(javaCrystalFromNbt(new Map()), null);
});

test('a region with a crystal, a zero orb and a falling stone imports all three and exports them back', async () => {
  const at = (m, x, y, z) => { const t = new Map(tagOf(m.nbt)); t.set('Pos', { type: NBT.LIST, value: { elementType: NBT.DOUBLE, items: [x, y, z] } }); return t; };
  const stoneRow = { ...falling[9] };
  const entities = [at(crystals[0], 2.5, 70, 2.5), at(rows('xporb')[2], 4.5, 70, 2.5), at(stoneRow, 6.5, 70, 2.5)];
  entities[0].set('Health', { type: NBT.SHORT, value: 1 }); // no effect on a crystal
  const { x, z } = regionAddress(0, 0);
  const files = [{ filename: 'r.0.0.mca', bytes: writeRegion([await encodeRegionChunk(chunkToNbt(new Chunk(0, 0), { entities, tileEntities: [] }), { x, z })]) }];
  const { record, report } = await importJavaRegionArea(files, { area: { chunkX: 0, chunkZ: 0, width: 1, depth: 1 }, mode: 'survival' });
  assert.equal(record.xpOrbs.length, 1);
  assert.equal(record.falling.length, 1);
  assert.equal(record.falling[0].block, fromOriginal(1, 0).id);
  const crystal = record.entities.find((m) => m.type === 'ender_crystal');
  assert.ok(crystal, JSON.stringify(report.entities));
  assert.equal(crystal.health, 5);
  assert.equal(crystal.effects.length, 0);
  assert.deepEqual(report.entities.lost ?? [], []);
});

test('export writes Data as the whole byte, DropItem and a crystal Invulnerable back', async () => {
  const { World } = await import('./world.js');
  const { Survival } = await import('./survival.js');
  const { exportJavaSave } = await import('./region-export.js');
  const { regionSlot, readRegion, decodeRegionChunk } = await import('./region-file.js');
  const { chunkFromNbt } = await import('./chunk-nbt.js');
  const w = new World('17', 'javaStreamed', 12), player = new Survival({}, 'survival').serialize();
  const stone = fromOriginal(1, 0).id;
  const { files } = await exportJavaSave({ id: 'rb', name: 'RB', seed: '17', biome: 'javaStreamed', generationVersion: 12, mode: 'survival', edits: [], player,
    position: { x: -0.5, y: 102, z: -0.5, yaw: 0, pitch: 0 }, updated: 1700000000000,
    falling: [{ x: -4.5, y: 101.51, z: -4.5, block: stone, meta: 16, data: 31, ticks: 0, vx: 0, vy: 0, vz: 0, fallDistance: 0, onGround: false, dropItem: false }],
    entities: [{ type: 'ender_crystal', x: -2.5, y: 101, z: -2.5, health: 5, invulnerable: true }] }, { world: w });
  const cx = -1 + w.originX / 16, cz = -1 + w.originZ / 16, a = regionAddress(cx, cz);
  const chunk = chunkFromNbt(await decodeRegionChunk(readRegion(files.get(`region/r.${a.regionX}.${a.regionZ}.mca`)).get(regionSlot(a.x, a.z))));
  const f = chunk.entities.find((e) => e.get('id').value === 'FallingSand'), c = chunk.entities.find((e) => e.get('id').value === 'EnderCrystal');
  assert.deepEqual([f.get('Tile').value, f.get('TileID').value, f.get('Data').value, f.get('Time').value, f.get('DropItem').value], [1, 1, 31, 0, 0]);
  assert.equal(c.get('Invulnerable').value, 1);
  assert.equal(c.has('Health'), false);
});
