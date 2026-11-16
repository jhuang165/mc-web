// Batch 77 fallingblock77: falling blocks drop damageDropped, keep TileEntityData, and the anvil roll follows the native Data int.
// Evidence: public/research/falling-block77-reference.json (Executed, tools/probes/FallingBlock77Probe.java) and the bytecode of xj / ajb.
import test from 'node:test';
import assert from 'node:assert/strict';
import ref from '../public/research/falling-block77-reference.json' with { type: 'json' };
import { NBT } from './nbt.js';
import { DAMAGE_DROPPED, NO_BLOCK_ITEM, damageDropped, fallingDropStack } from './falling-drops.js';
import { anvilImpact, anvilDropDamage } from './anvil-block.js';
import { JavaRandom } from './java-random.js';
import { FallingBlocks, spawnFalling } from './falling.js';
import { fromOriginal, toOriginal } from './block-registry.js';
import { World, ANVIL } from './world.js';
import { javaObjectFromNbt } from './java-objects.js';
import { nbtToJson } from './spawner-data.js';
import { applyFallingTileData } from './falling-tiles.js';
import { Signs } from './signs.js';

const tag = (type, value) => ({ type, value });
const compound = (o) => tag(NBT.COMPOUND, new Map(Object.entries(o)));

test('damageDropped matches the executed native table for every block and Data 0-255', () => {
  assert.equal(ref.blocksProbed, 175);
  for (let id = 1; id < 176; id++) {
    const row = ref.damageDropped[id];
    for (let m = 0; m < 256; m++) assert.equal(damageDropped(id, m), row?.[m] ?? 0, `block ${id} data ${m}`);
  }
  assert.deepEqual([...NO_BLOCK_ITEM].sort((a, b) => a - b), [...ref.noItem].sort((a, b) => a - b));
  assert.deepEqual(Object.keys(DAMAGE_DROPPED).map(Number).sort((a, b) => a - b), Object.keys(ref.damageDropped).map(Number).sort((a, b) => a - b));
});

test('anvil fall(float): roll only with HurtEntities, whole Data int, drop damage meta >> 2 (1248 executed rows)', () => {
  for (const [meta, hurt, distance, seed, resultMeta, broken, dropDamage] of ref.falls) {
    // native: no roll (and no change) without HurtEntities or a fall of one block or less
    const impact = hurt ? anvilImpact(meta, distance, new JavaRandom(BigInt(seed))) : { meta, broken: false };
    assert.deepEqual([impact.meta, impact.broken ? 1 : 0], [resultMeta, broken], `meta ${meta} hurt ${hurt} distance ${distance} seed ${seed}`);
    assert.equal(anvilDropDamage(resultMeta), dropDamage);
  }
});

const flat = () => { const w = new World('17', 'flat', 12); for (let x = -3; x < 4; x++) for (let z = -3; z < 4; z++) for (let y = 1; y < 90; y++) w.set(x, y, z, y < 60 ? 1 : 0, false, 0); return w; };
const drop = (block, meta, extra = {}) => ({ block, meta, x: 0.5, y: 65, z: 0.5, vx: 0, vy: 0, vz: 0, ticks: 601, onGround: false, fallDistance: 0, ...extra });

test('a falling block that times out drops damageDropped, not damage 0', () => {
  const wool = fromOriginal(35, 5), log = fromOriginal(17, 1);
  for (const [cell, want] of [[wool, 5], [log, 1]]) {
    const drops = [], fb = new FallingBlocks(flat(), { drop: (s) => drops.push(s) }, [drop(cell.id, cell.meta)]);
    fb.tick();
    assert.equal(drops.length, 1);
    assert.equal(drops[0].damage, want);
  }
  const door = fromOriginal(64, 0);
  const drops = [], fb = new FallingBlocks(flat(), { drop: (s) => drops.push(s) }, [drop(door.id, 0)]);
  fb.tick();
  assert.equal(drops.length, 0, 'a block with no item drops nothing (entityDropItem ignores a null item)');
});

test('a timed-out anvil with Data above 15 drops Data >> 2', () => {
  const stack = fallingDropStack({ block: ANVIL, meta: 20, ...{} });
  assert.equal(stack.damage, 5);
  assert.equal(fallingDropStack({ block: ANVIL, meta: 9 }).damage, 2);
});

test('an anvil landing skips the damage roll when HurtEntities is false and rolls with the whole Data int otherwise', () => {
  const cell = fromOriginal(145, 0);
  const run = (extra, seed) => {
    const w = flat(), fb = new FallingBlocks(w, { drop: () => {} }, []);
    const e = spawnFalling(cell.id, 0, 0, 80, 0, new JavaRandom(BigInt(seed)));
    Object.assign(e, { ticks: 5, ...extra });
    fb.entities.push(e);
    for (let i = 0; i < 80 && fb.entities.length; i++) fb.tick();
    return { cell: w.get(0, 60, 0), meta: w.getMeta(0, 60, 0) };
  };
  let rolled = 0;
  for (let seed = 0; seed < 12; seed++) {
    const off = run({ hurtEntities: false, fallHurtAmount: 2, fallHurtMax: 40 }, seed);
    assert.deepEqual(off, { cell: cell.id, meta: 0 }, 'HurtEntities false: no roll');
    const on = run({}, seed);
    if (on.cell !== cell.id || on.meta !== 0) rolled++;
  }
  assert.ok(rolled > 0, 'a 20-block fall rolls the stage up or breaks the anvil for some seeds');
});

test('FallingSand TileEntityData is read, saved, restored and exported', async () => {
  const items = tag(NBT.LIST, { elementType: NBT.COMPOUND, items: [new Map([['Slot', tag(NBT.BYTE, 3)], ['id', tag(NBT.SHORT, 4)], ['Count', tag(NBT.BYTE, 7)], ['Damage', tag(NBT.SHORT, 0)]])] });
  const entity = new Map([['id', tag(NBT.STRING, 'FallingSand')], ['TileID', tag(NBT.INT, 54)], ['Data', tag(NBT.BYTE, 3)], ['Time', tag(NBT.BYTE, 1)],
    ['Pos', tag(NBT.LIST, { elementType: NBT.DOUBLE, items: [0.5, 70, 0.5] })],
    ['TileEntityData', compound({ id: tag(NBT.STRING, 'Chest'), x: tag(NBT.INT, 9), y: tag(NBT.INT, 9), z: tag(NBT.INT, 9), Items: items })]]);
  const { record } = javaObjectFromNbt(entity);
  assert.ok(record.tileData);
  const fb = new FallingBlocks(flat(), {}, [record]);
  assert.deepEqual(fb.serialize()[0].tileData, record.tileData);
  const { exportJavaSave } = await import('./region-export.js');
  const { Survival } = await import('./survival.js');
  const { regionSlot, readRegion, decodeRegionChunk, regionAddress } = await import('./region-file.js');
  const { chunkFromNbt } = await import('./chunk-nbt.js');
  const w = new World('17', 'javaStreamed', 12), player = new Survival({}, 'survival').serialize();
  const { files } = await exportJavaSave({ id: 'rb', name: 'RB', seed: '17', biome: 'javaStreamed', generationVersion: 12, mode: 'survival', edits: [], player,
    position: { x: -0.5, y: 102, z: -0.5, yaw: 0, pitch: 0 }, updated: 1700000000000, falling: [{ ...record, x: -4.5, y: 101.5, z: -4.5 }], entities: [] }, { world: w });
  const cx = -1 + w.originX / 16, cz = -1 + w.originZ / 16, a = regionAddress(cx, cz);
  const chunk = chunkFromNbt(await decodeRegionChunk(readRegion(files.get(`region/r.${a.regionX}.${a.regionZ}.mca`)).get(regionSlot(a.x, a.z))));
  const f = chunk.entities.find((e) => e.get('id').value === 'FallingSand');
  const data = f.get('TileEntityData');
  assert.equal(data.type, NBT.COMPOUND);
  assert.equal(data.value.get('Items').value.items[0].get('Count').value, 7);
  assert.equal(data.value.get('id').value, 'Chest');
});

test('landing applies TileEntityData to the placed chest, furnace and sign; sand ignores it', () => {
  const chestCell = fromOriginal(54, 3);
  const items = tag(NBT.LIST, { elementType: NBT.COMPOUND, items: [new Map([['Slot', tag(NBT.BYTE, 3)], ['id', tag(NBT.SHORT, 4)], ['Count', tag(NBT.BYTE, 7)], ['Damage', tag(NBT.SHORT, 0)]])] });
  const survival = { chests: {}, furnaces: {}, dispensers: {}, hoppers: {}, brewing: {} };
  const calls = [];
  const w = flat(), fb = new FallingBlocks(w, { drop: () => {}, tile: (x, y, z, block, data, byte) => { calls.push([x, y, z, block]); applyFallingTileData({ block, x, y, z, data, dataByte: byte, host: { survival, signs: new Signs() } }); } }, []);
  const e = spawnFalling(chestCell.id, chestCell.meta, 0, 62, 0, new JavaRandom(1n));
  e.ticks = 5; e.tileData = nbtToJson(compound({ x: tag(NBT.INT, 1), Items: items }));
  fb.entities.push(e);
  for (let i = 0; i < 40 && fb.entities.length; i++) fb.tick();
  assert.equal(w.get(0, 60, 0), chestCell.id);
  assert.equal(calls.length, 1);
  const chest = survival.chests['0,60,0'];
  assert.equal(chest.items[3].count, 7);
  // sign
  const signs = new Signs(), signCell = fromOriginal(63, 0);
  assert.equal(applyFallingTileData({ block: signCell.id, x: 1, y: 60, z: 1, data: nbtToJson(compound({ Text1: tag(NBT.STRING, 'abcdefghijklmnopqrstuv') })), dataByte: 0, host: { survival, signs } }), true);
  assert.deepEqual([signs.tile(1, 60, 1).text[0], signs.tile(1, 60, 1).editable], ['abcdefghijklmno', false]);
  // sand has no tile entity
  const sand = fromOriginal(12, 0);
  assert.equal(applyFallingTileData({ block: sand.id, x: 2, y: 60, z: 2, data: nbtToJson(compound({ Items: items })), dataByte: 0, host: { survival, signs } }), false);
  assert.equal(toOriginal(chestCell.id, chestCell.meta)[0], 54);
});

test('an item entity keeps Owner, Thrower and PortalCooldown through Java import and export', async () => {
  const { Chunk } = await import('./chunk-store.js');
  const { chunkToNbt } = await import('./chunk-nbt.js');
  const { importJavaRegionArea } = await import('./region-import.js');
  const { encodeRegionChunk, writeRegion, regionAddress, regionSlot, readRegion, decodeRegionChunk } = await import('./region-file.js');
  const { chunkFromNbt } = await import('./chunk-nbt.js');
  const { exportJavaSave } = await import('./region-export.js');
  const { Survival } = await import('./survival.js');
  const item = new Map([['id', tag(NBT.SHORT, 4)], ['Count', tag(NBT.BYTE, 3)], ['Damage', tag(NBT.SHORT, 0)]]);
  const entity = new Map([['id', tag(NBT.STRING, 'Item')], ['Pos', tag(NBT.LIST, { elementType: NBT.DOUBLE, items: [2.5, 70.125, 2.5] })], ['Item', tag(NBT.COMPOUND, item)],
    ['Age', tag(NBT.SHORT, 10)], ['PickupDelay', tag(NBT.SHORT, 5)], ['Owner', tag(NBT.STRING, 'Alex')], ['Thrower', tag(NBT.STRING, 'Steve')], ['PortalCooldown', tag(NBT.INT, 77)]]);
  const { x, z } = regionAddress(0, 0);
  const files = [{ filename: 'r.0.0.mca', bytes: writeRegion([await encodeRegionChunk(chunkToNbt(new Chunk(0, 0), { entities: [entity], tileEntities: [] }), { x, z })]) }];
  const { record } = await importJavaRegionArea(files, { area: { chunkX: 0, chunkZ: 0, width: 1, depth: 1 }, mode: 'survival' });
  assert.deepEqual([record.drops[0].owner, record.drops[0].thrower, record.drops[0].portalCooldown], ['Alex', 'Steve', 77]);
  const w = new World('17', 'javaStreamed', 12), player = new Survival({}, 'survival').serialize();
  const { files: out } = await exportJavaSave({ id: 'rb', name: 'RB', seed: '17', biome: 'javaStreamed', generationVersion: 12, mode: 'survival', edits: [], player,
    position: { x: -0.5, y: 102, z: -0.5, yaw: 0, pitch: 0 }, updated: 1700000000000, drops: [{ ...record.drops[0], x: -4.5, z: -4.5 }], entities: [] }, { world: w });
  const cx = -1 + w.originX / 16, cz = -1 + w.originZ / 16, a = regionAddress(cx, cz);
  const chunk = chunkFromNbt(await decodeRegionChunk(readRegion(out.get(`region/r.${a.regionX}.${a.regionZ}.mca`)).get(regionSlot(a.x, a.z))));
  const e = chunk.entities.find((t) => t.get('id').value === 'Item');
  assert.deepEqual([e.get('Owner').value, e.get('Thrower').value, e.get('PortalCooldown').value], ['Alex', 'Steve', 77]);
});
