// Batch 90 mobrec90: executed mob records on the unchanged 1.7.10 classes.
//  - tools/probes/EndermanWolfProbe.java set b90mr (EndermanWolfScenarios.run90, `EW_SET=b90mr node tools/verify-endermanwolf.mjs` -> public/research/enderman-wolf-b90mr-reference.json):
//    a blaze fighting a probe EntityPlayerMP that is shot, put in creative mode or killed. Row element 11 = [Entity.rand draws on the world's Random so far].
//  - tools/probes/VillageFightProbe.java b90- records (`VF_PREFIX=b90- node tools/verify-village-fight.mjs` -> public/research/village-fight-b90-reference.json):
//    a skeleton jockey on a spider that climbs a stone ring; mathRandom holds the knockback nudge of the rider's own arrow.
import test from "node:test";
import assert from "node:assert/strict";
import { reference90, replayEndermanWolf, firstDivergence } from "./enderman-wolf-replay.js";
import { replayFight, firstDivergence as fightDivergence, fightReference90 } from "./village-fight-replay.js";
import { sourceEntity } from "./revenge-target.js";
import { readFileSync } from "node:fs";

const recs = reference90.records, by = (s) => recs.find((r) => r.name.includes(s));
const target = (r) => r.rows.map((row) => row[0][0][4]); // the blaze's entityToAttack index (1 = the player, -1 none)

test("mobrec90: the b90mr reference holds 8 executed blaze records with the world random draw count", () => {
  assert.equal(recs.length, 8);
  assert.match(reference90.method, /Batch 90/);
  for (const r of recs) assert.ok(r.rows.every((row) => Array.isArray(row[11]) && row[11].length === 1), r.name);
});
for (const r of recs) {
  test(`mobrec90: ${r.name} replays with no divergence`, () => {
    assert.equal(JSON.stringify(firstDivergence(r, replayEndermanWolf(r))), "null", r.name);
  });
}
test("mobrec90: firstDivergence catches a changed world random count", () => {
  const r = by("shot-9001"), bad = structuredClone(r); bad.rows[100][11][0] = 2;
  assert.deepEqual(firstDivergence(bad, replayEndermanWolf(r)).slice(0, 2), [100, "world random draws"]);
});

test("mobrec90 blaze shot sound: the server draws nothing from the world random across the whole fight (Executed); the port does not either", () => {
  for (const n of ["shot-9001", "shot-9002"]) {
    const r = by(n);
    assert.ok(r.rows.some((row) => row[1].length > 0), `${n} has sounds`);
    assert.ok(r.rows.every((row) => row[11][0] === 0), `${n}: world random untouched`);
  }
  // the aux event pitch is the client's own draw: levelEvent takes a separate client random, not m.worldRandom
  const src = readFileSync(new URL("./blaze-ghast-mobs.js", import.meta.url), "utf8"), le = src.slice(src.indexOf("levelEvent"));
  assert.match(le, /clientAuxRandom \?\?= new JavaRandom/);
  assert.match(le, /pitch: ghastPitch\(m\.clientAuxRandom\)/);
});

test("mobrec90 blaze hover: a creative or dead player stays the target through the hover read until td.bq clears it (Executed)", () => {
  // td.bq clears the target on the tick of the creative switch or the death, AFTER xx.e's hover has read it (the replay of these records compares the blaze's motion and shots every tick)
  for (const n of ["creative-9011", "dead-9021"]) {
    const t = target(by(n));
    assert.equal(t[59], 1, `${n}: target held until the switch`);
    assert.equal(t[60], -1, `${n}: cleared by td.bq on tick 60`);
  }
  assert.ok(!/st\.target === p && !\(p\?\.alive/.test(readFileSync(new URL("./blaze-ghast-mobs.js", import.meta.url), "utf8")), "the port no longer clears it before the hover read");
});

test("mobrec90 look target: a dead player is the closest player until Entity.isDead (deathTime 20), the pitch uses the float 1.62 (Executed)", () => {
  const src = readFileSync(new URL("./blaze-ghast-mobs.js", import.meta.url), "utf8");
  assert.match(src, /lookGone/);
  assert.match(src, /deadTicks \?\? 0\) > 20/);
  assert.doesNotMatch(src, /st\.target === p && !\(p\?\.alive/);
});

// --- spider jockey
const fights = fightReference90.records;
test("mobrec90 jockey: five executed records with a skeleton riding a spider, mathRandom recorded", () => {
  assert.equal(fights.length, 5);
  for (const r of fights) { assert.equal(r.types, "VVG"); assert.deepEqual(r.mobs.map((m) => m[1]), [0, 1], r.name); }
  assert.ok(fights.filter((r) => r.mathRandom.length > 0).length >= 4);
});
for (const r of fights) {
  test(`mobrec90 jockey: ${r.name} replays with no divergence (climb, rider seat, revenge and attack target)`, () => {
    assert.equal(JSON.stringify(fightDivergence(r, replayFight(r))), "null", r.name);
  });
}
test("mobrec90 jockey: its own arrow makes the rider its own revenge target but never its attack target (Executed: 2231 tick 198)", () => {
  const r = fights.find((x) => x.name.endsWith("-2231"));
  const sk = r.rows.map((row) => row[7][1]);
  assert.equal(sk[197][5], -1);
  assert.equal(sk[198][5], 5, "revenge target = itself");
  assert.equal(sk[198][4], 3, "attack target stays the player");
  const a = { type: "skeleton" };
  assert.equal(sourceEntity({ entities: [a] }, a, { shooter: a }), a, "an arrow's shooter is the revenge entity even when it is the victim");
});
