import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { LightVolume, lightEmission } from "./lighting.js";
import { fromOriginal } from "./block-registry.js";
import { SIZE } from "./world.js";

// Replays public/research/light-engine-reference.json (tools/probes/LightEngineProbe.java: the unchanged World.updateLightByType /
// computeLightValue and Chunk.generateSkylightMap / relightBlock / propagateSkylightOcclusion / recheckGaps over real Chunk and
// ExtendedBlockStorage objects) through the port's LightVolume. Native area: x, z -32..47, port local = native + 48. The port solves the
// fixed point, so it must equal the native result once the chunk tick after an edit has run; the documented differences are pinned below.
const ref = JSON.parse(readFileSync(new URL("../public/research/light-engine-reference.json", import.meta.url)));
const H = 256, OFF = 48, AREA = 48;
const byName = new Map(ref.scenarios.map((s) => [s.case, s]));
const idCache = new Map();
const internal = (mc, meta) => {
  const k = mc * 16 + meta;
  if (!idCache.has(k)) idCache.set(k, mc ? fromOriginal(mc, meta).id : 0);
  return idCache.get(k);
};
const sha = (b) => createHash("sha256").update(b).digest("hex");
const anchor = (x, z) => (x & 15) === 15 && (z & 15) === 15;

function build(s) {
  const data = new Uint8Array(SIZE * SIZE * H), nether = s.case === "nether";
  const put = (x, y, z, b) => { data[((x + OFF) * SIZE + z + OFF) * H + y] = b; };
  for (const [x0, y0, z0, x1, y1, z1, id, meta] of s.fills) {
    const b = internal(id, meta);
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) put(x, y, z, b);
  }
  const world = { height: H, hasNoSky: nether, get: (x, y, z) => (x < 0 || z < 0 || y < 0 || x >= SIZE || z >= SIZE || y >= H ? 0 : data[(x * SIZE + z) * H + y]) };
  const light = new LightVolume(world, (x, y, z, b) => lightEmission(b));
  const edit = ([x, y, z, id, meta]) => { put(x, y, z, internal(id, meta)); light.update(x + OFF, y, z + OFF); };
  return { light, edit, nether };
}
// Same layout as the probe: x-major, z, y; anchor columns zero-filled; heights as big-endian shorts.
function digests(light) {
  const sky = Buffer.alloc(AREA * AREA * H), block = Buffer.alloc(AREA * AREA * H), heights = Buffer.alloc(AREA * AREA * 2);
  let k = 0, j = 0;
  for (let x = -16; x < 32; x++) for (let z = -16; z < 32; z++) {
    if (anchor(x, z)) { k += H; j += 2; continue; }
    const base = ((x + OFF) * SIZE + z + OFF) * H;
    sky.set(light.sky.subarray(base, base + H), k);
    block.set(light.block.subarray(base, base + H), k);
    k += H;
    const hv = light.heights[(x + OFF) * SIZE + z + OFF];
    heights[j++] = hv >> 8; heights[j++] = hv & 255;
  }
  return { sky: sha(sky), block: sha(block), heights: sha(heights) };
}
// Cells of the snapshot's region (x, z, y order) whose value differs from the port, skipping anchor columns.
function regionDiffs(light, region, channel) {
  const [x0, y0, z0, x1, y1, z1] = region.box, nat = region[channel], arr = light[channel], out = [];
  let k = 0;
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++, k++) {
    if (anchor(x, z)) continue;
    const p = arr[((x + OFF) * SIZE + z + OFF) * H + y], n = parseInt(nat[k], 16);
    if (p !== n) out.push({ x, y, z, native: n, port: p });
  }
  return out;
}
function checkSnap(light, snap, label, { heights = true, sky = true, block = true } = {}) {
  const d = digests(light);
  if (sky) assert.equal(d.sky, snap.sky, `${label} sky`);
  if (block) assert.equal(d.block, snap.block, `${label} block`);
  if (heights) assert.equal(d.heights, snap.heights, `${label} heightMap`);
  if (snap.region) {
    if (sky) assert.deepEqual(regionDiffs(light, snap.region, "sky"), [], `${label} sky region`);
    if (block) assert.deepEqual(regionDiffs(light, snap.region, "block"), [], `${label} block region`);
  }
}

// Scenarios whose every snapshot after "generated" matches: the settled state is the fixed point because the fills are flat ground and
// every light source/occluder is placed by a step.
const EXACT = ["torch", "emitters", "cave-torch", "shaft", "roof", "opacity-columns", "water-basin", "overhang-cave", "chunk-boundary", "stress-201", "stress-202", "stress-203"];
for (const name of EXACT) {
  test(`light engine: ${name} matches native sky/block light and heightMap after every edit`, () => {
    const s = byName.get(name), { light, edit } = build(s);
    checkSnap(light, s.snaps[1], "settled");
    s.steps.forEach((step, i) => {
      edit(step);
      checkSnap(light, s.snaps[i + 2], `step ${i} ${JSON.stringify(step)}`);
    });
  });
}

test("light engine: on flat ground a fresh chunk's generateSkylightMap equals the port's fixed point", () => {
  for (const name of ["torch", "shaft", "roof", "chunk-boundary"]) {
    const s = byName.get(name), { light } = build(s);
    checkSnap(light, s.snaps[0], `${name} generated`, { sky: true, block: true, heights: true });
  }
});

test("light engine: the Nether (no sky) matches native block light; the port keeps height 256 where the native heightMap holds the real top", () => {
  const s = byName.get("nether"), { light, edit } = build(s);
  checkSnap(light, s.snaps[1], "settled", { heights: false });
  s.steps.forEach((step, i) => {
    edit(step);
    checkSnap(light, s.snaps[i + 2], `step ${i}`, { heights: false });
  });
  assert.ok(light.sky.every((v) => v === 0), "no sky light anywhere");
  assert.notEqual(digests(light).heights, s.snaps[s.snaps.length - 1].heights);
});

// --- documented differences ---

test("documented difference: a floating opaque block placed into an empty section leaves stale light under it natively; the port relights (14)", () => {
  const s = byName.get("null-section"), { light, edit } = build(s);
  edit(s.steps[0]); // glowstone (opaque) at (8, 64, 8): section 4 did not exist, so Chunk.func_150807_a ran generateSkylightMap
  const snap = s.snaps[2], diffs = regionDiffs(light, snap.region, "sky");
  assert.deepEqual(diffs, [61, 62, 63].map((y) => ({ x: 8, y, z: 8, native: 15, port: 14 })));
  assert.equal(digests(light).heights, snap.heights, "the heightMap itself agrees");
  // The next edits recompute those cells (native too) and everything matches again.
  s.steps.slice(1).forEach((step, i) => {
    edit(step);
    checkSnap(light, s.snaps[i + 3], `null-section step ${i + 1}`);
  });
});

test("documented difference: native skips a light update when a chunk within 17 blocks is unloaded; the port always updates", () => {
  const s = byName.get("loaded-edge"), { light, edit } = build(s);
  edit(s.steps[0]); // torch at x -14: chunks -2..2 loaded, within range
  checkSnap(light, s.snaps[2], "torch at -14");
  edit(s.steps[1]); // torch at x -20: chunk -3 (x -48..-33) is within 17 blocks and not loaded
  assert.equal(s.snaps[3].region.block, s.snaps[2].region.block, "native light array unchanged by the skipped update");
  const diffs = regionDiffs(light, s.snaps[3].region, "block");
  assert.ok(diffs.length > 100 && diffs.every((d) => d.native === 0 || d.port > d.native), "the port lights the torch's surroundings");
  assert.ok(light.blockAt(-20 + OFF, 61, 8 + OFF) === 14 && light.blockAt(-25 + OFF, 61, 8 + OFF) === 9);
});

test("documented difference: native lights a generated chunk only vertically (lateral light and emitters wait for ticks and updates); the port propagates at once", () => {
  for (const name of ["terrain-101", "terrain-102", "terrain-103"]) {
    const s = byName.get(name), { light } = build(s);
    assert.equal(digests(light).heights, s.snaps[0].heights, `${name}: heightMap agrees`);
    for (const snap of [s.snaps[0], s.snaps[1]]) {
      const diffs = regionDiffs(light, snap.region, "sky");
      assert.ok(diffs.length > 0, `${name} ${snap.label}: native leaves some cells dark`);
      assert.ok(diffs.every((d) => d.port > d.native), `${name} ${snap.label}: the port is never darker than native`);
    }
  }
  // Emitters set by generation are lit by the port (fixed point) but have no block light natively until something updates them.
  const s = byName.get("terrain-101"), { light } = build(s);
  assert.notEqual(digests(light).block, s.snaps[1].block);
});
