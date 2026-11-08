import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { NativeLight, SKY, BLOCK } from "./native-light.js";
import { lightOpacity, lightEmission } from "./lighting.js";
import { fromOriginal } from "./block-registry.js";

// Replays every snapshot of public/research/light-engine-reference.json (LightEngineProbe: chunks -2..2 generated with
// generateSkylightMap, "settled" = isTerrainPopulated plus two chunk ticks, then World.setBlock + one chunk tick per step) through
// NativeLight, including the four cases the fixed-point LightVolume documents as differences (null-section, loaded-edge, the fresh
// terrain chunks and the Nether heightMap). Chunk ticks run in the probe's HashMap<Long, Chunk> iteration order.
const ref = JSON.parse(readFileSync(new URL("../public/research/light-engine-reference.json", import.meta.url)));
const OFF = 32, W = 80, H = 256, LO = -16, HI = 32;
const idCache = new Map();
const internal = (mc, meta) => {
  const k = mc * 16 + meta;
  if (!idCache.has(k)) idCache.set(k, mc ? fromOriginal(mc, meta).id : 0);
  return idCache.get(k);
};
const OP = new Uint8Array(256), EM = new Uint8Array(256);
for (let b = 0; b < 256; b++) { OP[b] = Math.min(255, lightOpacity(b)); EM[b] = lightEmission(b); }
const sha = (b) => createHash("sha256").update(b).digest("hex");
const anchor = (x, z) => (x & 15) === 15 && (z & 15) === 15;

// java.util.HashMap iteration over Long keys ChunkCoordIntPair.chunkXZ2Int(x, z) inserted x-major, z inner: Long.hashCode is
// x ^ z, HashMap.hash spreads h ^ (h >>> 16), 25 entries resize the table to 64 buckets, and a bucket keeps insertion order.
export function hashMapOrder(keys, buckets) {
  const spread = (h) => (h ^ (h >>> 16)) & (buckets - 1);
  return keys.map((k, i) => ({ k, i, b: spread(k[0] ^ k[1]) })).sort((a, b) => a.b - b.b || a.i - b.i).map((e) => e.k);
}
const ORDER = hashMapOrder(Array.from({ length: 25 }, (_, i) => [((i / 5) | 0) - 2, (i % 5) - 2]), 64);

function build(s) {
  const ids = new Uint8Array(W * W * H), mc = new Uint16Array(W * W * H), nether = s.case === "nether";
  const at = (x, z) => ((x + OFF) * W + z + OFF) * H;
  for (const [x0, y0, z0, x1, y1, z1, id, meta] of s.fills) { // clipped to the loaded square, as the probe fills each chunk
    const b = internal(id, meta);
    for (let x = Math.max(x0, -OFF); x <= Math.min(x1, W - OFF - 1); x++) for (let z = Math.max(z0, -OFF); z <= Math.min(z1, W - OFF - 1); z++)
      for (let y = y0; y <= y1; y++) { ids[at(x, z) + y] = b; mc[at(x, z) + y] = id * 16 + meta; }
  }
  const light = new NativeLight({ width: W, height: H, hasNoSky: nether, isRemote: true, blockAt: (x, y, z) => ids[(x * W + z) * H + y], opacity: (b) => OP[b], emission: (x, y, z, b) => EM[b] });
  for (const [cx, cz] of ORDER) light.generateChunk(cx + 2, cz + 2);
  const tick = () => {
    light.isRemote = false;
    for (const [cx, cz] of ORDER) light.tickChunk(light.chunkIndex(cx + 2, cz + 2));
    light.isRemote = true;
  };
  const settle = () => { light.terrainPopulated.fill(1); tick(); tick(); };
  const edit = ([x, y, z, id, meta]) => {
    const i = at(x, z) + y, oldOp = OP[ids[i]], same = mc[i] === id * 16 + meta;
    ids[i] = internal(id, meta); mc[i] = id * 16 + meta;
    const changed = light.setBlock(x + OFF, y, z + OFF, oldOp, ids[i], same);
    tick();
    return changed;
  };
  return { light, settle, edit };
}
function digests(light) {
  const n = (HI - LO) * (HI - LO), sky = Buffer.alloc(n * H), block = Buffer.alloc(n * H), heights = Buffer.alloc(n * 2);
  let k = 0, j = 0;
  for (let x = LO; x < HI; x++) for (let z = LO; z < HI; z++) {
    if (anchor(x, z)) { k += H; j += 2; continue; }
    for (let y = 0; y < H; y++, k++) { sky[k] = light.saved(SKY, x + OFF, y, z + OFF); block[k] = light.saved(BLOCK, x + OFF, y, z + OFF); }
    const hv = light.heights[(x + OFF) * W + z + OFF];
    heights[j++] = hv >> 8; heights[j++] = hv & 255;
  }
  return { sky: sha(sky), block: sha(block), heights: sha(heights) };
}
function regionDiffs(light, region, channel) {
  const [x0, y0, z0, x1, y1, z1] = region.box, nat = region[channel], out = [], type = channel === "sky" ? SKY : BLOCK;
  let k = 0;
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++, k++) {
    const p = light.saved(type, x + OFF, y, z + OFF), v = parseInt(nat[k], 16);
    if (p !== v) out.push({ x, y, z, native: v, port: p });
  }
  return out;
}
function check(light, snap, label) {
  if (snap.region) {
    assert.deepEqual(regionDiffs(light, snap.region, "sky").slice(0, 8), [], `${label} sky region`);
    assert.deepEqual(regionDiffs(light, snap.region, "block").slice(0, 8), [], `${label} block region`);
  }
  assert.deepEqual(digests(light), { sky: snap.sky, block: snap.block, heights: snap.heights }, label);
}

test("native light: the probe's chunk tick order is java.util.HashMap order over the chunk keys", () => {
  assert.equal(ORDER.length, 25);
  // bucket 0 holds x ^ z == 0 and x ^ z == -1 (-1 ^ 0xffff has no low bits), in insertion order
  assert.deepEqual(ORDER.slice(0, 9), [[-2, -2], [-2, 1], [-1, -1], [-1, 0], [0, -1], [0, 0], [1, -2], [1, 1], [2, 2]]);
});

for (const s of ref.scenarios) {
  test(`native light: ${s.case} matches LightEngineProbe at every snapshot (generated, settled, every edit)`, () => {
    const { light, settle, edit } = build(s);
    check(light, s.snaps[0], "generated");
    settle();
    check(light, s.snaps[1], "settled");
    s.steps.forEach((step, i) => {
      const ok = edit(step);
      assert.equal(ok, !s.snaps[i + 2].label.endsWith("-unchanged"), `step ${i} result`);
      check(light, s.snaps[i + 2], `step ${i} ${JSON.stringify(step)}`);
    });
  });
}

// --- light-engine2-reference.json (LightEngine2Probe): scripted chunk loading, population, ticks and edits ---
const ref2 = JSON.parse(readFileSync(new URL("../public/research/light-engine2-reference.json", import.meta.url)));
const byCase2 = new Map(ref2.scenarios.map((s) => [s.case, s]));
const LO2 = -32, HI2 = 48;
export function replay(s, options = {}) {
  const ids = new Uint8Array(W * W * H), mc = new Uint16Array(W * W * H), at = (x, z) => ((x + OFF) * W + z + OFF) * H;
  for (const [x0, y0, z0, x1, y1, z1, id, meta] of s.fills) { // clipped to the loaded square, as the probe fills each chunk
    const b = internal(id, meta);
    for (let x = Math.max(x0, -OFF); x <= Math.min(x1, W - OFF - 1); x++) for (let z = Math.max(z0, -OFF); z <= Math.min(z1, W - OFF - 1); z++)
      for (let y = y0; y <= y1; y++) { ids[at(x, z) + y] = b; mc[at(x, z) + y] = id * 16 + meta; }
  }
  const decorations = new Map();
  for (const d of s.decorations) {
    const k = `${(d[0] - 8) >> 4},${(d[2] - 8) >> 4}`;
    if (!decorations.has(k)) decorations.set(k, []);
    decorations.get(k).push(d);
  }
  const light = new NativeLight({ width: W, height: H, isRemote: true, blockAt: (x, y, z) => ids[(x * W + z) * H + y], opacity: (b) => OP[b], emission: (x, y, z, b) => EM[b], ...options });
  const order = [], snaps = [];
  const set = (x, y, z, id, meta) => {
    if (light.chunkAt(x + OFF, z + OFF) < 0) { light.updateAll(x + OFF, y, z + OFF); return; } // EmptyChunk drops the block
    const i = at(x, z) + y, oldOp = OP[ids[i]], same = mc[i] === id * 16 + meta;
    ids[i] = internal(id, meta); mc[i] = id * 16 + meta;
    light.setBlock(x + OFF, y, z + OFF, oldOp, ids[i], same);
  };
  const decorate = (cx, cz) => { for (const d of decorations.get(`${cx - 2},${cz - 2}`) ?? []) set(...d); };
  for (const op of s.ops) {
    const [name, a, b] = op;
    if (name === "queue") light.queue = new Int32Array(a);
    else if (name === "gen" || name === "load") {
      order.push(light.generateChunk(a + 2, b + 2));
      if (name === "load") light.populateChunk(a + 2, b + 2, decorate);
    } else if (name === "terrain") for (const c of order) light.terrainPopulated[c] = 1;
    else if (name === "tick") {
      light.isRemote = false;
      for (const c of order) { light.enqueueRelightChecks(c); light.tickChunk(c); }
      light.isRemote = true;
    } else if (name === "reset") for (const c of order) light.resetRelightChecks(c);
    else if (name === "set") set(...op.slice(1));
    else if (name === "snap") snaps.push({ label: a, ...digests2(light) });
    else throw new Error(name);
  }
  return { light, snaps };
}
function digests2(light) {
  const n = (HI2 - LO2) * (HI2 - LO2), sky = Buffer.alloc(n * H), block = Buffer.alloc(n * H), heights = Buffer.alloc(n * 2);
  let k = 0, j = 0;
  for (let x = LO2 + OFF; x < HI2 + OFF; x++) for (let z = LO2 + OFF; z < HI2 + OFF; z++) {
    for (let y = 0; y < H; y++, k++) { sky[k] = light.saved(SKY, x, y, z); block[k] = light.saved(BLOCK, x, y, z); }
    const hv = light.heightValue(x, z);
    heights[j++] = hv >> 8; heights[j++] = hv & 255;
  }
  return { sky: sha(sky), block: sha(block), heights: sha(heights) };
}

for (const s of ref2.scenarios) {
  test(`native light: ${s.case} matches LightEngine2Probe at every snapshot`, () => {
    const { snaps } = replay(s);
    assert.equal(snaps.length, s.snaps.length);
    snaps.forEach((p, i) => assert.deepEqual(p, s.snaps[i], `${s.case} ${s.snaps[i].label}`));
  });
}

const upto = (s, label, options) => {
  const i = s.ops.findIndex((o) => o[0] === "snap" && o[1] === label);
  return replay({ ...s, ops: s.ops.slice(0, i + 1) }, options).light;
};
const differ = (a, b) => a.filter((s, i) => s.sky !== b[i].sky || s.block !== b[i].block).length;

test("native light: the 32768-entry queue does not overflow on the cavern edits; 4096 and 1024 entries do and change the light", () => {
  const full = replay(byCase2.get("queue-32768")), short = [4096, 1024].map((n) => replay(byCase2.get(`queue-${n}`)));
  assert.equal(full.light.queue.length, 32768);
  assert.equal(full.light.stats.overflow, 0);
  assert.ok(full.light.stats.peak > 16000, `peak ${full.light.stats.peak}`);
  for (const r of short) {
    assert.ok(r.light.stats.overflow > 0);
    assert.ok(differ(full.snaps, r.snaps) > 10);
  }
});

test("native light: the 17-block cutoff is exercised: a longer reach would change the cavern snapshots", () => {
  const s = byCase2.get("queue-32768");
  assert.ok(differ(replay(s).snaps, replay(s, { reach: 30 }).snaps) > 0);
});

test("native light: next to an unloaded chunk the update is skipped (doChunksNearChunkExist 17)", () => {
  const s = byCase2.get("unloaded-edge"), at = (l) => s.snaps.find((p) => p.label === l);
  assert.deepEqual({ ...at("edge 8"), label: "" }, { ...at("settled"), label: "" }, "torch at x 8: chunk x 16..31 is not loaded");
  assert.equal(at("edge 14").block, at("edge 8").block, "glowstone at x 14: no block light");
  assert.notEqual(at("torch again").block, at("clear -12").block, "the same torch lights once the chunk column has loaded");
});

test("native light: a block set into a missing section below the heightMap darkens the section; server ticks keep it, relight checks heal it", () => {
  const s = byCase2.get("null-sections"), sky = (L, x, y, z) => L.saved(SKY, x + OFF, y, z + OFF);
  const floating = upto(s, "floating"), dark = upto(s, "ticks"), healing = upto(s, "checks 32"), healed = upto(s, "checks 512");
  assert.equal(sky(floating, 12, 62, 12), 15, "stale 15 under the floating block (generateSkylightMap stops at it)");
  assert.equal(sky(floating, 12, 90, 12), 0, "the missing section under it reads 0");
  assert.equal(sky(dark, 14, 95, 14), 0, "open air in the new section 5 has no sky light");
  assert.equal(sky(dark, 2, 84, 5), 0);
  assert.equal(sky(healing, 2, 84, 5), 15, "enqueueRelightChecks visits section 5 of a column every second tick");
  assert.equal(sky(healing, 14, 95, 14), 0);
  assert.equal(sky(healed, 14, 95, 14), 15);
  assert.equal(sky(healed, 12, 62, 12), 14);
});
