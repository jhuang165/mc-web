// A minimal zip reader for the mod installers (fetch-tacz.mjs, fetch-knives.mjs): the end-of-central-directory record, then
// each central entry's local header, stored or deflated. Yields { name, read() -> Buffer | null }.
import { inflateRawSync } from "node:zlib";

export function* zipEntries(zip) {
  let eocd = zip.length - 22;
  while (eocd >= 0 && zip.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error("not a zip file");
  let p = zip.readUInt32LE(eocd + 16);
  for (let i = 0, n = zip.readUInt16LE(eocd + 10); i < n; i++) {
    const method = zip.readUInt16LE(p + 10), size = zip.readUInt32LE(p + 20), nameLen = zip.readUInt16LE(p + 28);
    const extraLen = zip.readUInt16LE(p + 30), commentLen = zip.readUInt16LE(p + 32), local = zip.readUInt32LE(p + 42);
    const name = zip.toString("utf8", p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;
    yield { name, read() {
      const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28), body = zip.subarray(start, start + size);
      return method === 0 ? Buffer.from(body) : method === 8 ? inflateRawSync(body) : null;
    } };
  }
}
