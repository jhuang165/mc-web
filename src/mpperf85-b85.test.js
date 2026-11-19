// Batch 85 mpperf85: MC_MPPERF85 off / on / verify give the same tracker, meta-diff and target-list results.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fast85 } from "./mpperf85-fast.js";
import { copyMetaDiff, copyMetaOf } from "./copy-meta.js";
import { mobTargets } from "./projectiles.js";

const withMode = (mode, fn) => { const was = fast85.mode; fast85.mode = mode; try { return fn(); } finally { fast85.mode = was; } };

test("copyMetaDiff: same diffs and same last in every mode", () => {
  const mobs = () => [
    { type: "cow", health: 10, air: 300, fire: 0 }, { type: "squid", health: 10, air: 100 }, { type: "enderman", health: 40, screaming: true, fire: 1 },
    { type: "wither", health: 300, invul: 20 }, { type: "zombie", health: NaN }, { type: "pig", health: 10, effects: [{ id: 1, amplifier: 0, duration: 100 }], air: undefined }, { health: 3 },
  ];
  const run = (mode) => withMode(mode, () => mobs().map((e) => {
    const last = copyMetaOf(e) ?? {}, seq = [];
    seq.push(copyMetaDiff(last, e));
    e.fire = 5; e.air = 120; e.screaming = false; e.invul = 0; e.health = 7; e.effects = [{ id: 14, amplifier: 0, duration: 50 }];
    seq.push(copyMetaDiff(last, e), copyMetaDiff(last, e));
    return JSON.stringify([seq, last]);
  }));
  const off = run("off");
  assert.deepEqual(run("on"), off);
  assert.deepEqual(run("verify"), off);
});

test("mobTargets: the same records with or without the one-element lists", () => {
  const mk = () => [{ type: "cow", x: 1, y: 2, z: 3, growingAge: 0 }, { type: "pig", x: -4, y: 5, z: 6, growingAge: -100 }, { type: "zombie", x: 0, y: 0, z: 0, growingAge: 0 }];
  const out = (mode) => withMode(mode, () => JSON.stringify(mobTargets(mk(), { x: 1, y: 1, z: 1 }), (k, v) => (k === "ref" ? v.type ?? "thrower" : v)));
  assert.equal(out("on"), out("off"));
  assert.equal(out("verify"), out("off"));
});

test("seeded server scenes hash the same off / on / verify", () => {
  const hash = (m) => spawnSync(process.execPath, ["tools/bench-alloc81.mjs", "--scene=pen", "--state", "--ticks=100", "--mobs=60"], { env: { ...process.env, MC_MPPERF85: m, MC_MPPERF84: m, MC_MPPERF83: m }, encoding: "utf8" }).stdout.trim().split("mobs=").pop();
  const off = hash("off");
  assert.match(off, /^\d+ \[/);
  assert.equal(hash("on"), off);
  assert.equal(hash("verify"), off);
});
