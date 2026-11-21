// Batch 94 mobrec94: executed mob records on the unchanged 1.7.10 classes.
//  - tools/probes/EndermanWolfProbe.java set b94mr (EndermanWolfScenarios.run94; `EW_SET=b94mr node tools/verify-endermanwolf.mjs` ->
//    public/research/enderman-wolf-b94mr-reference.json (wither) and enderman-wolf-b94mr-pigman-reference.json (pigman group anger, giants)).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { reference94, replayEndermanWolf, firstDivergence } from "./enderman-wolf-replay.js";

const recs = reference94.records, by = (s) => recs.find((r) => r.name.includes(s));
const src = (f) => readFileSync(new URL(f, import.meta.url), "utf8");

test("mobrec94: the b94mr references hold 18 executed records (wither blue skulls, armour, block breaking, regeneration; pigman anger; giants)", () => {
  assert.equal(recs.length, 18);
  assert.match(reference94.method, /Batch 94/);
  for (const k of ["wither-blue", "wither-armor-arrow", "wither-break", "wither-regen", "pigman-group", "pigman-attacker", "giant-attacker", "giant-pigman"]) assert.ok(recs.some((r) => r.name.includes(`-${k}`)), k);
});
for (const r of recs) {
  test(`mobrec94: ${r.name} replays with no divergence`, () => {
    assert.equal(JSON.stringify(firstDivergence(r, replayEndermanWolf(r))), "null", r.name);
  });
}
test("mobrec94: firstDivergence catches a changed row", () => {
  const r = by("wither-regen-9631"), bad = structuredClone(r);
  bad.rows[100][0][0][3] += 1;
  assert.notEqual(JSON.stringify(firstDivergence(bad, replayEndermanWolf(r))), "null");
});

test("mobrec94 wither armour: an arrow shot from a bow refuses damage below half health (Executed armor-arrow-9611, plain-arrow-9612)", () => {
  assert.match(src("./bow.js"), /\{ projectile: true, directArrow: true, shooter:/);
  assert.match(src("./wither-boss-mobs.js"), /armored\(e\.health\) && \(source\.arrow \|\| source\.directArrow \|\| name === "arrow"\)/);
});
test("mobrec94 wither block breaking: the drops roll on World.rand, not the wither's own Random (Executed break-9621, break-twice-9622)", () => {
  const w = src("./wither-boss-mobs.js");
  assert.match(w, /const wrand = m\.worldRandom/);
  assert.match(w, /explosionDrops\(id, meta, x, y, z, 1, wrand\)/);
});
test("mobrec94 wither effect kill: no AI step and no ambient sound roll for a mob killed in its own potion step (Executed hit-9613, cross-9633)", () => {
  const e = src("./entities.js");
  assert.match(e, /if \(e\.health <= 0\) \{ e\.jumping = false; e\.moveStrafing = 0; e\.moveForward = 0; return; \}/);
  assert.match(e, /this\.curedLive !== e && e\.health > 0\) this\.talk\(e\)/);
});
test("mobrec94 blue skulls: a blast carries `blue` so obsidian and the other 0.8-capped blocks break (Executed blue-9601, blue-9602)", () => {
  assert.match(src("./enderman-wolf-replay.js"), /blue: !!x\.blue/);
});
