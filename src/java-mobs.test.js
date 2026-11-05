import test from 'node:test';
import assert from 'node:assert/strict';
import reference from '../public/research/zombie-villager-reference.json' with { type: 'json' };
import { World } from './world.js';
import { exportJavaSave } from './region-export.js';
import { readRegion, decodeRegionChunk, regionAddress, regionSlot } from './region-file.js';
import { chunkFromNbt } from './chunk-nbt.js';
import { decodeNbt, NBT } from './nbt.js';
import { javaMobFromNbt, JAVA_MOBS } from './java-mobs.js';
import { Survival } from './survival.js';
import { EntityWorld } from './entities.js';

const hex = (s) => Uint8Array.from(s.match(/../g).map((b) => parseInt(b, 16)));
const nativeEntity = (kind, variant) => decodeNbt(hex(reference.records.find((r) => r.case === 'entityNbt' && r.kind === kind && r.variant === variant).nbt)).tag.value;

test('the native zombie NBT (IsBaby, IsVillager, ConversionTime, ActiveEffects) imports as zombie villager state', () => {
  assert.deepEqual(Object.keys(JAVA_MOBS).sort(), ['Enderman', 'Slime', 'Villager', 'VillagerGolem', 'Zombie']);
  const [plain, villager, baby, converting] = [0, 1, 2, 3].map((v) => javaMobFromNbt(nativeEntity('zombie', v), { shiftX: 10, shiftZ: -20 }));
  assert.deepEqual([plain.type, plain.villager, plain.growingAge, plain.conversionTime], ['zombie', false, 0, undefined]);
  assert.deepEqual([villager.villager, villager.growingAge, villager.conversionTime], [true, 0, undefined]);
  assert.deepEqual([baby.villager, baby.growingAge], [true, -1]);
  assert.deepEqual([converting.villager, converting.conversionTime], [true, 3777]);
  // Strength (id 5) for the length of the cure, written by startConversion.
  assert.deepEqual(converting.effects, [{ id: 5, amplifier: 0, duration: 3777 }]);
  assert.deepEqual([plain.x, plain.y, plain.z, plain.health], [74.5, 0, 44.5, 20]);
  // EntityWorld reads it back as a live zombie villager with its countdown.
  const w = { get: () => 0, getMeta: () => 0, solid: () => false, surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }), numericSeed: 1 };
  const ew = new EntityWorld(w, [{ ...converting, x: 64.5, z: 64.5 }], () => 0.5);
  const z = ew.entities[0];
  assert.deepEqual([z.type, z.villager, z.conversionTime], ['zombie', true, 3777]);
});

test('the native iron golem NBT imports with PlayerCreated', () => {
  assert.equal(javaMobFromNbt(nativeEntity('golem', 0)).playerCreated, false);
  const built = javaMobFromNbt(nativeEntity('golem', 1));
  assert.deepEqual([built.type, built.playerCreated, built.health], ['iron_golem', true, 100]);
});

test('unknown entities and unusable positions are not mobs', () => {
  assert.equal(javaMobFromNbt(new Map([['id', { type: NBT.STRING, value: 'Pig' }]])), null);
  assert.equal(javaMobFromNbt(new Map([['id', { type: NBT.STRING, value: 'Zombie' }]])), null);
});

test('export then import keeps zombie villagers, a curing timer, golems and villagers', async () => {
  const w = new World('17', 'javaStreamed', 12), player = new Survival({}, 'survival').serialize();
  const mobs = [
    { type: 'zombie', x: -2, y: 102, z: -2, health: 20, growingAge: 0, villager: true, conversionTime: 4000, effects: [{ id: 5, duration: 4000, amplifier: 0 }] },
    { type: 'zombie', x: -3, y: 102, z: -2, health: 12, growingAge: -1, villager: true },
    { type: 'zombie', x: -4, y: 102, z: -2, health: 20, growingAge: 0 },
    { type: 'iron_golem', x: -5, y: 102, z: -2, health: 90, playerCreated: true },
    { type: 'villager', x: -6, y: 102, z: -2, health: 20, growingAge: -24000, profession: 3, riches: 5, effects: [{ id: 9, duration: 150, amplifier: 0 }] },
  ];
  const record = { id: 'zv', name: 'ZV', seed: '17', biome: 'javaStreamed', generationVersion: 12, mode: 'survival', edits: [], player,
    position: { x: -0.5, y: 102, z: -0.5, yaw: 0, pitch: 0 }, entities: mobs, updated: 1700000000000 };
  const { files } = await exportJavaSave(record, { world: w });
  const cx = -1 + w.originX / 16, cz = -1 + w.originZ / 16, a = regionAddress(cx, cz);
  const chunk = chunkFromNbt(await decodeRegionChunk(readRegion(files.get(`region/r.${a.regionX}.${a.regionZ}.mca`)).get(regionSlot(a.x, a.z))));
  const byId = (id) => chunk.entities.filter((e) => e.get('id').value === id);
  const [curing, baby, , ] = byId('Zombie');
  assert.deepEqual([curing.get('IsVillager').value, curing.get('ConversionTime').value, curing.has('IsBaby'), curing.get('CanBreakDoors').value], [1, 4000, false, 0]);
  assert.deepEqual([baby.get('IsBaby').value, baby.get('IsVillager').value, baby.get('ConversionTime').value], [1, 1, -1]);
  assert.equal(byId('Zombie')[2].has('IsVillager'), false);
  assert.equal(byId('VillagerGolem')[0].get('PlayerCreated').value, 1);
  assert.equal(curing.get('ActiveEffects').value.items[0].get('Id').value, 5);
  const back = chunk.entities.map((e) => javaMobFromNbt(e, { shiftX: -w.originX, shiftZ: -w.originZ })).filter(Boolean);
  assert.equal(back.length, 5);
  const find = (type, pred = () => true) => back.find((m) => m.type === type && pred(m));
  assert.deepEqual([find('zombie', (m) => m.conversionTime).conversionTime, find('zombie', (m) => m.conversionTime).villager], [4000, true]);
  assert.deepEqual([find('zombie', (m) => m.growingAge < 0).villager, find('zombie', (m) => m.growingAge < 0).health], [true, 12]);
  assert.equal(find('zombie', (m) => !m.villager).villager, false);
  assert.equal(find('iron_golem').playerCreated, true);
  const v = find('villager');
  assert.deepEqual([v.profession, v.riches, v.growingAge, v.effects], [3, 5, -24000, [{ id: 9, amplifier: 0, duration: 150 }]]);
  assert.deepEqual([v.x, v.z], [-6, -2]);
});

test('importing a Java area brings zombie villagers, golems, villagers and the villages inside it', async () => {
  const { Chunk } = await import('./chunk-store.js');
  const { chunkToNbt } = await import('./chunk-nbt.js');
  const { encodeRegionChunk, writeRegion } = await import('./region-file.js');
  const { importJavaRegionArea } = await import('./region-import.js');
  const { encodeCompressedNbt } = await import('./nbt-compression.js');
  const { villageDocument } = await import('./village.js');
  const t = (type, value) => ({ type, value }), compound = (o) => new Map(Object.entries(o)), list = (elementType, items) => t(NBT.LIST, { elementType, items });
  const mob = (id, pos, extra = {}) => compound({ id: t(NBT.STRING, id), Pos: list(NBT.DOUBLE, pos), Motion: list(NBT.DOUBLE, [0, 0, 0]), ...extra });
  const chunk = new Chunk(-2, 3);
  chunk.setBlockState(1, 70, 1, 1, 0);
  const x0 = -32, z0 = 48;
  const entities = [
    mob('Zombie', [x0 + 4, 71, z0 + 4], { IsVillager: t(NBT.BYTE, 1), ConversionTime: t(NBT.INT, 500), IsBaby: t(NBT.BYTE, 1), HealF: t(NBT.FLOAT, 14) }),
    mob('VillagerGolem', [x0 + 6, 71, z0 + 4], { PlayerCreated: t(NBT.BYTE, 1) }),
    mob('Villager', [x0 + 8, 71, z0 + 4], { Profession: t(NBT.INT, 2), Riches: t(NBT.INT, 9), Age: t(NBT.INT, 0) }),
    mob('Zombie', [x0 + 40, 71, z0 + 4]), // outside the one-chunk area
    mob('Creeper', [x0 + 3, 71, z0 + 3]),
  ];
  const { regionX, regionZ, x, z } = regionAddress(chunk.x, chunk.z);
  const files = [{ filename: `r.${regionX}.${regionZ}.mca`, bytes: writeRegion([await encodeRegionChunk(chunkToNbt(chunk, { entities }), { x, z })]) }];
  const village = (cx, cz) => ({ pop: 4, radius: 30, golems: 1, stable: 100, tick: 5000, mtick: 0, c: [cx, 70, cz], ac: [cx + 2, 70, cz + 3],
    doors: [[cx + 1, 70, cz, -1, 0, 4000], [cx + 5, 70, cz + 2, 0, 1, 4500]], players: [['Steve', -7]] });
  const villages = await encodeCompressedNbt(villageDocument({ tick: 321, villages: [village(x0 + 8, z0 + 8), village(900, 900)] }));
  const { record, report } = await importJavaRegionArea(files, { area: { chunkX: -2, chunkZ: 3, width: 1, depth: 1 }, structureData: [{ filename: 'data/villages.dat', bytes: villages }] });
  // The area moves by +80 blocks in x (chunk -2 to chunk 3).
  assert.deepEqual(report.entities.converted, { Villager: 1, VillagerGolem: 1, Zombie: 1 });
  assert.deepEqual(report.entities.lost.map((e) => e.id).sort(), ['Creeper', 'Zombie (outside area)']);
  assert.deepEqual(record.entities.map((e) => e.type), ['zombie', 'iron_golem', 'villager']);
  const [zombie, golem, villager] = record.entities;
  assert.deepEqual([zombie.x, zombie.y, zombie.z, zombie.villager, zombie.conversionTime, zombie.growingAge, zombie.health], [52, 71, 52, true, 500, -1, 14]);
  assert.deepEqual([golem.playerCreated, villager.profession, villager.riches], [true, 2, 9]);
  assert.deepEqual(report.villages, { found: true, kept: 1, outside: 1 });
  assert.equal(record.villages.tick, 321);
  const v = record.villages.villages[0];
  assert.deepEqual([v.c, v.ac, v.doors, v.players, v.pop, v.golems], [[56, 70, 56], [58, 70, 59], [[57, 70, 48 + 8, -1, 0, 4000], [61, 70, 58, 0, 1, 4500]], [['Steve', -7]], 4, 1]);
  assert.equal(record.structureData, undefined, 'villages.dat is not structure data');
  // The record is what the browser loads: the zombie villager keeps its countdown, the village is a live collection.
  const w = { get: () => 0, getMeta: () => 0, solid: () => false, surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }), numericSeed: 1 };
  const ew = new EntityWorld(w, JSON.parse(JSON.stringify(record.entities)).map((e) => ({ ...e, x: 64.5, y: 10, z: 64.5 })), () => 0.5);
  assert.deepEqual(ew.entities.map((e) => e.type), ['zombie', 'iron_golem', 'villager']);
  ew.villages.loadJSON(record.villages);
  assert.equal(ew.villages.villages.length, 1);
});
