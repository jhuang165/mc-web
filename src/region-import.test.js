import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Chunk} from './chunk-store.js';
import {World, WATER} from './world.js';
import {NBT} from './nbt.js';
import {chunkToNbt} from './chunk-nbt.js';
import {encodeRegionChunk, writeRegion, regionAddress} from './region-file.js';
import {toOriginal} from './block-registry.js';
import {importedRuntime} from './world-import.js';
import {isJavaLandscape} from './java-world.js';
import {Survival} from './survival.js';
import {ItemEntities} from './item-entities.js';
import {inspectRegion} from './region-inspection.js';
import {importJavaRegionArea, itemFromOriginal, ORIGINAL_ITEMS, IMPORT_EDIT_LIMIT} from './region-import.js';
import {MC_IDS} from '../tools/inventory-replay.mjs';

const t = (type, value) => ({type, value});
const compound = (fields) => new Map(Object.entries(fields));
const list = (elementType, items) => t(NBT.LIST, {elementType, items});
const stack = (slot, id, count, damage = 0, extra = {}) => compound({Slot: t(NBT.BYTE, slot), id: t(NBT.SHORT, id), Count: t(NBT.BYTE, count), Damage: t(NBT.SHORT, damage), ...extra});
const tile = (id, x, y, z, extra = {}) => compound({id: t(NBT.STRING, id), x: t(NBT.INT, x), y: t(NBT.INT, y), z: t(NBT.INT, z), ...extra});
const entity = (id, pos, extra = {}) => compound({id: t(NBT.STRING, id), Pos: list(NBT.DOUBLE, pos), Motion: list(NBT.DOUBLE, [0, 0, 0]), ...extra});

// Group chunk payloads by region and write one .mca per region.
async function regions(chunks) {
  const files = new Map();
  for (const {chunk, ...payload} of chunks) {
    const {regionX, regionZ, x, z} = regionAddress(chunk.x, chunk.z), name = `r.${regionX}.${regionZ}.mca`;
    if (!files.has(name)) files.set(name, []);
    files.get(name).push(await encodeRegionChunk(chunkToNbt(chunk, payload), {x, z}));
  }
  return [...files].map(([filename, entries]) => ({filename, bytes: writeRegion(entries)}));
}

// The Import screen's acceptance path (main.js #file-input), without the DOM: envelope checks, World.restore,
// importedRuntime, then the Survival player that launch() reads chests/furnaces from and item-entity loading.
function importLikeScreen(record) {
  const text = JSON.stringify(record);
  assert.ok(text.length <= 8 * 1024 * 1024);
  const data = JSON.parse(text);
  assert.equal(data.format, 'blockworld');
  assert.equal(data.version, 1);
  assert.equal(typeof data.name, 'string');
  assert.equal(typeof data.seed, 'string');
  assert.ok(isJavaLandscape(data.biome));
  const world = new World(data.seed, data.biome, data.generationVersion ?? 1);
  world.restore(data.edits);
  const runtime = importedRuntime(data);
  const p = data.player && typeof data.player === 'object' ? data.player : {};
  const survival = new Survival(Array.isArray(p.slots) ? p : {...p, hotbar: data.hotbar, current: data.selected}, data.mode);
  const items = new ItemEntities(() => 0.5);
  items.load(runtime.drops, (s) => survival.inventory.read(s), survival.time);
  return {world, runtime, survival, player: survival.serialize(), items};
}

test('item table matches the inventory replay mapping and keeps only supported subtypes', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(ORIGINAL_ITEMS)), Object.fromEntries(Object.entries(MC_IDS)));
  assert.deepEqual(itemFromOriginal(263, 1), {id: 308, damage: 0, clamped: false});
  assert.deepEqual(itemFromOriginal(35, 14), {id: 19, damage: 14, clamped: false});
  assert.deepEqual(itemFromOriginal(257, 9999), {id: 102, damage: 250, clamped: true});
  assert.deepEqual(itemFromOriginal(1, -3), {id: 3, damage: 0, clamped: false});
  assert.deepEqual(itemFromOriginal(5, 1), {id: 7, damage: 1, clamped: false}); // spruce planks (stairs recipes need them)
  assert.deepEqual(itemFromOriginal(323, 0), {id: 480, damage: 0, clamped: false}); // sign (signs.js)
  assert.equal(itemFromOriginal(400, 0), null); // pumpkin pie (not in this build; the clock 347 maps to 2080 in maps.js); the painting 321 and item frame 389 map to 1700 and 1701
  assert.deepEqual(itemFromOriginal(321, 0), {id: 1700, damage: 0, clamped: false}); // painting
  assert.deepEqual(itemFromOriginal(389, 0), {id: 1701, damage: 0, clamped: false}); // item frame
  assert.equal(itemFromOriginal(38, 9), null);
});

test('a multi-chunk area across negative regions keeps chunk-relative placement and reports missing chunks', async () => {
  const a = new Chunk(-1, -1), b = new Chunk(0, -1), c = new Chunk(-1, 0), d = new Chunk(-1, 1);
  a.setBlockState(0, 0, 0, 7); a.setBlockState(15, 255, 15, 35, 14);
  b.setBlockState(0, 64, 15, 4);
  c.setBlockState(15, 10, 0, 3);
  // Same region as chunk (-1, 0) but outside the area: r.-1.0 is used, the far one is not.
  d.setBlockState(0, 0, 0, 1);
  const files = await regions([{chunk: a}, {chunk: b}, {chunk: c}, {chunk: d}, {chunk: new Chunk(100, 100)}]);
  const {record, report} = await importJavaRegionArea(files, {area: {chunkX: -1, chunkZ: -1, width: 2, depth: 2}, missing: 'air'});
  assert.deepEqual(report.destination, {chunkX: 3, chunkZ: 3, blockX: 48, blockZ: 48});
  assert.equal(report.chunks.converted, 3);
  assert.deepEqual(report.chunks.missing, [{x: 0, z: 0, reason: 'r.0.0.mca not supplied'}]);
  assert.deepEqual(report.source.unusedRegions, ['r.3.3.mca']);
  assert.equal(report.base.aligned, false);
  const {world} = importLikeScreen(record);
  // Chunk (-1,-1) -> live (3,3), (0,-1) -> (4,3), (-1,0) -> (3,4); (0,0) missing -> cleared to air.
  assert.equal(world.get(48, 0, 48), 11); // bedrock
  assert.equal(world.get(63, 255, 63), 19);
  assert.equal(world.getMeta(63, 255, 63), 14);
  assert.equal(world.get(64, 64, 63), 12); // cobblestone
  assert.equal(world.get(63, 10, 64), 2); // dirt
  assert.equal(world.get(50, 5, 50), 0); // rest of the source chunk is air over generated terrain
  for (const y of [0, 40, 70]) assert.equal(world.get(70, y, 70), 0); // missing chunk, 'air' fill
  // Outside the area the generated base terrain stays.
  const base = new World(record.seed, record.biome, 9);
  assert.equal(world.get(10, 1, 10), base.get(10, 1, 10));
  assert.equal(record.edits.length, report.edits);
  // The 'generated' fill leaves missing chunks to the base terrain and needs fewer edits.
  const kept = await importJavaRegionArea(files, {area: {chunkX: -1, chunkZ: -1, width: 2, depth: 2}});
  assert.ok(kept.report.edits < report.edits);
  assert.equal(importLikeScreen(kept.record).world.get(70, 1, 70), base.get(70, 1, 70));
});

test('chests, furnaces and dropped items convert; other tile entities and entities are counted as loss', async () => {
  const chunk = new Chunk(-2, 3);
  chunk.setBlockState(1, 70, 1, 54, 4); // chest facing west
  chunk.setBlockState(2, 70, 1, 54, 4);
  chunk.setBlockState(5, 70, 5, 61, 2); // furnace
  chunk.setBlockState(6, 70, 6, 144, 0); // skull (internal 172, skull.js)
  chunk.setBlockState(8, 70, 8, 54, 0); // chest with invalid facing and no tile entity
  const x0 = -32, z0 = 48;
  const tileEntities = [
    tile('Chest', x0 + 1, 70, z0 + 1, {Items: list(NBT.COMPOUND, [
      stack(0, 1, 64), stack(1, 257, 1, 40), stack(2, 35, 12, 14), stack(3, 400, 1), stack(26, 264, 99),
      stack(-56, 4, 3), // Slot & 255 = 200: outside the chest
      stack(4, 276, 1, 0, {tag: t(NBT.COMPOUND, compound({ench: list(NBT.END, [])}))}),
      stack(5, 276, 1, 12, {tag: t(NBT.COMPOUND, compound({
        ench: list(NBT.COMPOUND, [compound({id:t(NBT.SHORT,16),lvl:t(NBT.SHORT,3)})]),
        RepairCost:t(NBT.INT,9), display:t(NBT.COMPOUND,compound({Name:t(NBT.STRING,'Found sword')})), Unbreakable:t(NBT.BYTE,1),
      }))}),
      stack(6, 403, 1, 0, {tag: t(NBT.COMPOUND, compound({
        StoredEnchantments: list(NBT.COMPOUND, [compound({id:t(NBT.SHORT,16),lvl:t(NBT.SHORT,2)})]), RepairCost:t(NBT.INT,4),
      }))}),
      stack(7, 298, 1, 0, {tag: t(NBT.COMPOUND, compound({display:t(NBT.COMPOUND,compound({color:t(NBT.INT,0x33aabb)}))}))}),
    ])}),
    tile('Furnace', x0 + 5, 70, z0 + 5, {Items: list(NBT.COMPOUND, [stack(0, 392, 5), stack(1, 263, 3), stack(2, 393, 2)]),
      BurnTime: t(NBT.SHORT, 900), CookTime: t(NBT.SHORT, 150)}),
    tile('Skull', x0 + 6, 70, z0 + 6),
    tile('Chest', x0 + 9, 70, z0 + 9), // its cell is air
    tile('Chest', 5, 70, 5), // belongs to another chunk
  ];
  const entities = [
    entity('Item', [x0 + 3.5, 71.125, z0 + 3.5], {Age: t(NBT.SHORT, 100), PickupDelay: t(NBT.SHORT, 10), Item: t(NBT.COMPOUND, stack(0, 264, 2))}),
    entity('Item', [x0 + 4.5, 71.125, z0 + 4.5], {Item: t(NBT.COMPOUND, stack(0, 400, 1))}),
    entity('Pig', [x0 + 8, 71, z0 + 8]),
    entity('Skeleton', [x0 + 9, 71, z0 + 9], {Riding: t(NBT.COMPOUND, compound({id: t(NBT.STRING, 'Chicken')}))}),
  ];
  const tileTicks = [compound({i: t(NBT.INT, 8), x: t(NBT.INT, 0), y: t(NBT.INT, 0), z: t(NBT.INT, 0), t: t(NBT.INT, 1), p: t(NBT.INT, 0)})];
  const files = await regions([{chunk, tileEntities, entities, tileTicks}]);
  const {record, report} = await importJavaRegionArea(files, {area: {chunkX: -2, chunkZ: 3, width: 1, depth: 1}, mode: 'survival'});
  assert.deepEqual(report.destination, {chunkX: 3, chunkZ: 3, blockX: 48, blockZ: 48});
  const {world, player, items} = importLikeScreen(record);
  assert.equal(world.get(49, 70, 49), 41);
  assert.equal(world.get(53, 70, 53), 14);
  assert.equal(world.get(54, 70, 54), 172); // skull (skull.js)
  assert.deepEqual(record.skulls, [{x: 54, y: 70, z: 54, type: 0, rot: 0, owner: ''}]);
  const chest = player.chests['49,70,49'];
  assert.equal(chest.facing, 4);
  assert.deepEqual(chest.items.slice(0, 5), [{id: 3, count: 64, damage: 0}, {id: 102, count: 1, damage: 40}, {id: 19, count: 12, damage: 14}, null, {id: 115, count: 1, damage: 0, enchantments: []}]);
  assert.deepEqual(chest.items[26], {id: 303, count: 64, damage: 0});
  assert.deepEqual(chest.items[5], {id: 115, count: 1, damage: 12, enchantments:[{id:16,lvl:3}], repairCost:9, displayName:'Found sword', unbreakable:true});
  assert.deepEqual(chest.items[6], {id: 365, count: 1, damage: 0, stored:[{id:16,lvl:2}], storedEnchantments:[{id:16,lvl:2}], repairCost:4});
  assert.deepEqual(chest.items[7], {id: 400, count: 1, damage: 0, color: 0x33aabb});
  assert.equal(player.chests['50,70,49'].facing, 4);
  assert.ok(player.chests['50,70,49'].items.every(s => s === null));
  assert.equal(player.chests['56,70,56'].facing, 3);
  assert.deepEqual(player.furnaces['53,70,53'], {items: [{id: 323, count: 5, damage: 0}, {id: 301, count: 3, damage: 0}, {id: 324, count: 2, damage: 0}], burn: 900, burnTotal: 1600, cook: 150});
  assert.equal(items.items.length, 1);
  assert.deepEqual(items.items[0].stack, {id: 303, count: 2, damage: 0});
  assert.deepEqual([items.items[0].x, items.items[0].z, items.items[0].age, items.items[0].delay], [51.5, 51.5, 100, 10]);
  assert.ok(Math.abs(items.items[0].y - 71) < 1e-9);
  assert.equal(player.mode ?? record.mode, 'survival');
  assert.deepEqual(report.tileEntities, {total: 5, converted: {Chest: 1, Furnace: 1, Skull: 1},
    lost: [{id: 'Chest', count: 1}, {id: 'Chest (outside its chunk)', count: 1}]});
  assert.deepEqual(report.items, {converted: 12, lost: [{id: '400:0', count: 2}, {id: 'slot 200', count: 1}], tagsStripped: 0, clamped: 1});
  assert.deepEqual(report.entities, {total: 5, converted: {Item: 1, Skeleton: 1}, lost: [{id: 'Chicken', count: 1}, {id: 'Item (unsupported stack)', count: 1}, {id: 'Pig', count: 1}]});
  assert.equal(report.scheduledTicks, 1);
  assert.deepEqual(report.blocks.unsupported, []);
  // Furnace facing is not stored by the browser; chest facing travels in its record; meta 0 is inexact.
  assert.deepEqual(report.blocks.approximations, [{id: 54, meta: 0, cells: 1, to: [41, 0], exact: false, state: ['facing']}, {id: 61, meta: 2, cells: 1, to: [14, 0], exact: true, state: ['facing']}]);
  assert.equal(report.blocks.exact, 3);
});

test('unsupported, unregistered and approximated block states are counted and replaced', async () => {
  const chunk = new Chunk(0, 0);
  // Every registered 1.7.10 block state has a browser mapping since batch 6 (beacon 138, nether wart 115), so only the unregistered case is left.
  chunk.setBlockState(3, 1, 0, 50, 1); // wall torch facing east: exact (meta 1)
  // Add nibble: unregistered high id 300 (setBlockState refuses it, so write the arrays).
  const storage = chunk.section(0); storage.lsb[(1 << 8) | 2] = 300 & 255; storage.createMsb().set(2, 1, 0, 300 >> 8);
  chunk.setBlockState(4, 1, 0, 8, 2); // flowing water
  chunk.setBlockState(5, 1, 0, 60, 3); // moist farmland
  chunk.setBlockState(6, 1, 0, 59, 7); // ripe wheat
  const {record, report} = await importJavaRegionArea(await regions([{chunk}]), {area: {chunkX: 0, chunkZ: 0, width: 1, depth: 1}, destination: {chunkX: 0, chunkZ: 7}});
  assert.equal(report.blocks.sourceCells, 5);
  assert.equal(report.blocks.omitted, 1);
  assert.equal(report.blocks.exact, 2);
  assert.equal(report.blocks.approximated, 2);
  assert.deepEqual(report.blocks.unsupported, [{id: 300, meta: 0, cells: 1, reason: 'unregistered'}]);
  assert.deepEqual(report.blocks.approximations.map(a => [a.id, a.meta, a.exact, a.state]), [[8, 2, true, ['flowing']], [60, 3, true, ['moisture']]]);
  const {world} = importLikeScreen(record);
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map(x => [world.get(x, 1, 112), world.getMeta(x, 1, 112)]), [[0, 0], [0, 0], [0, 0], [20, 1], [WATER, 2], [30, 0], [38, 0]]);
});

test('the source seed reproduces its 8x8 generator area with only the changed cells as edits', async () => {
  const seed = '-4172144997902289642', base = new World(seed, 'java', 9);
  const cx0 = base.originX >> 4, cz0 = base.originZ >> 4, chunks = [];
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    const chunk = new Chunk(cx0 + i, cz0 + j), live = base.chunkAt(i, j);
    for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) {
      chunk.biomes[lx + lz * 16] = base.biomeIds[(i * 16 + lx) * 128 + j * 16 + lz];
      for (let y = 0; y < 256; y++) {
        const k = (lx * 16 + lz) * 256 + y, id = live.blocks[k];
        if (!id) continue;
        const [mc, meta] = toOriginal(id, live.meta[k]);
        chunk.setBlockState(lx, y, lz, mc, meta);
      }
    }
    chunks.push({chunk});
  }
  chunks[9].chunk.setBlockState(3, 200, 4, 41); // gold block in live chunk (1,1)
  chunks[63].chunk.setBlockState(15, 0, 15, 0); // a hole in the bedrock of live chunk (7,7)
  const files = await regions(chunks);
  const {record, report} = await importJavaRegionArea(files, {seed});
  assert.deepEqual(report.source.area, {chunkX: cx0, chunkZ: cz0, width: 8, depth: 8});
  assert.equal(report.base.aligned, true);
  assert.deepEqual([report.destination.chunkX, report.destination.chunkZ], [0, 0]);
  assert.equal(report.chunks.converted, 64);
  assert.equal(report.edits, 2);
  assert.deepEqual(report.biomes, {carried: false, compared: 16384, matching: 16384, differing: 0, unset: 0});
  const {world} = importLikeScreen(record);
  assert.equal(world.get(19, 200, 20), 27);
  assert.equal(world.get(127, 0, 127), 0);
  // A source area that is not the generator area exceeds the edit budget and reports why.
  await assert.rejects(importJavaRegionArea(files, {area: {chunkX: cx0, chunkZ: cz0}}), (error) => {
    assert.match(error.message, /100000/);
    assert.ok(error.report.edits > IMPORT_EDIT_LIMIT);
    return true;
  });
});

test('original AnvilChunkLoader payloads convert with the same cell inventory as region inspection', async () => {
  const {cases} = JSON.parse(readFileSync(new URL('../public/research/chunk-nbt-reference.json', import.meta.url)));
  for (const c of cases.filter(c => c.hasSky).slice(0, 3)) {
    const {x, z, regionX, regionZ} = regionAddress(c.summary.x, c.summary.z), filename = `r.${regionX}.${regionZ}.mca`;
    const bytes = writeRegion([{x, z, format: 'gzip', compressed: Buffer.from(c.inputGzip, 'base64')}]);
    const inspected = await inspectRegion(filename, bytes);
    const {record, report} = await importJavaRegionArea([{filename, bytes}], {area: {chunkX: c.summary.x, chunkZ: c.summary.z, width: 1, depth: 1}});
    assert.equal(report.blocks.sourceCells, inspected.states.reduce((sum, s) => sum + s.cells, 0));
    assert.equal(report.blocks.exact + report.blocks.approximated + report.blocks.omitted, report.blocks.sourceCells);
    assert.equal(report.scheduledTicks, c.scheduled.length);
    importLikeScreen(record);
  }
});

test('rejects malformed inputs before converting', async () => {
  const chunk = new Chunk(4, 4);
  const [file] = await regions([{chunk}]);
  const area = {chunkX: 4, chunkZ: 4, width: 1, depth: 1};
  await assert.rejects(importJavaRegionArea([{...file, filename: 'r.0.0.mca.bak'}], {area}), /Expected r/);
  await assert.rejects(importJavaRegionArea([file, file], {area}), /Duplicate/);
  await assert.rejects(importJavaRegionArea([file], {area: {...area, width: 9}}), /1-8/);
  await assert.rejects(importJavaRegionArea([file], {area, destination: {chunkX: 8, chunkZ: 0}}), /Destination/);
  await assert.rejects(importJavaRegionArea([file], {area, landscape: 'meadow'}), /landscape/);
  // Slot (4,4) of r.1.0 is chunk (36,4); the payload says (4,4).
  await assert.rejects(importJavaRegionArea([{...file, filename: 'r.1.0.mca'}], {area: {chunkX: 36, chunkZ: 4, width: 1, depth: 1}}), /slot 132: expected chunk \(36, 4\)/);
});

test('a Piston tile entity in a moving-block cell imports as a restorable moving piston', async () => {
  const chunk = new Chunk(-2, 3);
  chunk.setBlockState(3, 70, 3, 36, 5); // piston_extension
  const x0 = -32, z0 = 48;
  const tileEntities = [
    tile('Piston', x0 + 3, 70, z0 + 3, {blockId: t(NBT.INT, 1), blockData: t(NBT.INT, 0), facing: t(NBT.INT, 5), progress: t(NBT.FLOAT, 0.5), extending: t(NBT.BYTE, 1)}),
    tile('Piston', x0 + 4, 70, z0 + 4, {blockId: t(NBT.INT, 1), blockData: t(NBT.INT, 0), facing: t(NBT.INT, 5), progress: t(NBT.FLOAT, 0.5), extending: t(NBT.BYTE, 1)}), // air cell
  ];
  const files = await regions([{chunk, tileEntities, entities: [], tileTicks: []}]);
  const {record, report} = await importJavaRegionArea(files, {area: {chunkX: -2, chunkZ: 3, width: 1, depth: 1}, mode: 'survival'});
  assert.deepEqual(record.pistons, [{x: 51, y: 70, z: 51, block: 1, meta: 0, facing: 5, progress: 0.5, extending: true}]);
  assert.deepEqual(report.tileEntities.converted, {Piston: 1});
});
