import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { NativeLight, SKY, BLOCK } from "./native-light.js";
import { lightOpacity, lightEmission } from "./lighting.js";
import { fromOriginal } from "./block-registry.js";
import { lightBrightnessTable } from "./dimensions.js";

// Replays public/research/light-engine3-reference.json (tools/probes/LightEngine3Probe.java: chunks -3..3 loaded, the unchanged
// World/Chunk light code, real WorldProviderSurface/Hell/End objects) through NativeLight, and then replays the ring scenarios the way
// the streamed window runs them: the outer ring chunks are not resident (NativeLight.loaded 0), edits there are deferred, edits near
// them are refused by the 17-block test and recorded, and when the ring chunks become resident replayDeferred() must reproduce the
// native all-loaded result. That residency replay is a port model, not native behaviour; the all-loaded results are the native ones.
const ref = JSON.parse(readFileSync(new URL("../public/research/light-engine3-reference.json", import.meta.url)));
const R = 3, OFF = 48, W = 112, H = 256, LO = -48, HI = 64, NC = 7;
const idCache = new Map();
const internal = (mc, meta) => {
  const k = mc * 16 + meta;
  if (!idCache.has(k)) idCache.set(k, mc ? fromOriginal(mc, meta).id : 0);
  return idCache.get(k);
};
const OP = new Uint8Array(256), EM = new Uint8Array(256);
for (let b = 0; b < 256; b++) { OP[b] = Math.min(255, lightOpacity(b)); EM[b] = lightEmission(b); }
const sha = (b) => createHash("sha256").update(b).digest("hex");
const byCase = new Map(ref.scenarios.map((s) => [s.case, s]));

function spiral() {
  const out = [[0, 0]];
  for (let ring = 1; ring <= R; ring++) for (let cx = -ring; cx <= ring; cx++) for (let cz = -ring; cz <= ring; cz++) if (Math.max(Math.abs(cx), Math.abs(cz)) === ring) out.push([cx, cz]);
  return out;
}
function digests(light) {
  const n = (HI - LO) * (HI - LO), sky = Buffer.alloc(n * H), block = Buffer.alloc(n * H), heights = Buffer.alloc(n * 2);
  let k = 0, j = 0;
  for (let x = LO + OFF; x < HI + OFF; x++) for (let z = LO + OFF; z < HI + OFF; z++) {
    for (let y = 0; y < H; y++, k++) { sky[k] = light.saved(SKY, x, y, z); block[k] = light.saved(BLOCK, x, y, z); }
    const hv = light.heightValue(x, z);
    heights[j++] = hv >> 8; heights[j++] = hv & 255;
  }
  return { sky: sha(sky), block: sha(block), heights: sha(heights) };
}
const ringChunk = (c) => { const cx = (c / NC) | 0, cz = c % NC; return cx === 0 || cz === 0 || cx === NC - 1 || cz === NC - 1; };

// ring: null (everything resident, the native case) or "defer" (see above).
export function replay3(s, { ring = null, options = {}, replay = true } = {}) {
  const ids = new Uint8Array(W * W * H), at = (x, z) => ((x + OFF) * W + z + OFF) * H;
  for (const [x0, y0, z0, x1, y1, z1, id, meta] of s.fills) {
    const b = internal(id, meta);
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) ids[at(x, z) + y] = b;
  }
  const light = new NativeLight({ width: W, height: H, hasNoSky: s.provider.g, isRemote: true, blockAt: (x, y, z) => ids[(x * W + z) * H + y], opacity: (b) => OP[b], emission: (x, y, z, b) => EM[b], ...options });
  const order = [], snaps = [];
  let deferring = false;
  const set = (x, y, z, id, meta) => {
    const i = at(x, z) + y, oldOp = OP[ids[i]], nid = internal(id, meta);
    ids[i] = nid;
    if (light.chunkAt(x + OFF, z + OFF) < 0) { if (deferring) light.defer(x + OFF, y, z + OFF, oldOp, nid); return; }
    light.setBlock(x + OFF, y, z + OFF, oldOp, nid, false);
  };
  const tick = () => {
    light.isRemote = false;
    for (const c of order) { if (light.loaded[c]) { light.enqueueRelightChecks(c); light.tickChunk(c); } }
    light.isRemote = true;
  };
  let settled = false;
  for (const op of s.ops) {
    const [name, a, b] = op;
    if (name === "gen" || name === "load") { order.push(light.generateChunk(a + R, b + R)); if (name === "load") light.populateChunk(a + R, b + R); }
    else if (name === "terrain") for (const c of order) light.terrainPopulated[c] = 1;
    else if (name === "tick") tick();
    else if (name === "reset") for (const c of order) light.resetRelightChecks(c);
    else if (name === "set") set(...op.slice(1));
    else if (name === "snap") {
      if (ring && !settled) { // the scenario's first snapshot is the settled square: from here on the ring is not resident
        settled = true;
        for (const c of order) if (ringChunk(c)) light.loaded[c] = 0;
        deferring = true;
      }
      if (!ring) snaps.push({ label: a, ...digests(light) });
    } else if (name !== "queue") throw new Error(name);
  }
  if (ring) { // the ring becomes resident: replay what was refused, then the chunks tick as usual
    const before = digests(light);
    for (const c of order) light.loaded[c] = 1;
    if (replay) light.replayDeferred();
    tick();
    return { light, before, after: digests(light) };
  }
  return { light, snaps };
}

for (const s of ref.scenarios) {
  test(`native light: ${s.case} matches LightEngine3Probe at every snapshot`, () => {
    const { snaps } = replay3(s);
    assert.equal(snaps.length, s.snaps.length);
    snaps.forEach((p, i) => assert.deepEqual(p, s.snaps[i], `${s.case} ${s.snaps[i].label}`));
  });
}

const last = (s) => { const { label, ...d } = s.snaps[s.snaps.length - 1]; return d; };
const cells = (a, b) => { // differing cells between two replays, per channel
  let sky = 0, block = 0;
  for (let x = 0; x < W; x++) for (let z = 0; z < W; z++) for (let y = 0; y < H; y++) {
    if (a.saved(SKY, x, y, z) !== b.saved(SKY, x, y, z)) sky++;
    if (a.saved(BLOCK, x, y, z) !== b.saved(BLOCK, x, y, z)) block++;
  }
  return { sky, block };
};
const nativeFinal = (s) => replay3({ ...s, ops: s.ops.filter((o) => o[0] !== "snap") }).light;
// Exact: place-only edits, the plugged and reopened cavern holes, and the opposite ring.
for (const name of ["ring-lights", "ring-negative", "ring-holes"]) {
  test(`ring residency: ${name} edits made while the ring is not resident match the native result once it is`, () => {
    const s = byCase.get(name);
    const r = replay3(s, { ring: "defer", options: { replaySkipped: true } }), stale = replay3(s, { ring: "defer", replay: false });
    assert.ok(r.light.stats.skipped > 0 && r.light.stats.replayed > 0, "the scenario exercises the residency replay");
    assert.deepEqual(r.after, last(s), `${name} after replay`);
    if (name !== "ring-holes") assert.notDeepEqual(stale.after, last(s), "without the replay the light stays stale"); // the holes end where they started
  });
}
// Nether and End: block light and heights match exactly. The sky nibble of a missing section above the heightMap is native 15 until a
// block-light write creates that section (zero sky); a refused relight check writes nothing, so those cells stay 15 (invisible: above ceilings).
for (const name of ["nether-ring", "end-ring"]) {
  test(`ring residency: ${name} block light and heights match native; only the sky nibble of never-written sections differs`, () => {
    const s = byCase.get(name), r = replay3(s, { ring: "defer", options: { replaySkipped: true } }), stale = replay3(s, { ring: "defer", replay: false });
    const { sky, ...want } = last(s);
    assert.equal(r.after.block, want.block); assert.equal(r.after.heights, want.heights);
    assert.notEqual(stale.after.block, want.block, "without the replay the block light stays stale");
    assert.ok(r.light.stats.skipped + r.light.stats.replayed > 0);
  });
}
// Approximate: place-and-remove pairs while the ring is not resident. The refused removal passes never ran, so the replay re-lights from a
// different intermediate state; the replay still lands far closer to native than leaving the light stale.
test("ring residency: ring-overworld place-and-remove pairs are approximate and much closer to native than no replay", () => {
  const s = byCase.get("ring-overworld"), nat = nativeFinal(s);
  const r = replay3(s, { ring: "defer", options: { replaySkipped: true } }), stale = replay3(s, { ring: "defer", replay: false });
  const near = cells(r.light, nat), far = cells(stale.light, nat);
  assert.equal(near.block, 0, `block cells ${near.block}`);
  assert.ok(near.sky + near.block <= far.sky + far.block, `${near.sky + near.block} vs ${far.sky + far.block}`);
  assert.ok(near.sky < 8000, `sky cells ${near.sky}`);
});

test("native providers: Nether and End are hasNoSky (aqo.g); sky reads 0 in existing sections and 15 above the heightMap of missing ones; lightBrightnessTable matches", () => {
  for (const [name, id, h] of [["nether-edits", -1, 128], ["end-edits", 1, 128], ["ring-overworld", 0, 256]]) {
    const p = byCase.get(name).provider;
    assert.equal(p.g, name !== "ring-overworld"); assert.equal(p.dimensionId, id); assert.equal(p.actualHeight, h);
  }
  assert.equal(byCase.get("nether-edits").provider.f, true); // isHellWorld; the End has f false
  assert.equal(byCase.get("end-edits").provider.f, false);
  for (const name of ["nether-edits", "end-edits"]) {
    const { light } = replay3(byCase.get(name)), samples = byCase.get(name).provider.skySamples;
    assert.ok(samples.length > 40 && samples.some((s) => s[3] === 0) && samples.some((s) => s[3] === 15));
    for (const [x, y, z, v, h] of samples) {
      assert.equal(light.saved(SKY, x + OFF, y, z + OFF), v, `${name} sky ${x},${y},${z}`);
      assert.equal(light.heightValue(x + OFF, z + OFF), h, `${name} height ${x},${z}`);
    }
  }
  const bits = (ambient) => Array.from(lightBrightnessTable(ambient), (v) => new Uint32Array(new Float32Array([v]).buffer)[0]);
  assert.deepEqual(bits(0), byCase.get("ring-overworld").provider.brightnessBits);
  assert.deepEqual(bits(0.1), byCase.get("nether-edits").provider.brightnessBits);
});
