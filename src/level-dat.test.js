// level.dat, the singleplayer player and stats/<uuid>.json against public/research/level-dat-reference.json (the unchanged
// 1.7.10 WorldInfo, WorldType, GameRules and EntityPlayer; tools/verify-level-dat.mjs), and a browser -> Java -> browser save.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodeNbt } from './nbt.js';
import { NBT } from './nbt.js';
import { encodeCompressedNbt } from './nbt-compression.js';
import { WORLD_TYPES, parseWorldType, readLevelData, readLevelDat, javaPlayerFromNbt, levelGenerator, statsRecordFromJson } from './level-dat.js';
import { levelNbt, exportJavaSave } from './region-export.js';
import { importJavaRegionArea, itemFromOriginal, hangingFromNbt } from './region-import.js';
import { importedRuntime } from './world-import.js';
import { DEFAULT_RULES, ruleOn } from './game-rules.js';
import { Survival } from './survival.js';
import { Experience } from './experience.js';
import { World } from './world.js';
import { populationBlockMapperReady } from './population-world.js';
import { Hanging } from './hanging.js';
import { Minecarts } from './minecarts.js';
import { statsFileJson, parseStatsFile, Stats } from './stats.js';

const ref = JSON.parse(readFileSync(new URL('../public/research/level-dat-reference.json', import.meta.url), 'utf8'));
const fromHex = (h) => decodeNbt(Uint8Array.from(h.match(/../g).map((b) => parseInt(b, 16)))).tag.value;
const plain = (t) => {
  const v = t.value;
  if (t.type === NBT.COMPOUND) return Object.fromEntries([...v].map(([k, x]) => [k, plain(x)]));
  if (t.type === NBT.LIST) return v.items.map((i) => plain({ type: v.elementType, value: i }));
  return v;
};
const value = (map, key) => map.get(key)?.value;
// The native ItemStack.loadItemStackFromNBT result as the probe records it: [id, count, damage] for a registered item.
const rawItem = (c) => (itemFromOriginal(value(c, 'id'), value(c, 'Damage')) ? [value(c, 'id'), value(c, 'Count'), value(c, 'Damage')] : null);

test('WorldType names, versions and parseWorldType match 1.7.10', () => {
  for (const t of ref.worldTypes) {
    const ours = WORLD_TYPES.find((w) => w.name === t.name);
    assert.ok(ours, t.name);
    assert.equal(ours.id, t.id); assert.equal(ours.version, t.version); assert.equal(!!ours.versioned, t.versioned);
  }
  assert.equal(WORLD_TYPES.length, ref.worldTypes.length);
  for (const p of ref.parseWorldType) assert.equal(parseWorldType(p.name), p.type, p.name);
});

test('GameRules defaults and the boolean read match GameRules', () => {
  assert.deepEqual({ ...DEFAULT_RULES }, plain({ type: NBT.COMPOUND, value: fromHex(ref.gameRules) }));
  for (const r of ref.ruleValues) assert.equal(ruleOn({ gameRules: { keepInventory: r.value } }, 'keepInventory'), r.on, JSON.stringify(r.value));
});

// What WorldInfo(NBTTagCompound) kept, as its writer puts it back.
function assertLevelMatches(level, written, dimension, name) {
  assert.equal(level.seed, value(written, 'RandomSeed').toString(), name);
  assert.equal(level.worldType, value(written, 'generatorName'), name);
  assert.equal(level.generatorVersion, value(written, 'generatorVersion'), name);
  assert.equal(level.generatorOptions, value(written, 'generatorOptions'), name);
  assert.equal(level.gameType, value(written, 'GameType'), name);
  assert.equal(level.mapFeatures, value(written, 'MapFeatures') === 1, name);
  assert.equal(level.hardcore, value(written, 'hardcore') === 1, name);
  assert.equal(level.allowCommands, value(written, 'allowCommands') === 1, name);
  assert.equal(level.initialized, value(written, 'initialized') === 1, name);
  assert.equal(level.time, Number(value(written, 'Time')), name);
  assert.equal(level.dayTime, Number(value(written, 'DayTime')), name);
  assert.deepEqual(level.spawn, ['SpawnX', 'SpawnY', 'SpawnZ'].map((k) => value(written, k)), name);
  assert.equal(level.levelName, value(written, 'LevelName'), name);
  for (const k of ['rainTime', 'thunderTime']) assert.equal(level[k], value(written, k), name);
  for (const k of ['raining', 'thundering']) assert.equal(level[k], value(written, k) === 1, name);
  assert.deepEqual(level.gameRules, plain(written.get('GameRules')), name);
  assert.equal(level.dimension, dimension, name);
}

test('readLevelData keeps what WorldInfo(NBTTagCompound) keeps', () => {
  assert.equal(ref.reads.length, 17);
  for (const r of ref.reads) {
    const level = readLevelData(fromHex(r.input));
    assertLevelMatches(level, fromHex(r.written), r.dimension, r.name);
  }
  const ignored = readLevelData(fromHex(ref.reads.find((r) => r.name === 'difficulty-ignored').input)).ignored;
  assert.ok(ignored.includes('Difficulty'));
  // initialized: the probe's fresh WorldSettings write 0 and read it back as 0.
  for (const s of ref.settings) {
    const data = fromHex(s.written), level = readLevelData(data);
    assert.equal(level.initialized, false, s.name);
    assertLevelMatches(level, fromHex(s.reread), 0, `settings:${s.name}`);
  }
});

test('levelGenerator continues each world type with its generator', () => {
  const kinds = Object.fromEntries(ref.settings.map((s) => [s.name, levelGenerator(readLevelData(fromHex(s.written)))]));
  assert.deepEqual(kinds['default-survival'], { seed: '17', biome: 'javaStreamed', worldType: 'default', generatorOptions: '', generationVersion: 16, approximate: [] });
  assert.equal(kinds['flat-creative-commands'].worldType, 'flat');
  assert.equal(kinds['flat-creative-commands'].generatorOptions, '2;7,2x3,2;1;village');
  assert.equal(kinds['flat-creative-commands'].generationVersion, 16);
  assert.equal(kinds['largeBiomes-hardcore'].worldType, 'largeBiomes');
  assert.equal(kinds['amplified-adventure-nofeatures'].generationVersion, 17);
  assert.equal(kinds['amplified-adventure-nofeatures'].seed, '-9223372036854775808');
  assert.equal(kinds.default_1_1.worldType, 'default_1_1');
  assert.equal(kinds.default_1_1.seed, '9223372036854775807');
});

test('javaPlayerFromNbt reads what EntityPlayer.readEntityFromNBT keeps', () => {
  for (const c of ref.players) {
    const written = fromHex(c.written);
    const p = javaPlayerFromNbt(c.input ? fromHex(c.input) : written, { convertItem: rawItem });
    const name = c.name;
    assert.equal(p.player.health, c.health, name);
    assert.deepEqual([p.player.food, p.player.saturation, p.player.exhaustion, p.player.timer], c.food.map((v, i) => (i === 0 || i === 3 ? v : Math.fround(v))), name);
    assert.deepEqual([p.experience.level, p.experience.total, p.experience.progress], c.xp, name);
    assert.equal(p.selectedItemSlot, value(written, 'SelectedItemSlot'), name);
    assert.equal(p.player.current, Math.max(0, Math.min(8, value(written, 'SelectedItemSlot'))), name);
    assert.deepEqual(p.player.slots, c.slots, name);
    assert.deepEqual(p.player.armor, c.armor, name);
    const sortEffects = (l) => [...l].sort((a, b) => a[0] - b[0]);
    assert.deepEqual(sortEffects(p.effects.map((e) => [e.id, e.duration, e.amplifier, e.ambient])), sortEffects(c.effects), name);
    assert.equal(p.player.air, value(written, 'Air'), name);
    assert.equal(p.player.fire, value(written, 'Fire'), name);
    assert.equal(p.player.absorption, value(written, 'AbsorptionAmount'), name);
    assert.equal(p.fallDistance, value(written, 'FallDistance'), name);
    assert.equal(p.dimension, value(written, 'Dimension'), name);
    const ender = Array(27).fill(null);
    for (const e of written.get('EnderItems').value.items) ender[value(e, 'Slot')] = rawItem(e);
    assert.deepEqual(p.player.enderItems, ender, name);
    const ab = written.get('abilities').value;
    assert.deepEqual([p.abilities.invulnerable, p.abilities.flying, p.abilities.mayfly, p.abilities.instabuild, p.abilities.mayBuild], c.abilities, name);
    assert.deepEqual([p.abilities.flySpeed, p.abilities.walkSpeed], [value(ab, 'flySpeed'), value(ab, 'walkSpeed')], name);
    const spawn = ['SpawnX', 'SpawnY', 'SpawnZ'].map((k) => value(written, k));
    assert.deepEqual(p.bedSpawn, spawn.every(Number.isInteger) ? spawn : null, name);
    assert.deepEqual([p.position.x, p.position.y, p.position.z], c.pos, name);
    // The camera angles are the exporter's inverse: Rotation = [(PI - yaw) * 180 / PI, -pitch * 180 / PI].
    const yaw = ((((Math.PI - p.position.yaw) * 180) / Math.PI) % 360 + 360) % 360;
    assert.ok(Math.abs(yaw - ((c.yaw % 360) + 360) % 360) < 1e-9, name);
    assert.ok(Math.abs((-p.position.pitch * 180) / Math.PI - c.pitch) < 1e-9, name);
  }
  // InventoryPlayer.readFromNBT keeps a Count 0 main stack (the native read-back [1,0,0]); javaPlayerFromNbt keeps it too (zero-stacks.test.js).
  const oddCase = ref.players.find((c) => c.name === 'inventory-odd-slots'), odd = javaPlayerFromNbt(fromHex(oddCase.input));
  assert.deepEqual(oddCase.slots[3], [1, 0, 0]);
  assert.equal(odd.player.slots[3].count, 0);
  assert.ok(odd.lost.includes('Inventory slot 36') && odd.lost.includes('Inventory slot 255'));
  const flying = javaPlayerFromNbt(fromHex(ref.players.find((c) => c.name === 'creative-flying').input));
  assert.equal(flying.playerGameType, 1);
  // abilities.flying and SpawnForced are carried now (import applies them), no longer reported as lost.
  assert.equal(flying.flying, true);
  assert.ok(!flying.lost.some((l) => l.startsWith('abilities.flying')) && !flying.lost.includes('SpawnForced'));
});

test('the converted player loads into Survival and Experience', () => {
  const rich = javaPlayerFromNbt(fromHex(ref.players.find((c) => c.name === 'rich').input));
  const s = new Survival(rich.player, 'survival');
  assert.equal(s.health, 13.5);
  assert.deepEqual([s.food, s.saturation, s.exhaustion, s.timer], [17, 2.5, 1.25, 30]);
  assert.equal(s.air, 250);
  assert.equal(s.inventory.current, 1);
  const pick = s.inventory.main[0];
  assert.equal(pick.count, 1); assert.equal(pick.damage, 12); assert.equal(pick.displayName, 'Mining pick');
  assert.deepEqual(pick.enchantments, [{ id: 32, lvl: 3 }]);
  assert.equal(s.inventory.main[35].pages?.[0] ?? s.inventory.main[35].book?.pages?.[0], 'Hello');
  assert.equal(s.enderItems[26].count, 16);
  assert.deepEqual(s.effects.serialize().map((e) => e.id).sort((a, b) => a - b), [1, 16]);
  const xp = new Experience(rich.experience).serialize();
  assert.equal(xp.level, 7); assert.equal(xp.total, 120); assert.equal(xp.score, 99);
});

test('levelNbt writes the keys and types WorldInfo and EntityPlayer write', () => {
  for (const s of ref.settings) {
    const native = fromHex(s.written), level = readLevelData(native);
    const record = { name: level.levelName, biome: 'javaStreamed', worldType: level.worldType, mode: ['survival', 'creative', 'adventure'][level.gameType],
      allowCommands: level.allowCommands, gameRules: level.gameRules, ...(level.mapFeatures ? {} : { mapFeatures: false }), ...(level.hardcore ? { hardcore: true } : {}),
      worldSpawn: level.spawn, player: { time: level.dayTime }, position: { x: 0, y: 70, z: 0, yaw: 0, pitch: 0 } };
    const w = { javaSeed: BigInt(level.seed), originX: 0, originZ: 0, generatorOptions: level.generatorOptions, spawn: () => ({ x: 0, y: 64, z: 0 }) };
    const ours = levelNbt(record, w).tag.value.get('Data').value;
    assert.deepEqual(new Set(ours.keys()), new Set(native.keys()), s.name);
    for (const [k, t] of native) assert.equal(ours.get(k).type, t.type, `${s.name} ${k}`);
    for (const k of ['RandomSeed', 'generatorName', 'generatorVersion', 'generatorOptions', 'GameType', 'MapFeatures', 'hardcore', 'allowCommands', 'LevelName'])
      assert.deepEqual(ours.get(k), native.get(k), `${s.name} ${k}`);
    assert.deepEqual(plain(ours.get('GameRules')), plain(native.get('GameRules')), s.name);
    assert.deepEqual(readLevelData(ours).worldType, level.worldType, s.name);
  }
  // The player: every key of the native rich save, with its type, comes back from a converted rich player.
  const richNative = fromHex(ref.players.find((c) => c.name === 'rich').written);
  const rich = javaPlayerFromNbt(richNative);
  const record = { mode: 'survival', player: rich.player, experience: rich.experience, bed: { spawn: rich.bedSpawn }, position: rich.position, worldSpawn: [0, 64, 0] };
  const player = levelNbt(record, { javaSeed: 1n, originX: 0, originZ: 0, spawn: () => ({ x: 0, y: 64, z: 0 }) }).tag.value.get('Data').value.get('Player').value;
  for (const [k, t] of richNative) if (!['UUIDMost', 'UUIDLeast'].includes(k)) { assert.ok(player.has(k), k); assert.equal(player.get(k).type, t.type, k); }
  for (const k of ['HealF', 'Health', 'Air', 'Fire', 'foodLevel', 'foodSaturationLevel', 'foodExhaustionLevel', 'foodTickTimer', 'XpLevel', 'XpP', 'XpTotal', 'Score', 'SelectedItemSlot', 'SpawnX', 'SpawnY', 'SpawnZ', 'Dimension'])
    assert.deepEqual(player.get(k), richNative.get(k), k);
  assert.deepEqual(player.get('Pos'), richNative.get('Pos'));
  assert.deepEqual(plain(player.get('Rotation')).map((v) => Math.round(v * 1000) / 1000), plain(richNative.get('Rotation')));
  const byId = (l) => Object.fromEntries(plain(l).map((e) => [e.Id, [e.Duration, e.Amplifier]]));
  assert.deepEqual(byId(player.get('ActiveEffects')), byId(richNative.get('ActiveEffects')));
  const inv = (l) => plain(l).map((e) => [e.Slot, e.id, e.Count, e.Damage]).sort((a, b) => a[0] - b[0]);
  assert.deepEqual(inv(player.get('Inventory')), inv(richNative.get('Inventory')));
  assert.deepEqual(inv(player.get('EnderItems')), inv(richNative.get('EnderItems')));
});

test('stats files keep the exploreAllBiomes progress both ways', () => {
  const s = new Stats({ 'stat.jump': 12, 'stat.walkOneCm': 3400 });
  const text = statsFileJson(s, ['openInventory'], ['Plains', 'Forest']);
  const json = JSON.parse(text);
  assert.deepEqual(json['achievement.exploreAllBiomes'], { value: 0, progress: ['Plains', 'Forest'] });
  assert.deepEqual(parseStatsFile(text).biomes, ['Plains', 'Forest']);
  const record = statsRecordFromJson(text);
  assert.deepEqual(record, { stats: { 'stat.jump': 12, 'stat.walkOneCm': 3400 }, achievements: { unlocked: ['openInventory'], biomes: ['Plains', 'Forest'] } });
  assert.deepEqual(importedRuntime(record), record);
  // A native file: plain ints, an unlocked exploreAllBiomes object and an unknown stat.
  const native = statsRecordFromJson('{"stat.leaveGame":3,"achievement.exploreAllBiomes":{"value":1,"progress":["Desert"]},"stat.futureThing":4}');
  assert.deepEqual(native, { stats: { 'stat.leaveGame': 3 }, achievements: { unlocked: ['exploreAllBiomes'], biomes: ['Desert'] } });
  assert.deepEqual(statsRecordFromJson('nope'), { stats: {}, achievements: { unlocked: [], biomes: [] } });
});

test('a browser world exported to Java and imported with its level.dat continues with the same generator and player', async () => {
  await populationBlockMapperReady;
  const w = new World('8675309', 'javaStreamed', 15, 'default');
  // The player stands in chunk 4 of the exported 8x8 window, so the default import area is exactly the exported columns.
  const x0 = 68, z0 = 68, ground = w.surface(x0, z0);
  w.set(x0, ground, z0, 57); w.set(x0, ground + 1, z0, 1); w.set(x0 + 1, ground + 1, z0, 66);
  const player = new Survival({}, 'survival').serialize();
  Object.assign(player, { health: 15, food: 12, saturation: 1.5, air: 280, fire: -20, time: 30123, effects: [{ id: 1, amplifier: 1, duration: 600 }] });
  player.slots[0] = { id: 103, count: 1, damage: 12, displayName: 'Mining pick', enchantments: [{ id: 32, lvl: 3 }] };
  player.slots[4] = { id: 1, count: 40, damage: 0 };
  player.armor[3] = { id: 408, count: 1, damage: 7 }; // browser ids: 103 diamond pickaxe, 408 iron helmet
  player.current = 4;
  const hanging = JSON.parse(JSON.stringify(Hanging.fromJSON([{ kind: 'painting', dir: 2, tx: x0 - 2, ty: ground + 2, tz: z0, art: 'Kebab' },
    { kind: 'frame', dir: 0, tx: x0 + 3, ty: ground + 2, tz: z0, item: { id: 1, count: 1, damage: 0 }, rotation: 3 }]).toJSON()));
  const carts = { version: 1, carts: [
    { type: 2, x: x0 + 1.5, y: ground + 1.0625, z: z0 + 0.5, motion: [0, 0, 0], rotation: [90, 0], fallDistance: 0, fire: 0, onGround: true, fuel: 300, pushX: 0.5, pushZ: 0, items: [] },
    { type: 1, x: x0 + 1.5, y: ground + 1.0625, z: z0 + 1.5, motion: [0, 0, 0], rotation: [0, 0], fallDistance: 0, fire: 0, onGround: true, customName: 'Loot', items: [{ slot: 3, id: 264, damage: 0, count: 5 }] },
    { type: 4, x: x0 + 2.5, y: ground + 1.0625, z: z0 + 1.5, motion: [0, 0, 0], rotation: [0, 0], fallDistance: 0, fire: 0, onGround: true, spawner: { EntityId: 'Zombie', Delay: 33 }, items: [] },
    { type: 6, x: x0 + 3.5, y: ground + 1.0625, z: z0 + 1.5, motion: [0, 0, 0], rotation: [0, 0], fallDistance: 0, fire: 0, onGround: true, command: { command: '/say hi', successCount: 2, customName: '@', trackOutput: true, lastOutput: null }, items: [] },
  ] };
  const record = {
    id: 'round', name: 'Round trip', seed: '8675309', biome: 'javaStreamed', generationVersion: 16, worldType: 'default', mode: 'survival',
    allowCommands: true, gameRules: { ...DEFAULT_RULES, keepInventory: 'true', doDaylightCycle: 'false' },
    edits: [...w.edits], player, position: { x: x0 + 0.5, y: ground + 2, z: z0 + 0.5, yaw: 0.5, pitch: -0.25 },
    experience: { total: 50, score: 50, level: 5, progress: 0.5 }, bed: { spawn: [x0 + 5, ground, z0] }, worldSpawn: [x0, ground + 1, z0],
    weather: { rainTime: 1234, thunderTime: 5678, raining: true, thundering: false },
    stats: { 'stat.jump': 9 }, achievements: { unlocked: ['openInventory'], biomes: ['Forest'] },
    hanging, minecarts: carts, updated: 1700000000000,
  };
  const { files } = await exportJavaSave(record, { world: w });
  const level = await readLevelDat(files.get('level.dat'));
  assert.equal(level.worldType, 'default'); assert.equal(level.generatorVersion, 1); assert.equal(level.allowCommands, true);
  assert.equal(level.gameRules.keepInventory, 'true');
  const regions = [...files].filter(([n]) => /^region\/r\.-?\d+\.-?\d+\.mca$/.test(n)).map(([n, bytes]) => ({ filename: n.slice(7), bytes }));
  const statsName = [...files.keys()].find((n) => n.startsWith('stats/'));
  const { record: back, report } = await importJavaRegionArea(regions, { level, stats: new TextDecoder().decode(files.get(statsName)) });
  // Same seed and generator: the area differs from the regenerated world only by the player's edits.
  assert.equal(back.seed, '8675309'); assert.equal(back.biome, 'javaStreamed'); assert.equal(back.worldType, 'default'); assert.equal(back.generationVersion, 16);
  assert.deepEqual(report.base.generatorOrigin, { chunkX: w.originX >> 4, chunkZ: w.originZ >> 4 });
  assert.deepEqual(new Map(back.edits), new Map(record.edits));
  assert.equal(report.chunks.converted, 64);
  assert.equal(report.biomes.differing, 0);
  assert.equal(back.mode, 'survival'); assert.equal(back.allowCommands, true);
  assert.equal(back.gameRules.doDaylightCycle, 'false');
  assert.deepEqual(back.worldSpawn, record.worldSpawn);
  assert.deepEqual(back.bed, record.bed);
  assert.deepEqual(back.weather, record.weather);
  assert.equal(back.player.time, 30123);
  assert.ok(Math.abs(back.position.x - record.position.x) < 1e-9 && Math.abs(back.position.z - record.position.z) < 1e-9 && back.position.y === record.position.y);
  assert.ok(Math.abs(back.position.yaw - record.position.yaw) < 1e-6 && Math.abs(back.position.pitch - record.position.pitch) < 1e-6);
  const s = new Survival(back.player, back.mode);
  assert.equal(s.health, 15); assert.equal(s.food, 12); assert.equal(s.air, 280); assert.equal(s.fire, -20); assert.equal(s.inventory.current, 4);
  assert.equal(s.inventory.main[0].displayName, 'Mining pick'); assert.equal(s.inventory.main[4].count, 40); assert.equal(s.inventory.armor[3].id, 408);
  assert.deepEqual(s.effects.serialize().map(({ id, amplifier, duration }) => [id, amplifier, duration]), [[1, 1, 600]]);
  assert.deepEqual(new Experience(back.experience).serialize().level, 5);
  assert.deepEqual(back.stats, record.stats); assert.deepEqual(back.achievements, record.achievements);
  // Paintings, item frames and every cart type come back.
  assert.deepEqual(back.hanging, hanging);
  assert.equal(Hanging.fromJSON(back.hanging).entities.length, 2);
  const cartsBack = back.minecarts.carts.sort((a, b) => a.type - b.type);
  assert.deepEqual(cartsBack.map((c) => c.type), [1, 2, 4, 6]);
  assert.deepEqual(cartsBack[0].items, [{ slot: 3, id: 264, damage: 0, count: 5 }]); assert.equal(cartsBack[0].customName, 'Loot');
  assert.deepEqual([cartsBack[1].fuel, cartsBack[1].pushX, cartsBack[1].rotation], [300, 0.5, [90, 0]]);
  assert.equal(cartsBack[2].spawner.EntityId, 'Zombie'); assert.equal(cartsBack[2].spawner.Delay, 33);
  assert.deepEqual([cartsBack[3].command.command, cartsBack[3].command.successCount], ['/say hi', 2]);
  const viaImport = importedRuntime(JSON.parse(JSON.stringify(back)));
  assert.equal(Minecarts.fromJSON(viaImport.minecarts).carts.length, 4);
  assert.equal(viaImport.minecarts.carts.find((c) => c.type === 4).spawner.EntityId, 'Zombie');
  assert.equal(viaImport.minecarts.carts.find((c) => c.type === 6).command.command, '/say hi');
  assert.equal(viaImport.hanging.length, 2); assert.deepEqual(viaImport.gameRules, back.gameRules); assert.deepEqual(viaImport.bed, back.bed);
  // The imported columns are claimed, so streamed population does not hand them out again.
  const cells = Object.values(back.populatedColumns.cells).reduce((n, hex) => n + [...BigInt('0x' + hex).toString(2)].filter((b) => b === '1').length, 0);
  assert.equal(cells, 64);
});

test('a level.dat import writes a gzip document readLevelDat accepts, and reports a player in another dimension', async () => {
  const nether = fromHex(ref.players.find((c) => c.name === 'nether').input);
  const data = fromHex(ref.settings.find((s) => s.name === 'default-survival').written);
  data.set('Player', { type: NBT.COMPOUND, value: nether });
  const bytes = await encodeCompressedNbt({ name: '', tag: { type: NBT.COMPOUND, value: new Map([['Data', { type: NBT.COMPOUND, value: data }]]) } });
  const level = await readLevelDat(bytes);
  assert.equal(level.dimension, -1);
  const { record, report } = await importJavaRegionArea([], { level, area: { chunkX: 0, chunkZ: 0, width: 1, depth: 1 }, generationVersion: 13 });
  assert.equal(report.level.player.dimension, -1);
  assert.match(report.level.player.placed, /world spawn/);
  assert.deepEqual([record.position.x, record.position.z], [record.worldSpawn[0] + 0.5, record.worldSpawn[2] + 0.5]);
  assert.equal(record.generationVersion, 13);
  assert.equal(record.player.slots[0].displayName, 'Mining pick');
});

test('region painting and item-frame compounds read as the native EntityHanging.readEntityFromNBT (hanging-reference nbt-read)', () => {
  const hangingRef = JSON.parse(readFileSync(new URL('../public/research/hanging-reference.json', import.meta.url), 'utf8'));
  const toMap = (t) => (t.type === NBT.COMPOUND ? { type: t.type, value: new Map(t.value.map(([k, v]) => [k, toMap(v)])) } : t);
  const cases = hangingRef.cases.filter((c) => c.kind === 'nbt-read');
  assert.equal(cases.length, 11);
  for (const c of cases) {
    const raw = (item) => (item.size ? { id: value(item, 'id'), count: value(item, 'Count'), damage: value(item, 'Damage') } : null);
    const made = hangingFromNbt(toMap(c.tag).value, c.frame ? 'ItemFrame' : 'Painting', { convertItem: raw });
    assert.deepEqual([made.dir, made.tx, made.ty, made.tz], c.state.slice(0, 4), c.name);
    if (c.frame) {
      assert.deepEqual(made.item ? [made.item.id, made.item.count, made.item.damage, null] : null, c.item, c.name);
      assert.equal(made.rotation, c.rotation, c.name);
    } else assert.equal(made.art, c.art, c.name);
    // The live entity built from the record stands where the native one does.
    const e = Hanging.fromJSON([made]).entities[0];
    assert.ok([e.x, e.y, e.z].every((v, k) => Math.abs(v - c.state[4 + k]) < 1e-9), `${c.name}: ${[e.x, e.y, e.z]} vs ${c.state.slice(4, 7)}`);
  }
});
