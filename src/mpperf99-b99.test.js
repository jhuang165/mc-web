// Batch 99 mpperf99: spawner player list only when read, chunk set unchanged-input fast path, deliverSounds list per call; results unchanged.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fast99 } from "./mpperf99-fast.js";
import { ChunkSet } from "./multiplayer/server-chunks.js";
import { tickSpawners } from "./multiplayer/server-spawners.js";
import { buildPlayersScene, drain } from "./mpperf77-scene.js";

const modes = ["off", "on", "verify"];
const withMode = (m, f) => { const old = fast99.mode; fast99.mode = m; try { return f(); } finally { fast99.mode = old; } };

test("tickSpawners reads a player-list function only past its early return", () => {
  let calls = 0;
  const fn = () => { calls++; return [{ position: { x: 1, y: 2, z: 3 } }]; };
  assert.deepEqual(tickSpawners({ mobs: null, spawners: new Map(), random: null, players: fn, light: {}, vehicles: null }), []);
  assert.equal(calls, 0);
  assert.deepEqual(tickSpawners({ mobs: null, spawners: new Map(), random: null, players: [], light: {}, vehicles: null }), []);
});

test("the live tick builds the spawner player list 0 times without spawners (off: every tick), same state", () => {
  const run = (m) => withMode(m, () => {
    const s = buildPlayersScene({ players: 3, mobs: 0, seed: 3 });
    let n = 0; const filter = Array.prototype.filter;
    Array.prototype.filter = function (f) { if (String(f).replace(/\s/g, "") === "p=>!p.dimension") n++; return filter.call(this, f); };
    try { for (let i = 0; i < 10; i++) { s.tick(); drain(s); } } finally { Array.prototype.filter = filter; }
    return { n, pos: [...s.players.values()].map((p) => [p.position.x, p.position.y, p.position.z].join("|")) };
  });
  const off = run("off"), on = run("on"), ver = run("verify");
  assert.ok(off.n >= 10, `off built ${off.n}`);
  assert.ok(on.n < off.n, `on built ${on.n}, off ${off.n}`);
  assert.deepEqual(on.pos, off.pos); assert.deepEqual(ver.pos, off.pos);
});

test("ChunkSet.chunks gives the same lists in every mode across moves, and an unchanged call returns the kept list without map calls", () => {
  const world = { size: 128, originX: 0, originZ: 0 };
  const seq = [[{ x: 10, z: 10 }], [{ x: 10.5, z: 11 }], [{ x: 40, z: 10 }], [{ x: 40, z: 10 }, { x: 90, z: 90 }], [{ x: 40, z: 10 }, { x: 90, z: 90 }], [], [{ x: 10, z: 10 }]];
  const out = {};
  for (const m of modes) out[m] = withMode(m, () => { const c = new ChunkSet(); return seq.map((p) => JSON.stringify(c.chunks(p, world, 3))); });
  assert.deepEqual(out.on, out.off); assert.deepEqual(out.verify, out.off);
  withMode("on", () => {
    const c = new ChunkSet(), a = c.chunks([{ x: 10, z: 10 }], world, 3);
    const map = Array.prototype.map; let n = 0; Array.prototype.map = function (...x) { n++; return map.apply(this, x); };
    try { assert.equal(c.chunks([{ x: 11, z: 12 }], world, 3), a); } finally { Array.prototype.map = map; }
    assert.equal(n, 0);
    assert.notEqual(c.chunks([{ x: 10, z: 10 }], world, 4), a); // another radius is a different answer
  });
  withMode("off", () => { const c = new ChunkSet(); c.chunks([{ x: 10, z: 10 }], world, 3); });
  const c = new ChunkSet(); // switching modes never serves a stale list
  withMode("on", () => c.chunks([{ x: 10, z: 10 }], world, 3));
  withMode("off", () => c.chunks([{ x: 90, z: 90 }], world, 3));
  assert.equal(JSON.stringify(withMode("on", () => c.chunks([{ x: 10, z: 10 }], world, 3))), JSON.stringify(new ChunkSet().chunks([{ x: 10, z: 10 }], world, 3)));
});

test("deliverSounds delivers the same sounds in every mode with several sounds", () => {
  const result = {};
  for (const m of modes) withMode(m, () => {
    const s = buildPlayersScene({ players: 3, mobs: 0, seed: 3 });
    const ps = [...s.players.values()], at = ps[0].position;
    for (const p of ps.slice(1)) { p.position.x = at.x + 1; p.position.y = at.y; p.position.z = at.z; p.soundsOut = []; }
    ps[0].soundsOut = [];
    for (const n of ["a", "b", "c"]) s.soundsOut.push({ name: n, x: at.x, y: at.y, z: at.z, volume: 1, pitch: 1, except: n === "b" ? ps[0].id : null, dim: 0 });
    s.deliverSounds();
    result[m] = ps.map((p) => p.soundsOut.map((x) => x.name).join(","));
  });
  assert.deepEqual(result.on, result.off); assert.deepEqual(result.verify, result.off);
  assert.equal(result.off[0], "a,c");
});

test("bench hashes are identical off / on / verify and the bench prints mode99", () => {
  const h = (s) => s.slice(s.indexOf("["));
  for (const scene of [["--scene=pen", "--mobs=20"], ["--scene=travel"]]) {
    const out = modes.map((m) => spawnSync(process.execPath, ["tools/bench-alloc81.mjs", ...scene, "--state", "--ticks=50"], { env: { ...process.env, MC_MPPERF99: m }, encoding: "utf8" }).stdout);
    modes.forEach((m, i) => assert.match(out[i], new RegExp(`mode99=${m} (mode100=\\w+ )?(mode101=\\w+ )?mobs=\\d+ \\[`)));
    assert.equal(h(out[1]), h(out[0])); assert.equal(h(out[2]), h(out[0]));
  }
});
