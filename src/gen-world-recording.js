// Test-side recording for native replays over gen-world.js: hashes of the ordered world calls
// and successful writes in the probes' int32 LE layout, collected drops/sounds/aux, and the
// probes' chunk storage hash (chunks in Java long-key order, id|meta<<12 per x/z/y, height map).
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const int32 = (hash, values) => { const b = Buffer.alloc(values.length * 4); values.forEach((v, i) => b.writeInt32LE(v, i * 4)); hash.update(b); };
export function recordedWorld(world) {
  const r = { calls: createHash("sha1"), callCount: 0, writes: createHash("sha1"), writeCount: 0, written: new Set(), drops: [], sounds: [], aux: [] };
  world.onCall = (...a) => { r.callCount++; int32(r.calls, a); };
  world.onWrite = (...a) => { r.writeCount++; int32(r.writes, a); r.written.add(`${a[3]}:${a[5]}`); };
  world.onItem = (...a) => r.drops.push(a);
  world.onSound = (name, x, y, z, volume, pitch) => r.sounds.push([name, x, y, z, volume, pitch]);
  world.onAux = (...a) => r.aux.push(a);
  return r;
}
// Chunk storage hash: (id | meta << 12) per x/z/y, then the height map, chunks in the probe's long-key order (z unsigned).
export function stateSha1(world) {
  const d = createHash("sha1"), chunks = [...world.chunks.values()].sort((a, b) => a.x - b.x || (a.z >>> 0) - (b.z >>> 0));
  for (const c of chunks) {
    int32(d, [c.x, c.z]);
    const col = new Int32Array(256);
    for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) {
      for (let y = 0; y < 256; y++) col[y] = c.getBlock(x, y, z) | c.getMeta(x, y, z) << 12;
      d.update(Buffer.from(col.buffer));
    }
    const hm = new Int32Array(256);
    for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) hm[x * 16 + z] = c.heightMap[z << 4 | x];
    d.update(Buffer.from(hm.buffer));
  }
  return d.digest("hex");
}
export function assertEffects(r, rec, label) {
  assert.equal(r.drops.length, rec.drops.length, `${label} drops`);
  r.drops.forEach((d, i) => assert.deepEqual(d, rec.drops[i], `${label} drop ${i}`));
  assert.deepEqual(r.sounds.map(([n, x, y, z, v, p]) => [n, x, y, z, v, p]), rec.sounds.map(([n, x, y, z, v, p]) => [n, x, y, z, Math.fround(v), Math.fround(p)]), `${label} sounds`);
  assert.deepEqual(r.aux, rec.aux, `${label} aux`);
}
