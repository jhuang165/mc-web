// WORLD-03g: convert an area of Java 1.7.10 region files into a new Blockworld export for the existing
// Import screen. The export is a version-9 Java world record whose `edits` rebuild the area over the
// generated terrain of `seed`; supported chest/furnace contents and dropped items travel in the player
// and runtime fields the importer already reads. Everything else is counted in the loss report.
import { parseStructureDataFiles } from './structure-data.js';
import { World, SIZE, SAPLING, WEB, LADDER, YELLOW_FLOWER, RED_FLOWER, DYE, SNOW_LAYER, ICE, CACTUS, TNT, FENCE, RAIL } from './world.js';
import { isJavaLandscape } from './java-world.js';
import { fromOriginal, isRegistered } from './block-registry.js';
import { readRegion, decodeRegionChunk, regionAddress, regionSlot } from './region-file.js';
import { chunkFromNbt } from './chunk-nbt.js';
import { NBT } from './nbt.js';
import { ITEMS, burnTime } from './survival.js';
import { CHEST, CHEST_SLOTS } from './chest.js';
import { DISPENSER } from './dispenser-piston.js';
import { DISPENSER_SLOTS } from './dispenser-container.js';
import { POPULATION_ITEMS } from './population-content.js';

export const LIVE_CHUNKS = SIZE / 16;
// World.restore and the Import screen's file-size check (main.js).
export const IMPORT_EDIT_LIMIT = 100000, IMPORT_BYTE_LIMIT = 8 * 1024 * 1024;
// ItemEntities.load keeps at most this many saved drops.
export const IMPORT_DROP_LIMIT = 512;
const FURNACE = 14, CHUNK_INFLATE_LIMIT = 16 * 1024 * 1024, AREA_INFLATE_LIMIT = 256 * 1024 * 1024;

// Original item ID (or "id:damage" subtype) -> browser item. The same table as tools/inventory-replay.mjs
// MC_IDS (the item catalogue's mapping); region-import.test.js keeps the two identical.
export const ORIGINAL_ITEMS = Object.freeze({
  1: 3, 2: 1, 3: 2, 4: 12, 54: 41, 5: 7, 6: SAPLING, 7: 11, 12: 6, 13: 25, 14: 18, 15: 16, 16: 15, 17: 4, 18: 5, 20: 9, 30: WEB, 65: LADDER,
  '31:1': 39, 35: 19, 49: 22, 41: 27, 42: 26, 45: 8, 47: 21, 50: 20, 56: 17, 57: 28, 58: 13, 61: 14, 78: SNOW_LAYER, 79: ICE, 80: 23, 82: 24, 172: 40,
  256: 110, 257: 102, 258: 106, 259: 126, 260: 200, 263: 301, 264: 303, 265: 302, 266: 304, 267: 114, 268: 112, 269: 108, 270: 100, 271: 104,
  272: 113, 273: 109, 274: 101, 275: 105, 276: 115, 277: 111, 278: 103, 279: 107,
  280: 300, 283: 119, 284: 118, 285: 116, 286: 117, 290: 120, 291: 121, 292: 122, 293: 123, 294: 124, 295: 309, 296: 305, 297: 201, 318: 313,
  319: 202, 320: 203, 332: 312, 344: 316, 288: 317, 365: 318, 366: 319, 336: 306, 337: 307, 340: 314, 352: 311, 359: 125, 261: 127, 262: 320,
  287: 321, 363: 204, 364: 205, 367: 206, 334: 315, '263:1': 308, 351: DYE, 37: YELLOW_FLOWER, 38: RED_FLOWER,
  375: 326, 391: 322, 392: 323, 393: 324, 394: 325, 325: 340, 326: 341, 327: 342, 335: 343,
  46: TNT, 289: 330,
  81: CACTUS, 338: 327, 339: 328, 353: 329,
  298: 400, 299: 401, 300: 402, 301: 403, 302: 404, 303: 405, 304: 406, 305: 407, 306: 408, 307: 409, 308: 410, 309: 411, 310: 416, 311: 417,
  312: 418, 313: 419, 314: 412, 315: 413, 316: 414, 317: 415,
  // Mineshaft blocks and loot: fence, rail, redstone, pumpkin/melon seeds, saddle, iron horse armor
  // and the enchanted book (whose StoredEnchantments are retained).
  85: FENCE, 66: RAIL, 331: 360, 361: 361, 362: 362, 329: 363, 417: 364, 403: 365,
  // Empty and chest cart items (internal 342 is the lava bucket).
  328: 366, 342: 450,
  ...POPULATION_ITEMS,
});
// Subtype families whose stack damage the browser stores as the same variant index.
const VARIANT_DAMAGE = new Set([35, 38, 351, 3, 5, 6, 12, 17, 18, 24, 44, 98, 97, 145, 159, 161, 162, 175]);

/** Browser stack fields for an original item ID/damage, or null when the build has no such item. */
export function itemFromOriginal(id, damage = 0) {
  if (!Number.isInteger(id) || !Number.isInteger(damage)) return null;
  // ItemStack.readFromNBT: negative damage reads as 0.
  if (damage < 0) damage = 0;
  const subtype = ORIGINAL_ITEMS[`${id}:${damage}`];
  if (subtype !== undefined) return { id: subtype, damage: 0, clamped: false };
  const base = ORIGINAL_ITEMS[id];
  if (base === undefined) return null;
  const item = ITEMS[base];
  if (item.durability) return { id: base, damage: Math.min(damage, item.durability), clamped: damage > item.durability };
  if (VARIANT_DAMAGE.has(id)) return damage < (item.variants?.length ?? 1) ? { id: base, damage, clamped: false } : null;
  return damage === 0 ? { id: base, damage: 0, clamped: false } : null;
}

// Cached fromOriginal for every (id << 4 | meta) key; air with metadata 0 is always exact.
const MAPPED = new Map();
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

// NBT accessors that read like NBTTagCompound getters: a missing or mistyped tag is the default.
const get = (map, key, type, fallback) => {
  const tag = map instanceof Map ? map.get(key) : undefined;
  return tag?.type === type ? tag.value : fallback;
};
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
 *   mode, name, hasSky
 */
export async function importJavaRegionArea(regions, options = {}) {
  const { seed = '1710', landscape = 'java', missing = 'generated', mode = 'creative', hasSky = true } = options;
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
  const world = new World(seedText, landscape, 9), height = world.height;
  const origin = { chunkX: world.originX >> 4, chunkZ: world.originZ >> 4 };
  const area = validateArea(options.area ?? { ...origin, width: LIVE_CHUNKS, depth: LIVE_CHUNKS });
  const offset = { chunkX: area.chunkX - origin.chunkX, chunkZ: area.chunkZ - origin.chunkZ };
  const aligned = offset.chunkX >= 0 && offset.chunkZ >= 0 && offset.chunkX + area.width <= LIVE_CHUNKS && offset.chunkZ + area.depth <= LIVE_CHUNKS;
  const destination = options.destination ?? (aligned ? offset
    : { chunkX: (LIVE_CHUNKS - area.width) >> 1, chunkZ: (LIVE_CHUNKS - area.depth) >> 1 });
  for (const [v, size] of [[destination.chunkX, area.width], [destination.chunkZ, area.depth]])
    if (!Number.isInteger(v) || v < 0 || v + size > LIVE_CHUNKS) throw new RangeError('Destination must keep the area inside the browser world');
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
  const chests = {}, furnaces = {}, dispensers = {}, drops = [];
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
    if (nbt) {
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
      const unbreakable = get(nbt, 'Unbreakable', NBT.BYTE);
      if (unbreakable !== undefined) stack.unbreakable = unbreakable !== 0;
      const recognized = new Set(['ench', 'StoredEnchantments', 'RepairCost', 'display', 'Unbreakable']);
      if ([...nbt.keys()].some((key) => !recognized.has(key))) report.items.tagsStripped++;
      else if (display && [...display.keys()].some((key) => key !== 'Name')) report.items.tagsStripped++;
    }
    if (mapped.clamped || count > limit) report.items.clamped++;
    report.items.converted++;
    return stack;
  };
  const slotItems = (tile, size, unsigned) => {
    const items = Array(size).fill(null);
    for (const entry of compounds(tile, 'Items')) {
      let slot = get(entry, 'Slot', NBT.BYTE, 0);
      if (unsigned) slot &= 255;
      // The original readers skip out-of-range slots before loading the stack.
      if (slot < 0 || slot >= size) { tally(itemLost, `slot ${slot}`); continue; }
      const stack = convertItem(entry);
      if (stack) items[slot] = stack;
    }
    return items;
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
        if (mapped.id === CHEST) facings.set(`${dx},${y},${dz}`, mapped.state.facing >= 2 && mapped.state.facing <= 5 ? mapped.state.facing : 3);
        const carried = mapped.id === CHEST && mapped.exact;
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
      if (world.biomeIds[(baseX + dx) * SIZE + baseZ + dz] === source) report.biomes.matching++;
      else report.biomes.differing++;
    }

    // Tile entities: chests and furnaces whose cell converted to the matching browser block.
    for (const tile of tileEntities) {
      report.tileEntities.total++;
      const id = get(tile, 'id', NBT.STRING, '?'), x = get(tile, 'x', NBT.INT), y = get(tile, 'y', NBT.INT), z = get(tile, 'z', NBT.INT);
      const inside = [x, y, z].every(Number.isInteger) && x >> 4 === cx && z >> 4 === cz && y >= 0 && y < height;
      const lx = inside ? baseX + (x & 15) : 0, lz = inside ? baseZ + (z & 15) : 0, key = `${lx},${y},${lz}`;
      if (inside && id === 'Chest' && chests[key]) {
        chests[key].items = slotItems(tile, CHEST_SLOTS, true);
        tally(tileConverted, id);
      } else if (inside && id === 'Trap' && world.get(lx, y, lz) === DISPENSER) {
        // TileEntityDispenser.readFromNBT: nine slots, Slot read as an unsigned byte.
        dispensers[key] = { items: slotItems(tile, DISPENSER_SLOTS, true) };
        tally(tileConverted, id);
      } else if (inside && id === 'Furnace' && world.get(lx, y, lz) === FURNACE) {
        const items = slotItems(tile, 3, false);
        // TileEntityFurnace.readFromNBT: currentItemBurnTime is recomputed from the fuel slot.
        furnaces[key] = { items, burn: Math.max(0, Math.min(20000, get(tile, 'BurnTime', NBT.SHORT, 0))), burnTotal: Math.min(20000, burnTime(items[1])),
          cook: Math.max(0, Math.min(199, get(tile, 'CookTime', NBT.SHORT, 0))) };
        tally(tileConverted, id);
      } else tally(tileLost, inside ? id : `${id} (outside its chunk)`);
    }

    // Entities: dropped items only (EntityItem, Pos/Motion/Age/PickupDelay/Item). Riders count as lost.
    for (const entity of entities) {
      report.entities.total++;
      const id = get(entity, 'id', NBT.STRING, '?'), pos = doubles(entity, 'Pos'), motion = doubles(entity, 'Motion');
      for (const rider of [get(entity, 'Riding', NBT.COMPOUND)].filter(Boolean)) { report.entities.total++; tally(entityLost, get(rider, 'id', NBT.STRING, '?')); }
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
  const parsedStructures = options.structureData ? await parseStructureDataFiles(options.structureData) : null;
  if (parsedStructures) report.structures = { ...parsedStructures.report, kept: aligned && Object.keys(parsedStructures.structureData).length > 0 };
  // Start above the centre of the area, on its highest solid block.
  const px = destination.chunkX * 16 + area.width * 8, pz = destination.chunkZ * 16 + area.depth * 8;
  let py = height - 1;
  while (py > 0 && !world.solid(px, py, pz)) py--;
  const record = {
    format: 'blockworld', version: 1, generationVersion: 9, seed: seedText, biome: landscape, mode,
    name: String(options.name ?? `Java ${area.chunkX},${area.chunkZ} ${area.width}x${area.depth}`).slice(0, 40),
    edits: [...world.edits],
    position: { x: px + 0.5, y: py + 1.01, z: pz + 0.5, yaw: 0, pitch: 0 },
    // legacyPlayer() keeps these fields; without `slots` the Creative hotbar defaults apply.
    player: { chests, furnaces, dispensers },
    drops,
    ...(report.structures?.kept ? { structureData: parsedStructures.structureData } : {}),
  };
  report.bytes = new TextEncoder().encode(JSON.stringify(record)).length;
  if (report.bytes > IMPORT_BYTE_LIMIT) {
    const error = new RangeError(`The export is ${report.bytes} bytes; the Import screen accepts at most ${IMPORT_BYTE_LIMIT}.`);
    error.report = report;
    throw error;
  }
  return { record, report };
}
