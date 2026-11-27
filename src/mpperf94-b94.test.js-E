// Batch 94 mpperf94: MC_MPPERF94 off / on / verify give the same legacyThink results and bench states; the shared legacyThink environment is used and falls back when taken.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fast94, createLegacyEnv94, sameEnv94, keptCopy94 } from "./mpperf94-fast.js";
import { buildPlayersScene, drain, lcg } from "./mpperf77-scene.js";

const withMode = (mode, fn) => { const was = fast94.mode; fast94.mode = mode; try { return fn(); } finally { fast94.mode = was; } };

test("shared environment: bound for one call, null when taken or off, released after", () => {
  const sh = createLegacyEnv94(() => {}, () => 0);
  const ctx = () => [{ ai: {} }, { x: 1 }, { height: 1.8 }, null, {}, {}, {}, false, false, 1, null, { nextInt: () => 0 }];
  withMode("on", () => {
    const env = sh.bind(...ctx());
    assert.ok(env); assert.equal(env.rand.nextInt(1), 0);
    assert.equal(sh.bind(...ctx()), null, "an outer call holds it");
    sh.release();
    assert.equal(env.rand, null);
    assert.ok(sh.bind(...ctx())); sh.release();
  });
  withMode("off", () => assert.equal(sh.bind(...ctx()), null));
});

test("sameEnv94 notices a differing answer", () => {
  const p = { alive: true, left: false }, e = { x: 1, y: 2, z: 3, eyeHeight: 1, alive: true };
  const mk = (alive) => ({ remote: false, closestPlayer: () => p, lookGone: () => false, isAlive: () => alive, isCreative: () => false, eyeHeight: () => 1, boxMidY: (x) => x.y, pathWeight: () => 0 });
  sameEnv94(mk(true), mk(true), e, p, null);
  assert.throws(() => sameEnv94(mk(true), mk(false), e, p, null), /mpperf94/);
});

test("keptCopy94 builds the comparison copy only for the mpperf81 verify mode or with the flag off", () => {
  withMode("on", () => { assert.equal(keptCopy94("on"), false); assert.equal(keptCopy94("off"), false); assert.equal(keptCopy94("verify"), true); });
  withMode("off", () => assert.equal(keptCopy94("on"), true));
});

test("a night scene with spiders ticks the same in off / on / verify and uses the shared environment", () => {
  const run = (mode) => withMode(mode, () => {
    const rs = lcg(777), was = Math.random; Math.random = () => rs();
    try {
      fast94.binds = 0;
      const s = buildPlayersScene({ players: 3, layout: "cluster", mobs: 60, seed: 4 }), out = [];
      for (let i = 0; i < 60; i++) { s.tick(); out.push(JSON.stringify(drain(s))); }
      out.push(JSON.stringify(s.mobs.mobs.entities.map((e) => [e.type, e.x, e.y, e.z, e.health, e.rotationYaw])));
      return { out: out.join("\n"), binds: fast94.binds };
    } finally { Math.random = was; }
  });
  const off = run("off"), on = run("on"), ver = run("verify");
  assert.equal(off.binds, 0); assert.ok(on.binds > 0, "spiders thought through the shared environment"); assert.ok(ver.binds > 0);
  assert.equal(on.out, off.out); assert.equal(ver.out, off.out);
});

test("bench state hashes are identical off / on / verify and the bench prints mode94", () => {
  const hash = (m, scene) => spawnSync(process.execPath, ["tools/bench-alloc81.mjs", `--scene=${scene}`, "--state", "--ticks=100", "--mobs=70"], { env: { ...process.env, MC_MPPERF94: m }, encoding: "utf8" }).stdout.trim().split("mobs=").pop();
  for (const scene of ["pen", "travel", "terrain"]) {
    const off = hash("off", scene);
    assert.match(off, /\[".{16}",".{16}"\]$/);
    assert.equal(hash("on", scene), off, scene); assert.equal(hash("verify", scene), off, scene);
  }
  assert.match(spawnSync(process.execPath, ["tools/bench-alloc81.mjs", "--scene=pen", "--state", "--ticks=50", "--mobs=20"], { env: { ...process.env, MC_MPPERF94: "off" }, encoding: "utf8" }).stdout, /mode94=off/);
});
