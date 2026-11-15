// Batch 74: Chunk.func_150804_b / recheckGaps on both sides, from tools/probes/LightGapsProbe.java (public/research/light-gaps-reference.jsonl).
// ChunkProviderClient.unloadQueuedChunks (bjd.d, run by every WorldClient.tick) calls func_150804_b on every client chunk with isRemote true, so
// recheckGaps handles ONE flagged column a chunk per call; WorldServer runs it with isRemote false (all flagged columns). Executed: in every script
// the pass changed no sky, block or height cell, on either side, and the client only needs more ticks to clear its flags. NativeLight replays that.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NativeLight, SKY, BLOCK } from "./native-light.js";
import { lightOpacity, lightEmission } from "./lighting.js";
import { fromOriginal } from "./block-registry.js";

const rows = readFileSync(new URL("../public/research/light-gaps-reference.jsonl", import.meta.url), "utf8").trim().split("\n").map((l) => JSON.parse(l));
const effect = new Map(rows.filter((r) => r.mode === "effect").map((r) => [r.case, r]));
const OP = new Uint8Array(256), EM = new Uint8Array(256);
for (let b = 0; b < 256; b++) { OP[b] = Math.min(255, lightOpacity(b)); EM[b] = lightEmission(b); }
const OFF = 48, W = 128, H = 256, internal = (mc) => (mc ? fromOriginal(mc, 0).id : 0);

// The probe's world: flat ground over x, z -48..79 (bedrock 0, stone 1..58, dirt 59, grass 60) and an anchor stone at (cx * 16 + 15, 100, cz * 16 + 15)
// for chunks -3..3 and one at (79, 100, 15); chunks -3..3 first, further chunks on request. mode: "server" (isRemote false), "client" (isRemote
// true: one flagged column a chunk per call) or "none" (no tick after the settling).
function world(mode) {
  const ids = new Uint8Array(W * W * H), at = (x, z) => ((x + OFF) * W + z + OFF) * H;
  for (let x = -OFF; x < W - OFF; x++) for (let z = -OFF; z < W - OFF; z++) {
    ids.fill(internal(7), at(x, z), at(x, z) + 1); ids.fill(internal(1), at(x, z) + 1, at(x, z) + 59);
    ids[at(x, z) + 59] = internal(3); ids[at(x, z) + 60] = internal(2);
  }
  for (let cx = -3; cx <= 3; cx++) for (let cz = -3; cz <= 3; cz++) ids[at(cx * 16 + 15, cz * 16 + 15) + 100] = internal(1);
  ids[at(79, 15) + 100] = internal(1);
  const light = new NativeLight({ width: W, height: H, isRemote: true, blockAt: (x, y, z) => ids[(x * W + z) * H + y], opacity: (b) => OP[b], emission: (x, y, z, b) => EM[b] });
  const chunks = [], load = (cx, cz, populated) => { const c = light.generateChunk(cx + 3, cz + 3); chunks.push(c); if (populated) { light.terrainPopulated[c] = 1; light.lightPopulated[c] = 1; } return c; };
  const tick = (m) => { if (m === "none") return; light.isRemote = m === "client"; for (const c of chunks) light.tickChunk(c); light.isRemote = true; };
  for (let cx = -3; cx <= 3; cx++) for (let cz = -3; cz <= 3; cz++) load(cx, cz, false);
  for (const c of chunks) light.terrainPopulated[c] = 1;
  tick("server"); tick("server");
  const edit = (x, y, z, id) => { const i = at(x, z) + y, old = OP[ids[i]]; ids[i] = internal(id); light.setBlock(x + OFF, y, z + OFF, old, ids[i], false); tick(mode); };
  const flagged = () => light.gaps.reduce((a, b) => a + b, 0);
  return { light, edit, flagged, load: (cx, cz) => { load(cx, cz, true); tick(mode); }, tick: () => tick(mode) };
}
const digest = (light) => {
  const out = [];
  for (let x = -OFF; x < W - OFF; x++) for (let z = -OFF; z < W - OFF; z++) for (let y = 0; y < H; y++) { out.push(light.saved(SKY, x + OFF, y, z + OFF), light.saved(BLOCK, x + OFF, y, z + OFF)); }
  return out;
};
const same = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; };
const STEPS = {
  "edge-then-load": () => [[60, 61, 5, 1], [62, 70, 4, 1], [63, 90, 6, 1], [61, 60, 6, 0], [62, 70, 4, 0], [63, 90, 6, 0], [60, 61, 5, 0]],
  "roof-chunk-edge": () => [...Array.from({ length: 36 }, (_, i) => [58 + ((i / 6) | 0), 70, 2 + (i % 6), 1]), ...Array.from({ length: 36 }, (_, i) => [58 + ((i / 6) | 0), 70, 2 + (i % 6), 0])],
};

test("the probe: recheckGaps changes no light cell, server pass, client pass or none (executed, 8 scripts)", () => {
  assert.equal(effect.size, 8, "6 older scripts (flat-pillar, roof-slab, float-stays, float-three, cavern, hillside) and the two edge scripts");
  for (const r of effect.values()) for (const s of r.snaps) for (const k of ["S-N", "S-C", "C-N"]) {
    assert.equal(s[k].sky + s[k].block + s[k].heights, 0, `${r.case} ${s.label} ${k}`);
  }
});

test("the probe: the client pass clears one flagged column a chunk per tick, the server pass all at once", () => {
  const r = effect.get("roof-chunk-edge"), at = (l) => r.snaps.find((s) => s.label === l);
  assert.deepEqual([at("unroof 35").flaggedS, at("unroof 35").flaggedC, at("unroof 35").flaggedN], [36, 36, 36], "recheckGaps waits for the 33 x 33 area round the chunk centre");
  assert.deepEqual([at("chunk 4,1 arrives").flaggedS, at("chunk 4,1 arrives").flaggedC], [0, 35]);
  assert.deepEqual(["after 1 more ticks", "after 3 more ticks", "after 30 more ticks", "after 300 more ticks"].map((l) => at(l).flaggedC), [34, 32, 5, 0]);
  assert.ok(["after 1 more ticks", "after 3 more ticks", "after 300 more ticks"].every((l) => at(l).flaggedS === 0 && at(l).flaggedN === 36), "no pass: the flags stay");
  const e = effect.get("edge-then-load"), l = (n) => e.snaps.find((s) => s.label === n);
  assert.deepEqual([l("remove pillar").flaggedS, l("chunk 4,0 arrives").flaggedS, l("chunk 4,1 arrives").flaggedS, l("chunk 4,1 arrives").flaggedC, l("after 3 more ticks").flaggedC], [4, 4, 0, 3, 0]);
});

for (const name of Object.keys(STEPS)) {
  test(`NativeLight ${name}: server pass, client pass (isRemote) and no pass give the same light, flags clear as in the probe`, () => {
    const rec = effect.get(name), S = world("server"), C = world("client"), N = world("none");
    for (const [x, y, z, id] of STEPS[name]()) { S.edit(x, y, z, id); C.edit(x, y, z, id); N.edit(x, y, z, id); }
    const last = (l) => rec.snaps.find((s) => s.label === l);
    const edits = rec.snaps.findIndex((s) => s.label.startsWith("chunk 4,-1"));
    const end = rec.snaps[edits - 1];
    assert.deepEqual([S.flagged() > 0, C.flagged() > 0, N.flagged() > 0], [true, true, true], "flags set by the removals wait for the missing neighbours");
    assert.deepEqual([S.flagged(), C.flagged(), N.flagged()], [end.flaggedS, end.flaggedC, end.flaggedN], "same flag counts as the executed worlds before the load");
    for (const [cx, cz] of [[4, -1], [4, 0], [4, 1]]) { S.load(cx, cz); C.load(cx, cz); N.load(cx, cz); }
    assert.deepEqual([S.flagged(), C.flagged()], [last("chunk 4,1 arrives").flaggedS, last("chunk 4,1 arrives").flaggedC]);
    const seq = [];
    for (let t = 1; t <= 300; t++) { S.tick(); C.tick(); N.tick(); if (t === 1 || t === 3 || t === 30 || t === 300) seq.push(C.flagged()); }
    assert.deepEqual(seq, ["after 1 more ticks", "after 3 more ticks", "after 30 more ticks", "after 300 more ticks"].map((l) => last(l).flaggedC));
    assert.equal(S.flagged(), 0);
    const a = digest(S.light), b = digest(C.light), c = digest(N.light);
    assert.ok(same(a, b) && same(a, c), "the pass writes no light cell");
  });
}
