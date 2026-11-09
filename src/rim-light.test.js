// Batch 31 (light-engine.md "Batch 31"): the rim of the loaded chunk set. public/research/rim-light-reference.json is the unchanged 1.7.10
// World/Chunk light code (tools/probes/RimLightProbe.java) loading terrain over chunks -7..7 chunk by chunk (spiral and x-major order, two seeds)
// with ChunkProviderServer.populate and a server tick after each load, at three growing sizes of the loaded set. NativeLight replays it exactly
// (all per-chunk digests), and the ring's column light is compared with it chunk ring by chunk ring.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { replayRim, R, W, H } from "./rim-light-ref.js";
import { SKY, BLOCK } from "./native-light.js";
import { computeColumnLight, isRim, verticalLight, OPACITY } from "./ring-light.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/rim-light-reference.json", import.meta.url)));
const key = (a, b) => a * 100 + b;

// For each snapshot: cells per chunk where the column light differs from the native light, by depth (0 = outermost loaded chunk).
function compare(light, ids, L, noRim, nether) {
  const cols = new Map();
  for (let cx = -L; cx <= L; cx++) for (let cz = -L; cz <= L; cz++) {
    const blocks = new Uint8Array(256 * H);
    for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) { const from = (((cx + R) * 16 + lx) * W + (cz + R) * 16 + lz) * H; blocks.set(ids.subarray(from, from + H), (lx * 16 + lz) * H); }
    cols.set(key(cx, cz), { blocks, h: H });
  }
  const ring = { world: { hasNoSky: nether }, height: H, resident: () => false, cols, key, noRim };
  const out = new Map();
  for (let cx = -L; cx <= L; cx++) for (let cz = -L; cz <= L; cz++) {
    const d = L - Math.max(Math.abs(cx), Math.abs(cz));
    if (d > 1) continue;
    const lit = computeColumnLight(ring, cx, cz, nether);
    let e = out.get(d); if (!e) out.set(d, e = { sky: 0, block: 0, chunks: 0 });
    e.chunks++;
    for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) for (let y = 0; y < H; y++) {
      const v = y >= lit.hh ? 240 : lit.packed[(lx * 16 + lz) * lit.hh + y], x = (cx + R) * 16 + lx, z = (cz + R) * 16 + lz;
      if (!nether && v >> 4 !== light.saved(SKY, x, y, z)) e.sky++;
      if ((v & 15) !== light.saved(BLOCK, x, y, z)) e.block++;
    }
  }
  for (const e of out.values()) { e.sky /= e.chunks; e.block /= e.chunks; }
  return out;
}

const results = [];
for (const s of ref.scenarios) {
  test(`rim light: ${s.case} NativeLight replays the unchanged classes at every snapshot (225 chunks x sky, block, heights)`, () => {
    const model = { base: [], native: [] };
    const { snaps } = replayRim(s, (label, light, ids) => {
      if (!/^(loaded|aged)/.test(label)) return;
      const L = label.startsWith("aged") ? R : +label.split(" ")[1], nether = /nether/.test(s.case);
      model.base.push([label, compare(light, ids, L, false, nether)]);
      model.native.push([label, compare(light, ids, L, true, nether)]);
    }, ref.terrains);
    assert.equal(snaps.length, s.snaps.length);
    snaps.forEach((p, i) => assert.deepEqual(p.chunks, s.snaps[i].chunks, `${s.case} ${s.snaps[i].label}`));
    results.push({ case: s.case, ...model });
  });
}

test("rim light: the outermost loaded chunks hold vertical-only sky and no block light; the barrier model was far worse there (Nether: 7,000 to 8,000 cells a chunk against under 200)", () => {
  assert.equal(results.length, 5);
  for (const r of results) for (let i = 0; i < r.base.length; i++) {
    const [label, now] = r.base[i], was = r.native[i][1], d0 = now.get(0), w0 = was.get(0);
    const nether = /nether/.test(r.case);
    assert.ok(d0.sky < 35, `${r.case} ${label}: ${d0.sky.toFixed(1)} sky cells per rim chunk differ`);
    assert.ok(d0.block < (nether ? 250 : 30), `${r.case} ${label}: ${d0.block.toFixed(1)} block cells per rim chunk differ`);
    if (!nether) assert.ok(w0.sky > 2 * d0.sky, `${r.case} ${label}: sky ${w0.sky.toFixed(0)} before, ${d0.sky.toFixed(0)} now`);
  }
  let before = 0, after = 0;
  for (const r of results) for (let i = 0; i < r.base.length; i++) { before += r.native[i][1].get(0).block; after += r.base[i][1].get(0).block; }
  assert.ok(before > 4 * after, `block cells per rim chunk, summed over the snapshots: ${before.toFixed(0)} before, ${after.toFixed(0)} now`);
});

test("rim light: the second ring in is not modelled by position (its emitters depend on when population ran); the model stays at the fixed point there", () => {
  // d1 block light: the rim's own emitters are off, otherwise the barrier model's values; native stays darker in places, as measured.
  for (const r of results) for (let i = 0; i < r.base.length; i++) assert.ok(r.base[i][1].get(1).block <= r.native[i][1].get(1).block + 1e-9, `${r.case} ${r.base[i][0]}`);
});

test("rim light: isRim is a held column with a neighbour that is neither held nor resident; verticalLight follows Chunk.generateSkylightMap", () => {
  const cols = new Map(), ring = { world: {}, height: 256, resident: (x, z) => x >= 100 * 16 && x < 101 * 16 && z >= 0 && z < 16, cols, key };
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) cols.set(key(a, b), { blocks: new Uint8Array(256 * 16), h: 16 });
  assert.equal(isRim(ring, 1, 1), false, "all eight neighbours held");
  assert.equal(isRim(ring, 0, 0), true);
  assert.equal(isRim(ring, 1, 0), true);
  ring.resident = (x, z) => x >= 16 * -1 && x < 0 && z >= 0 && z < 16;
  cols.delete(key(2, 2));
  assert.equal(isRim(ring, 1, 1), true, "a missing diagonal neighbour counts");
  ring.resident = (x, z) => x >= 32 && x < 48 && z >= 32 && z < 48;
  assert.equal(isRim(ring, 1, 1), false, "a resident neighbour counts as loaded");
  // one column: stone at y 5 (opacity 15), a cell of opacity 3 at y 9 and of opacity 1 at y 12, air elsewhere
  const three = OPACITY.findIndex((o) => o === 3), one = OPACITY.findIndex((o, id) => o === 1 && id > 0);
  const blocks = new Uint8Array(256 * 16);
  blocks[5] = 1; blocks[9] = three; blocks[12] = one;
  const lit = verticalLight({ blocks, h: 16 }, false).packed;
  assert.deepEqual([13, 12, 11, 10, 9, 8, 7, 6, 5, 1].map((y) => lit[y] >> 4), [15, 14, 13, 12, 9, 8, 7, 6, 0, 0]);
  assert.ok(lit.slice(0, 16).every((v) => (v & 15) === 0), "no block light");
  assert.ok(verticalLight({ blocks, h: 16 }, true).packed.every((v) => v === 0), "no sky in the Nether and End");
});
