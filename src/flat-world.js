// Superflat (WorldType.FLAT) as 1.7.10 builds it: FlatGeneratorInfo (ass) parse and serialise, FlatLayerInfo (ast),
// the GuiFlatPresets table, ChunkProviderFlat's terrain (aqu) and WorldChunkManagerHell (aie).
// Everything here is checked against the unchanged classes in public/research/flat-world-reference.json
// (tools/probes/FlatWorldProbe.java); see public/research/superflat.md for what is and is not replayed natively.
import { getBiome } from './java-biomes.js';

// Block.getBlockById(id) is air for every id the 1.7.10 registry does not hold (BlockRegistry ids 1..164 and 170..175).
export const isRegisteredBlock = (id) => (id >= 1 && id <= 164) || (id >= 170 && id <= 175);
export const PLAINS = 1;

// Integer.parseInt: an optional sign and decimal digits that fit an int, otherwise null (NumberFormatException).
export function javaParseInt(s) {
  if (typeof s !== 'string' || !/^[+-]?\d+$/.test(s)) return null;
  const n = Number(s);
  return n >= -2147483648 && n <= 2147483647 ? n : null;
}
// qh.a(String, int): Integer.parseInt or the default.
const parseIntOr = (s, d) => javaParseInt(s) ?? d;
// String.split(regex) without a limit: no match returns the string itself, otherwise trailing empty strings go.
function splitTrim(s, sep) {
  if (!s.includes(sep)) return [s];
  const out = s.split(sep);
  while (out.length && out[out.length - 1] === '') out.pop();
  return out;
}
// String.split(sep, 2).
function splitTwo(s, sep) {
  const i = s.indexOf(sep);
  return i < 0 ? [s] : [s.slice(0, i), s.slice(i + sep.length)];
}

// java.util.HashMap iteration order (Java 8+): bucket (h ^ h >>> 16) & (capacity - 1), insertion order inside a bucket,
// capacity 16 doubling when the size passes 0.75 * capacity, entries keeping their relative order on a resize.
// ass.toString walks the feature map and each feature's parameter map in this order.
export const javaStringHash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0; return h; };
export class JavaHashMap {
  constructor() { this.capacity = 16; this.table = new Map(); this.size = 0; }
  static spread(h) { return (h ^ (h >>> 16)) | 0; }
  put(key, value) {
    const h = JavaHashMap.spread(javaStringHash(key)), index = h & (this.capacity - 1);
    let bucket = this.table.get(index);
    if (!bucket) this.table.set(index, bucket = []);
    const hit = bucket.find((e) => e.key === key);
    if (hit) { hit.value = value; return; }
    bucket.push({ key, value, h });
    if (++this.size > this.capacity * 0.75) this.resize();
  }
  resize() {
    const entries = this.entries();
    this.capacity *= 2; this.table = new Map();
    for (const e of entries) {
      const index = e.h & (this.capacity - 1);
      if (!this.table.has(index)) this.table.set(index, []);
      this.table.get(index).push(e);
    }
  }
  entries() { return [...this.table.keys()].sort((a, b) => a - b).flatMap((k) => this.table.get(k)); }
}

// FlatLayerInfo (ast): [block, meta, count, start]; `start` is its lowest y (setMinY).
function parseLayer(text, y) {
  const parts = splitTwo(text, 'x');
  let count = 1;
  if (parts.length === 2) {
    count = javaParseInt(parts[0]);
    if (count === null) return null;
    if (y + count >= 256) count = 256 - y;
    if (count < 0) count = 0;
  }
  const body = splitTwo(parts[parts.length - 1], ':');
  let block = javaParseInt(body[0]), meta = 0;
  if (block === null) return null;
  if (body.length > 1) { meta = javaParseInt(body[1]); if (meta === null) return null; }
  if (!isRegisteredBlock(block)) { block = 0; meta = 0; }
  if (meta < 0 || meta > 15) meta = 0;
  return [block, meta, count, y];
}
function parseLayers(text) {
  if (text == null || text.length < 1) return [];
  const out = [];
  let y = 0;
  for (const part of splitTrim(text, ',')) {
    const layer = parseLayer(part, y);
    if (!layer) return null;
    out.push(layer);
    y += layer[2];
  }
  return out;
}
export const layerString = ([block, meta, count]) => (count > 1 ? `${count}x` : '') + block + (meta > 0 ? `:${meta}` : '');

// FlatGeneratorInfo.getDefaultFlatGenerator: bedrock, two dirt, grass; plains; village.
export const DEFAULT_FLAT_STRING = '2;7,2x3,2;1;village';
// A parsed flat world: { biome, layers: [[block, meta, count, start]], features: [[name, [[key, value]]]] (HashMap order), height }.
export class FlatGeneratorInfo {
  constructor(biome = PLAINS, layers = [], features = []) { this.biome = biome; this.layers = layers; this.features = features; this.recalc(); }
  // ass.d: every layer's start from the layers below it, and the total height.
  recalc() {
    let y = 0;
    for (const l of this.layers) { l[3] = y; y += l[2]; }
    this.height = y;
    return this;
  }
  has(name) { return this.features.some(([n]) => n === name); }
  options(name) { return Object.fromEntries(this.features.find(([n]) => n === name)?.[1] ?? []); }
  toString() {
    const features = this.features.map(([name, params]) => name.toLowerCase() + (params.length ? `(${params.map(([k, v]) => `${k}=${v}`).join(' ')})` : ''));
    return `2;${this.layers.map(layerString).join(',')};${this.biome};${features.join(',')}`;
  }
  toJSON() { return { string: this.toString(), biome: this.biome, height: this.height, layers: this.layers, features: this.features }; }
}
export const defaultFlatInfo = () => parseFlatInfo(DEFAULT_FLAT_STRING);

// ass.a(String): createFlatGeneratorFromString. Anything that does not parse falls back to the default.
export function parseFlatInfo(text) {
  if (text == null) return build(DEFAULT_FLAT_STRING);
  return build(text) ?? build(DEFAULT_FLAT_STRING);
  function build(source) {
    const parts = source.split(';');
    const version = parts.length === 1 ? 0 : parseIntOr(parts[0], 0);
    if (version < 0 || version > 2) return null;
    let i = parts.length === 1 ? 0 : 1;
    const layers = parseLayers(parts[i++]);
    if (!layers?.length) return null;
    let biome = PLAINS;
    if (version > 0 && parts.length > i) biome = parseIntOr(parts[i++], biome);
    const map = new JavaHashMap();
    if (version > 0 && parts.length > i) {
      for (const feature of splitTrim(parts[i].toLowerCase(), ',')) {
        const sub = splitTwo(feature, '('), params = new JavaHashMap();
        if (sub[0].length > 0) {
          map.put(sub[0], params);
          if (sub.length > 1 && sub[1].endsWith(')') && sub[1].length > 1) {
            for (const p of splitTrim(sub[1].slice(0, -1), ' ')) {
              const kv = splitTwo(p, '=');
              if (kv.length > 1) params.put(kv[0], kv[1]);
            }
          }
        }
      }
    } else map.put('village', new JavaHashMap());
    return new FlatGeneratorInfo(biome, layers, map.entries().map((e) => [e.key, e.value.entries().map((p) => [p.key, p.value])]));
  }
}
export const normalizeFlatOptions = (text) => parseFlatInfo(text).toString();

// GuiFlatPresets' table (the strings are read from the class; icon = the original item id drawn beside the name).
export const FLAT_PRESETS = Object.freeze([
  ['Classic Flat', 2, '2;7,2x3,2;1;village'],
  ["Tunnelers' Dream", 1, '2;7,230x1,5x3,2;3;biome_1,decoration,stronghold,mineshaft,dungeon'],
  ['Water World', 8, '2;7,5x1,5x3,5x12,90x9;1;village,biome_1'],
  ['Overworld', 31, '2;7,59x1,3x3,2;1;village,biome_1,decoration,stronghold,mineshaft,lake,lava_lake,dungeon'],
  ['Snowy Kingdom', 78, '2;7,59x1,3x3,2,78;12;village,biome_1'],
  ['Bottomless Pit', 288, '2;2x4,3x3,2;1;village,biome_1'],
  ['Desert', 12, '2;7,3x1,52x24,8x12;2;village,biome_1,decoration,stronghold,mineshaft,dungeon'],
  ['Redstone Ready', 331, '2;7,3x1,52x24;2;'],
].map(([name, icon, string]) => Object.freeze({ name, icon, string })));

// BiomeGenBase.getBiome(id) with the one deviation a browser needs: a hole in the table (ids 40, 126-128, 168-255) is a
// NullPointerException when 1.7.10 builds a chunk, so those ids use plains here (labelled approximation).
export const flatBiome = (id) => getBiome(id) ?? getBiome(PLAINS);

// WorldChunkManagerHell (aie): one biome everywhere.
export class FlatChunkManager {
  constructor(biomeId) { this.biome = flatBiome(biomeId); this.cache = new Map(); }
  biomeAt() { return this.biome; }
  // areBiomesViable(x, z, r, list): true when the biome is in the list.
  areBiomesViable(x, z, r, allowed) { return allowed.includes(this.biome.slot); }
  // findBiomePosition: nothing for a biome outside the list, else two draws within +-range (y is 0).
  findBiomePosition(x, z, range, allowed, random) {
    if (!allowed.includes(this.biome.slot)) return null;
    return [x - range + random.nextInt(range * 2 + 1), 0, z - range + random.nextInt(range * 2 + 1)];
  }
}

// ChunkProviderFlat.provideChunk (aqu.d): the layers fill every column from their start up; heights past 255 are cut.
// Layout (x * 16 + z) * 256 + y in original ids, the order of WorldChunk and the terrain providers.
export class FlatChunkProvider {
  constructor(info) {
    this.info = info; this.manager = new FlatChunkManager(info.biome);
    this.column = new Uint8Array(256); this.columnMeta = new Uint8Array(256);
    for (const [block, meta, count, start] of info.layers) {
      for (let y = start; y < start + count && y < 256; y++) { this.column[y] = block; this.columnMeta[y] = meta; }
    }
    this.biomeState = { topBlock: () => this.topBlock() };
  }
  // The block at the top of the layers' terrain (the biome's topBlock for the structure code).
  topBlock() { return 2; }
  provideChunk(x, z) {
    const blocks = new Uint8Array(65536), metadata = new Uint8Array(65536), biomes = new Uint8Array(256).fill(this.info.biome & 255);
    for (let c = 0; c < 256; c++) {
      blocks.set(this.column, c * 256);
      metadata.set(this.columnMeta, c * 256);
    }
    return { x, z, blocks, metadata, biomes };
  }
}
