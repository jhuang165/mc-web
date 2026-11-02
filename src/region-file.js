// Java 1.7.10 MCA container. Writing rebuilds a compact image, not an in-place allocator.
import {encodeCompressedNbt, decodeCompressedNbt} from './nbt-compression.js';
export const REGION_SECTOR_BYTES = 4096;
const HEADER = 8192, DEFAULT_LIMIT = 64 * 1024 * 1024;
function integer(value, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new RangeError('Invalid region integer');
  return value;
}
function limit(options) { return integer(options.maxBytes ?? DEFAULT_LIMIT, HEADER, 0x7fffffff); }
export function regionSlot(x, z) { return integer(x, 0, 31) + integer(z, 0, 31) * 32; }
export function regionAddress(chunkX, chunkZ) {
  integer(chunkX, -2147483648, 2147483647); integer(chunkZ, -2147483648, 2147483647);
  return {regionX: chunkX >> 5, regionZ: chunkZ >> 5, x: chunkX & 31, z: chunkZ & 31};
}
function compression(format) {
  if (format !== 'gzip' && format !== 'zlib') throw new TypeError('Unsupported region compression');
  return format === 'gzip' ? 1 : 2;
}

/** Read a snapshot of each compressed entry, keyed by x + z*32. No decompression here. */
export function readRegion(bytes, options = {}) {
  if (!(bytes instanceof Uint8Array)) throw new TypeError('Region input must be Uint8Array');
  if (bytes.length > limit(options)) throw new RangeError('Region byte limit exceeded');
  if (bytes.length < HEADER || bytes.length % REGION_SECTOR_BYTES) throw new RangeError('Truncated region sectors');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const used = new Uint8Array(bytes.length / REGION_SECTOR_BYTES); used[0] = used[1] = 1;
  const entries = new Map();
  for (let slot = 0; slot < 1024; slot++) {
    const location = view.getUint32(slot * 4), offset = location >>> 8, sectors = location & 255;
    if (!location) continue;
    if (offset < 2 || !sectors || offset + sectors > used.length) throw new RangeError('Invalid region sector location');
    for (let s = offset; s < offset + sectors; s++) {
      if (used[s]) throw new RangeError('Overlapping region sectors');
      used[s] = 1;
    }
    const start = offset * REGION_SECTOR_BYTES, length = view.getInt32(start);
    if (length < 1 || length > sectors * REGION_SECTOR_BYTES - 4) throw new RangeError('Invalid region chunk length');
    const id = bytes[start + 4];
    if (id !== 1 && id !== 2) throw new TypeError('Unsupported region compression');
    entries.set(slot, {x: slot & 31, z: slot >> 5, timestamp: view.getUint32(4096 + slot * 4),
      format: id === 1 ? 'gzip' : 'zlib', compressed: bytes.slice(start + 5, start + 4 + length)});
  }
  return entries;
}

/** Write entries in slot order. Timestamps are explicit unsigned seconds, default zero. */
export function writeRegion(entries, options = {}) {
  const maxBytes = limit(options), slots = new Map();
  let totalSectors = 2;
  for (const entry of entries) {
    const slot = regionSlot(entry.x, entry.z), id = compression(entry.format);
    if (slots.has(slot)) throw new Error('Duplicate region slot');
    if (!(entry.compressed instanceof Uint8Array)) throw new TypeError('Compressed region payload must be Uint8Array');
    // RegionFile.write deliberately reserves an extra sector at an exact boundary.
    const sectors = Math.floor((entry.compressed.length + 5) / REGION_SECTOR_BYTES) + 1;
    if (sectors >= 256) throw new RangeError('Region chunk exceeds 255 sectors');
    totalSectors += sectors;
    if (totalSectors * REGION_SECTOR_BYTES > maxBytes) throw new RangeError('Region byte limit exceeded');
    slots.set(slot, {entry, id, sectors, timestamp: integer(entry.timestamp ?? 0, 0, 0xffffffff)});
  }
  const bytes = new Uint8Array(totalSectors * REGION_SECTOR_BYTES), view = new DataView(bytes.buffer);
  let offset = 2;
  for (const [slot, {entry, id, sectors, timestamp}] of [...slots].sort((a,b) => a[0]-b[0])) {
    view.setUint32(slot * 4, offset * 256 + sectors);
    view.setUint32(4096 + slot * 4, timestamp);
    const start = offset * REGION_SECTOR_BYTES;
    view.setInt32(start, entry.compressed.length + 1); bytes[start + 4] = id;
    bytes.set(entry.compressed, start + 5); offset += sectors;
  }
  return bytes;
}

/** Compose with bounded NBT. Region file caps and decompression caps are independent. */
export async function decodeRegionChunk(entry, options = {}) {
  compression(entry.format);
  return decodeCompressedNbt(entry.compressed, {...options, format: entry.format});
}
export async function encodeRegionChunk(document, {x, z, timestamp = 0, format = 'zlib', ...options}) {
  regionSlot(x, z); compression(format); integer(timestamp, 0, 0xffffffff);
  return {x, z, timestamp, format, compressed: await encodeCompressedNbt(document, {...options, format})};
}
