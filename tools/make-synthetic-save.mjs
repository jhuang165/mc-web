// Build a synthetic 1.7.10-format save folder: Anvil regions for the Overworld, Nether and End, level.dat, a player, stats and
// data/*.dat, with entities and tile entities. Terrain is this repo's generators (Overworld: StreamingPopulation.original, the
// ported ChunkProviderGenerate with caves/ravines; Nether/End: DimensionWorld), written as native NBT through the repo's own
// Anvil writer. It is NOT produced by the Java classes: the native evidence for generation and population is in
// tools/probes/InterchangePopulateProbe.java (tools/verify-interchange-populate.mjs).
//   node tools/make-synthetic-save.mjs OUT_DIR [--seed N] [--width 16] [--depth 6] [--first-x 28] [--first-z 0]
// Overworld rectangle: width x depth chunks from (first-x, first-z) (default 28..43 x 0..5: regions r.0.0 and r.1.0). Every
// third chunk column is left unpopulated (TerrainPopulated=0) so the importer's population pass has work; so is one Nether chunk
// (-1,-2) and one End chunk (-1,-1), whose +x/+z neighbours are stored (batch 28: Nether/End population).
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { populationBlockMapperReady } from '../src/population-world.js';
import { NBT } from '../src/nbt.js';
import { encodeCompressedNbt } from '../src/nbt-compression.js';
import { Chunk } from '../src/chunk-store.js';
import { chunkToNbt } from '../src/chunk-nbt.js';
import { encodeRegionChunk, writeRegion, regionAddress } from '../src/region-file.js';
import { toOriginal } from '../src/block-registry.js';

await populationBlockMapperReady;
const { streamedSource } = await import('../src/java-world.js');
const { DimensionWorld } = await import('../src/dimension-world.js');

const args = process.argv.slice(2), out = args.shift();
if (!out || out.startsWith('--')) { console.error('Usage: node tools/make-synthetic-save.mjs OUT_DIR [--seed N] [--width W] [--depth D] [--first-x X] [--first-z Z]'); process.exit(2); }
const opt = { seed: '4242', width: 16, depth: 6, 'first-x': 28, 'first-z': 0 };
while (args.length) { const k = args.shift().replace(/^--/, ''); opt[k] = args.shift(); }
const W = Number(opt.width), D = Number(opt.depth), X0 = Number(opt['first-x']), Z0 = Number(opt['first-z']);

const t = (type, value) => ({ type, value });
const compound = (o) => new Map(Object.entries(o));
const list = (type, items) => t(NBT.LIST, { elementType: type, items });
const doubles = (...v) => list(NBT.DOUBLE, v);
const item = (slot, id, count, damage = 0) => compound({ Slot: t(NBT.BYTE, slot), id: t(NBT.SHORT, id), Count: t(NBT.BYTE, count), Damage: t(NBT.SHORT, damage) });
const tile = (id, x, y, z, extra = {}) => compound({ id: t(NBT.STRING, id), x: t(NBT.INT, x), y: t(NBT.INT, y), z: t(NBT.INT, z), ...extra });
const mob = (id, x, y, z, extra = {}) => compound({ id: t(NBT.STRING, id), Pos: doubles(x, y, z), Motion: doubles(0, 0, 0), Rotation: list(NBT.FLOAT, [0, 0]),
  OnGround: t(NBT.BYTE, 1), Health: t(NBT.SHORT, 10), Air: t(NBT.SHORT, 300), Fire: t(NBT.SHORT, -1), FallDistance: t(NBT.FLOAT, 0), ...extra });

// Float a small furnished platform at y 200 (generated terrain never reaches it): chest, sign, furnace, hopper, spawner, skull.
function furnish(chunk, cx, cz, tiles, entities, seq) {
  const bx = cx * 16, bz = cz * 16, put = (lx, y, lz, id, meta = 0) => { const s = chunk.section(y >> 4, true); s.setBlock(lx, y & 15, lz, id); s.setMeta(lx, y & 15, lz, meta); };
  for (let lx = 2; lx < 9; lx++) put(lx, 199, 2, 1);
  put(2, 200, 2, 54, 2); tiles.push(tile('Chest', bx + 2, 200, bz + 2, { Items: list(NBT.COMPOUND, [item(0, 264, 5), item(1, 276, 1, 12), item(13, 322, 2, 1)]) }));
  put(3, 200, 2, 63, 4); tiles.push(tile('Sign', bx + 3, 200, bz + 2, { Text1: t(NBT.STRING, `{"text":"chunk ${cx}"}`), Text2: t(NBT.STRING, `{"text":"${cz}"}`), Text3: t(NBT.STRING, '{"text":""}'), Text4: t(NBT.STRING, '{"text":""}') }));
  put(4, 200, 2, 61, 3); tiles.push(tile('Furnace', bx + 4, 200, bz + 2, { BurnTime: t(NBT.SHORT, 120), CookTime: t(NBT.SHORT, 40), Items: list(NBT.COMPOUND, [item(0, 4, 8), item(1, 263, 4)]) }));
  put(5, 200, 2, 154, 0); tiles.push(tile('Hopper', bx + 5, 200, bz + 2, { TransferCooldown: t(NBT.INT, 0), Items: list(NBT.COMPOUND, [item(0, 296, 3)]) }));
  put(6, 200, 2, 52); tiles.push(tile('MobSpawner', bx + 6, 200, bz + 2, { EntityId: t(NBT.STRING, 'Zombie'), Delay: t(NBT.SHORT, 20), MinSpawnDelay: t(NBT.SHORT, 200), MaxSpawnDelay: t(NBT.SHORT, 800), SpawnCount: t(NBT.SHORT, 4), MaxNearbyEntities: t(NBT.SHORT, 6), RequiredPlayerRange: t(NBT.SHORT, 16), SpawnRange: t(NBT.SHORT, 4) }));
  put(7, 200, 2, 144, 1); tiles.push(tile('Skull', bx + 7, 200, bz + 2, { SkullType: t(NBT.BYTE, 3), Rot: t(NBT.BYTE, 4), ExtraType: t(NBT.STRING, 'Notch') }));
  entities.push(mob('Pig', bx + 3.5, 201, bz + 3.5, { Age: t(NBT.INT, 0), InLove: t(NBT.INT, 0) }));
  entities.push(mob('Cow', bx + 5.5, 201, bz + 3.5, { Age: t(NBT.INT, 0), InLove: t(NBT.INT, 0) }));
  if (seq % 2 === 0) entities.push(mob('Zombie', bx + 8.5, 201, bz + 8.5, { IsVillager: t(NBT.BYTE, 0), IsBaby: t(NBT.BYTE, 0), Equipment: list(NBT.COMPOUND, [compound({}), compound({}), compound({}), compound({}), compound({})]) }));
  entities.push(compound({ id: t(NBT.STRING, 'Item'), Pos: doubles(bx + 4.5, 201, bz + 4.5), Motion: doubles(0, 0, 0), Rotation: list(NBT.FLOAT, [0, 0]), OnGround: t(NBT.BYTE, 1), Health: t(NBT.SHORT, 5), Age: t(NBT.SHORT, 100), Fire: t(NBT.SHORT, 0), Air: t(NBT.SHORT, 300), FallDistance: t(NBT.FLOAT, 0),
    Item: t(NBT.COMPOUND, compound({ id: t(NBT.SHORT, 264), Count: t(NBT.BYTE, 2), Damage: t(NBT.SHORT, 0) })) }));
  if (seq % 5 === 0) entities.push(mob('MinecartChest', bx + 6.5, 201, bz + 6.5, { Items: list(NBT.COMPOUND, [item(0, 265, 7)]) }));
  if (seq % 7 === 0) entities.push(compound({ id: t(NBT.STRING, 'Painting'), Pos: doubles(bx + 9.5, 201.5, bz + 5.5), Motion: doubles(0, 0, 0), Rotation: list(NBT.FLOAT, [0, 0]), Dir: t(NBT.BYTE, 0), Motive: t(NBT.STRING, 'Kebab'), TileX: t(NBT.INT, bx + 9), TileY: t(NBT.INT, 201), TileZ: t(NBT.INT, bz + 5) }));
}

function toChunk(cx, cz, o, { populated, hasSky, furnished, seq, nether }) {
  const c = new Chunk(cx, cz, hasSky), tiles = [], entities = [];
  for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) for (let y = 0; y < 256; y++) {
    const i = (lx * 16 + lz) * 256 + y, id = o.blocks[i];
    if (!id) continue;
    const s = c.section(y >> 4, true); s.setBlock(lx, y & 15, lz, id); s.setMeta(lx, y & 15, lz, o.metadata?.[i] ?? 0);
  }
  if (furnished) furnish(c, cx, cz, tiles, entities, seq);
  c.isTerrainPopulated = populated; c.isLightPopulated = false;
  for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) c.biomes[lz * 16 + lx] = nether ? 8 : 1;
  return { chunk: c, tileEntities: tiles, entities };
}
const regions = new Map();
async function addChunk(dim, built) {
  const { chunk, ...payload } = built, a = regionAddress(chunk.x, chunk.z), key = `${dim}|${a.regionX}|${a.regionZ}`;
  if (!regions.has(key)) regions.set(key, { dim, rx: a.regionX, rz: a.regionZ, entries: [] });
  regions.get(key).entries.push(await encodeRegionChunk(chunkToNbt(chunk, payload), { x: a.x, z: a.z, timestamp: 1700000000 }));
}
const toOrig = (blocks, meta) => {
  const b = new Uint8Array(65536), m = new Uint8Array(65536);
  for (let i = 0; i < 65536; i++) if (blocks[i]) { const o = toOriginal(blocks[i], meta[i], {}); if (o) { b[i] = o.id ?? o[0]; m[i] = o.meta ?? o[1] ?? 0; } }
  return { blocks: b, metadata: m };
};

const seed = BigInt(opt.seed);
const pop = streamedSource({ seed, generationVersion: 16, originX: 0, originZ: 0, worldType: 'default' }).population;
let seq = 0;
for (let x = X0; x < X0 + W; x++) for (let z = Z0; z < Z0 + D; z++) {
  const populated = (x - X0) % 3 !== 2 || z - Z0 === D - 1 || x - X0 === W - 1; // unpopulated columns keep their +x/+z neighbours
  await addChunk(0, toChunk(x, z, pop.original(x, z), { populated, hasSky: true, furnished: populated && (x + z) % 4 === 0, seq: seq++ }));
}
const nether = new DimensionWorld(String(seed), -1), end = new DimensionWorld(String(seed), 1);
for (let x = -2; x < 2; x++) for (let z = -2; z < 2; z++) {
  const c = nether.generateTerrainChunk(x, z);
  await addChunk(-1, toChunk(x, z, toOrig(c.blocks, c.metadata), { populated: !(x === -1 && z === -2), hasSky: false, furnished: x === 0 && z === 0, seq: seq++, nether: true }));
}
for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) {
  const c = end.generateTerrainChunk(x, z);
  await addChunk(1, toChunk(x, z, toOrig(c.blocks, c.metadata), { populated: !(x === -1 && z === -1), hasSky: false, furnished: x === 0 && z === 0, seq: seq++ }));
}

await mkdir(out, { recursive: true });
for (const r of regions.values()) {
  const dir = join(out, r.dim === 0 ? 'region' : r.dim === -1 ? 'DIM-1/region' : 'DIM1/region');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `r.${r.rx}.${r.rz}.mca`), writeRegion(r.entries));
}
const uuid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const playerTag = compound({
  Pos: doubles((X0 + 1) * 16 + 4.5, 201, 2.5 + Z0 * 16), Motion: doubles(0, 0, 0), Rotation: list(NBT.FLOAT, [90, 10]), Dimension: t(NBT.INT, 0), HealF: t(NBT.FLOAT, 18), foodLevel: t(NBT.INT, 17),
  playerGameType: t(NBT.INT, 0), XpLevel: t(NBT.INT, 7), XpP: t(NBT.FLOAT, 0.25), XpTotal: t(NBT.INT, 100), Score: t(NBT.INT, 0), SelectedItemSlot: t(NBT.INT, 0),
  Inventory: list(NBT.COMPOUND, [item(0, 276, 1, 5), item(1, 364, 12), item(2, 4, 64)]), EnderItems: list(NBT.COMPOUND, [item(0, 264, 9)]),
  abilities: t(NBT.COMPOUND, compound({ flying: t(NBT.BYTE, 0), mayfly: t(NBT.BYTE, 0), instabuild: t(NBT.BYTE, 0), invulnerable: t(NBT.BYTE, 0), walkSpeed: t(NBT.FLOAT, 0.1), flySpeed: t(NBT.FLOAT, 0.05) }))
});
const tagBytes = (name, c) => encodeCompressedNbt({ name, tag: t(NBT.COMPOUND, c) });
const level = compound({ Data: t(NBT.COMPOUND, compound({
  RandomSeed: t(NBT.LONG, seed), generatorName: t(NBT.STRING, 'default'), generatorVersion: t(NBT.INT, 1), generatorOptions: t(NBT.STRING, ''), GameType: t(NBT.INT, 0), MapFeatures: t(NBT.BYTE, 1),
  SpawnX: t(NBT.INT, X0 * 16 + 8), SpawnY: t(NBT.INT, 80), SpawnZ: t(NBT.INT, Z0 * 16 + 8), Time: t(NBT.LONG, 24000n), DayTime: t(NBT.LONG, 6000n), LastPlayed: t(NBT.LONG, 1700000000000n),
  LevelName: t(NBT.STRING, 'Synthetic 1.7.10'), version: t(NBT.INT, 19133), hardcore: t(NBT.BYTE, 0), initialized: t(NBT.BYTE, 1), allowCommands: t(NBT.BYTE, 1), raining: t(NBT.BYTE, 0), thundering: t(NBT.BYTE, 0),
  rainTime: t(NBT.INT, 100000), thunderTime: t(NBT.INT, 100000), Difficulty: t(NBT.BYTE, 2), DifficultyLocked: t(NBT.BYTE, 0), SizeOnDisk: t(NBT.LONG, 0n) })) });
await writeFile(join(out, 'level.dat'), await tagBytes('', level));
await mkdir(join(out, 'playerdata'), { recursive: true }); await mkdir(join(out, 'stats'), { recursive: true }); await mkdir(join(out, 'data'), { recursive: true });
await writeFile(join(out, 'playerdata', `${uuid}.dat`), await tagBytes('', playerTag));
await writeFile(join(out, 'stats', `${uuid}.json`), JSON.stringify({ 'stat.walkOneCm': 12345, 'stat.jump': 77, 'achievement.openInventory': 1 }));
const counts = { overworld: W * D, nether: 16, end: 9, regions: regions.size };
console.log(JSON.stringify({ out, seed: String(seed), ...counts, entities: 'pigs, cows, zombies, items, chest minecarts, paintings', tiles: 'chests, signs, furnaces, hoppers, spawners, skulls' }));
