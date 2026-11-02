// AnvilChunkLoader's storage payload, independent of region IO and runtime loading.
import {NBT} from './nbt.js';
import {Chunk, ExtendedBlockStorage, NibbleArray} from './chunk-store.js';

const ROOT_KEYS = new Set(['Level']);
const LEVEL_KEYS = new Set(['V', 'xPos', 'zPos', 'LastUpdate', 'HeightMap', 'TerrainPopulated',
  'LightPopulated', 'InhabitedTime', 'Sections', 'Biomes', 'Entities', 'TileEntities', 'TileTicks']);
const SECTION_KEYS = new Set(['Y', 'Blocks', 'Add', 'Data', 'BlockLight', 'SkyLight']);
const tag = (type, value) => ({type, value});
const compound = value => tag(NBT.COMPOUND, value);
function int(value, min = -2147483648, max = 2147483647) {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new RangeError('Invalid chunk integer');
  return value;
}
function long(value) {
  if (typeof value === 'number') value = BigInt(int(value, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER));
  if (typeof value !== 'bigint' || value < -(1n << 63n) || value >= (1n << 63n)) throw new RangeError('Invalid chunk long');
  return value;
}
function map(value) {
  if (!(value instanceof Map)) throw new TypeError('Chunk compound must be a Map');
  return value;
}
function field(entries, name, type, fallback) {
  const found = entries.get(name);
  if (!found && arguments.length === 4) return fallback;
  if (found?.type !== type) throw new TypeError(`Invalid chunk tag ${name}`);
  return found.value;
}
function array(value, Type, length) {
  if (!(value instanceof Type) || value.length !== length) throw new RangeError(`Invalid chunk array; expected ${length} elements`);
  return value.slice();
}
function extras(entries, known) {
  return structuredClone(new Map([...map(entries)].filter(([key]) => !known.has(key))));
}
function list(entries, key, required = false) {
  const value = field(entries, key, NBT.LIST, required ? undefined : {elementType: NBT.END, items: []});
  if (!value || !Array.isArray(value.items) || (value.elementType !== NBT.COMPOUND && !(value.elementType === NBT.END && !value.items.length))) {
    throw new TypeError(`Invalid chunk list ${key}`);
  }
  return value.items.map(item => structuredClone(map(item)));
}
function listTag(items) {
  if (!Array.isArray(items)) throw new TypeError('Chunk payload list must be an array');
  return tag(NBT.LIST, {elementType: items.length ? NBT.COMPOUND : NBT.END,
    items: items.map(item => structuredClone(map(item)))});
}

/** Decode storage; return opaque payloads/extensions separately, without spawning or ticking. */
export function chunkFromNbt(document, {hasSky = true} = {}) {
  if (typeof hasSky !== 'boolean') throw new TypeError('hasSky must be boolean');
  if (document.tag?.type !== NBT.COMPOUND) throw new TypeError('Chunk root must be compound');
  const root = map(document.tag.value), level = map(field(root, 'Level', NBT.COMPOUND));
  const chunk = new Chunk(int(field(level, 'xPos', NBT.INT)), int(field(level, 'zPos', NBT.INT)), hasSky);
  chunk.heightMap = array(field(level, 'HeightMap', NBT.INT_ARRAY), Int32Array, 256);
  chunk.isTerrainPopulated = int(field(level, 'TerrainPopulated', NBT.BYTE, 0), -128, 127) !== 0;
  chunk.isLightPopulated = int(field(level, 'LightPopulated', NBT.BYTE, 0), -128, 127) !== 0;
  const inhabited = long(field(level, 'InhabitedTime', NBT.LONG, 0n));
  // Existing Chunk lifecycle arithmetic uses Number; preserve unusual longs exactly as BigInt.
  chunk.inhabitedTime = inhabited >= BigInt(Number.MIN_SAFE_INTEGER) && inhabited <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(inhabited) : inhabited;
  if (level.has('Biomes')) chunk.biomes = array(field(level, 'Biomes', NBT.BYTE_ARRAY), Int8Array, 256);
  const sectionExtras = new Map();
  for (const section of list(level, 'Sections', true)) {
    const y = int(field(section, 'Y', NBT.BYTE), 0, 15), storage = new ExtendedBlockStorage(y << 4, hasSky);
    storage.lsb = new Uint8Array(array(field(section, 'Blocks', NBT.BYTE_ARRAY), Int8Array, 4096));
    if (section.has('Add')) storage.msb = new NibbleArray(4096, 4, new Uint8Array(array(field(section, 'Add', NBT.BYTE_ARRAY), Int8Array, 2048)));
    storage.metadata = new NibbleArray(4096, 4, new Uint8Array(array(field(section, 'Data', NBT.BYTE_ARRAY), Int8Array, 2048)));
    storage.blocklight = new NibbleArray(4096, 4, new Uint8Array(array(field(section, 'BlockLight', NBT.BYTE_ARRAY), Int8Array, 2048)));
    if (hasSky) storage.skylight = new NibbleArray(4096, 4, new Uint8Array(array(field(section, 'SkyLight', NBT.BYTE_ARRAY), Int8Array, 2048)));
    storage.recount();
    // The original array assignment makes the last duplicate Y win.
    chunk.sections[y] = storage;
    sectionExtras.set(y, extras(section, SECTION_KEYS));
  }
  const entities = list(level, 'Entities'), tileEntities = list(level, 'TileEntities');
  chunk.hasEntities = entities.length > 0;
  return {
    chunk, name: document.name ?? '', lastUpdate: long(field(level, 'LastUpdate', NBT.LONG, 0n)),
    entities, tileEntities, tileTicks: level.has('TileTicks') ? list(level, 'TileTicks') : null,
    extensions: {root: extras(root, ROOT_KEYS), level: extras(level, LEVEL_KEYS), sections: sectionExtras},
  };
}

/** Build a named Level compound, copying arrays and retaining supplied opaque payloads. */
export function chunkToNbt(chunk, {name = '', lastUpdate = 0n, entities = [], tileEntities = [], tileTicks = null, extensions = {}} = {}) {
  if (!(chunk instanceof Chunk)) throw new TypeError('Expected Chunk storage');
  if (typeof chunk.hasSky !== 'boolean') throw new TypeError('hasSky must be boolean');
  if (!Array.isArray(chunk.sections) || chunk.sections.length !== 16) throw new RangeError('Expected 16 chunk sections');
  const sections = [];
  for (let y = 0; y < 16; y++) {
    const storage = chunk.sections[y];
    if (!storage) continue;
    if (storage.yBase !== (y << 4)) throw new RangeError('Section base does not match slot');
    const entry = extras(extensions.sections?.get(y) ?? new Map(), SECTION_KEYS);
    entry.set('Y', tag(NBT.BYTE, y));
    entry.set('Blocks', tag(NBT.BYTE_ARRAY, new Int8Array(array(storage.lsb, Uint8Array, 4096))));
    if (storage.msb) entry.set('Add', tag(NBT.BYTE_ARRAY, new Int8Array(array(storage.msb.data, Uint8Array, 2048))));
    entry.set('Data', tag(NBT.BYTE_ARRAY, new Int8Array(array(storage.metadata.data, Uint8Array, 2048))));
    entry.set('BlockLight', tag(NBT.BYTE_ARRAY, new Int8Array(array(storage.blocklight.data, Uint8Array, 2048))));
    // Even no-sky dimensions write a zero SkyLight array, matching AnvilChunkLoader.
    entry.set('SkyLight', tag(NBT.BYTE_ARRAY, chunk.hasSky ? new Int8Array(array(storage.skylight.data, Uint8Array, 2048)) : new Int8Array(2048)));
    sections.push(entry);
  }
  const level = extras(extensions.level ?? new Map(), LEVEL_KEYS);
  for (const [key, value] of [
    ['V', tag(NBT.BYTE, 1)], ['xPos', tag(NBT.INT, int(chunk.x))], ['zPos', tag(NBT.INT, int(chunk.z))],
    ['LastUpdate', tag(NBT.LONG, long(lastUpdate))], ['HeightMap', tag(NBT.INT_ARRAY, array(chunk.heightMap, Int32Array, 256))],
    ['TerrainPopulated', tag(NBT.BYTE, chunk.isTerrainPopulated ? 1 : 0)], ['LightPopulated', tag(NBT.BYTE, chunk.isLightPopulated ? 1 : 0)],
    ['InhabitedTime', tag(NBT.LONG, long(chunk.inhabitedTime))], ['Sections', listTag(sections)],
    ['Biomes', tag(NBT.BYTE_ARRAY, array(chunk.biomes, Int8Array, 256))], ['Entities', listTag(entities)], ['TileEntities', listTag(tileEntities)],
  ]) level.set(key, value);
  if (tileTicks !== null) level.set('TileTicks', listTag(tileTicks));
  const root = extras(extensions.root ?? new Map(), ROOT_KEYS);
  root.set('Level', compound(level));
  return {name, tag: compound(root)};
}
