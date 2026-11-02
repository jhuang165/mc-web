import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JavaRandom } from "./java-random.js";
import { randomLong } from "./mapgen.js";
import { GenWorld, materialOf } from "./gen-world.js";
import { WorldGenLiquids } from "./springs.js";
import { recordedWorld, stateSha1, assertEffects } from "./gen-world-recording.js";
const ref = JSON.parse(readFileSync(new URL("../public/research/springs-reference.json", import.meta.url)));
const mod = (a, b) => ((a % b) + b) % b;
// The probe's synthetic fixture (SpringProbe.cell); values are id << 4 | meta.
function h(a, b, c) {
  let v = (Math.imul(a, 0x2F0B3A49) + Math.imul(b, 0x6C8E9CF5) + Math.imul(c, 0x1B873593)) | 0;
  v ^= v >>> 15; v = Math.imul(v, 0x2C1B3C6D); v ^= v >>> 12; v = Math.imul(v, 0x297A2D39); v ^= v >>> 15; return v;
}
const room = (x, z, l) => (h(Math.floor(x / 6), Math.floor(z / 6), l) & 3) === 0;
const open = (x, z, l) => mod(x + 3 * l, 6) === 0 || mod(z + 5 * l, 6) === 0 || room(x, z, l);
const pillar = (x, z, l) => open(x, z, l) && (h(x, z, l + 100) & 63) === 7;
const FLOORS = [1, 1, 1, 1, 1, 2, 2, 3, 12, 12, 13, 9, 9, 11, 2, 3], DIRS = [[0, 1], [-1, 0], [0, -1], [1, 0]];
export function cell(x, y, z) {
  if (y <= 0) return 7 << 4;
  if (y > 81) return 0;
  if (y === 81) { const v = h(x, z, 81), k = v & 15; return k === 0 ? 31 << 4 | 1 : k === 1 ? 37 << 4 : k === 2 ? 38 << 4 | (v >>> 4 & 7) : k === 3 ? 83 << 4 : 0; }
  if (y === 80) return 2 << 4;
  if (y >= 77) return 3 << 4;
  if (y > 72) return 1 << 4;
  const l = Math.floor((y - 1) / 12), f = 12 * l + 5;
  if (!open(x, z, l)) return 1 << 4;
  const c = h(x, z, l + 100);
  if (l > 0 && (c & 31) === 1 && y >= f - 8 && y <= f + 3) return 0;
  if (pillar(x, z, l) && y > f && y <= f + 3) return 17 << 4 | 3;
  const kind = h(Math.floor(x / 6), Math.floor(z / 6), l + 50) & 7, pool = room(x, z, l) && kind <= 1;
  const floor = FLOORS[c >>> 4 & 15];
  if (y === f) return floor << 4;
  if (y === f + 1) {
    if (pool) return (kind === 0 ? 9 : 11) << 4;
    const p = c >>> 8 & 15;
    if (floor === 2 || floor === 3) return p <= 1 ? 31 << 4 | 1 : p === 2 ? 31 << 4 | 2 : p === 3 ? 37 << 4 : p === 4 ? 38 << 4 | (c >>> 12 & 7) : p === 5 ? 39 << 4 : p === 6 ? 40 << 4 : p === 7 ? 83 << 4 : 0;
    if (floor === 12) return p <= 2 ? 32 << 4 : p <= 4 ? 81 << 4 : p === 5 ? 83 << 4 : 0;
    if (floor === 9) return p <= 3 ? 111 << 4 : 0;
    if (floor === 1 && p === 0) return 39 << 4;
    return 0;
  }
  if (y === f + 2) {
    for (let d = 0; d < 4; d++) if (pillar(x + DIRS[d][0], z + DIRS[d][1], l) && (c >>> 14 & 3) === 0) return 127 << 4 | (d | (c >>> 16 & 3) << 2) % 12;
    if ((c >>> 18 & 3) === 0) { let m = 0; for (let d = 0; d < 4; d++) if (!open(x + DIRS[d][0], z + DIRS[d][1], l)) m |= 1 << d; if (m !== 0) return 106 << 4 | m; }
    return 0;
  }
  if (y === f + 3) return 0;
  if (y === f + 4) { const k = c >>> 20 & 7; return k === 0 ? 12 << 4 : k === 1 ? 13 << 4 : 1 << 4; }
  return 1 << 4;
}
let template = null;
function fixtureChunks() {
  if (template) return template;
  template = [];
  for (let cx = -3; cx <= 2; cx++) for (let cz = -3; cz <= 2; cz++) {
    const blocks = new Uint16Array(65536), meta = new Uint8Array(65536);
    for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) for (let y = 0; y < 256; y++) {
      const v = cell(cx * 16 + x, y, cz * 16 + z), i = (x * 16 + z) * 256 + y;
      blocks[i] = v >> 4; meta[i] = v & 15;
    }
    template.push([cx, cz, blocks, meta]);
  }
  return template;
}
// Records a GenWorld the way SpringProbe's World double does.

test("GEN-04g springs: native block properties", () => {
  const w = new GenWorld();
  for (const [id, mat, solid, blocks, replaceable, opacity, normal, opaque, top] of ref.config.blocks) {
    assert.equal(materialOf(id), mat, `material ${id}`);
    assert.deepEqual([w.isSolid(id), w.blocksMovement(id), w.isReplaceable(id), w.vineSupport(id), w.isOpaqueCube(id)],
      [!!solid, !!blocks, !!replaceable, !!(normal && blocks), !!opaque], `flags ${id}`);
    for (let m = 0; m < 16; m++) assert.equal(w.solidTop(id, m), (top >> m & 1) === 1, `top ${id}:${m}`);
  }
  assert.deepEqual(ref.config.liquidBlockers, [64, 71, 63, 65, 83]);
});

test("GEN-04g springs: native WorldGenLiquids with immediate flow over Chunk storage", () => {
  const seen = new Set();
  for (const rec of ref.records) {
    const label = `seed ${rec.seed}`, rand = new JavaRandom(BigInt(rec.seed));
    const world = new GenWorld({ rand: new JavaRandom(BigInt(rec.worldRand)), light: (x, y, z) => mod(x * 5 + y * 11 + z * 3 + rec.lightBase, 16) });
    for (const [cx, cz, blocks, meta] of fixtureChunks()) world.addChunk(cx, cz, blocks, meta);
    const r = recordedWorld(world);
    const results = rec.attempts.map(([id, x, y, z]) => new WorldGenLiquids(id).generate(world, rand, x, y, z));
    assert.deepEqual(results, rec.results, label);
    assert.equal(r.callCount, rec.callCount, `${label} calls`);
    assert.equal(r.calls.digest("hex"), rec.callSha1, `${label} call order`);
    assert.equal(r.writeCount, rec.writeCount, label);
    assert.equal(r.writes.digest("hex"), rec.writeSha1, label);
    assert.deepEqual(world.pending, rec.pending, `${label} pending`);
    assertEffects(r, rec, label);
    assert.equal(stateSha1(world), rec.stateSha1, `${label} state`);
    assert.equal(randomLong(rand).toString(), rec.nextLong, label);
    assert.equal(randomLong(world.rand).toString(), rec.worldNextLong, label);
    for (const [id] of rec.attempts) seen.add(`spring:${id}`);
    for (const d of rec.drops) seen.add(`drop:${d[3]}`);
    if (rec.sounds.length) seen.add("fizz");
    if (rec.aux.length) seen.add("cactus");
    for (const k of r.written) seen.add(`write:${k}`);
  }
  // Instant sand/gravel falls (flags 3), lava hardening (obsidian, cobblestone, stone), leaf decay marks.
  for (const k of ["spring:8", "spring:10", "drop:111", "drop:338", "drop:81", "drop:39", "drop:295", "drop:351", "fizz", "cactus",
    "write:12:3", "write:13:3", "write:49:3", "write:4:3", "write:1:3", "write:9:2", "write:11:2", "write:-1:2"]) assert.ok(seen.has(k), k);
});
