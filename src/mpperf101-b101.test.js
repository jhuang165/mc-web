// Batch 101 mpperf101: FineGrid keeps its cell lists between ticks, tickMobs keeps its order arrays; results unchanged.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fast101 } from "./mpperf101-fast.js";
import { FineGrid } from "./push-grid.js";
import { EntityWorld } from "./entities.js";

const modes = ["off", "on", "verify"];
const withMode = (m, f) => { const old = fast101.mode; fast101.mode = m; try { return f(); } finally { fast101.mode = old; } };
const mk = (n, seed) => { let s = seed; const r = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff); return Array.from({ length: n }, () => ({ type: "pig", x: r() * 60, y: 4, z: r() * 60 })); };
const half = (o) => (o.big ? 5 : 0.5);

test("FineGrid over a moving same list: kept cell lists give the same candidates as a fresh grid (incl. big, NaN, far moves)", () => {
  for (const m of modes) withMode(m, () => {
    const list = mk(120, 11); let g = new FineGrid(list, half), steps = 0;
    for (let t = 0; t < 30; t++) {
      for (let i = 0; i < list.length; i++) { const o = list[i]; o.x += (i % 5) * 0.4 - 0.8; o.z += 0.3; if (i === 7 && t === 5) o.big = true; if (i === 9 && t === 6) o.x = NaN; if (i === 9 && t === 8) o.x = 20; if (i === 3 && t === 10) o.z += 300; }
      g = new FineGrid(list, half, g);
      const fresh = withMode("off", () => new FineGrid(list, half));
      for (const o of list.slice(0, 40)) { const b = [o.x - 2, 0, o.z - 2, o.x + 2, 9, o.z + 2], a = g.query(b), f = fresh.query(b); assert.deepEqual(a === null ? null : a.slice(), f === null ? null : f.slice()); steps++; }
    }
    assert.ok(steps > 100);
  });
});

test("on keeps the cell list arrays (same array object per occupied cell), off empties them", () => {
  const list = mk(60, 5), static0 = list.map((o) => ({ ...o }));
  const run = (m) => withMode(m, () => { const g1 = new FineGrid(list, half), c1 = [...g1.cells.values()].filter((c) => c.length); const g2 = new FineGrid(list, half, g1); return c1.every((c) => c.length > 0) && g2.cells === g1.cells && [...g2.cells.values()].some((c) => c.length) ; });
  assert.ok(run("on")); assert.ok(run("verify")); assert.equal(static0.length, 60);
  // after a recycle with off, the retired cell lists were cleared (length 0) before refill; with on a list that gets no change is untouched
  const g1 = withMode("on", () => new FineGrid(list, half)), probe = [...g1.cells.values()].find((c) => c.length), before = probe.slice();
  withMode("on", () => new FineGrid(list, half, g1));
  assert.deepEqual(probe, before);
});

test("withBalls with keep: same order as a fresh call, kept arrays reused, no entity kept in the rows", () => {
  const mkW = () => { const w = Object.create(EntityWorld.prototype); w.entities = []; w.orderSeqs = new Map(); let n = 0; w.orderStamp = () => ++n; w.takeId = () => {}; w.seatRiders = (o) => o; const items = [{ id: 1 }, { id: 2 }, { id: 3 }]; w.walks = new Map([["item", { list: () => items }]]); w._fireballs = { list: [{ id: "b" }] }; return w; };
  const w = mkW(), order = [{ m: 1 }, { m: 2 }];
  for (const m of modes) withMode(m, () => {
    const fresh = mkW().withBalls(order.slice()), a = w.withBalls(order.slice(), true), b = w.withBalls(order.slice(), true);
    assert.deepEqual(a.map((e) => e.id ?? e.m), fresh.map((e) => e.id ?? e.m));
    assert.deepEqual(b.map((e) => e.id ?? e.m), fresh.map((e) => e.id ?? e.m));
    if (m !== "off") { assert.equal(a, b); assert.ok(w.wbRows101.every((r) => r[1] === null)); }
  });
});

test("bench hashes are identical off / on / verify and the bench prints mode101", () => {
  const h = (s) => s.slice(s.indexOf("["));
  for (const scene of [["--scene=pen", "--mobs=20"], ["--scene=travel"]]) {
    const out = modes.map((m) => spawnSync(process.execPath, ["tools/bench-alloc81.mjs", ...scene, "--state", "--ticks=50"], { env: { ...process.env, MC_MPPERF101: m }, encoding: "utf8" }).stdout);
    modes.forEach((m, i) => assert.match(out[i], new RegExp(`mode101=${m} mobs=\\d+ \\[`)));
    assert.equal(h(out[1]), h(out[0])); assert.equal(h(out[2]), h(out[0]));
  }
});
