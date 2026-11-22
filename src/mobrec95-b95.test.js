// Batch 95 mobrec95: executed mob records on the unchanged 1.7.10 classes.
//  - tools/probes/EndermanWolfProbe.java set b95mr (EndermanWolfScenarios.run95; `EW_SET=b95mr node tools/verify-endermanwolf.mjs` ->
//    public/research/enderman-wolf-b95mr-{,pigman-,sheep-,squid-}reference.json): long pigman and giant fights, sheep and squid.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { reference95, replayEndermanWolf, firstDivergence } from "./enderman-wolf-replay.js";

const recs = reference95.records, by = (s) => recs.find((r) => r.name.includes(s));
const src = (f) => readFileSync(new URL(f, import.meta.url), "utf8");

test("mobrec95: the b95mr references hold 31 executed records (pigman and giant fights, sheep, squid)", () => {
  assert.equal(recs.length, 31);
  for (const k of ["pigman-giant", "giant-pigmen", "giant-zombie", "zombie-giant", "giant-player", "pigman-group-player", "sheep-breed", "squid"]) assert.ok(recs.some((r) => r.name.includes(k)), k);
});
for (const r of recs) {
  test(`mobrec95: ${r.name} replays with no divergence`, () => {
    assert.equal(JSON.stringify(firstDivergence(r, replayEndermanWolf(r))), "null", r.name);
  });
}
test("mobrec95: firstDivergence catches a changed row", () => {
  const r = recs[0], bad = structuredClone(r);
  bad.rows[100][0][0][3] += 1;
  assert.notEqual(JSON.stringify(firstDivergence(bad, replayEndermanWolf(r))), "null");
});

test("mobrec95 giant: its entityAge is the idle counter, so the despawn roll draws nextInt(800) at the native tick (Executed giant-zombie, pigman-giant)", () => {
  const e = src("./entities.js");
  assert.match(e, /st\.entityAge = e\.idle \|\| 0;/);
  assert.match(e, /e\.idle = st\.entityAge;/);
});
test("mobrec95 sheep shear: the wool count and drop offsets come from the sheep's own Random (Executed sheep-shear)", () => {
  assert.match(src("./entities.js"), /const r=entityRandom\(e\),n=1\+r\.nextInt\(3\);e\.sheared=true;/);
});
test("mobrec95 replay: the grass the lamb eats is a changed cell and tall grass has no collision box", () => {
  const s = src("./enderman-wolf-replay.js");
  assert.match(s, /ev\.eatGrass\) cells\.push/);
  assert.match(s, /PISTON_MOVING, 39\]/);
});
test("mobrec95 sheep breed: a lamb whose parents mix no dye takes a colour from World.rand.nextBoolean (Executed sheep-breed-9815)", () => {
  assert.match(src("./entities.js"), /wr\.nextBoolean\(\)\?0:1/);
});
