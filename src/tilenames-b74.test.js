// Batch 74 tilenames: CustomName on block entities (tile-names.js), against tile-names-reference.json (tools/verify-tile-names.mjs, unchanged 1.7.10 classes).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { placeHeldBlock } from './block-placement-simulation.js';
import { World } from './world.js';
import { Survival, ITEMS } from './survival.js';
import { brewingView } from './brewing.js';
import { exportJavaSave, writeContainerTile } from './region-export.js';
import { importJavaRegionArea, readContainerTile } from './region-import.js';
import { readRegion, decodeRegionChunk } from './region-file.js';
import { chunkFromNbt } from './chunk-nbt.js';
import { nameStoreOf, nameTileFromStack } from './tile-names.js';

const ref = JSON.parse(readFileSync(new URL('../public/research/tile-names-reference.json', import.meta.url), 'utf8')).records;
const hooks = { collides: () => false };

function place(survival, world, itemId, at, named, yaw = 0) {
  survival.inventory.setStack(0, { id: itemId, count: 8, damage: 0, ...(named === undefined ? {} : { displayName: named }) });
  const below = [at[0], at[1] - 1, at[2]];
  world.set(...below, 1);
  world.set(...at, 0);
  const out = placeHeldBlock({ world, survival, position: { x: at[0] + 20.5, y: at[1], z: at[2] + 20.5 }, yaw, flowers: {}, farming: { observe() {} } }, { id: itemId, item: ITEMS[itemId], target: { block: below, adjacent: at } }, hooks);
  assert.equal(out.placed, true, `placing ${itemId}: ${out.reason}`);
  return at.join(',');
}
const fresh = () => ({ world: new World('tn', 'meadow', 1), survival: new Survival({}, 'survival') });

test('executed reference: the six block entities write CustomName only when named; dispensers count an empty name', () => {
  const tiles = ref.filter((r) => r.tile);
  assert.equal(tiles.length, 7);
  for (const r of tiles) {
    assert.equal(r.defaultFlag, false); assert.equal(r.unnamedHasCustomName, false);
    assert.equal(r.flag, true); assert.equal(r.writtenCustomName, 'Stash');
    assert.equal(r.readName, 'Loot'); assert.equal(r.wrongTypeFlag, false);
    const dispenser = r.tile === 'Trap' || r.tile === 'Dropper';
    assert.equal(r.emptyFlag, dispenser); assert.equal(r.emptyWritten, dispenser);
  }
});

test('placing a named stack names the tile; an unnamed stack leaves it unnamed', () => {
  const { world, survival } = fresh();
  const cases = [[41, 'chests'], [14, 'furnaces'], [1115, 'dispensers'], [1132, 'dispensers'], [133, 'hoppers'], [1134, 'brewing']];
  cases.forEach(([item, store], i) => {
    const key = place(survival, world, item, [10 + i * 3, 40, 10], `Named ${item}`);
    assert.equal(survival[store][key].name, `Named ${item}`, `store ${store}`);
    const plain = place(survival, world, item, [10 + i * 3, 40, 20]);
    assert.equal(survival[store][plain]?.name ?? null, null);
  });
  const table = place(survival, world, 86, [40, 40, 10], 'Study');
  assert.equal(survival.tableNames[table], 'Study');
  assert.equal(nameStoreOf(163), null); // an ender chest is not named
  assert.equal(nameTileFromStack(survival, 41, '0,0,0', { id: 54, count: 1 }), false);
});

test('names survive a save and load of the player record, and an unnamed tile writes no name', () => {
  const { world, survival } = fresh();
  const chest = place(survival, world, 41, [10, 40, 10], 'Loot'), furnace = place(survival, world, 14, [14, 40, 10], 'Smelter'), drop = place(survival, world, 1132, [18, 40, 10], ''), table = place(survival, world, 86, [22, 40, 10], 'Study'), plain = place(survival, world, 1115, [26, 40, 10]);
  const saved = JSON.parse(JSON.stringify(survival.serialize())), back = new Survival(saved, 'survival');
  assert.equal(back.chests[chest].name, 'Loot'); assert.equal(back.furnaces[furnace].name, 'Smelter');
  assert.equal(back.dispensers[drop].name, ''); assert.equal(back.tableNames[table], 'Study');
  assert.ok(!('name' in back.dispensers[plain]));
  assert.ok(!('name' in saved.dispensers[plain]));
});

test('container titles: a custom name is shown unchanged, a large chest uses the west/north half first', () => {
  const { world, survival } = fresh();
  const a = place(survival, world, 41, [10, 40, 10], 'Alpha', Math.PI / 2), b = place(survival, world, 41, [11, 40, 10], 'Beta', Math.PI / 2);
  const east = survival.openChest(world, 11, 40, 10);
  assert.equal(east.title, 'Alpha'); assert.equal(east.titleLocalized, true);
  survival.chests[a].name = null;
  assert.equal(survival.openChest(world, 10, 40, 10).title, 'Beta');
  delete survival.chests[b].name;
  const plain = survival.openChest(world, 10, 40, 10);
  assert.equal(plain.title, 'Large Chest'); assert.ok(!plain.titleLocalized);
  const f = place(survival, world, 14, [30, 40, 10], 'Chest'); // equal to a default English title: still not translated
  const fc = survival.openFurnace(f, () => {});
  assert.equal(fc.title, 'Chest'); assert.equal(fc.titleLocalized, true);
  const stand = place(survival, world, 1134, [34, 40, 10], 'Brews');
  assert.equal(brewingView(survival.brewing[stand]).customName, 'Brews');
});

test('NBT: containers write CustomName when named and read it back', () => {
  const tile = readContainerTile('Chest', new Map(Object.entries({ id: { type: 8, value: 'Chest' }, CustomName: { type: 8, value: 'Loot' } })));
  assert.equal(tile.record.name, 'Loot'); assert.deepEqual(tile.ignored, []);
  const written = writeContainerTile('chests', { items: Array(27).fill(null), name: 'Loot' }, 1, 2, 3);
  assert.equal(written.get('CustomName').value, 'Loot');
  assert.equal(writeContainerTile('furnaces', { items: [null, null, null] }, 1, 2, 3).has('CustomName'), false);
  assert.equal(writeContainerTile('furnaces', { items: [null, null, null], name: '' }, 1, 2, 3).has('CustomName'), false);
  assert.equal(writeContainerTile('dispensers', { items: Array(9).fill(null), name: '' }, 1, 2, 3).get('CustomName').value, '');
  assert.equal(writeContainerTile('brewing', { items: [null, null, null, null], brewTime: 0, name: 'B' }, 1, 2, 3).get('CustomName').value, 'B');
});

test('region export and import round trip a named chest and a named enchanting table', async () => {
  const w = new World('17', 'javaStreamed', 12);
  w.restore([['0,100,0', 41], ['2,100,0', 86]]);
  const player = new Survival({}, 'survival').serialize();
  player.chests['0,100,0'] = { facing: 3, items: Array(27).fill(null), name: 'Loot' };
  player.tableNames = { '2,100,0': 'Study' };
  const record = { id: 'x', name: 'X', seed: '17', biome: 'javaStreamed', generationVersion: 12, mode: 'survival', edits: [...w.edits], player, position: { x: 3.5, y: 110, z: 5.5, yaw: 0, pitch: 0 } };
  const { files } = await exportJavaSave(record, { world: w });
  const regions = [...files].filter(([k]) => /^region\/.*\.mca$/.test(k)).map(([k, bytes]) => ({ filename: k.slice(7), bytes }));
  const tiles = [];
  for (const { bytes } of regions) for (const entry of readRegion(bytes).values()) tiles.push(...chunkFromNbt(await decodeRegionChunk(entry)).tileEntities);
  const by = (id) => tiles.find((t) => t.get('id').value === id);
  assert.equal(by('Chest').get('CustomName').value, 'Loot');
  assert.equal(by('EnchantTable').get('CustomName').value, 'Study');
  const back = await importJavaRegionArea(regions, { area: { chunkX: w.originX / 16, chunkZ: w.originZ / 16, width: 1, depth: 1 } });
  assert.equal(Object.values(back.record.player.chests).find((c) => c.name)?.name, 'Loot');
  assert.deepEqual(Object.values(back.record.player.tableNames), ['Study']);
  assert.ok(!back.report.tileEntities.lost.some((l) => /CustomName/.test(JSON.stringify(l))));
});
