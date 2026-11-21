// Batch 89 console89: the native bytes /netstat counts for chunk data (S21 / S26) and ItemStack tags. Server-only (node:zlib): imported by net-packet-ids.js,
// which only server/server.js and the tests load.
//
// Evidence (bytecode-read gx, gz, et.a(add), du.a; executed tools/probes/Console89Probe.java -> public/research/console89-reference.json):
//  * S21PacketChunkData (gx.<init>(apx, full, mask)): gx.a(apx, full, mask) extracts the data, then `new Deflater(-1)` deflates it once (zlib stream, default level)
//    into a buffer as long as the input; the packet writes int x, int z, bool full, short mask, short add mask, int length, the deflated bytes.
//  * The extracted data (gx.a): for each section i (0..15) that exists, is in the mask and (for a full chunk) is not empty (blockRefCount != 0): first every such
//    section's 4096 block id bytes (LSB), then every section's 2048-byte metadata nibbles, then block light, then (when the world has sky: !WorldProvider.hasNoSky)
//    sky light, then the add arrays of the sections that have one, then (full chunk) the 256 biome bytes. Inside a section the index is y << 8 | z << 4 | x and a
//    nibble array keeps index i in byte i >> 1, the low nibble for even i.
//  * S26PacketMapChunkBulk (gz.<init>(List)): each chunk's gx.a(apx, true, 65535) data is concatenated and deflated ONCE with Deflater(-1); the packet writes short
//    count, int length, bool sky, the bytes, then int x, int z, short mask, short add mask per chunk.
//  * An ItemStack (et.a(add)): short id, byte count, short damage, then the tag when the item is damageable or shares its tag (Item.getShareTag, true by default):
//    short -1 for no tag, else short length and du.a(tag) = CompressedStreamTools.compress, a gzip stream of the tag written with an empty root name.
// Node's zlib (deflateSync / gzipSync at level -1) stands in for java.util.zip; the executed samples match byte for byte (src/console89-b89.test.js).
import { deflateSync, gzipSync } from 'node:zlib';
import { toOriginal } from '../block-registry.js';
import { NBT, encodeNbt } from '../nbt.js';
import { writeItemTags } from '../item-tags.js';
import { writeFireworkTags } from '../fireworks-nbt.js';
import { writeBookTags } from '../books-nbt.js';

const SECTION = 4096;
/**
 * gx.a's data. `ids`, `metas`, `sky`, `block`: one entry per cell at (lx * 16 + lz) * height + y (native ids, metadata and light values 0-15); `biomes`: 256 bytes at
 * lz * 16 + lx. A section exists below `height`; for a full chunk only the non-empty ones are written, for a partial one every masked section below `height`.
 */
export function chunkData({ height, ids, metas, sky = null, block = null, biomes = null }, { full = true, mask = 0xffff, hasSky = true } = {}) {
  const sections = [];
  for (let s = 0; s < 16 && s * 16 < height; s++) {
    if (!(mask & (1 << s))) continue;
    if (full) { let any = false; for (let lx = 0; lx < 16 && !any; lx++) for (let lz = 0; lz < 16 && !any; lz++) { const base = (lx * 16 + lz) * height; for (let y = s * 16; y < s * 16 + 16 && y < height; y++) if (ids[base + y] !== 0) { any = true; break; } } if (!any) continue; }
    sections.push(s);
  }
  const n = sections.length, parts = hasSky ? 4 : 3, out = new Uint8Array(n * (SECTION + (parts - 1) * 2048) + (full ? 256 : 0));
  const metaAt = n * SECTION, blockAt = metaAt + n * 2048, skyAt = blockAt + n * 2048;
  sections.forEach((s, k) => {
    for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) {
      const base = (lx * 16 + lz) * height;
      for (let dy = 0; dy < 16; dy++) {
        const y = s * 16 + dy; if (y >= height) break;
        const c = base + y, i = dy << 8 | lz << 4 | lx, half = i >> 1, shift = (i & 1) << 2;
        out[k * SECTION + i] = ids[c] & 255;
        out[metaAt + k * 2048 + half] |= (metas[c] & 15) << shift;
        if (block) out[blockAt + k * 2048 + half] |= (block[c] & 15) << shift;
        if (hasSky && sky) out[skyAt + k * 2048 + half] |= (sky[c] & 15) << shift;
      }
    }
  });
  if (full && biomes) out.set(biomes.subarray(0, 256), out.length - 256);
  return out;
}

/** Deflater(-1) over the data: the length the packet writes. */
export const deflatedLength = (data) => deflateSync(data, { level: -1 }).length;

// ---- the port's columns ----
let nativeIds = null; // port (id | meta << 8) -> native (id | meta << 12), or -1 when the port block has no original
const toNative = (value) => {
  nativeIds ??= new Int32Array(4096).fill(-2);
  let v = nativeIds[value];
  if (v === -2) { const o = toOriginal(value & 255, value >> 8); v = nativeIds[value] = o ? (o[0] & 4095) | (o[1] & 15) << 12 : -1; }
  return v;
};

/**
 * The native data of a port column message ({ x, z, runs }: the run-length cells of encodeColumn, column order (lx * 16 + lz) * height + y). `source` gives what the
 * runs do not carry: { height, light: { skyAt(x, y, z), blockAt(x, y, z) } (world cells: column * 16 + local), biomes(x, z) -> 256 bytes, hasSky }. Without a light
 * source the sky light is 15 above the column's top non-air cell and 0 below, block light 0 (an estimate). Port blocks with no original count as air.
 * The block side state the port keeps outside the cell (flowing water, a lit furnace, a chest's facing) is not looked at: the metadata is toOriginal's default.
 */
export function columnData(column, source = {}, opts = {}) {
  const runs = Array.isArray(column?.runs) ? column.runs : [];
  let total = 0; for (let i = 1; i < runs.length; i += 2) total += runs[i] | 0;
  const height = source.height ?? (total >> 8), cells = 256 * height;
  const ids = new Uint16Array(cells), metas = new Uint8Array(cells), sky = new Uint8Array(cells), block = new Uint8Array(cells);
  let at = 0;
  for (let i = 0; i + 1 < runs.length && at < cells; i += 2) {
    const v = toNative(runs[i] & 4095), end = Math.min(cells, at + (runs[i + 1] | 0));
    if (v > 0) { ids.fill(v & 4095, at, end); metas.fill(v >> 12, at, end); }
    at = end;
  }
  const hasSky = source.hasSky !== false, light = source.light, ox = (column.x | 0) * 16, oz = (column.z | 0) * 16;
  for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) {
    const base = (lx * 16 + lz) * height;
    const wx = ox + lx, wz = oz + lz;
    if (light?.sky && light.block && light.height === height && wx >= 0 && wz >= 0 && wx < light.size && wz < light.size) { // LightVolume: a column's cells are contiguous in y
      const at = (wx * light.size + wz) * height; if (hasSky) sky.set(light.sky.subarray(at, at + height), base); block.set(light.block.subarray(at, at + height), base); continue;
    }
    if (light) { for (let y = 0; y < height; y++) { if (hasSky) sky[base + y] = light.skyAt(wx, y, wz); block[base + y] = light.blockAt(wx, y, wz); } continue; }
    if (!hasSky) continue;
    let top = height - 1; while (top >= 0 && ids[base + top] === 0) top--;
    sky.fill(15, base + top + 1, base + height);
  }
  let biomes = source.biomes?.(column.x | 0, column.z | 0) ?? null;
  if (!biomes) biomes = new Uint8Array(256).fill(source.biome ?? 1);
  return chunkData({ height, ids, metas, sky, block, biomes }, { ...opts, hasSky });
}

/**
 * The Deflater(-1) length of the concatenated data of `columns` (one column: S21's data; up to five: S26's, deflated once). Lengths are cached by the columns'
 * coordinates and cells (a 64-bit hash of the runs), the options and the source, so the same terrain sent again (another player, a rejoin) is not deflated again.
 * The light is not part of the key: a light change with no cell change in these columns keeps the cached length (an estimate). At most CACHE_MAX entries (oldest dropped).
 */
const lengths = new Map(), sourceIds = new WeakMap(), CACHE_MAX = 8192;
let nextSource = 1;
const sourceId = (s) => { if (!s || typeof s !== 'object') return 0; let id = sourceIds.get(s); if (!id) sourceIds.set(s, (id = nextSource++)); return id; };
const hashColumns = (columns) => {
  let a = 0x811c9dc5, b = 0x2545f491 ^ columns.length;
  const mix = (v) => { a = Math.imul(a ^ v, 16777619); b = Math.imul(b ^ v, 0x5bd1e995); b ^= b >>> 13; };
  for (const c of columns) { mix(c?.x | 0); mix(c?.z | 0); const runs = Array.isArray(c?.runs) ? c.runs : []; mix(runs.length); for (let i = 0; i < runs.length; i++) mix(runs[i] | 0); }
  return `${a >>> 0}:${b >>> 0}`;
};
export function columnsDeflated(columns, source = {}, opts = {}) {
  const key = `${sourceId(source)}|${opts.full !== false}|${opts.mask ?? 0xffff}|${hashColumns(columns)}`;
  const hit = lengths.get(key);
  if (hit !== undefined) { lengths.delete(key); lengths.set(key, hit); return hit; }
  const parts = columns.map((c) => columnData(c, source, opts)), all = parts.length === 1 ? parts[0] : new Uint8Array(parts.reduce((n, d) => n + d.length, 0));
  if (parts.length !== 1) { let at = 0; for (const d of parts) { all.set(d, at); at += d.length; } }
  const n = deflatedLength(all);
  lengths.set(key, n); if (lengths.size > CACHE_MAX) lengths.delete(lengths.keys().next().value);
  return n;
}

/**
 * The chunk source of a dimension of a DedicatedSimulation (what columnData needs beyond the runs): its height, light volume, biome bytes (World.biomeAt ids) and sky.
 * Kept per world so the cache above sees one source per world. The Overworld's light is read only while it is the simulation's own (not inside a Nether swap).
 * Dimensions that do not exist yet return undefined (the estimate): nothing is created for a count.
 */
const sources = new WeakMap();
export function chunkSourceFor(sim, dim = 0) {
  if (!sim) return undefined;
  const dims = sim.dimensions, n = dim === -1 ? dims?.nether : dim === 1 ? dims?.end?.n : null;
  const world = dim ? n?.world : (dims?.overworld ?? sim.world), light = dim ? n?.light : (sim.world === world ? sim.light : null);
  if (!world) return undefined;
  let s = sources.get(world);
  if (!s) {
    const fallback = dim === -1 ? 8 : dim === 1 ? 9 : 1; // BiomeGenBase hell (8), sky (9), plains (1) when the world has no biome map
    s = { height: world.height ?? 256, hasSky: !world.hasNoSky, biome: fallback, light: null,
      biomes: (cx, cz) => { if (typeof world.biomeAt !== 'function') return null; const b = new Uint8Array(256); for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) b[z << 4 | x] = world.biomeAt(cx * 16 + x, cz * 16 + z)?.id ?? fallback; return b; } };
    sources.set(world, s);
  }
  s.light = light ?? null;
  return s;
}

// ---- ItemStack tags ----
const tag = (type, value) => ({ type, value });
const comp = (o) => tag(NBT.COMPOUND, new Map(Object.entries(o)));
const enchList = (values) => tag(NBT.LIST, { elementType: values.length ? NBT.COMPOUND : NBT.END, items: values.map((e) => new Map([['id', tag(NBT.SHORT, e.id | 0)], ['lvl', tag(NBT.SHORT, e.lvl | 0)]])) });
/** The ItemStack tag compound of a port stack (the tag region-export.js writes), or null when the stack has none. */
export function stackTag(s) {
  if (!s || typeof s !== 'object') return null;
  const entries = {};
  if (Array.isArray(s.enchantments)) entries.ench = enchList(s.enchantments);
  const stored = s.storedEnchantments ?? (s.stored?.length ? s.stored : undefined);
  if (Array.isArray(stored)) entries.StoredEnchantments = enchList(stored);
  if (Number.isInteger(s.repairCost)) entries.RepairCost = tag(NBT.INT, s.repairCost);
  const display = {};
  if (typeof s.displayName === 'string') display.Name = tag(NBT.STRING, s.displayName);
  if (Number.isInteger(s.color) && s.color >= 0 && s.color <= 0xffffff) display.color = tag(NBT.INT, s.color);
  if (Object.keys(display).length) entries.display = comp(display);
  try { writeFireworkTags(s, entries); writeBookTags(s, entries); writeItemTags(s, entries); } catch { /* a malformed field: counted without it */ }
  if (typeof s.unbreakable === 'boolean') entries.Unbreakable = tag(NBT.BYTE, s.unbreakable ? 1 : 0);
  return Object.keys(entries).length ? comp(entries) : null;
}
/** du.a(tag): the gzip length of a tag compound (root name ""). */
export const tagGzipLength = (t) => gzipSync(encodeNbt({ name: '', tag: t }), { level: -1 }).length;
const tagLengths = new WeakMap();
/** The bytes et.a(add) writes after the damage: 2 (short -1) with no tag, else 2 + the gzip length. */
export function itemTagBytes(s) {
  if (!s || typeof s !== 'object') return 2;
  if (tagLengths.has(s)) return tagLengths.get(s);
  const t = stackTag(s), n = t ? 2 + tagGzipLength(t) : 2;
  tagLengths.set(s, n); return n;
}
