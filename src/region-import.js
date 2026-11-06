import { readCommandBlock } from "./command-block.js";
import { makeSpawner, readNBT as readSpawnerNBT, spawnerJSON } from './mob-spawner.js';
import { readNoteTile } from "./note-blocks.js";
import { readJukeboxTile } from "./jukebox.js";
// WORLD-03g: convert an area of Java 1.7.10 region files into a new Blockworld export for the existing
// Import screen. The export is a version-9 Java world record whose `edits` rebuild the area over the
// generated terrain of `seed`; supported chest/furnace contents and dropped items travel in the player
// and runtime fields the importer already reads. Everything else is counted in the loss report.
import { parseStructureDataFiles } from './structure-data.js';
import { World, SIZE, MOB_SPAWNER, SAPLING, WEB, LADDER, YELLOW_FLOWER, RED_FLOWER, DYE, SNOW_LAYER, ICE, CACTUS, TNT, FENCE, RAIL } from './world.js';
import { DimensionWorld } from './dimension-world.js';
import { DIM_KEYS, TILE_KEYS } from './dimension-live.js';
import { isJavaLandscape } from './java-world.js';
import { fromOriginal, isRegistered } from './block-registry.js';
import { readRegion, decodeRegionChunk, regionAddress, regionSlot } from './region-file.js';
import { chunkFromNbt } from './chunk-nbt.js';
import { nbtGet } from './nbt-get.js';
import { readFireworkNbt } from './fireworks-nbt.js';
import { readBookNbt } from './books-nbt.js';
import { NBT } from './nbt.js';
import { ITEMS, burnTime } from './survival.js';
import { CHEST, CHEST_SLOTS } from './chest.js';
import { TRAPPED_CHEST, ENDER_CHEST, isChestBlock } from './chest-blocks.js';
import { DISPENSER } from './dispenser-piston.js';
import { PISTON_MOVING } from './redstone-blocks-2.js';
import { DISPENSER_SLOTS } from './dispenser-container.js';
import { ORIGINAL_ITEMS } from './original-items.js';
import { importedMobType, IMPORT_MOB_LIMIT, javaMobFromNbt } from './java-mobs.js';
import { JAVA_PROJECTILES, IMPORT_PROJECTILE_LIMIT, javaProjectileFromNbt } from './java-projectiles.js';
import { decodeCompressedNbt } from './nbt-compression.js';
import { villagesFromNbt } from './village.js';
import { isMapFile, mapsFromFiles } from './maps-nbt.js';

export const LIVE_CHUNKS = SIZE / 16;
// World.restore and the Import screen's file-size check (main.js).
export const IMPORT_EDIT_LIMIT = 100000, IMPORT_BYTE_LIMIT = 8 * 1024 * 1024;
// ItemEntities.load keeps at most this many saved drops.
export const IMPORT_DROP_LIMIT = 512;
const FURNACE = 14, CHUNK_INFLATE_LIMIT = 16 * 1024 * 1024, AREA_INFLATE_LIMIT = 256 * 1024 * 1024;

export { ORIGINAL_ITEMS };
// Subtype families whose stack damage the browser stores as the same variant index.
const VARIANT_DAMAGE = new Set([35, 38, 351, 3, 5, 6, 12, 17, 18, 24, 44, 98, 97, 145, 155, 159, 161, 162, 175, 95, 160, 171, 397, 322]); // 397: ItemSkull, damage = SkullType 0-4 (skull.js); 322:1 the enchanted golden apple (food-items.js)

/** Browser stack fields for an original item ID/damage, or null when the build has no such item. */
export function itemFromOriginal(id, damage = 0) {
  if (!Number.isInteger(id) || !Number.isInteger(damage)) return null;
  // ItemStack.readFromNBT: negative damage reads as 0.
  if (damage < 0) damage = 0;
  const subtype = ORIGINAL_ITEMS[`${id}:${damage}`];
  if (subtype !== undefined) return { id: subtype, damage: 0, clamped: false };
  // ItemPotion: the damage value is the whole potion (effects, strength, splash); the browser keeps it unchanged (potions.js).
  if (id === 373) return damage < 65536 ? { id: 385, damage, clamped: false } : null;
  const base = ORIGINAL_ITEMS[id];
  if (base === undefined) return null;
  const item = ITEMS[base];
  if (item.durability) return { id: base, damage: Math.min(damage, item.durability), clamped: damage > item.durability };
  // ItemMonsterPlacer: the damage is the EntityList id (spawn-eggs.js); any value is a valid stack, unknown ones just spawn nothing.
  if (id === 383) return damage < 32768 ? { id: base, damage, clamped: false } : null;
  // ItemMap: the damage is the map_N id (maps.js), so every value names a map.
  if (id === 358) return damage < 32768 ? { id: base, damage, clamped: false } : null;
  if (VARIANT_DAMAGE.has(id)) return damage < (item.variants?.length ?? 1) ? { id: base, damage, clamped: false } : null;
  return damage === 0 ? { id: base, damage: 0, clamped: false } : null;
}

// Cached fromOriginal for every (id << 4 | meta) key; air with metadata 0 is always exact.
const MAPPED = new Map();
// ItemStack.stackTagCompound, as far as the browser stack carries it: ench, StoredEnchantments, RepairCost, display.Name,
// display.color and Unbreakable. Returns the keys it could not keep ("display.Lore" for nested ones). Used by the Java
// import and by /give's data tag.
export function readItemTag(stack, nbt) {
  const readEnchantments = (key) => {
    const value = get(nbt, key, NBT.LIST);
    // NBTTagCompound.getTagList accepts any element type when the list is empty.
    if (!value || (value.items.length && value.elementType !== NBT.COMPOUND)) return undefined;
    return value.items.slice(0, 64).map((e) => ({ id: get(e, 'id', NBT.SHORT, 0), lvl: get(e, 'lvl', NBT.SHORT, 0) }));
  };
  const enchantments = readEnchantments('ench'), stored = readEnchantments('StoredEnchantments');
  if (enchantments) stack.enchantments = enchantments;
  if (stored) { stack.stored = stored; stack.storedEnchantments = stored.map((e) => ({ ...e })); }
  const repairCost = get(nbt, 'RepairCost', NBT.INT);
  if (repairCost !== undefined) stack.repairCost = repairCost | 0;
  const display = get(nbt, 'display', NBT.COMPOUND), name = get(display, 'Name', NBT.STRING);
  if (name !== undefined) stack.displayName = name;
  const color = get(display, 'color', NBT.INT);
  if (Number.isInteger(color) && color >= 0 && color <= 0xFFFFFF) stack.color = color;
  const unbreakable = get(nbt, 'Unbreakable', NBT.BYTE);
  if (unbreakable !== undefined) stack.unbreakable = unbreakable !== 0;
  const recognized = new Set(['ench', 'StoredEnchantments', 'RepairCost', 'display', 'Unbreakable', ...readFireworkNbt(stack, nbt), ...readBookNbt(stack, nbt)]);
  const ignored = [...nbt.keys()].filter((key) => !recognized.has(key));
  if (display) ignored.push(...[...display.keys()].filter((key) => key !== 'Name' && key !== 'color').map((key) => 'display.' + key));
  return ignored;
}

// Shared TileEntity container readers for Java import and command data tags.
export function readContainerTile(id, tile, { convertItem = itemStackFromNbt, invalidSlot = () => {} } = {}) {
  const spec = { Chest: ['chests', 27, true], Trap: ['dispensers', 9, true], Dropper: ['dispensers', 9, true], Hopper: ['hoppers', 5, true], Cauldron: ['brewing', 4, true], Furnace: ['furnaces', 3, false] }[id];
  if (!spec) return null;
  const [name, size, unsigned] = spec, items = Array(size).fill(null), ignored = [], kept = new Set(['id', 'x', 'y', 'z', 'Items']);
  for (const entry of compounds(tile, 'Items')) {
    let slot = get(entry, 'Slot', NBT.BYTE, 0);
    if (unsigned) slot &= 255;
    if (slot < 0 || slot >= size) { invalidSlot(slot); continue; }
    const lost = [], stack = convertItem(entry, { ignored: lost });
    ignored.push(...lost.map(k => `Items[${slot}].tag.${k}`));
    if (stack) items[slot] = stack;
  }
  const record = { items };
  if (id === 'Hopper') { record.cooldown = get(tile, 'TransferCooldown', NBT.INT, 0); record.name = get(tile, 'CustomName', NBT.STRING, '') || null; kept.add('TransferCooldown'); kept.add('CustomName'); }
  if (id === 'Cauldron') { record.brewTime = get(tile, 'BrewTime', NBT.SHORT, 0); kept.add('BrewTime'); }
  if (id === 'Furnace') { record.burn = get(tile, 'BurnTime', NBT.SHORT, 0); record.cook = get(tile, 'CookTime', NBT.SHORT, 0); record.burnTotal = burnTime(items[1]); kept.add('BurnTime'); kept.add('CookTime'); }
  return { name, record, ignored: [...tile.keys()].filter(k => !kept.has(k)).concat(ignored) };
}
export function itemStackFromNbt(compound, { ignored = [] } = {}) {
  const mapped = itemFromOriginal(get(compound, 'id', NBT.SHORT), get(compound, 'Damage', NBT.SHORT, 0)), count = get(compound, 'Count', NBT.BYTE, 0);
  if (!mapped || count <= 0) return null;
  const stack = { id: mapped.id, damage: mapped.damage, count };
  const nbt = get(compound, 'tag', NBT.COMPOUND);
  if (nbt) ignored.push(...readItemTag(stack, nbt));
  return stack;
}

/** fromOriginal for a packed original state, memoized. */
export function mapOriginalState(key) {
  let mapped = MAPPED.get(key);
  if (mapped === undefined) {
    mapped = key === 0 ? { id: 0, meta: 0, exact: true } : fromOriginal(key >> 4, key & 15);
    MAPPED.set(key, mapped);
  }
  return mapped;
}
/** Packed original (id << 4 | meta) of an ExtendedBlockStorage cell; a missing section is air. */
export function originalState(section, dx, y, dz) {
  if (!section) return 0;
  const i = ((y & 15) << 8) | (dz << 4) | dx, shift = (i & 1) * 4;
  const high = section.msb ? (section.msb.data[i >> 1] >> shift) & 15 : 0;
  return (((high << 8) | section.lsb[i]) << 4) | ((section.metadata.data[i >> 1] >> shift) & 15);
}

/** Region coordinates of a canonical r.<x>.<z>.mca filename. */
export function parseRegionFilename(filename) {
  const match = /^r\.(-?\d+)\.(-?\d+)\.mca$/.exec(filename);
  if (!match || match[0] !== filename) throw new Error(`Expected r.<regionX>.<regionZ>.mca, found ${JSON.stringify(filename)}`);
  const [regionX, regionZ] = match.slice(1).map(Number);
  for (const value of [regionX, regionZ])
    if (!Number.isInteger(value) || value < -67108864 || value > 67108863) throw new Error('Region address exceeds signed chunk coordinates');
  return { regionX, regionZ };
}

// NBT accessors that read like NBTTagCompound getters (nbt-get.js): numeric tags convert across types, anything else
// must match; a missing or unreadable tag is the default.
const get = nbtGet;
const compounds = (map, key) => {
  const list = get(map, key, NBT.LIST);
  return list?.elementType === NBT.COMPOUND ? list.items : [];
};
const doubles = (map, key) => {
  const list = get(map, key, NBT.LIST);
  return list?.elementType === NBT.DOUBLE && list.items.length === 3 ? list.items : null;
};
const tally = (map, key, n = 1) => map.set(key, (map.get(key) ?? 0) + n);
const sortedCounts = (map, name = 'id') => [...map].sort(([a], [b]) => String(a).localeCompare(String(b), 'en', { numeric: true })).map(([key, count]) => ({ [name]: key, count }));

function validateArea(area) {
  if (!area || typeof area !== 'object') throw new TypeError('Area must be {chunkX, chunkZ, width, depth}');
  const { chunkX, chunkZ, width = LIVE_CHUNKS, depth = LIVE_CHUNKS } = area;
  for (const v of [chunkX, chunkZ]) if (!Number.isSafeInteger(v) || v < -1875000 || v >= 1875000) throw new RangeError('Area chunk coordinates exceed the 1.7.10 world border');
  for (const v of [width, depth]) if (!Number.isInteger(v) || v < 1 || v > LIVE_CHUNKS) throw new RangeError(`Area width and depth must be 1-${LIVE_CHUNKS} chunks (the browser world is ${SIZE}x${SIZE} blocks)`);
  if (chunkX + width > 1875000 || chunkZ + depth > 1875000) throw new RangeError('Area chunk coordinates exceed the 1.7.10 world border');
  return { chunkX, chunkZ, width, depth };
}

/**
 * Convert an area of chunks from one or more region files.
 * regions: iterable of {filename, bytes}. options:
 *   area         {chunkX, chunkZ, width, depth} in source chunk coordinates (width/depth 1-8); defaults to
 *                the 8x8 chunks the browser generates for `seed`
 *   seed         base world seed (the source world's seed makes the surrounding and unedited terrain match)
 *   landscape    java | javaAmplified | javaLargeBiomes
 *   destination  {chunkX, chunkZ} live chunk of the area's north-west corner; defaults to the generator's own
 *                position when the area lies inside the base world's 8x8 chunks, else centred
 *   missing      'generated' keeps base terrain for absent chunks, 'air' clears them to void
 *   mode, name, hasSky, dimension (0, -1 or 1; nonzero regions keep native coordinates)
 */
export async function importJavaRegionArea(regions, options = {}) {
  const { seed = '1710', landscape = 'java', missing = 'generated', mode = 'creative', dimension = 0, hasSky = dimension !== -1 } = options;
  if (![0, -1, 1].includes(dimension)) throw new Error('Unsupported dimension');
  if (dimension && options.destination) throw new Error('Dimension regions keep their native coordinates');
  if (!isJavaLandscape(landscape)) throw new Error(`Unknown Java landscape ${landscape}`);
  if (missing !== 'generated' && missing !== 'air') throw new Error("missing must be 'generated' or 'air'");
  if (mode !== 'creative' && mode !== 'survival') throw new Error("mode must be 'creative' or 'survival'");
  const seedText = String(seed);
  if (!seedText || seedText.length > 80) throw new Error('Seed must be 1-80 characters (the Import screen keeps 80)');

  // Index the supplied files by region coordinate; parse headers only for regions the area needs.
  const files = new Map();
  for (const { filename, bytes } of regions) {
    const { regionX, regionZ } = parseRegionFilename(filename), key = `${regionX},${regionZ}`;
    if (files.has(key)) throw new Error(`Duplicate region ${filename}`);
    files.set(key, { filename, bytes, entries: null, used: false });
  }

  if (options.area) validateArea(options.area);
  const world = dimension ? new DimensionWorld(seedText, dimension) : new World(seedText, landscape, 9);
  const height = world.height, origin = { chunkX: world.originX >> 4, chunkZ: world.originZ >> 4 };
  const area = validateArea(options.area ?? { ...origin, width: LIVE_CHUNKS, depth: LIVE_CHUNKS });
  const offset = { chunkX: area.chunkX - origin.chunkX, chunkZ: area.chunkZ - origin.chunkZ };
  const aligned = !!dimension || (offset.chunkX >= 0 && offset.chunkZ >= 0 && offset.chunkX + area.width <= LIVE_CHUNKS && offset.chunkZ + area.depth <= LIVE_CHUNKS);
  const destination = dimension ? { chunkX: area.chunkX, chunkZ: area.chunkZ } : options.destination ?? (aligned ? offset
    : { chunkX: (LIVE_CHUNKS - area.width) >> 1, chunkZ: (LIVE_CHUNKS - area.depth) >> 1 });
  if (!dimension) {
    for (const [v, size] of [[destination.chunkX, area.width], [destination.chunkZ, area.depth]])
      if (!Number.isInteger(v) || v < 0 || v + size > LIVE_CHUNKS) throw new RangeError('Destination must keep the area inside the browser world');
  } else world.streamAround((area.chunkX + 4) * 16, (area.chunkZ + 4) * 16);
  const shiftX = (destination.chunkX - area.chunkX) * 16, shiftZ = (destination.chunkZ - area.chunkZ) * 16;

  const report = {
    source: { area, regions: [], unusedRegions: [] },
    destination: { ...destination, blockX: destination.chunkX * 16, blockZ: destination.chunkZ * 16 },
    base: { seed: seedText, landscape, generationVersion: 9, generatorOrigin: origin, aligned },
    chunks: { converted: 0, missing: [], fill: missing },
    inflatedBytes: 0,
    edits: 0, editLimit: IMPORT_EDIT_LIMIT, bytes: 0, byteLimit: IMPORT_BYTE_LIMIT,
    blocks: { sourceCells: 0, exact: 0, approximated: 0, omitted: 0, unsupported: [], approximations: [] },
    biomes: { carried: false, compared: 0, matching: 0, differing: 0, unset: 0 },
    lighting: 'recomputed by the browser; source SkyLight and BlockLight are not carried',
    tileEntities: { total: 0, converted: {}, lost: [] },
    items: { converted: 0, lost: [], tagsStripped: 0, clamped: 0 },
    entities: { total: 0, converted: {}, lost: [] },
    scheduledTicks: 0,
  };
  const unsupported = new Map(), approximations = new Map(), tileLost = new Map(), tileConverted = new Map();
  const itemLost = new Map(), entityLost = new Map(), entityConverted = new Map();
  const commandBlocks = [], musicTiles = [];
  const signs = [], skulls = [], beacons = [], spawners = [], importedColumns = {};
  const chests = {}, furnaces = {}, dispensers = {}, hoppers = {}, brewing = {}, pistons = [], drops = [], mobs = []; let chainCount = 0;
  const projectileLists = { projectiles: [], thrownPotions: [], arrows: [], fireballs: [], eyes: [], rockets: [] };
  let edits = 0;
  const write = (x, y, z, block, meta) => {
    if (world.get(x, y, z) === block && world.getMeta(x, y, z) === meta) return;
    // Past the limit keep counting, but stop growing the edit map.
    if (++edits <= IMPORT_EDIT_LIMIT) world.set(x, y, z, block, true, meta);
  };

  const convertItem = (compound) => {
    const id = get(compound, 'id', NBT.SHORT), count = get(compound, 'Count', NBT.BYTE, 0), damage = get(compound, 'Damage', NBT.SHORT, 0);
    const mapped = id === undefined ? null : itemFromOriginal(id, damage);
    if (!mapped || count <= 0) {
      tally(itemLost, id === undefined ? `${get(compound, 'id', NBT.STRING) ?? '?'}` : `${id}:${Math.max(0, damage)}`);
      return null;
    }
    const limit = ITEMS[mapped.id].stack ?? 64;
    const stack = { id: mapped.id, count: Math.min(count, limit), damage: mapped.damage };
    const nbt = get(compound, 'tag', NBT.COMPOUND);
    if (nbt && readItemTag(stack, nbt).length) report.items.tagsStripped++;
    if (mapped.clamped || count > limit) report.items.clamped++;
    report.items.converted++;
    return stack;
  };


  let inflated = 0;
  for (let i = 0; i < area.width; i++) for (let j = 0; j < area.depth; j++) {
    const cx = area.chunkX + i, cz = area.chunkZ + j, address = regionAddress(cx, cz);
    const baseX = (destination.chunkX + i) * 16, baseZ = (destination.chunkZ + j) * 16;
    const file = files.get(`${address.regionX},${address.regionZ}`);
    let entry = null;
    if (file) {
      file.used = true;
      file.entries ??= readRegion(file.bytes);
      entry = file.entries.get(regionSlot(address.x, address.z)) ?? null;
    }
    if (!entry) {
      report.chunks.missing.push({ x: cx, z: cz, reason: file ? 'empty region slot' : `r.${address.regionX}.${address.regionZ}.mca not supplied` });
      if (missing === 'air') for (let dx = 0; dx < 16; dx++) for (let dz = 0; dz < 16; dz++) for (let y = 0; y < height; y++) write(baseX + dx, y, baseZ + dz, 0, 0);
      continue;
    }
    let decoded;
    try {
      const remaining = AREA_INFLATE_LIMIT - inflated;
      if (remaining <= 0) throw new Error('Area expansion budget exhausted');
      const doc = await decodeRegionChunk(entry, { maxBytes: Math.min(CHUNK_INFLATE_LIMIT, remaining) });
      inflated += doc.bytesRead;
      decoded = chunkFromNbt(doc, { hasSky });
      if (decoded.chunk.x !== cx || decoded.chunk.z !== cz) throw new Error(`expected chunk (${cx}, ${cz}), found (${decoded.chunk.x}, ${decoded.chunk.z})`);
    } catch (cause) {
      throw new Error(`${file.filename} slot ${regionSlot(address.x, address.z)}: ${cause.message}`, { cause });
    }
    const { chunk, entities, tileEntities, tileTicks } = decoded;
    report.chunks.converted++;
    if (dimension) {
      const k = `${cx >> 3},${cz >> 3}`, bit = 1n << BigInt((cx & 7) * 8 + (cz & 7));
      importedColumns[k] = ((importedColumns[k] ?? 0n) | bit);
    }

    // Blocks: full height, through the block registry. Chest facing is carried in its chest record.
    const facings = new Map();
    for (let y = 0; y < height; y++) {
      const section = chunk.sections[y >> 4];
      for (let dz = 0; dz < 16; dz++) for (let dx = 0; dx < 16; dx++) {
        const key = originalState(section, dx, y, dz), mapped = mapOriginalState(key);
        if (key) report.blocks.sourceCells++;
        if (!mapped) {
          report.blocks.omitted++;
          tally(unsupported, key);
          write(baseX + dx, y, baseZ + dz, 0, 0);
          continue;
        }
        if (isChestBlock(mapped.id)) facings.set(`${dx},${y},${dz}`, mapped.state.facing >= 2 && mapped.state.facing <= 5 ? mapped.state.facing : 3);
        const carried = isChestBlock(mapped.id) && mapped.exact;
        if (key && (!mapped.exact || (mapped.state && !carried))) { report.blocks.approximated++; tally(approximations, key); }
        else if (key) report.blocks.exact++;
        write(baseX + dx, y, baseZ + dz, mapped.id, mapped.meta);
      }
    }
    for (const [cell, facing] of facings) {
      const [dx, y, dz] = cell.split(',').map(Number);
      chests[`${baseX + dx},${y},${baseZ + dz}`] = { facing, items: Array(CHEST_SLOTS).fill(null) };
    }

    // Biome bytes: the export has no biome field; the base world's generator supplies them. Compare.
    for (let dx = 0; dx < 16; dx++) for (let dz = 0; dz < 16; dz++) {
      const source = chunk.biomes[dx + dz * 16] & 255;
      if (source === 255) { report.biomes.unset++; continue; }
      report.biomes.compared++;
      if ((dimension ? world.biomeAt().id : world.biomeIds[(baseX + dx) * SIZE + baseZ + dz]) === source) report.biomes.matching++;
      else report.biomes.differing++;
    }

    // Tile entities: chests and furnaces whose cell converted to the matching browser block.
    for (const tile of tileEntities) {
      report.tileEntities.total++;
      const id = get(tile, 'id', NBT.STRING, '?'), x = get(tile, 'x', NBT.INT), y = get(tile, 'y', NBT.INT), z = get(tile, 'z', NBT.INT);
      const inside = [x, y, z].every(Number.isInteger) && x >> 4 === cx && z >> 4 === cz && y >= 0 && y < height;
      const lx = inside ? baseX + (x & 15) : 0, lz = inside ? baseZ + (z & 15) : 0, key = `${lx},${y},${lz}`;
      const block = world.get(lx, y, lz), expected = { Chest: block === TRAPPED_CHEST ? TRAPPED_CHEST : CHEST, Trap: DISPENSER, Dropper: 132, Hopper: 133, Cauldron: 134, Furnace: FURNACE }[id];
      if (inside && block === expected) {
        const loaded = readContainerTile(id, tile, { convertItem, invalidSlot: slot => tally(itemLost, `slot ${slot}`) });
        const stores = { chests, furnaces, dispensers, hoppers, brewing };
        stores[loaded.name][key] = { ...stores[loaded.name][key], ...loaded.record };
        tally(tileConverted, id);
      } else if (inside && id === 'MobSpawner' && block === MOB_SPAWNER) {
        const values = ['Delay', 'MinSpawnDelay', 'MaxSpawnDelay', 'SpawnCount', 'MaxNearbyEntities', 'RequiredPlayerRange', 'SpawnRange'];
        const params = values.flatMap(k => {
          const value = get(tile, k, NBT.SHORT);
          return value === undefined ? [] : [[k, value]];
        });
        const spawner = { x: lx, y, z: lz, EntityId: get(tile, 'EntityId', NBT.STRING, 'Pig'), ...Object.fromEntries(params) };
        // SpawnData and SpawnPotentials (MobSpawnerBaseLogic.readFromNBT) are kept as the save's JSON entries (spawner-data.js).
        const data = get(tile, 'SpawnData', NBT.COMPOUND), potentials = get(tile, 'SpawnPotentials', NBT.LIST);
        if (data || potentials?.elementType === NBT.COMPOUND) {
          const kept = makeSpawner(0, 0, 0);
          readSpawnerNBT(kept, { EntityId: spawner.EntityId, SpawnData: data, SpawnPotentials: potentials?.elementType === NBT.COMPOUND ? potentials.items : undefined });
          const json = spawnerJSON(kept);
          if (json.SpawnData) spawner.SpawnData = json.SpawnData;
          if (json.SpawnPotentials) spawner.SpawnPotentials = json.SpawnPotentials;
        }
        spawners.push(spawner);
        tally(tileConverted, id);
      } else if (inside && id === 'Airportal' && block === 149) {
        tally(tileConverted, id); // TileEntityEndPortal has no saved fields
      } else if (inside && id === 'EnderChest' && block === ENDER_CHEST) {
        tally(tileConverted, id); // no saved data: the lid state is runtime, the inventory is the player's EnderItems
      } else if (inside && id === 'Control' && block === 139) {
        commandBlocks.push({ x: lx, y, z: lz, ...readCommandBlock(tile) }); tally(tileConverted, id);
      } else if (inside && id === 'Music' && block === 177) {
        musicTiles.push({ kind: 'note', x: lx, y, z: lz, note: readNoteTile(tile).note }); tally(tileConverted, id);
      } else if (inside && id === 'RecordPlayer' && block === 178) {
        const { record } = readJukeboxTile(tile);
        if (record) musicTiles.push({ kind: 'jukebox', x: lx, y, z: lz, record }); tally(tileConverted, id);
      } else if (inside && id === 'Skull' && block === 172) {
        // TileEntitySkull.readFromNBT: SkullType (byte), Rot (byte), ExtraType (owner name, only for type 3).
        skulls.push({ x: lx, y, z: lz, type: Math.max(0, Math.min(4, Number(get(tile, 'SkullType', NBT.BYTE, 0)) | 0)), rot: Number(get(tile, 'Rot', NBT.BYTE, 0)) & 15, owner: String(get(tile, 'ExtraType', NBT.STRING, '')) }); tally(tileConverted, id);
      } else if (inside && id === 'Sign' && (block === 175 || block === 176)) {
        // TileEntitySign.readFromNBT: Text1-Text4, each cut to 15 characters; the loaded tile is not editable (signs.js).
        signs.push({ x: lx, y, z: lz, text: [1, 2, 3, 4].map(i => String(get(tile, `Text${i}`, NBT.STRING, '')).slice(0, 15)) }); tally(tileConverted, id);
      } else if (inside && id === 'Beacon' && block === 173) {
        beacons.push({ x: lx, y, z: lz, primary: get(tile, 'Primary', NBT.INT, 0), secondary: get(tile, 'Secondary', NBT.INT, 0), levels: get(tile, 'Levels', NBT.INT, 0) }); tally(tileConverted, id); // pyramid.js
      } else if (inside && id === 'Piston' && world.get(lx, y, lz) === PISTON_MOVING) {
        // TileEntityPiston.readFromNBT: blockId, blockData, facing, progress (lastProgress = progress), extending. The
        // restore (piston-live.js) lets the move finish on the first tick, as native does.
        pistons.push({ x: lx, y, z: lz, block: get(tile, 'blockId', NBT.INT, 0), meta: get(tile, 'blockData', NBT.INT, 0), facing: get(tile, 'facing', NBT.INT, 0),
          progress: get(tile, 'progress', NBT.FLOAT, 0), extending: !!get(tile, 'extending', NBT.BYTE, 0) });
        tally(tileConverted, id);
      } else tally(tileLost, inside ? id : `${id} (outside its chunk)`);
    }

    // Entities: dropped items (EntityItem, Pos/Motion/Age/PickupDelay/Item) and the mobs java-mobs.js reads (a rider and its mount become a linked pair).
    for (const entity of entities) {
      report.entities.total++;
      const id = get(entity, 'id', NBT.STRING, '?'), pos = doubles(entity, 'Pos'), motion = doubles(entity, 'Motion');
      // An entity with a "Riding" compound is the rider, and the compound is its mount (Entity.writeToNBT; AnvilChunkLoader.loadEntities creates each
      // mount of the chain, adds it and calls rider.mountEntity(mount)). Mobs of the chain become linked records (`riding` is the mount's id, which
      // linkRiders turns back into the pair); a mount that is not an importable mob is counted as lost and its rider stays unmounted.
      const chain = [entity];
      for (let rider = get(entity, 'Riding', NBT.COMPOUND); rider && chain.length < 16; rider = get(rider, 'Riding', NBT.COMPOUND)) { chain.push(rider); report.entities.total++; }
      const inAreaAt = (p) => { const mx = p[0] + shiftX, mz = p[2] + shiftZ; return mx >= destination.chunkX * 16 && mx < (destination.chunkX + area.width) * 16 && mz >= destination.chunkZ * 16 && mz < (destination.chunkZ + area.depth) * 16; };
      const importMob = (member, mid) => {
        const mpos = doubles(member, 'Pos'), mtype = get(member, 'id', NBT.STRING, '?');
        if (!importedMobType(mtype) || !mpos?.every(Number.isFinite)) { if (mid) tally(entityLost, mtype); return null; }
        const inArea = inAreaAt(mpos), mob = inArea && mobs.length < IMPORT_MOB_LIMIT ? javaMobFromNbt(member, { shiftX, shiftZ, convertItem }) : null;
        if (mob) { if (mid) mob.id = mid; mobs.push(mob); tally(entityConverted, mtype); } else tally(entityLost, !inArea ? `${mtype} (outside area)` : `${mtype} (over mob limit)`);
        return mob;
      };
      if (chain.length > 1 && importedMobType(id) && pos?.every(Number.isFinite)) {
        const stamp = ++chainCount * 100;
        const made = chain.map((member, k) => importMob(member, `mob-${1000000 + stamp + k}`));
        made.forEach((mob, k) => { if (mob && made[k + 1]) mob.riding = made[k + 1].id; });
        continue;
      }
      for (const lost of chain.slice(1)) tally(entityLost, get(lost, 'id', NBT.STRING, '?'));
      // JAVA_MOBS and JAVA_SUMMON_MOBS become live mobs (java-mobs.js).
      if (importMob(entity)) continue;
      if (importedMobType(id) && pos?.every(Number.isFinite)) continue;
      // Snowball, ThrownEnderpearl, ThrownPotion, ThrownExpBottle, Arrow, Fireball, SmallFireball, WitherSkull, EyeOfEnderSignal and FireworksRocketEntity
      // become the browser's saved in-flight projectiles (java-projectiles.js).
      if (JAVA_PROJECTILES[id] && pos?.every(Number.isFinite)) {
        const px = pos[0] + shiftX, pz = pos[2] + shiftZ, list = projectileLists[JAVA_PROJECTILES[id]];
        const inArea = px >= destination.chunkX * 16 && px < (destination.chunkX + area.width) * 16 && pz >= destination.chunkZ * 16 && pz < (destination.chunkZ + area.depth) * 16;
        const made = inArea && list.length < IMPORT_PROJECTILE_LIMIT[JAVA_PROJECTILES[id]] ? javaProjectileFromNbt(entity, { shiftX, shiftZ, convertItem, dimension }) : null;
        if (made?.record) { list.push(made.record); tally(entityConverted, id); }
        else tally(entityLost, !inArea ? `${id} (outside area)` : made?.lost ? `${id} (${made.lost})` : `${id} (over projectile limit)`);
        continue;
      }
      // EntityLeashKnot (id LeashKnot) refuses to save in 1.7.10 (su.d returns false; mob-gear-nbt-reference.json), so a native chunk never holds
      // one: a knot is rebuilt from its mobs' Leash X/Y/Z (leashRestore). A foreign save's knot entity is counted, not lost.
      if (id === 'LeashKnot') { report.entities.leashKnots = (report.entities.leashKnots ?? 0) + 1; continue; }
      if (id !== 'Item' || !pos || !pos.every(Number.isFinite)) { tally(entityLost, id); continue; }
      const x = pos[0] + shiftX, z = pos[2] + shiftZ;
      const insideArea = x >= destination.chunkX * 16 && x < (destination.chunkX + area.width) * 16 && z >= destination.chunkZ * 16 && z < (destination.chunkZ + area.depth) * 16;
      const item = get(entity, 'Item', NBT.COMPOUND);
      if (!insideArea || drops.length >= IMPORT_DROP_LIMIT || !item) { tally(entityLost, !insideArea ? 'Item (outside area)' : !item ? 'Item (no stack)' : 'Item (over drop limit)'); continue; }
      const stack = convertItem(item);
      if (!stack) { tally(entityLost, 'Item (unsupported stack)'); continue; }
      const m = motion && motion.every(Number.isFinite) ? motion : [0, 0, 0];
      // Saved y is the bounding-box bottom; Pos[1] is posY (yOffset 0.125 above it).
      drops.push({ stack, x, y: pos[1] - 0.125, z, mx: m[0], my: m[1], mz: m[2],
        age: Math.max(0, Math.min(5999, get(entity, 'Age', NBT.SHORT, 0))), delay: Math.max(0, Math.min(40, get(entity, 'PickupDelay', NBT.SHORT, 0))) });
      tally(entityConverted, id);
    }
    report.scheduledTicks += tileTicks?.length ?? 0;
  }

  for (const file of files.values()) (file.used ? report.source.regions : report.source.unusedRegions).push(file.filename);
  report.inflatedBytes = inflated;
  report.edits = edits;
  report.blocks.unsupported = [...unsupported].sort(([a], [b]) => a - b).map(([key, cells]) => ({
    id: key >> 4, meta: key & 15, cells, reason: isRegistered(key >> 4) ? 'unmapped' : 'unregistered' }));
  report.blocks.approximations = [...approximations].sort(([a], [b]) => a - b).map(([key, cells]) => {
    const m = mapOriginalState(key);
    return { id: key >> 4, meta: key & 15, cells, to: [m.id, m.meta], exact: m.exact, ...(m.state ? { state: Object.keys(m.state) } : {}) };
  });
  report.tileEntities.converted = Object.fromEntries(tileConverted);
  report.tileEntities.lost = sortedCounts(tileLost);
  report.items.lost = sortedCounts(itemLost);
  report.entities.converted = Object.fromEntries(entityConverted);
  report.entities.lost = sortedCounts(entityLost);
  if (edits > IMPORT_EDIT_LIMIT) {
    const error = new RangeError(`The area needs ${edits} block edits; the Import screen accepts at most ${IMPORT_EDIT_LIMIT}. ` +
      (aligned ? 'Choose a smaller area.' : "Pass the source world's seed (and its area around the generator origin) or choose a smaller area."));
    error.report = report;
    throw error;
  }

  // data/*.dat (options.structureData: iterable of {filename, bytes}): kept unchanged in native coordinates, which
  // only match the browser world's native frame when the area is aligned; unknown start ids are counted, never fatal.
  const isVillagesFile = ({ filename }) => /(^|\/)villages\.dat$/.test(filename);
  const parsedStructures = options.structureData ? await parseStructureDataFiles([...options.structureData].filter((f) => !isVillagesFile(f) && !isMapFile(f))) : null;
  // data/map_N.dat + idcounts.dat (maps-nbt.js): shifted like the villages.
  const mapsImport = options.structureData ? await mapsFromFiles([...options.structureData].filter(isMapFile)) : { maps: null };
  if (mapsImport.maps) for (const m of mapsImport.maps.maps) { m.xCenter += shiftX; m.zCenter += shiftZ; }
  if (parsedStructures) report.structures = { ...parsedStructures.report, kept: aligned && Object.keys(parsedStructures.structureData).length > 0 };
  // data/villages.dat (VillageCollection "villages"): the villages whose centre is inside the area, shifted like entities.
  // Door rows keep their inside direction; reputations, golem counts and the tick counters come across unchanged.
  let villages = null;
  const villageFile = options.structureData ? [...options.structureData].find(isVillagesFile) : null;
  report.villages = { found: !!villageFile, kept: 0, outside: 0 };
  if (villageFile) {
    try {
      const root = (await decodeCompressedNbt(villageFile.bytes)).tag, data = root.value.get('data') ?? root;
      const json = villagesFromNbt(data), inside = (v) => {
        const x = v.c[0] + shiftX, z = v.c[2] + shiftZ;
        return x >= destination.chunkX * 16 && x < (destination.chunkX + area.width) * 16 && z >= destination.chunkZ * 16 && z < (destination.chunkZ + area.depth) * 16;
      };
      const kept = json.villages.filter(inside);
      report.villages.kept = kept.length; report.villages.outside = json.villages.length - kept.length;
      if (kept.length) villages = { tick: json.tick, villages: kept.map((v) => ({ ...v, c: [v.c[0] + shiftX, v.c[1], v.c[2] + shiftZ], ac: [v.ac[0] + shiftX, v.ac[1], v.ac[2] + shiftZ], doors: v.doors.map((d) => [d[0] + shiftX, d[1], d[2] + shiftZ, ...d.slice(3)]) })) };
    } catch (error) { report.villages.error = String(error?.message ?? error); }
  }
  // Start above the centre of the area, on its highest solid block.
  const px = destination.chunkX * 16 + area.width * 8, pz = destination.chunkZ * 16 + area.depth * 8;
  let py = height - 1;
  if (dimension === -1) {
    // Prefer a sheltered floor in the imported area to the Nether's bedrock roof.
    py = 123;
    while (py > 1 && (!world.solid(px, py, pz) || world.get(px, py + 1, pz) || world.get(px, py + 2, pz))) py--;
  } else while (py > 0 && !world.solid(px, py, pz)) py--;
  let record = {
    format: 'blockworld', version: 1, generationVersion: 9, seed: seedText, biome: landscape, mode,
    name: String(options.name ?? `Java ${area.chunkX},${area.chunkZ} ${area.width}x${area.depth}`).slice(0, 40),
    edits: [...world.edits],
    position: { x: px + 0.5, y: py + 1.01, z: pz + 0.5, yaw: 0, pitch: 0 },
    // legacyPlayer() keeps these fields; without `slots` the Creative hotbar defaults apply.
    player: { chests, furnaces, dispensers, hoppers, brewing },
    pistons, commandBlocks, ...(musicTiles.length ? { musicTiles } : {}), ...(signs.length ? { signs } : {}), ...(skulls.length ? { skulls } : {}), ...(beacons.length ? { beacons } : {}),
    drops,
    ...(spawners.length ? { spawners } : {}),
    ...(mobs.length ? { entities: mobs } : {}),
    ...Object.fromEntries(Object.entries(projectileLists).filter(([, list]) => list.length).map(([name, list]) => [name, name === 'eyes' ? { eyes: list } : name === 'rockets' ? { rockets: list } : list])),
    ...(villages ? { villages } : {}),
    ...(mapsImport.maps ? { maps: mapsImport.maps } : {}),
    ...(report.structures?.kept ? { structureData: parsedStructures.structureData } : {}),
  };
  if (dimension) {
    const state = Object.fromEntries(DIM_KEYS.filter(k => Object.hasOwn(record, k)).map(k => [k, record[k]]));
    const tiles = Object.fromEntries(TILE_KEYS.filter(k => Object.hasOwn(record.player, k)).map(k => [k, record.player[k]]));
    state.populatedColumns = { version: 1, cells: Object.fromEntries(Object.entries(importedColumns).map(([k, v]) => [k, v.toString(16)])) };
    if (dimension === 1) state.dragonSpawned = true;
    record = {
      format: record.format, version: record.version, seed: seedText, name: record.name, mode,
      biome: 'javaStreamed', generationVersion: 15, dimension, position: record.position, edits: [],
      ...(record.fireballs ? { fireballs: record.fireballs } : {}), // tagged with `dimension`; main.js restores the ones of the world it opens
      dimensions: { [dimension]: { state, tiles, edits: record.edits } },
    };
    report.source.dimension = dimension;
  }
  report.bytes = new TextEncoder().encode(JSON.stringify(record)).length;
  if (report.bytes > IMPORT_BYTE_LIMIT) {
    const error = new RangeError(`The export is ${report.bytes} bytes; the Import screen accepts at most ${IMPORT_BYTE_LIMIT}.`);
    error.report = report;
    throw error;
  }
  return { record, report };
}
