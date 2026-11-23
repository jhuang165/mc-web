// Batch 96 mpperf96: Map / Set / array loops without iterators (eachValue96) and the index loops, results unchanged.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fast96, eachValue96 } from "./mpperf96-fast.js";
import { JavaHashSetOrder } from "./java-hashset-order.js";
import { ChunkSet } from "./multiplayer/server-chunks.js";
import { chunkHash } from "./chunk-store.js";

const modes = ["off", "on", "verify"];
const withMode = (m, f) => { const old = fast96.mode; fast96.mode = m; try { return f(); } finally { fast96.mode = old; } };

test("eachValue96 visits like for-of, including adds and deletes during the walk", () => {
  const run = (m, make) => withMode(m, () => { const c = make(), seen = []; eachValue96(c, (v) => {
    seen.push(v);
    if (c instanceof Map) { if (v === 1) { c.delete(2); c.set(9, 9); } if (v === 9 && !c.has(10)) c.set(10, 10); }
    else if (c instanceof Set) { if (v === 1) { c.delete(2); c.add(9); } if (v === 9) c.add(10); }
    else if (v === 1) c.push(9);
  }); return seen; });
  const makers = [() => new Map([[0, 0], [1, 1], [2, 2], [3, 3]]), () => new Set([0, 1, 2, 3]), () => [0, 1, 2, 3]];
  for (const make of makers) {
    const ref = run("off", make);
    assert.ok(ref.length >= 4 && ref.includes(9));
    for (const m of ["on", "verify"]) assert.deepEqual(run(m, make), ref);
  }
  assert.deepEqual(withMode("on", () => { const out = []; eachValue96(new Map([[1, "a"], [2, "b"]]), function (v) { out.push(this.t + v); }, { t: "x" }); return out; }), ["xa", "xb"]);
});

test("index loops equal the reference: hash-set keys, chunk order", () => {
  const set = new JavaHashSetOrder("java8");
  for (let i = 0; i < 200; i++) set.add(`k${i}`, (i * 2654435761) >>> 0);
  const ref = []; for (const bin of set.table) for (const node of bin) ref.push(node.key);
  assert.deepEqual(set.keys(), ref);
  const centres = [[0, 0], [3, -2], [40, 40]], radius = 5;
  const o = new ChunkSet(), got = o.order(centres, radius);
  const s2 = new JavaHashSetOrder(o.mode);
  for (const [cx, cz] of centres) for (let i = -radius; i <= radius; i++) for (let j = -radius; j <= radius; j++) s2.add(`${cx + i},${cz + j}`, chunkHash(cx + i, cz + j));
  const want = s2.keys().map((k) => k.split(",").map(Number));
  assert.equal(got.length, want.length);
  assert.ok(got.length > 100);
  assert.deepEqual(got, want);
});

test("bench hashes are identical off / on / verify and the bench prints mode96", () => {
  const out = {};
  for (const m of modes) out[m] = spawnSync(process.execPath, ["tools/bench-alloc81.mjs", "--scene=pen", "--state", "--ticks=50", "--mobs=20"], { env: { ...process.env, MC_MPPERF96: m }, encoding: "utf8" }).stdout;
  for (const m of modes) assert.match(out[m], new RegExp(`mode96=${m} (mode97=\\w+ )?(mode98=\\w+ )?mobs=\\d+ \\[`));
  const h = (s) => s.slice(s.indexOf("["));
  assert.equal(h(out.on), h(out.off)); assert.equal(h(out.verify), h(out.off));
  const tr = modes.map((m) => spawnSync(process.execPath, ["tools/bench-alloc81.mjs", "--scene=travel", "--state", "--ticks=50"], { env: { ...process.env, MC_MPPERF96: m }, encoding: "utf8" }).stdout);
  assert.equal(h(tr[1]), h(tr[0])); assert.equal(h(tr[2]), h(tr[0]));
});
