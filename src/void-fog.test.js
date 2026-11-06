// Replays public/research/void-fog-reference.json (tools/probes/VoidFogProbe.java via tools/verify-void-fog.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { hasVoidParticles, voidFogYFactor, voidFogFar, voidParticleSpawns } from "./void-fog.js";
import { adjustFogColor } from "./potion-fx.js";
import { displayTicks } from "./display-ticks.js";

const ref = JSON.parse(await readFile(new URL("../public/research/void-fog-reference.json", import.meta.url)));
const rec = (c) => ref.records.filter((r) => r.case === c);

test("provider void flags and Y factor match the original WorldProviders", () => {
  for (const r of rec("provider")) {
    assert.equal(hasVoidParticles({ worldType: r.worldType, dimension: r.dimension }), r.hasVoid, JSON.stringify(r));
    assert.equal(voidFogYFactor(r.worldType), r.factor);
  }
});
test("fog colour scale below the void line", () => {
  for (const r of rec("color")) {
    const out = adjustFogColor([1, 1, 1], { feetY: r.y, voidFactor: voidFogYFactor(r.worldType) });
    assert.ok(Math.abs(out[0] - r.scale) <= 1e-6, `${r.worldType} y ${r.y}: ${out[0]} vs ${r.scale}`);
  }
});
test("setupFog far plane shrinks near the void", () => {
  for (const r of rec("far")) assert.equal(voidFogFar({ far: r.far, skyLight: r.sky, y: r.y }), r.result, JSON.stringify(r));
  assert.equal(voidFogFar({ far: 128, skyLight: 0, y: 0, creative: true }), 128);
  assert.equal(voidFogFar({ far: 128, skyLight: 0, y: 0, hasVoid: false }), 128);
});
test("depthsuspend roll condition", () => {
  for (const r of rec("particle")) assert.equal(voidParticleSpawns(r.roll, r.y), r.spawns, JSON.stringify(r));
});
test("displayTicks spawns no depthsuspend when the provider has no void particles", () => {
  const spawned = [];
  const world = { get: () => 0, getMeta: () => 0 };
  const rand = { n: 0, nextInt(k) { return (this.n++ * 7) % k; }, nextFloat() { return 0.5; } };
  displayTicks(world, 0, 0, 0, { rand, fx: { spawn: (k) => spawned.push(k) }, voidFog: false });
  assert.equal(spawned.length, 0);
  displayTicks(world, 0, 0, 0, { rand, fx: { spawn: (k) => spawned.push(k) }, voidFog: true });
  assert.ok(spawned.length > 0);
});
