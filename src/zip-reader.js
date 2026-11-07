// A small ZIP reader for resource packs (java.util.zip.ZipFile as 1.7.10's FileResourcePack uses it): the end of
// central directory record, the central directory, then each entry's local header on demand. Methods 0 (stored) and 8
// (deflate, via DecompressionStream('deflate-raw')) are supported; ZIP64 and encryption are not.
const u16 = (d, o) => d[o] | (d[o + 1] << 8);
const u32 = (d, o) => (d[o] | (d[o + 1] << 8) | (d[o + 2] << 16) | (d[o + 3] << 24)) >>> 0;
const utf8 = new TextDecoder();

export class ZipError extends Error {}

export async function inflateRaw(bytes) {
  if (typeof DecompressionStream === "undefined") throw new ZipError("DecompressionStream is unavailable");
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// bytes: Uint8Array of the whole archive. Returns Map(name -> { name, size, method, directory, read() }).
export function readZip(bytes) {
  if (!(bytes instanceof Uint8Array)) bytes = new Uint8Array(bytes);
  // EOCD: signature 0x06054b50 within the last 65535 + 22 bytes.
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) {
    if (u32(bytes, i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new ZipError("Not a zip file (no end of central directory)");
  const count = u16(bytes, eocd + 10), size = u32(bytes, eocd + 12), offset = u32(bytes, eocd + 16);
  if (count === 0xffff || size === 0xffffffff || offset === 0xffffffff) throw new ZipError("ZIP64 archives are not supported");
  const entries = new Map();
  let p = offset;
  for (let n = 0; n < count; n++) {
    if (p + 46 > bytes.length || u32(bytes, p) !== 0x02014b50) throw new ZipError("Corrupt central directory");
    const flags = u16(bytes, p + 8), method = u16(bytes, p + 10), compressed = u32(bytes, p + 20), size = u32(bytes, p + 24);
    const nameLength = u16(bytes, p + 28), extraLength = u16(bytes, p + 30), commentLength = u16(bytes, p + 32), local = u32(bytes, p + 42);
    const name = utf8.decode(bytes.subarray(p + 46, p + 46 + nameLength));
    p += 46 + nameLength + extraLength + commentLength;
    const entry = {
      name, size, method, directory: name.endsWith("/"),
      async read() {
        if (flags & 1) throw new ZipError("Encrypted entries are not supported: " + name);
        if (u32(bytes, local) !== 0x04034b50) throw new ZipError("Corrupt local header: " + name);
        const start = local + 30 + u16(bytes, local + 26) + u16(bytes, local + 28);
        const raw = bytes.subarray(start, start + compressed);
        if (method === 0) return raw;
        if (method === 8) return inflateRaw(raw);
        throw new ZipError("Unsupported compression method " + method + ": " + name);
      },
    };
    entries.set(name, entry);
  }
  return entries;
}
