// Batch 96 mobrec96: executed mob records on the unchanged 1.7.10 classes.
//  - tools/probes/EndermanWolfProbe.java set b96mr (EndermanWolfScenarios.run96; `EW_SET=b96mr node tools/verify-endermanwolf.mjs` ->
//    public/research/enderman-wolf-b96mr-{,pig-,chicken-,sheep-}reference.json): cows, mooshrooms, pigs, chickens, sheep shears, bats.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { reference96, replayEndermanWolf, firstDivergence } from "./enderman-wolf-replay.js";

const recs = reference96.records;
const src = (f) => readFileSync(new URL(f, import.meta.url), "utf8");

test("mobrec96: the b96mr references hold 65 executed records (cows, mooshrooms, pigs, chickens, sheep shears, bats)", () => {
  assert.equal(recs.length, 65);
  for (const k of ["cow", "mooshroom", "pig", "chicken", "sheep", "bat"]) assert.ok(recs.some((r) => r.name.includes(k)), k);
});
for (const r of recs) {
  test(`mobrec96: ${r.name} replays with no divergence`, () => {
    assert.equal(JSON.stringify(firstDivergence(r, replayEndermanWolf(r))), "null", r.name);
  });
}
test("mobrec96: firstDivergence catches a changed row", () => {
  const r = recs[0], bad = structuredClone(r);
  bad.rows[100][0][0][3] += 1;
  assert.notEqual(JSON.stringify(firstDivergence(bad, replayEndermanWolf(r))), "null");
});

test("mobrec96 breeding: the baby spawn drops ONE experience orb of nextInt(7)+1 (Executed cow, pig, chicken breeding)", () => {
  assert.match(src("./entities.js"), /xp:1\+rand\.nextInt\(7\),xpWhole:true/);
  assert.match(src("./experience.js"), /spawn\(value,p,whole=false\)/);
  assert.match(src("./living-simulation.js"), /event\.xp, event\.position, event\.xpWhole/);
  assert.match(src("./multiplayer/server-mobs.js"), /xpWhole/);
});
test("mobrec96 shears: breaking the shears draws the break-sound pitch from the world Random (Executed shears 237/238)", () => {
  assert.match(src("./entities.js"), /survival\.wear\(id,1\)\)\(this\.worldRandom\?\?=new JavaRandom/);
  assert.match(src("./mooshroom-golem-live.js"), /worldRandom/);
});
test("mobrec96 growth: a calf, piglet or chick that grows up widens its box and nudges (Executed calf, piglet, chick growth)", () => {
  assert.match(src("./entities.js"), /resizeBox\(e, b\.width \* 0\.5, b\.height \* 0\.5, b\.width, b\.height, this\.world\); this\.moveSteps\(e, from\)/);
});
