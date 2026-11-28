// Batch 102 mpperf102: ChunkSet numeric fill and kept player rows; results unchanged.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fast102 } from "./mpperf102-fast.js";
import { ChunkSet, ServerChunkSets } from "./multiplayer/server-chunks.js";

const modes = ["off", "on", "verify"];
const withMode = (m, f) => { const old = fast102.mode; fast102.mode = m; try { return f(); } finally { fast102.mode = old; } };

test("ChunkSet.chunks gives the same HashSet order in every mode (moving players, End origin, many players, far coords)", () => {
  const runs = modes.map((m) => withMode(m, () => {
    const out = [];
    for (const [world, n] of [[{ size: 256, originX: 0, originZ: 0 }, 16], [{ size: 256, originX: -128, originZ: -128 }, 3], [{ size: 128, originX: -25, originZ: -96 }, 2], [{ size: 128 }, 1]]) {
      const cs = new ChunkSet(), ps = Array.from({ length: n }, (_, i) => ({ x: i * 13.3, z: i * 7.1 }));
      for (let t = 0; t < 12; t++) { for (const p of ps) { p.x += 5; p.z -= 3; } out.push(JSON.stringify(cs.chunks(ps, world)), cs.capacity, cs.treeBins); }
    }
    const far = new ChunkSet(); out.push(JSON.stringify(far.chunks([{ x: 1e6, z: -1e6 }], { size: 99999999, originX: 1e6, originZ: -1e6 }))); // outside +-4096: string path
    return out;
  }));
  assert.deepEqual(runs[1], runs[0]); assert.deepEqual(runs[2], runs[0]);
});

test("ServerChunkSets refills kept player rows: same answer as fresh rows, fewer players shrinks, dimension filter holds", () => {
  const mk = () => { const players = new Map(); for (let i = 0; i < 4; i++) players.set(i, { dimension: i === 3 ? -1 : 0, position: { x: i * 40, z: i * 9 } }); return { players }; };
  const res = modes.map((m) => withMode(m, () => {
    const sim = mk(), sets = new ServerChunkSets(sim), w = { size: 256 }, out = [];
    out.push(JSON.stringify(sets.chunks(0, w)), JSON.stringify(sets.chunks(-1, w)));
    sim.players.get(1).position.x += 20; out.push(JSON.stringify(sets.chunks(0, w)));
    sim.players.delete(0); out.push(JSON.stringify(sets.chunks(0, w)));
    if (m !== "off") assert.equal(sets.sets.get(0).here102.length, 2);
    return out;
  }));
  assert.deepEqual(res[1], res[0]); assert.deepEqual(res[2], res[0]);
});

test("bench hashes equal across MC_MPPERF102 modes (travel, 50 ticks)", () => {
  const h = modes.map((m) => spawnSync("node", ["tools/bench-alloc81.mjs", "--state", "--scene=travel", "--ticks=50"], { env: { ...process.env, MC_MPPERF102: m }, encoding: "utf8" }).stdout.trim().split("\n").pop().replace(/.*? mobs=\d+ /, ""));
  assert.match(h[0], /^\["[0-9a-f]{16}"\]$/); assert.equal(h[1], h[0]); assert.equal(h[2], h[0]);
});
