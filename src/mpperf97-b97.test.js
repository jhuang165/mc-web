// Batch 97 mpperf97: the tick packet's item and player lists without closures, and the move scratch list that keeps its backing store; results unchanged.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fast97, resetList97 } from "./mpperf97-fast.js";
import { takeMoveScratch, releaseMoveScratch } from "./mpperf81-fast.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { buildPlayersScene } from "./mpperf77-scene.js";

const modes = ["off", "on", "verify"];
const withMode = (m, f) => { const old = fast97.mode; fast97.mode = m; try { return f(); } finally { fast97.mode = old; } };

test("itemList is the same list off / on / verify and builds it without filter or map", () => {
  const items = [0, 1, 2, 3, 4].map((k) => ({ eid: 100 + k, stack: { id: 1, count: k }, x: k, y: 2, z: 3, age: k, hover: 0.5, delay: 10, mx: 0, my: 0, mz: 0, dead: k === 2, fire: k === 3 ? 5 : 0, velocityChanged: k === 4 }));
  const sim = Object.assign(Object.create(DedicatedSimulation.prototype), { items: { items } });
  const want = withMode("off", () => sim.itemList());
  assert.equal(want.length, 4);
  for (const m of ["on", "verify"]) assert.deepEqual(withMode(m, () => sim.itemList()), want);
  const { filter, map } = Array.prototype; let calls = 0;
  Array.prototype.filter = function (...a) { calls++; return filter.apply(this, a); };
  Array.prototype.map = function (...a) { calls++; return map.apply(this, a); };
  try { withMode("on", () => sim.itemList()); } finally { Array.prototype.filter = filter; Array.prototype.map = map; }
  assert.equal(calls, 0);
});

test("presence is the same list off / on / verify, per dimension, in player order", () => {
  const s = buildPlayersScene({ players: 5, mobs: 10, seed: 3 });
  const ps = [...s.players.values()]; ps[1].dimension = -1; ps[3].dimension = -1; ps[2].swing = 3; ps[4].dead = true;
  for (const dim of [0, -1]) {
    const want = withMode("off", () => s.presence(dim));
    assert.equal(want.length, dim === 0 ? 3 : 2);
    for (const m of ["on", "verify"]) assert.deepEqual(withMode(m, () => s.presence(dim)), want);
    assert.deepEqual(want.map((p) => p.id), ps.filter((p) => (p.dimension | 0) === dim).map((p) => p.id));
  }
});

test("the move scratch list is empty after a reset in every mode and keeps working", () => {
  for (const m of modes) withMode(m, () => {
    const s = takeMoveScratch();
    if (!s) return; // MC_MPPERF81=off: no scratch
    for (const n of [3, 0, 40, 5]) { for (let i = 0; i < n; i++) s.list.push([i]); assert.equal(s.list.length, n); resetList97(s); assert.equal(s.list.length, 0); }
    s.list.push([1]); releaseMoveScratch(s); assert.equal(s.list.length, 0);
  });
});

test("bench hashes are identical off / on / verify and the bench prints mode97", () => {
  const out = {};
  for (const m of modes) out[m] = spawnSync(process.execPath, ["tools/bench-alloc81.mjs", "--scene=pen", "--state", "--ticks=50", "--mobs=20"], { env: { ...process.env, MC_MPPERF97: m }, encoding: "utf8" }).stdout;
  for (const m of modes) assert.match(out[m], new RegExp(`mode97=${m} mobs=\\d+ \\[`));
  const h = (s) => s.slice(s.indexOf("["));
  assert.equal(h(out.on), h(out.off)); assert.equal(h(out.verify), h(out.off));
  const tr = modes.map((m) => spawnSync(process.execPath, ["tools/bench-alloc81.mjs", "--scene=travel", "--state", "--ticks=50"], { env: { ...process.env, MC_MPPERF97: m }, encoding: "utf8" }).stdout);
  assert.equal(h(tr[1]), h(tr[0])); assert.equal(h(tr[2]), h(tr[0]));
});
